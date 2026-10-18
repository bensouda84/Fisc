import { describe, expect, it } from 'vitest';
import { simulate } from '../src/index.ts';
import { AS_OF, commercial, common, pendingRule, snapshot } from './fixtures.ts';

const internal = { mode: 'INTERNAL', asOf: AS_OF } as const;
const client = { mode: 'CLIENT', asOf: AS_OF } as const;
const credits = { cdiHires: 2, apprentices: 1 };

describe('cas dorés', () => {
  it('T1 — dons + crédits : brut 3 500 000, net −500 000, commission 0', () => {
    const r = simulate({ ...common, donations: 4_000_000n, ...credits }, snapshot('TEST'), commercial, internal);
    expect(r.gross).toEqual({ state: 'COMPLETE', value: 3_500_000n });
    expect(r.outflows).toEqual({ state: 'COMPLETE', value: 4_000_000n });
    expect(r.net).toEqual({ state: 'COMPLETE', value: -500_000n });
    expect(r.commission).toMatchObject({ state: 'COMPUTED', excl: 0n, vat: 0n, incl: 0n });
    // Par levier : dons 1 M brut / −3 M net ; CDI +2 M ; apprenti +0,5 M.
    expect(r.levers.map((l) => [l.id, l.gross, l.net])).toEqual([
      ['DONATIONS', 1_000_000n, -3_000_000n],
      ['CREDIT_CDI', 2_000_000n, 2_000_000n],
      ['CREDIT_APPRENTICE', 500_000n, 500_000n],
    ]);
  });

  it('T2 — sans crédits : brut 1 000 000, net −3 000 000, commission 0', () => {
    const r = simulate({ ...common, donations: 4_000_000n, cdiHires: 0, apprentices: 0 }, snapshot('TEST'), commercial, internal);
    expect(r.gross).toEqual({ state: 'COMPLETE', value: 1_000_000n });
    expect(r.net).toEqual({ state: 'COMPLETE', value: -3_000_000n });
    expect(r.commission).toMatchObject({ state: 'COMPUTED', incl: 0n });
  });

  it('T3 — client, règle CDI non confirmée : levier NON CALCULABLE, aucun 0, total non complet', () => {
    const snap = snapshot('REAL', { CREDIT_CDI: { status: 'DRAFT', validations: [] } });
    const r = simulate({ ...common, donations: 4_000_000n, ...credits }, snap, commercial, client);
    const cdi = r.levers.find((l) => l.id === 'CREDIT_CDI')!;
    expect(cdi.state).toBe('NOT_COMPUTABLE');
    expect(cdi.gross).toBeNull();
    expect(cdi.net).toBeNull();
    expect(cdi.reasons[0]?.code).toBe('RULE_NOT_CONFIRMED');
    expect(r.gross.state).toBe('PARTIAL');
    expect(r.net.state).toBe('PARTIAL');
    expect(r.commission.state).toBe('NOT_COMPUTED');
    expect(r.blockedRules).toEqual([{ concept: 'CREDIT_CDI', ruleId: 'cdi', status: 'DRAFT' }]);
  });

  it('T4 — client, taux de l’IS non confirmé : impôt et toute économie dépendante non calculables', () => {
    const snap = snapshot('REAL', { IS_RATE: { status: 'DRAFT', validations: [] } });
    const r = simulate({ ...common, donations: 4_000_000n, ...credits }, snap, commercial, client);
    expect(r.taxBefore).toBeNull();
    expect(r.levers.every((l) => l.state === 'NOT_COMPUTABLE' && l.gross === null)).toBe(true);
    expect(r.gross.state).toBe('NOT_COMPUTABLE');
    expect(r.net.state).toBe('NOT_COMPUTABLE');
    expect(r.commission.state).toBe('NOT_COMPUTED');
  });

  it('T5 — don non déductible : brut 2 500 000 / net −1 500 000 ; sans crédits brut 0 / net −4 000 000', () => {
    const snap = snapshot('TEST', { DONATION_DEDUCTIBILITY: { params: { deductible: false } } as never });
    const a = simulate({ ...common, donations: 4_000_000n, ...credits }, snap, commercial, internal);
    expect(a.gross).toEqual({ state: 'COMPLETE', value: 2_500_000n });
    expect(a.net).toEqual({ state: 'COMPLETE', value: -1_500_000n });
    expect(a.levers[0]?.state).toBe('NULL');
    const b = simulate({ ...common, donations: 4_000_000n, cdiHires: 0, apprentices: 0 }, snap, commercial, internal);
    expect(b.gross).toEqual({ state: 'COMPLETE', value: 0n });
    expect(b.net).toEqual({ state: 'COMPLETE', value: -4_000_000n });
  });

  it('T6 — pas de don, 2 CDI : brut 2 000 000, net 2 000 000, commission 400 000 HT / 72 000 TVA / 472 000 TTC', () => {
    const r = simulate({ ...common, donations: 0n, cdiHires: 2, apprentices: 0 }, snapshot('TEST'), commercial, internal);
    expect(r.gross).toEqual({ state: 'COMPLETE', value: 2_000_000n });
    expect(r.outflows).toEqual({ state: 'COMPLETE', value: 0n });
    expect(r.net).toEqual({ state: 'COMPLETE', value: 2_000_000n });
    expect(r.commission).toMatchObject({ state: 'COMPUTED', excl: 400_000n, vat: 72_000n, incl: 472_000n });
  });

  it('T7 — aucune règle de TEST en sortie client', () => {
    const r = simulate({ ...common, donations: 4_000_000n, ...credits }, snapshot('TEST'), commercial, client);
    const text = JSON.stringify(r, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
    expect(text).not.toContain('TEST');
    expect(r.levers.every((l) => l.state === 'NOT_COMPUTABLE' || l.state === 'NULL')).toBe(true);
    expect(r.levers.flatMap((l) => l.sources)).toEqual([]);
    expect(r.assumptions).toEqual([]);
    expect(r.gross.state).not.toBe('COMPLETE');
  });
});

describe('états et garde-fous', () => {
  it('« Je ne sais pas » rend le levier non calculable, jamais nul', () => {
    const r = simulate({ ...common, donations: 'UNKNOWN', cdiHires: 'UNKNOWN', apprentices: 0 }, snapshot('TEST'), commercial, internal);
    expect(r.levers.map((l) => l.state)).toEqual(['NOT_COMPUTABLE', 'NOT_COMPUTABLE', 'NULL']);
    expect(r.levers[0]?.reasons[0]?.code).toBe('INPUT_UNKNOWN');
    expect(r.levers[0]?.gross).toBeNull();
  });

  it('une donnée non saisie donne INPUT_MISSING', () => {
    const r = simulate({ ...common }, snapshot('TEST'), commercial, internal);
    expect(r.levers[0]?.reasons[0]?.code).toBe('INPUT_MISSING');
  });

  it('un décaissement non saisi : net PARTIEL et commission non calculée', () => {
    const r = simulate({ profit: 40_000_000n, donations: 0n, cdiHires: 2, apprentices: 0 }, snapshot('TEST'), commercial, internal);
    expect(r.net.state).toBe('PARTIAL');
    expect(r.commission.state).toBe('NOT_COMPUTED');
    expect(r.warnings.some((w) => w.code === 'NET_PARTIAL')).toBe(true);
  });

  it('un levier de crédit dépend du levier dons s’il est non calculable', () => {
    const r = simulate({ ...common, donations: 'UNKNOWN', cdiHires: 2, apprentices: 0 }, snapshot('TEST'), commercial, internal);
    expect(r.levers[1]?.state).toBe('NOT_COMPUTABLE');
    expect(r.levers[1]?.reasons[0]?.code).toBe('DEPENDS_ON_DONATIONS_LEVER');
  });

  it('plafonne les crédits à l’impôt et signale l’excédent', () => {
    const r = simulate({ ...common, profit: 2_000_000n, donations: 0n, cdiHires: 2, apprentices: 1 }, snapshot('TEST'), commercial, internal);
    // impôt = 500 000 ; CDI (2 M) absorbe tout, l'apprenti n'obtient rien.
    expect(r.levers[1]?.gross).toBe(500_000n);
    expect(r.levers[1]?.creditExcess).toBe(1_500_000n);
    expect(r.levers[2]?.gross).toBe(0n);
    expect(r.levers[2]?.creditExcess).toBe(500_000n);
    expect(r.warnings.some((w) => w.code === 'CREDIT_EXCESS')).toBe(true);
  });

  it('un bénéfice négatif ne produit pas d’impôt négatif', () => {
    const r = simulate({ ...common, profit: -5_000_000n, donations: 1_000_000n, cdiHires: 0, apprentices: 0 }, snapshot('TEST'), commercial, internal);
    expect(r.taxBefore).toBe(0n);
    expect(r.gross).toEqual({ state: 'COMPLETE', value: 0n });
  });

  it('une règle EN ATTENTE bloque le calcul en mode interne comme en mode client', () => {
    const snap = snapshot('TEST', { IS_RATE: pendingRule('is-rate', 'IS_RATE', 'TEST — taux IS en attente') });
    for (const mode of ['INTERNAL', 'CLIENT'] as const) {
      const r = simulate({ ...common, donations: 1_000_000n, cdiHires: 0, apprentices: 0 }, snap, commercial, { mode, asOf: AS_OF });
      expect(r.taxBefore).toBeNull();
      expect(r.levers[0]?.reasons.some((x) => x.code === (mode === 'INTERNAL' ? 'RULE_PENDING' : 'RULE_MISSING'))).toBe(true);
    }
  });

  it('une règle non encore en vigueur est refusée', () => {
    const snap = snapshot('TEST', { IS_RATE: { effectiveDate: '2027-01-01' } });
    const r = simulate({ ...common, donations: 1_000_000n }, snap, commercial, internal);
    expect(r.levers[0]?.reasons.some((x) => x.code === 'RULE_NOT_IN_FORCE')).toBe(true);
  });

  it('mode interne : les règles de TEST sont listées comme hypothèses', () => {
    const r = simulate({ ...common, donations: 4_000_000n, ...credits }, snapshot('TEST'), commercial, internal);
    expect(r.assumptions.length).toBe(4);
    expect(r.assumptions[0]?.message).toContain('Hypothèse');
  });

  it('mode client avec règles confirmées : sources complètes sur chaque montant (R2)', () => {
    const r = simulate({ ...common, donations: 4_000_000n, ...credits }, snapshot('REAL'), commercial, client);
    expect(r.gross).toEqual({ state: 'COMPLETE', value: 3_500_000n });
    for (const l of r.levers) {
      expect(l.sources.length).toBeGreaterThan(0);
      for (const s of l.sources) {
        expect(s).toMatchObject({ status: 'CONFIRMED', kind: 'REAL', registryVersion: 'fictif-0' });
        expect(s.article && s.page && s.effectiveDate).toBeTruthy();
      }
    }
  });

  it('mode client : paramètres commerciaux non validés → commission non calculée', () => {
    const r = simulate({ ...common, donations: 0n, cdiHires: 2, apprentices: 0 }, snapshot('REAL'), { ...commercial, validated: false }, client);
    expect(r.net.state).toBe('COMPLETE');
    expect(r.commission.state).toBe('NOT_COMPUTED');
  });

  it('plafond de commission appliqué', () => {
    const r = simulate({ ...common, donations: 0n, cdiHires: 2, apprentices: 0 }, snapshot('TEST'), { ...commercial, commissionCap: 100_000n }, internal);
    expect(r.commission).toMatchObject({ state: 'COMPUTED', excl: 100_000n, vat: 18_000n, incl: 118_000n, capApplied: true });
  });

  it('parité : deux appels identiques donnent le même résultat (déterminisme)', () => {
    const input = { ...common, donations: 4_000_000n, ...credits };
    expect(simulate(input, snapshot('TEST'), commercial, internal)).toEqual(simulate(input, snapshot('TEST'), commercial, internal));
  });
});

describe('règles bloquées', () => {
  it('T4 : le taux non confirmé figure parmi les règles bloquées', () => {
    const snap = snapshot('REAL', { IS_RATE: { status: 'DRAFT', validations: [] } });
    const r = simulate({ ...common, donations: 1_000_000n, cdiHires: 0, apprentices: 0 }, snap, commercial, client);
    expect(r.blockedRules).toContainEqual({ concept: 'IS_RATE', ruleId: 'is-rate', status: 'DRAFT' });
  });
});

describe('règle de TEST et règle REAL en attente pour le même concept', () => {
  it('mode client : la règle REAL en attente est rapportée, la règle de TEST reste invisible', () => {
    const base = snapshot('TEST');
    const real = { ...pendingRule('is-rate-real', 'IS_RATE', 'Taux de l’IS'), kind: 'REAL' } as never;
    const snap = { ...base, rules: [...base.rules, real] };
    const r = simulate({ ...common, donations: 1_000_000n, cdiHires: 0, apprentices: 0 }, snap, commercial, client);
    expect(r.blockedRules).toContainEqual({ concept: 'IS_RATE', ruleId: 'is-rate-real', status: 'PENDING' });
    expect(JSON.stringify(r, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))).not.toContain('TEST');
  });
});
