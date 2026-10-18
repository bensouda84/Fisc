import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { simulate } from '../src/index.ts';
import { AS_OF, commercial, common, lever, pendingRule, snapshot } from './fixtures.ts';

const internal = { mode: 'INTERNAL', asOf: AS_OF } as const; // exercice 2026
const client = { mode: 'CLIENT', asOf: AS_OF } as const;
const startup = { ...common, isStartup: 'YES', startupLabelYear: 2024, startupRegime: 'YES' } as const;

describe('exonération startup (R08)', () => {
  it('S1 — labellisée en 2024, exercice 2026 (2025 à 2027) : l’impôt avant opérations est supprimé', () => {
    const r = simulate({ ...startup, donations: 0n, cdiHires: 0, apprentices: 0 }, snapshot('TEST'), commercial, internal);
    expect(r.taxBefore).toBe(10_000_000n);
    expect(lever(r, 'STARTUP_EXEMPTION')).toMatchObject({ state: 'CALCULATED', gross: 10_000_000n, net: 10_000_000n });
    expect(r.gross).toEqual({ state: 'COMPLETE', value: 10_000_000n });
    expect(r.taxAfterDeductions).toBe(0n);
    expect(r.commission).toMatchObject({ state: 'COMPUTED', excl: 2_000_000n, vat: 360_000n, incl: 2_360_000n });
  });

  it('S2 — avec dons et crédits : pas de double compte, dons et crédits à zéro, crédits non imputés', () => {
    const r = simulate({ ...startup, donations: 4_000_000n, cdiHires: 2, apprentices: 1 }, snapshot('TEST'), commercial, internal);
    expect(r.gross).toEqual({ state: 'COMPLETE', value: 10_000_000n });
    expect(lever(r, 'DONATIONS')).toMatchObject({ state: 'CALCULATED', gross: 0n, net: -4_000_000n });
    expect(lever(r, 'DONATIONS').reasons[0]?.code).toBe('ALREADY_EXEMPT');
    expect(lever(r, 'CREDIT_CDI')).toMatchObject({ state: 'CALCULATED', gross: 0n, creditExcess: 2_000_000n });
    expect(lever(r, 'CREDIT_APPRENTICE')).toMatchObject({ gross: 0n, creditExcess: 500_000n });
    expect(r.net).toEqual({ state: 'COMPLETE', value: 6_000_000n });
    expect(r.levers.reduce((sum, l) => sum + (l.gross ?? 0n), 0n)).toBe(10_000_000n);
  });

  it('S3 — hors période (labellisée en 2020 : 2021 à 2023), régime exclu ou pas startup : levier nul, le calcul habituel reprend', () => {
    for (const patch of [{ startupLabelYear: 2020 }, { startupLabelYear: 2026 }, { startupRegime: 'NO' }, { isStartup: 'NO' }] as const) {
      const r = simulate({ ...startup, ...patch, donations: 4_000_000n, cdiHires: 2, apprentices: 1 }, snapshot('TEST'), commercial, internal);
      expect(lever(r, 'STARTUP_EXEMPTION').state).toBe('NULL');
      expect(r.gross).toEqual({ state: 'COMPLETE', value: 3_500_000n });
    }
    const out = simulate({ ...startup, startupLabelYear: 2020 }, snapshot('TEST'), commercial, internal);
    expect(lever(out, 'STARTUP_EXEMPTION').reasons[0]?.code).toBe('OUTSIDE_EXEMPTION_PERIOD');
    expect(lever(out, 'STARTUP_EXEMPTION').reasons[0]?.message).toContain('2021 à 2023');
  });

  it('S4 — l’année de labellisation compte ou non selon la règle validée (paramètre includesLabelYear)', () => {
    const withYear = snapshot('TEST', { STARTUP_EXEMPTION: { params: { durationYears: 3, includesLabelYear: true, appliesToProfitTax: true } } as never });
    // Labellisée en 2026, exercice 2026 : couverte seulement si l'année de labellisation est incluse.
    const a = simulate({ ...startup, startupLabelYear: 2026 }, withYear, commercial, internal);
    expect(lever(a, 'STARTUP_EXEMPTION').state).toBe('CALCULATED');
    // Labellisée en 2023 : 2023 à 2025 → exercice 2026 hors période.
    const b = simulate({ ...startup, startupLabelYear: 2023 }, withYear, commercial, internal);
    expect(lever(b, 'STARTUP_EXEMPTION').state).toBe('NULL');
  });

  it('S5 — si la règle validée ne rattache pas le texte à l’impôt sur les sociétés, le levier est nul', () => {
    const snap = snapshot('TEST', { STARTUP_EXEMPTION: { params: { durationYears: 3, includesLabelYear: false, appliesToProfitTax: false } } as never });
    const r = simulate({ ...startup, donations: 4_000_000n, cdiHires: 2, apprentices: 1 }, snap, commercial, internal);
    expect(lever(r, 'STARTUP_EXEMPTION')).toMatchObject({ state: 'NULL', gross: 0n });
    expect(lever(r, 'STARTUP_EXEMPTION').reasons[0]?.code).toBe('EXEMPTION_NOT_FOR_THIS_TAX');
    expect(r.gross).toEqual({ state: 'COMPLETE', value: 3_500_000n });
  });

  it('S6 — « Je ne sais pas », donnée manquante ou règle non confirmée : non calculable, et l’impôt en dépend (jamais un faux zéro)', () => {
    const cases = [{ isStartup: 'UNKNOWN' }, { isStartup: undefined }, { startupLabelYear: 'UNKNOWN' }, { startupRegime: 'UNKNOWN' }, { startupLabelYear: undefined }] as const;
    for (const patch of cases) {
      const r = simulate({ ...startup, ...patch, donations: 4_000_000n, cdiHires: 2, apprentices: 1 } as never, snapshot('TEST'), commercial, internal);
      expect(lever(r, 'STARTUP_EXEMPTION')).toMatchObject({ state: 'NOT_COMPUTABLE', gross: null });
      for (const id of ['DONATIONS', 'CREDIT_CDI', 'CREDIT_APPRENTICE'] as const) {
        expect(lever(r, id)).toMatchObject({ state: 'NOT_COMPUTABLE', gross: null });
        expect(lever(r, id).reasons[0]?.code).toBe('DEPENDS_ON_STARTUP_LEVER');
      }
      expect(r.taxAfterDeductions).toBeNull();
      expect(r.gross.state).not.toBe('COMPLETE');
      expect(r.commission.state).toBe('NOT_COMPUTED');
    }
  });

  it('S7 — mode client, règle non confirmée : non calculable ; startup « Non » reste nul sans règle', () => {
    const snap = snapshot('REAL', { STARTUP_EXEMPTION: { status: 'DRAFT', validations: [] } });
    const r = simulate({ ...startup, donations: 4_000_000n }, snap, commercial, client);
    expect(lever(r, 'STARTUP_EXEMPTION').state).toBe('NOT_COMPUTABLE');
    expect(r.blockedRules).toContainEqual({ concept: 'STARTUP_EXEMPTION', ruleId: 'startup', status: 'DRAFT' });
    const no = simulate({ ...common, donations: 4_000_000n, cdiHires: 0, apprentices: 0 }, snap, commercial, client);
    expect(lever(no, 'STARTUP_EXEMPTION').state).toBe('NULL');
    expect(no.gross).toEqual({ state: 'COMPLETE', value: 1_000_000n });
  });

  it('S8 — mode client avec règle confirmée : sources du taux et de l’exonération (R2)', () => {
    const r = simulate({ ...startup, donations: 0n, cdiHires: 0, apprentices: 0 }, snapshot('REAL'), commercial, client);
    expect(lever(r, 'STARTUP_EXEMPTION').sources.map((s) => s.ruleId)).toEqual(['is-rate', 'startup']);
    expect(r.gross).toEqual({ state: 'COMPLETE', value: 10_000_000n });
  });

  it('S9 — sans taux de l’IS établi, l’exonération n’est pas chiffrée', () => {
    const snap = snapshot('TEST', { IS_RATE: pendingRule('is-rate', 'IS_RATE', 'TEST — taux IS en attente') });
    const r = simulate({ ...startup }, snap, commercial, internal);
    expect(lever(r, 'STARTUP_EXEMPTION')).toMatchObject({ state: 'NOT_COMPUTABLE', gross: null });
  });

  it('propriété — exonérée : l’économie fiscale brute totale égale l’impôt avant opérations, quels que soient dons et crédits', () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 0n, max: 10n ** 10n }), fc.bigInt({ min: 0n, max: 10n ** 9n }), fc.integer({ min: 0, max: 20 }), fc.integer({ min: 0, max: 20 }), (profit, donations, cdi, app) => {
        const r = simulate({ ...startup, profit, donations, cdiHires: cdi, apprentices: app }, snapshot('TEST'), commercial, internal);
        expect(r.gross).toEqual({ state: 'COMPLETE', value: r.taxBefore });
        expect(r.taxAfterDeductions).toBe(0n);
      }),
    );
  });
});

