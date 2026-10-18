import { describe, expect, it } from 'vitest';
import { EngineInput, Money, Rate, Rule } from '../src/index.ts';

describe('montants et taux (R6)', () => {
  it('accepte entiers et chaînes décimales', () => {
    expect(Money.parse(3_500_000)).toBe(3_500_000n);
    expect(Money.parse('3500000')).toBe(3_500_000n);
  });
  it('refuse les flottants', () => {
    expect(() => Money.parse(1.5)).toThrow();
    expect(() => Money.parse('0.25')).toThrow();
    expect(() => Rate.parse({ num: 0.25, den: 1 })).toThrow();
  });
  it('un taux a un dénominateur strictement positif', () => {
    expect(() => Rate.parse({ num: 1, den: 0 })).toThrow();
    expect(Rate.parse({ num: '1', den: '4' })).toEqual({ num: 1n, den: 4n });
  });
});

describe('entrées', () => {
  it('« Je ne sais pas » est une réponse valide', () => {
    expect(EngineInput.parse({ donations: 'UNKNOWN', cdiHires: 'UNKNOWN' })).toEqual({ donations: 'UNKNOWN', cdiHires: 'UNKNOWN' });
  });
  it('refuse un don négatif ou un effectif non entier', () => {
    expect(() => EngineInput.parse({ donations: -1 })).toThrow();
    expect(() => EngineInput.parse({ cdiHires: 1.5 })).toThrow();
  });
});

describe('règle', () => {
  const pending = {
    id: 'r', concept: 'IS_RATE', label: 'Taux', kind: 'REAL', status: 'PENDING', article: null, page: null,
    effectiveDate: null, source: null, author: 'a', version: 1, validations: [], params: null, sourceToObtain: 'CGI',
  };
  it('accepte une entrée EN ATTENTE sans valeur', () => {
    expect(Rule.parse(pending).status).toBe('PENDING');
  });
  it('refuse une valeur codée sur une règle EN ATTENTE (R7) ou une règle EN ATTENTE sans source à obtenir', () => {
    expect(() => Rule.parse({ ...pending, params: { rate: { num: 1, den: 4 } } })).toThrow();
    expect(() => Rule.parse({ ...pending, sourceToObtain: null })).toThrow();
  });
  it('refuse une règle hors EN ATTENTE sans article, page, date ou source', () => {
    expect(() => Rule.parse({ ...pending, status: 'DRAFT', sourceToObtain: null, params: { rate: { num: 1, den: 4 } } })).toThrow();
  });
  it('refuse une validation manquante pour LEGAL_VALIDATED / ACCOUNTING_VALIDATED', () => {
    const full = { ...pending, article: 'a', page: 1, effectiveDate: '2026-01-01', source: 's', params: { rate: { num: 1, den: 4 } } };
    expect(() => Rule.parse({ ...full, status: 'LEGAL_VALIDATED' })).toThrow();
    expect(() => Rule.parse({ ...full, status: 'ACCOUNTING_VALIDATED' })).toThrow();
    expect(() => Rule.parse({ ...full, status: 'CONFIRMED', validations: [] })).toThrow();
  });
});

import { ClientResultSchema, EngineResultSchema } from '../src/index.ts';

describe('schéma de sortie du moteur', () => {
  const base = {
    mode: 'CLIENT', asOf: '2026-10-18', registryVersion: 'v1.0.0', taxBefore: null, taxSources: [], taxAfterDeductions: null,
    levers: [{ id: 'DONATIONS', label: 'Dons', state: 'NOT_COMPUTABLE', gross: null, outflows: '4000000', net: null, creditExcess: null, reasons: [], sources: [] }],
    gross: { state: 'NOT_COMPUTABLE', missing: ['DONATIONS'] },
    outflows: { state: 'COMPLETE', value: '4000000' },
    unallocatedOutflows: { state: 'COMPLETE', value: '0' },
    net: { state: 'NOT_COMPUTABLE', missing: ['DONATIONS'] },
    commission: { state: 'NOT_COMPUTED', reason: { code: 'X', message: 'm' } },
    blockedRules: [], assumptions: [], warnings: [], disclaimer: 'Non-avis.',
  };
  const source = { ruleId: 'r', concept: 'IS_RATE', label: 'Taux', kind: 'REAL', status: 'CONFIRMED', article: 'A', page: 3, effectiveDate: '2026-01-01', source: 'S', registryVersion: 'v1.0.0' };

  it('lit les montants en bigint', () => {
    expect(EngineResultSchema.parse(base).outflows).toEqual({ state: 'COMPLETE', value: 4_000_000n });
  });
  it('accepte une sortie client saine', () => {
    expect(ClientResultSchema.safeParse(base).success).toBe(true);
  });
  it('refuse une sortie client avec source de TEST, hypothèse, faux montant ou montant sans source', () => {
    const lever = base.levers[0]!;
    const bad = (patch: object) => ClientResultSchema.safeParse({ ...base, ...patch }).success;
    expect(bad({ mode: 'INTERNAL' })).toBe(false);
    expect(bad({ levers: [{ ...lever, state: 'CALCULATED', gross: '1000', sources: [{ ...source, kind: 'TEST' }] }] })).toBe(false);
    expect(bad({ levers: [{ ...lever, state: 'CALCULATED', gross: '1000', sources: [{ ...source, status: 'DRAFT' }] }] })).toBe(false);
    expect(bad({ levers: [{ ...lever, state: 'CALCULATED', gross: '1000', sources: [] }] })).toBe(false);
    expect(bad({ levers: [{ ...lever, gross: '0' }] })).toBe(false);
    expect(bad({ assumptions: [{ ruleId: 'r', label: 'l', kind: 'REAL', status: 'DRAFT', message: 'm' }] })).toBe(false);
    expect(bad({ disclaimer: 'règle de TEST' })).toBe(false);
    expect(bad({ levers: [{ ...lever, state: 'CALCULATED', gross: '1000', sources: [source] }] })).toBe(true);
  });
  it('refuse un impôt sans source et une source d’impôt de TEST', () => {
    expect(ClientResultSchema.safeParse({ ...base, taxBefore: '2500000' }).success).toBe(false);
    expect(ClientResultSchema.safeParse({ ...base, taxBefore: '2500000', taxSources: [source] }).success).toBe(true);
    expect(ClientResultSchema.safeParse({ ...base, taxBefore: '2500000', taxSources: [{ ...source, kind: 'TEST' }] }).success).toBe(false);
  });
  it('refuse un montant flottant', () => {
    expect(EngineResultSchema.safeParse({ ...base, taxBefore: '1.5' }).success).toBe(false);
  });
});
