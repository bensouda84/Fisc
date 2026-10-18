import { describe, expect, it } from 'vitest';
import { INPUT_KEYS, INPUT_LABEL_FR, describeAggregate, describeInput, formatMoney, visibleInputKeys } from '../src/index.ts';

describe('textes partagés par l’écran et le PDF', () => {
  it('décrit une saisie : montant, effectif, année, oui/non, « Je ne sais pas », non saisi', () => {
    expect(describeInput('profit', 40_000_000n)).toBe(formatMoney(40_000_000n));
    expect(describeInput('cdiHires', 2)).toBe('2');
    expect(describeInput('startupLabelYear', 2024)).toBe('2024');
    expect(describeInput('isStartup', 'YES')).toBe('Oui');
    expect(describeInput('vatAgri', 'NO')).toBe('Non');
    expect(describeInput('donations', 'UNKNOWN')).toBe('Je ne sais pas');
    expect(describeInput('fuelVat', undefined)).toBe('Non saisi');
  });

  it('décrit un total : complet, partiel avec sous-total, ou non calculable — jamais « 0 » pour une lacune', () => {
    expect(describeAggregate({ state: 'COMPLETE', value: 5n })).toBe(formatMoney(5n));
    expect(describeAggregate({ state: 'PARTIAL', subtotal: 5n, missing: ['x'] })).toContain('Partielle');
    expect(describeAggregate({ state: 'NOT_COMPUTABLE', missing: ['x'] })).toBe('Non calculable');
  });

  it('chaque question a un libellé en français', () => {
    for (const key of INPUT_KEYS) expect(INPUT_LABEL_FR[key].length).toBeGreaterThan(3);
  });

  it('les réponses dépendantes d’une porte « Non » ne sont ni demandées ni affichées', () => {
    expect(visibleInputKeys({})).not.toContain('startupLabelYear');
    expect(visibleInputKeys({ isStartup: 'NO' })).not.toContain('startupRegime');
    expect(visibleInputKeys({ isStartup: 'YES' })).toEqual(expect.arrayContaining(['startupLabelYear', 'startupRegime']));
    expect(visibleInputKeys({ vatAgri: 'NO' })).not.toContain('fuelVat');
    expect(visibleInputKeys({ vatAgri: 'YES' })).toContain('fuelVat');
  });
});
