import { canonicalJson, sha256 } from './canonical.ts';

export interface AuditEntry {
  seq: number;
  at: string;
  actor: string;
  action: string;
  target: string;
  detail: unknown;
  prevHash: string | null;
  hash: string;
}

export type AuditLog = readonly AuditEntry[];

const body = (e: Omit<AuditEntry, 'hash'>): string => canonicalJson(e);

/** Journal en ajout seul : chaque entrée porte l'empreinte de la précédente. Renvoie un nouveau journal. */
export function appendAudit(
  log: AuditLog,
  entry: Pick<AuditEntry, 'at' | 'actor' | 'action' | 'target' | 'detail'>,
): AuditLog {
  const last = log.at(-1);
  const partial = { seq: (last?.seq ?? 0) + 1, ...entry, prevHash: last?.hash ?? null };
  return Object.freeze([...log, Object.freeze({ ...partial, hash: sha256(body(partial)) })]);
}

/** Vrai si aucune entrée n'a été modifiée, retirée ou réordonnée. */
export function verifyAudit(log: AuditLog): boolean {
  let prev: string | null = null;
  for (const [i, entry] of log.entries()) {
    const { hash, ...partial } = entry;
    if (entry.seq !== i + 1 || entry.prevHash !== prev || hash !== sha256(body(partial))) return false;
    prev = hash;
  }
  return true;
}
