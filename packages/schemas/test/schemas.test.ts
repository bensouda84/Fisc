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
