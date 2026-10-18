import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  ClientOutputError,
  assertClientSafe,
  formatDate,
  formatMoney,
  mulRate,
  resolveRule,
  simulate,
} from '../src/index.ts';
import { AS_OF, commercial, common, snapshot } from './fixtures.ts';

const NBSP = ' ';

describe('format', () => {
  it('montants : espace insécable, sans décimale', () => {
    expect(formatMoney(3_500_000n)).toBe(`3${NBSP}500${NBSP}000${NBSP}F${NBSP}CFA`);
    expect(formatMoney(0n)).toBe(`0${NBSP}F${NBSP}CFA`);
    expect(formatMoney(-500_000n)).toBe(`−500${NBSP}000${NBSP}F${NBSP}CFA`);
  });
  it('dates en français', () => {
    expect(formatDate('2026-10-18')).toBe('18 octobre 2026');
    expect(formatDate('2026-01-01')).toBe('1er janvier 2026');
    expect(formatDate('2026-02-05')).toBe('5 février 2026');
    expect(() => formatDate('2026-13-01')).toThrow(RangeError);
  });
});

describe('mulRate', () => {
  it('arrondit au franc le plus proche, demi vers le haut', () => {
    expect(mulRate({ num: 1n, den: 4n }, 10n)).toBe(3n); // 2,5 → 3
    expect(mulRate({ num: 1n, den: 4n }, 9n)).toBe(2n); // 2,25 → 2
    expect(mulRate({ num: 1n, den: 3n }, 5n)).toBe(2n); // 1,67 → 2
  });
  it('refuse un montant négatif', () => {
    expect(() => mulRate({ num: 1n, den: 4n }, -1n)).toThrow(RangeError);
  });
  it('propriété : le résultat reste à moins d’un demi-franc du résultat exact', () => {
    fc.assert(
      fc.property(fc.bigInt({ min: 0n, max: 10n ** 12n }), fc.bigInt({ min: 0n, max: 100n }), fc.bigInt({ min: 1n, max: 100n }), (m, n, d) => {
        const r = mulRate({ num: n, den: d }, m);
        // |r − n·m/d| ≤ 1/2  ⇔  |2·d·r − 2·n·m| ≤ d
        const diff = 2n * d * r - 2n * n * m;
        return (diff < 0n ? -diff : diff) <= d;
      }),
    );
  });
});

describe('invariants du moteur (propriétés)', () => {
  const amount = fc.bigInt({ min: 0n, max: 10n ** 11n });
  const field = fc.oneof(amount, fc.constant('UNKNOWN' as const), fc.constant(undefined));
  const count = fc.oneof(fc.integer({ min: 0, max: 50 }), fc.constant('UNKNOWN' as const), fc.constant(undefined));
  const inputs = fc.record(
    { profit: fc.oneof(fc.bigInt({ min: -(10n ** 10n), max: 10n ** 11n }), fc.constant('UNKNOWN' as const), fc.constant(undefined)), donations: field, cdiHires: count, apprentices: count, extraSalaries: field, otherOutflows: field },
    { requiredKeys: [] },
  );

  it('net = brut − décaissements, commission ≥ 0, jamais de zéro à la place d’une lacune', () => {
    fc.assert(
      fc.property(inputs, fc.constantFrom('INTERNAL', 'CLIENT') as fc.Arbitrary<'INTERNAL' | 'CLIENT'>, fc.constantFrom('TEST', 'REAL') as fc.Arbitrary<'TEST' | 'REAL'>, (input, mode, kind) => {
        const r = simulate(input as never, snapshot(kind), commercial, { mode, asOf: AS_OF });
        if (r.gross.state === 'COMPLETE' && r.outflows.state === 'COMPLETE') {
          expect(r.net).toEqual({ state: 'COMPLETE', value: r.gross.value - r.outflows.value });
        }
        if (r.commission.state === 'COMPUTED') expect(r.commission.excl).toBeGreaterThanOrEqual(0n);
        for (const l of r.levers) {
          if (l.state === 'NOT_COMPUTABLE') expect([l.gross, l.net]).toEqual([null, null]);
          if (l.state !== 'NOT_COMPUTABLE') expect(l.gross).not.toBeNull();
        }
        if (r.gross.state === 'COMPLETE') {
          expect(r.gross.value).toBe(r.levers.reduce((s, l) => s + (l.gross ?? 0n), 0n));
        }
        if (mode === 'CLIENT') {
          expect(r.levers.flatMap((l) => l.sources).every((s) => s.kind === 'REAL' && s.status === 'CONFIRMED')).toBe(true);
          if (kind === 'TEST') expect(r.gross.state).not.toBe('COMPLETE');
        }
      }),
      { numRuns: 300 },
    );
  });
});

