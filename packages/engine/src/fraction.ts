import type { Rate } from '@fisc/schemas';

/**
 * Seul point d'arrondi du moteur (ADR-0004, règle À VALIDER) :
 * taux × montant, arrondi au franc le plus proche, demi vers le haut.
 */
export function mulRate(rate: Rate, amount: bigint): bigint {
  if (amount < 0n) throw new RangeError('mulRate: montant négatif');
  return (2n * rate.num * amount + rate.den) / (2n * rate.den);
}

export const max0 = (value: bigint): bigint => (value > 0n ? value : 0n);
export const min = (a: bigint, b: bigint): bigint => (a < b ? a : b);
