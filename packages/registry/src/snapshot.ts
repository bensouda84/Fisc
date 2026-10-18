import { RegistrySnapshot, type Rule } from '@fisc/schemas';
import { canonicalJson, sha256 } from './canonical.ts';

/** Instantané immuable : l'empreinte couvre version, date et règles. */
export function publishSnapshot(rules: Rule[], version: string, publishedAt: string): RegistrySnapshot {
  const draft = RegistrySnapshot.parse({ version, publishedAt, rules, hash: null });
  const hash = sha256(canonicalJson({ version, publishedAt, rules: draft.rules }));
  return Object.freeze({ ...draft, hash });
}

export function verifySnapshot(snapshot: RegistrySnapshot): boolean {
  const { version, publishedAt, rules } = snapshot;
  return snapshot.hash === sha256(canonicalJson({ version, publishedAt, rules }));
}

export interface RuleChange {
  ruleId: string;
  change: 'ADDED' | 'REMOVED' | 'MODIFIED';
  fields: string[];
}

const COMPARED: (keyof Rule)[] = [
  'concept', 'label', 'kind', 'status', 'article', 'page', 'effectiveDate',
  'source', 'author', 'version', 'params', 'validations', 'sourceToObtain',
];

/** Comparaison entre deux versions du registre, champ par champ. */
export function diffSnapshots(before: RegistrySnapshot, after: RegistrySnapshot): RuleChange[] {
  const key = (r: Rule): string => r.id;
  const a = new Map(before.rules.map((r) => [key(r), r]));
  const b = new Map(after.rules.map((r) => [key(r), r]));
  const changes: RuleChange[] = [];
  for (const [id, rule] of b) {
    const old = a.get(id);
    if (old === undefined) {
      changes.push({ ruleId: id, change: 'ADDED', fields: [] });
      continue;
    }
    const fields = COMPARED.filter((f) => canonicalJson(old[f]) !== canonicalJson(rule[f]));
    if (fields.length > 0) changes.push({ ruleId: id, change: 'MODIFIED', fields });
  }
  for (const id of a.keys()) {
    if (!b.has(id)) changes.push({ ruleId: id, change: 'REMOVED', fields: [] });
  }
  return changes.sort((x, y) => x.ruleId.localeCompare(y.ruleId));
}
