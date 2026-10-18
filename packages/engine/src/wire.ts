/* eslint-disable @typescript-eslint/no-explicit-any -- frontière JSON non typée, validée par BigInt() */
import type { Aggregate, Commission, EngineResult, LeverResult } from '@fisc/schemas';

/** Les montants circulent en chaînes décimales dans le JSON (ADR-0004) ; ces fonctions les rétablissent en bigint. */
const big = (v: unknown): bigint | null => (v === null || v === undefined ? null : BigInt(v as string));
const must = (v: unknown): bigint => BigInt(v as string);

function reviveAggregate(w: any): Aggregate {
  if (w.state === 'COMPLETE') return { state: 'COMPLETE', value: must(w.value) };
  if (w.state === 'PARTIAL') return { state: 'PARTIAL', subtotal: must(w.subtotal), missing: w.missing };
  return { state: 'NOT_COMPUTABLE', missing: w.missing };
}

function reviveCommission(w: any): Commission {
  if (w.state === 'NOT_COMPUTED') return w;
  return { state: 'COMPUTED', base: must(w.base), excl: must(w.excl), vat: must(w.vat), incl: must(w.incl), capApplied: w.capApplied };
}

/** JSON de l'API → EngineResult. Lève si un montant n'est pas un entier décimal. */
export function reviveResult(wire: any): EngineResult {
  return {
    ...wire,
    taxBefore: big(wire.taxBefore),
    taxAfterDeductions: big(wire.taxAfterDeductions),
    levers: wire.levers.map(
      (l: any): LeverResult => ({ ...l, gross: big(l.gross), outflows: big(l.outflows), net: big(l.net), creditExcess: big(l.creditExcess) }),
    ),
    gross: reviveAggregate(wire.gross),
    outflows: reviveAggregate(wire.outflows),
    unallocatedOutflows: reviveAggregate(wire.unallocatedOutflows),
    net: reviveAggregate(wire.net),
    commission: reviveCommission(wire.commission),
  };
}

export const toWireJson = (value: unknown): string =>
  JSON.stringify(value, (_k, v: unknown) => (typeof v === 'bigint' ? v.toString() : v));