describe('TVA sur le carburant agricole (R11)', () => {
  const agri = { ...common, vatAgri: 'YES' } as const;

  it('V1 — conditions remplies : la TVA supportée est récupérée', () => {
    const r = simulate({ ...agri, fuelVat: 1_200_000n, donations: 0n, cdiHires: 0, apprentices: 0 }, snapshot('TEST'), commercial, internal);
    expect(lever(r, 'VAT_FUEL_RECOVERY')).toMatchObject({ state: 'CALCULATED', gross: 1_200_000n, net: 1_200_000n });
    expect(r.gross).toEqual({ state: 'COMPLETE', value: 1_200_000n });
  });

  it('V2 — plafond établi par la règle validée : appliqué (95 % de 1 200 000 = 1 140 000), jamais codé en dur', () => {
    const snap = snapshot('TEST', { VAT_FUEL_RECOVERY: { params: { capPercent: { num: '19', den: '20' } } } as never });
    const r = simulate({ ...agri, fuelVat: 1_200_000n, donations: 0n, cdiHires: 0, apprentices: 0 }, snap, commercial, internal);
    expect(lever(r, 'VAT_FUEL_RECOVERY').gross).toBe(1_140_000n);
  });

  it('V3 — conditions non remplies ou aucune TVA : levier nul', () => {
    const no = simulate({ ...common, fuelVat: 1_200_000n, donations: 0n, cdiHires: 0, apprentices: 0 }, snapshot('TEST'), commercial, internal);
    expect(lever(no, 'VAT_FUEL_RECOVERY')).toMatchObject({ state: 'NULL', gross: 0n });
    expect(lever(no, 'VAT_FUEL_RECOVERY').reasons[0]?.code).toBe('CONDITION_NOT_MET');
    const zero = simulate({ ...agri, fuelVat: 0n }, snapshot('TEST'), commercial, internal);
    expect(lever(zero, 'VAT_FUEL_RECOVERY')).toMatchObject({ state: 'NULL', gross: 0n });
  });

  it('V4 — « Je ne sais pas », donnée manquante : non calculable, jamais nul', () => {
    for (const patch of [{ vatAgri: 'UNKNOWN' }, { vatAgri: undefined }, { fuelVat: 'UNKNOWN' }, { fuelVat: undefined }] as const) {
      const r = simulate({ ...agri, fuelVat: 1_200_000n, ...patch } as never, snapshot('TEST'), commercial, internal);
      expect(lever(r, 'VAT_FUEL_RECOVERY')).toMatchObject({ state: 'NOT_COMPUTABLE', gross: null, net: null });
    }
  });

  it('V5 — mode client : règle non confirmée → non calculable ; confirmée → sourcée ; sans taux de l’IS, la TVA reste calculable (indépendante)', () => {
    const input = { ...agri, fuelVat: 1_200_000n, donations: 0n, cdiHires: 0, apprentices: 0 } as const;
    const pending = simulate(input, snapshot('REAL', { VAT_FUEL_RECOVERY: { status: 'DRAFT', validations: [] } }), commercial, client);
    expect(lever(pending, 'VAT_FUEL_RECOVERY').state).toBe('NOT_COMPUTABLE');
    expect(pending.blockedRules).toContainEqual({ concept: 'VAT_FUEL_RECOVERY', ruleId: 'vat-fuel', status: 'DRAFT' });
    const ok = simulate(input, snapshot('REAL'), commercial, client);
    expect(lever(ok, 'VAT_FUEL_RECOVERY')).toMatchObject({ state: 'CALCULATED', gross: 1_200_000n });
    expect(lever(ok, 'VAT_FUEL_RECOVERY').sources[0]).toMatchObject({ concept: 'VAT_FUEL_RECOVERY', kind: 'REAL', status: 'CONFIRMED' });
    const noRate = simulate(input, snapshot('REAL', { IS_RATE: { status: 'DRAFT', validations: [] } }), commercial, client);
    expect(lever(noRate, 'VAT_FUEL_RECOVERY').state).toBe('CALCULATED');
    expect(noRate.taxBefore).toBeNull();
  });

  it('V6 — les trois montants restent distincts : brut, décaissements, net, avec commission HT/TVA/TTC', () => {
    const r = simulate({ ...agri, fuelVat: 1_000_000n, donations: 0n, cdiHires: 0, apprentices: 0 }, snapshot('TEST'), commercial, internal);
    expect(r.net).toEqual({ state: 'COMPLETE', value: 1_000_000n });
    expect(r.commission).toMatchObject({ state: 'COMPUTED', excl: 200_000n, vat: 36_000n, incl: 236_000n });
  });
});
