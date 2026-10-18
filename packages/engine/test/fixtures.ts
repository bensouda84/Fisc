import { RegistrySnapshot, type CommercialParams, type EngineInput, type Rule } from '@fisc/schemas';

/** Toutes les données de ce fichier sont FICTIVES (R8). */

const base = {
  article: 'TEST-ART (fictif)',
  page: 1,
  effectiveDate: '2026-01-01',
  source: 'Jeu de données fictif — arithmétique uniquement',
  author: 'auteur-fictif',
  version: 1,
  validations: [],
  sourceToObtain: null,
} as const;

export type Overrides = Partial<Record<Rule['concept'], Partial<Rule>>>;

const confirmedValidations = [
  { role: 'LEGAL', validator: 'juriste-fictif', at: '2026-01-02T09:00:00Z' },
  { role: 'ACCOUNTING', validator: 'expert-fictif', at: '2026-01-02T10:00:00Z' },
] as const;

function rules(kind: 'TEST' | 'REAL', overrides: Overrides): unknown[] {
  const real = kind === 'REAL';
  const common = {
    ...base,
    kind,
    status: real ? 'CONFIRMED' : 'DRAFT',
    validations: real ? confirmedValidations : [],
  };
  const prefix = real ? 'FICTIF' : 'TEST';
  const list: Record<string, unknown>[] = [
    { ...common, id: 'is-rate', concept: 'IS_RATE', label: `${prefix} — taux IS 25 %`, params: { rate: { num: '1', den: '4' } } },
    { ...common, id: 'don', concept: 'DONATION_DEDUCTIBILITY', label: `${prefix} — dons déductibles`, params: { deductible: true } },
    { ...common, id: 'cdi', concept: 'CREDIT_CDI', label: `${prefix} — crédit CDI`, params: { amountPerHire: '1000000' } },
    { ...common, id: 'app', concept: 'CREDIT_APPRENTICE', label: `${prefix} — crédit apprenti`, params: { amountPerApprentice: '500000' } },
  ];
  return list.map((r) => ({ ...r, ...(overrides[r.concept as Rule['concept']] ?? {}) }));
}

export function snapshot(kind: 'TEST' | 'REAL', overrides: Overrides = {}): RegistrySnapshot {
  return RegistrySnapshot.parse({
    version: kind === 'TEST' ? 'test-0' : 'fictif-0',
    publishedAt: '2026-01-03T00:00:00Z',
    rules: rules(kind, overrides),
  });
}

export const pendingRule = (id: string, concept: Rule['concept'], label: string): Partial<Rule> =>
  ({
    id, concept, label, status: 'PENDING', params: null, article: null, page: null,
    effectiveDate: null, source: null, validations: [], sourceToObtain: 'CGI consolidé 2026',
  }) as unknown as Partial<Rule>;

export const commercial: CommercialParams = {
  commissionRate: { num: 1n, den: 5n },
  vatRate: { num: 9n, den: 50n },
  commissionCap: null,
  validated: true,
};

export const common: EngineInput = {
  profit: 40_000_000n,
  extraSalaries: 0n,
  otherOutflows: 0n,
};
export const AS_OF = '2026-10-18';