describe('garde-fou client', () => {
  const okResult = simulate({ ...common, donations: 1_000_000n, cdiHires: 0, apprentices: 0 }, snapshot('REAL'), commercial, { mode: 'CLIENT', asOf: AS_OF });

  it('laisse passer un résultat sain, ignore le mode interne', () => {
    expect(() => assertClientSafe(okResult)).not.toThrow();
    expect(() => assertClientSafe({ ...okResult, mode: 'INTERNAL', assumptions: [{ ruleId: 'x', label: 'x', kind: 'TEST', status: 'DRAFT', message: 'x' }] })).not.toThrow();
  });
  it('rejette une source de TEST, une hypothèse, un montant sans source, un levier non calculable chiffré', () => {
    const lever = okResult.levers.find((l) => l.id === 'DONATIONS')!;
    const src = lever.sources[0]!;
    expect(() => assertClientSafe({ ...okResult, levers: [{ ...lever, sources: [{ ...src, kind: 'TEST' }] }] })).toThrow(ClientOutputError);
    expect(() => assertClientSafe({ ...okResult, levers: [{ ...lever, sources: [{ ...src, status: 'DRAFT' }] }] })).toThrow(ClientOutputError);
    expect(() => assertClientSafe({ ...okResult, assumptions: [{ ruleId: 'x', label: 'x', kind: 'REAL', status: 'DRAFT', message: 'x' }] })).toThrow(ClientOutputError);
    expect(() => assertClientSafe({ ...okResult, levers: [{ ...lever, sources: [] }] })).toThrow(ClientOutputError);
    expect(() => assertClientSafe({ ...okResult, levers: [{ ...lever, state: 'NOT_COMPUTABLE' }] })).toThrow(ClientOutputError);
    expect(() => assertClientSafe({ ...okResult, taxSources: [] })).toThrow(ClientOutputError);
    expect(() => assertClientSafe({ ...okResult, taxSources: [{ ...src, kind: 'TEST' }] })).toThrow(ClientOutputError);
  });
});

describe('résolution des règles', () => {
  it('règle absente du registre', () => {
    const snap = { ...snapshot('TEST'), rules: [] };
    const res = resolveRule(snap, 'IS_RATE', 'INTERNAL', AS_OF);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason.code).toBe('RULE_MISSING');
  });
  it('en mode client, une règle REAL non confirmée est signalée avec son statut', () => {
    const res = resolveRule(snapshot('REAL', { IS_RATE: { status: 'DRAFT', validations: [] } }), 'IS_RATE', 'CLIENT', AS_OF);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.blocked).toEqual({ concept: 'IS_RATE', ruleId: 'is-rate', status: 'DRAFT' });
  });
  it('choisit la version en vigueur la plus récente', () => {
    const snap = snapshot('TEST');
    const older = { ...snap.rules[0]!, id: 'old', effectiveDate: '2025-01-01', params: { rate: { num: 3n, den: 10n } } };
    const res = resolveRule({ ...snap, rules: [older, ...snap.rules] } as never, 'IS_RATE', 'INTERNAL', AS_OF);
    expect(res.ok && res.rule.id).toBe('is-rate');
  });
});

import { reviveResult, toWireJson } from '../src/index.ts';

describe('transport JSON', () => {
  it('aller-retour sans perte : résultat → JSON → résultat', () => {
    const cases = [
      { ...common, donations: 4_000_000n, cdiHires: 2, apprentices: 1 },
      { ...common, donations: 'UNKNOWN' as const, cdiHires: 2, apprentices: 0 },
      { profit: 40_000_000n, donations: 0n, cdiHires: 2, apprentices: 0 },
    ];
    for (const input of cases) {
      for (const kind of ['TEST', 'REAL'] as const) {
        for (const mode of ['INTERNAL', 'CLIENT'] as const) {
          const r = simulate(input, snapshot(kind), commercial, { mode, asOf: AS_OF });
          expect(reviveResult(JSON.parse(toWireJson(r)))).toEqual(r);
        }
      }
    }
  });
});

describe('source de l’impôt avant opérations', () => {
  it('l’impôt porte la source du taux, y compris quand tous les leviers sont non calculables', () => {
    const r = simulate({ profit: 10_000_000n }, snapshot('REAL'), commercial, { mode: 'CLIENT', asOf: AS_OF });
    expect(r.taxBefore).toBe(2_500_000n);
    expect(r.taxSources.map((s) => s.ruleId)).toEqual(['is-rate']);
    expect(r.levers.every((l) => l.state === 'NOT_COMPUTABLE')).toBe(true);
  });
  it('pas de source quand l’impôt n’est pas calculé', () => {
    const r = simulate({}, snapshot('REAL'), commercial, { mode: 'CLIENT', asOf: AS_OF });
    expect(r.taxBefore).toBeNull();
    expect(r.taxSources).toEqual([]);
  });
});
