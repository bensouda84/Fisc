import { RegistrySnapshot, Rule, type CommercialParams, CommercialParams as CommercialSchema } from '@fisc/schemas';
import { appendAudit, type AuditEntry } from '@fisc/registry';
import type { Db } from './db.ts';
import { toWire } from './wire.ts';

type Q = Pick<Db, 'query'>;

export interface UserRow {
  id: number;
  email: string;
  display: string;
  role: 'consultant' | 'client' | 'validator' | 'admin';
  specialty: 'LEGAL' | 'ACCOUNTING' | null;
  pass_hash: string;
}

export async function findUserByEmail(db: Q, email: string): Promise<UserRow | undefined> {
  return (await db.query<UserRow>('select * from users where email = $1', [email.toLowerCase()])).rows[0];
}

export async function findUserById(db: Q, id: number): Promise<UserRow | undefined> {
  return (await db.query<UserRow>('select * from users where id = $1', [id])).rows[0];
}

/** Dernière version de chaque règle. */
export async function latestRules(db: Q): Promise<Rule[]> {
  const { rows } = await db.query<{ data: unknown }>(
    'select distinct on (id) data from rule_version order by id, version desc',
  );
  return rows.map((r) => Rule.parse(r.data)).sort((a, b) => a.id.localeCompare(b.id));
}

export async function ruleHistory(db: Q, id: string): Promise<Rule[]> {
  const { rows } = await db.query<{ data: unknown }>('select data from rule_version where id = $1 order by version', [id]);
  return rows.map((r) => Rule.parse(r.data));
}

export async function saveRule(db: Q, rule: Rule): Promise<void> {
  await db.query('insert into rule_version(id, version, data) values ($1, $2, $3) on conflict (id, version) do update set data = excluded.data', [rule.id, rule.version, toWire(rule)]);
}

export async function currentSnapshot(db: Q): Promise<RegistrySnapshot | undefined> {
  const { rows } = await db.query<{ data: unknown }>('select data from registry_snapshot order by published_at desc, version desc limit 1');
  return rows[0] ? RegistrySnapshot.parse(rows[0].data) : undefined;
}

export async function snapshotByVersion(db: Q, version: string): Promise<RegistrySnapshot | undefined> {
  const { rows } = await db.query<{ data: unknown }>('select data from registry_snapshot where version = $1', [version]);
  return rows[0] ? RegistrySnapshot.parse(rows[0].data) : undefined;
}

export async function listSnapshots(db: Q): Promise<{ version: string; publishedAt: string; hash: string }[]> {
  const { rows } = await db.query<{ version: string; published_at: Date; hash: string }>(
    'select version, published_at, hash from registry_snapshot order by published_at desc, version desc',
  );
  return rows.map((r) => ({ version: r.version, publishedAt: r.published_at.toISOString(), hash: r.hash }));
}

export async function saveSnapshot(db: Q, snapshot: RegistrySnapshot): Promise<void> {
  await db.query('insert into registry_snapshot(version, published_at, hash, data) values ($1, $2, $3, $4)', [
    snapshot.version, snapshot.publishedAt, snapshot.hash, toWire(snapshot),
  ]);
}

/** Ajout au journal, sérialisé par verrou pour garder la chaîne d'empreintes intacte. */
export async function audit(
  db: Db,
  entry: { actor: string; action: string; target: string; detail: unknown },
  at: Date,
): Promise<void> {
  const client = await db.connect();
  try {
    await client.query('begin');
    await client.query('select pg_advisory_xact_lock(7001)');
    const last = (await client.query<{ seq: string; at: Date; actor: string; action: string; target: string; detail: unknown; prev_hash: string | null; hash: string }>(
      'select * from audit_log order by seq desc limit 1',
    )).rows[0];
    const previous: AuditEntry[] = last
      ? [{ seq: Number(last.seq), at: last.at.toISOString(), actor: last.actor, action: last.action, target: last.target, detail: last.detail, prevHash: last.prev_hash, hash: last.hash }]
      : [];
    const next = appendAudit(previous, { ...entry, at: at.toISOString() }).at(-1)!;
    await client.query(
      'insert into audit_log(seq, at, actor, action, target, detail, prev_hash, hash) values ($1,$2,$3,$4,$5,$6,$7,$8)',
      [next.seq, next.at, next.actor, next.action, next.target, toWire(next.detail), next.prevHash, next.hash],
    );
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function readAudit(db: Q): Promise<AuditEntry[]> {
  const { rows } = await db.query<{ seq: string; at: Date; actor: string; action: string; target: string; detail: unknown; prev_hash: string | null; hash: string }>(
    'select * from audit_log order by seq',
  );
  return rows.map((r) => ({ seq: Number(r.seq), at: r.at.toISOString(), actor: r.actor, action: r.action, target: r.target, detail: r.detail, prevHash: r.prev_hash, hash: r.hash }));
}

const DEFAULT_COMMERCIAL: CommercialParams = {
  commissionRate: { num: 1n, den: 5n },
  vatRate: { num: 9n, den: 50n },
  commissionCap: null,
  validated: false,
};

export async function getCommercial(db: Q): Promise<CommercialParams> {
  const { rows } = await db.query<{ value: unknown }>("select value from setting where key = 'commercial'");
  return rows[0] ? CommercialSchema.parse(rows[0].value) : DEFAULT_COMMERCIAL;
}

export async function setCommercial(db: Q, params: CommercialParams): Promise<void> {
  await db.query(
    "insert into setting(key, value) values ('commercial', $1) on conflict (key) do update set value = excluded.value",
    [toWire(params)],
  );
}
