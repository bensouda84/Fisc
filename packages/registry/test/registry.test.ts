import { describe, expect, it } from 'vitest';
import { Rule } from '@fisc/schemas';
import { simulate } from '@fisc/engine';
import {
  RegistryError, appendAudit, diffSnapshots, loadRealRules, loadTestRules,
  loadCatalogue, publishSnapshot, reviseRule, validateRule, verifyAudit, verifySnapshot,
} from '../src/index.ts';

const AT = '2026-10-18T09:00:00Z';
const legal = { role: 'LEGAL', validator: 'juriste-fictif', at: AT } as const;
const accounting = { role: 'ACCOUNTING', validator: 'expert-fictif', at: AT } as const;
const commercial = { commissionRate: { num: 1n, den: 5n }, vatRate: { num: 9n, den: 50n }, commissionCap: null, validated: true };

/** Règle REAL fictive remplie à partir d'une entrée EN ATTENTE du registre. */
function filled(): Rule {
  const pending = loadRealRules().find((r) => r.concept === 'IS_RATE')!;
  return reviseRule(pending, {
    article: 'FICTIF-1', page: 12, effectiveDate: '2026-01-01', source: 'Source fictive',
    params: { rate: { num: 1n, den: 4n } },
  });
}

describe('registre V1 initial', () => {
  it('ne contient que des entrées EN ATTENTE, sans valeur, avec la source à obtenir (R7)', () => {
    const rules = loadRealRules();
    expect(rules.length).toBeGreaterThanOrEqual(4);
    for (const r of rules) {
      expect(r).toMatchObject({ status: 'PENDING', params: null, kind: 'REAL' });
      expect(r.sourceToObtain).toBeTruthy();
    }
  });
  it('les règles de TEST sont étiquetées « TEST »', () => {
    for (const r of loadTestRules()) expect(r.label.startsWith('TEST')).toBe(true);
  });
  it('registre initial en mode client : tout est NON CALCULABLE, aucun zéro', () => {
    const snap = publishSnapshot(loadRealRules(), 'v1.0.0', AT);
    const r = simulate({ profit: 40_000_000n, donations: 4_000_000n, cdiHires: 2, apprentices: 1, extraSalaries: 0n, otherOutflows: 0n }, snap, commercial, { mode: 'CLIENT', asOf: '2026-10-18' });
    expect(r.levers.every((l) => l.state === 'NOT_COMPUTABLE' && l.gross === null)).toBe(true);
    expect(r.net.state).toBe('NOT_COMPUTABLE');
    expect(r.blockedRules.length).toBe(4);
  });
});

describe('cycle de vie et validation à deux niveaux', () => {
  it('remplir une règle EN ATTENTE la passe en PROJET (version +1)', () => {
    const r = filled();
    expect(r).toMatchObject({ status: 'DRAFT', version: 2 });
  });
  it('deux validations distinctes confirment la règle', () => {
    const one = validateRule(filled(), legal);
    expect(one.status).toBe('LEGAL_VALIDATED');
    const two = validateRule(one, accounting);
    expect(two.status).toBe('CONFIRMED');
    const otherOrder = validateRule(validateRule(filled(), accounting), legal);
    expect(otherOrder.status).toBe('CONFIRMED');
  });
  it('refuse : auteur validateur, même personne deux fois, rôle déjà posé, EN ATTENTE, TEST, déjà confirmée', () => {
    expect(() => validateRule(filled(), { ...legal, validator: filled().author })).toThrow(RegistryError);
    const one = validateRule(filled(), legal);
    expect(() => validateRule(one, { ...accounting, validator: legal.validator })).toThrow(RegistryError);
    expect(() => validateRule(one, { ...legal, validator: 'autre' })).toThrow(RegistryError);
    expect(() => validateRule(loadRealRules()[0]!, legal)).toThrow(RegistryError);
    expect(() => validateRule(loadTestRules()[0]!, legal)).toThrow(RegistryError);
    expect(() => validateRule(validateRule(one, accounting), { ...legal, validator: 'z' })).toThrow(RegistryError);
  });
  it('modifier une règle confirmée retire la confirmation', () => {
    const confirmed = validateRule(validateRule(filled(), legal), accounting);
    const revised = reviseRule(confirmed, { params: { rate: { num: 3n, den: 10n } } });
    expect(revised).toMatchObject({ status: 'DRAFT', validations: [], version: confirmed.version + 1 });
    expect(reviseRule(confirmed, { params: null }).status).toBe('PENDING');
  });
  it('une règle confirmée alimente le mode client avec sa source complète', () => {
    const confirmed = validateRule(validateRule(filled(), legal), accounting);
    const snap = publishSnapshot([confirmed], 'v1.1.0', AT);
    const r = simulate({ profit: 40_000_000n, donations: 0n, cdiHires: 0, apprentices: 0, extraSalaries: 0n, otherOutflows: 0n }, snap, commercial, { mode: 'CLIENT', asOf: '2026-10-18' });
    expect(r.taxBefore).toBe(10_000_000n);
    expect(JSON.stringify(r, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))).not.toContain('TEST');
  });
  it('le schéma refuse une règle de TEST confirmée ou un validateur qui est l’auteur', () => {
    const test = loadTestRules()[0]!;
    expect(() => Rule.parse({ ...test, status: 'CONFIRMED', validations: [legal, accounting] })).toThrow();
    const confirmed = validateRule(validateRule(filled(), legal), accounting);
    expect(() => Rule.parse({ ...confirmed, author: legal.validator })).toThrow();
  });
});

describe('instantanés et comparaison', () => {
  it('empreinte vérifiable, détecte une altération', () => {
    const snap = publishSnapshot(loadRealRules(), 'v1.0.0', AT);
    expect(verifySnapshot(snap)).toBe(true);
    expect(verifySnapshot({ ...snap, rules: snap.rules.slice(1) })).toBe(false);
  });
  it('compare deux versions : ajout, retrait, modification', () => {
    const v1 = publishSnapshot(loadRealRules(), 'v1.0.0', AT);
    const rules: Rule[] = loadRealRules().filter((r) => r.concept !== 'CREDIT_CDI');
    const idx = rules.findIndex((r) => r.concept === 'IS_RATE');
    rules[idx] = filled();
    const extra = loadTestRules()[1]!;
    const v2 = publishSnapshot([...rules, extra], 'v1.1.0', AT);
    expect(diffSnapshots(v1, v2)).toEqual([
      { ruleId: 'credit-cdi', change: 'REMOVED', fields: [] },
      { ruleId: 'is-rate', change: 'MODIFIED', fields: ['status', 'article', 'page', 'effectiveDate', 'source', 'version', 'params'] },
      { ruleId: extra.id, change: 'ADDED', fields: [] },
    ].sort((a, b) => a.ruleId.localeCompare(b.ruleId)));
  });
  it('refuse un instantané avec identifiants en double', () => {
    const r = loadRealRules()[0]!;
    expect(() => publishSnapshot([r, r], 'v', AT)).toThrow();
  });
});

describe('journal d’audit', () => {
  const entry = (n: number) => ({ at: AT, actor: 'admin', action: 'RULE_VALIDATED', target: `rule-${n}`, detail: { n } });
  it('chaîne les entrées et détecte toute altération', () => {
    let log = appendAudit([], entry(1));
    log = appendAudit(log, entry(2));
    log = appendAudit(log, entry(3));
    expect(verifyAudit(log)).toBe(true);
    expect(log.map((e) => e.seq)).toEqual([1, 2, 3]);
    expect(verifyAudit([log[0]!, log[2]!])).toBe(false);
    expect(verifyAudit([{ ...log[0]!, actor: 'pirate' }, log[1]!, log[2]!])).toBe(false);
    expect(verifyAudit([log[1]!, log[0]!, log[2]!])).toBe(false);
    expect(verifyAudit([])).toBe(true);
  });
  it('ne modifie pas le journal d’origine', () => {
    const log = appendAudit([], entry(1));
    appendAudit(log, entry(2));
    expect(log.length).toBe(1);
    expect(Object.isFrozen(log)).toBe(true);
  });
});

describe('catalogue du classeur (informatif)', () => {
  const cat = loadCatalogue();

  it('recense les 33 lignes : R01 à R23 et N01 à N10, sans doublon', () => {
    const ids = cat.lines.map((l) => l.id);
    expect(new Set(ids).size).toBe(33);
    expect(ids.filter((i) => i.startsWith('R'))).toHaveLength(23);
    expect(ids.filter((i) => i.startsWith('N'))).toHaveLength(10);
  });

  it('reprend les autres onglets sans perte (écarts V4, articles non lus, sources)', () => {
    expect(cat.v4Gaps.length).toBe(23);
    expect(cat.unreadArticles.length).toBe(23);
    expect(cat.sources.length).toBe(11);
  });

  it('chaque ligne modélisée pointe un concept qui existe au registre, en attente tant que non confirmé', () => {
    const real = loadRealRules();
    const modelled = cat.lines.filter((l) => l.modelled.state === 'YES');
    expect(modelled.map((l) => l.id).sort()).toEqual(['N01', 'N02', 'N03', 'N05', 'R08', 'R11']);
    for (const l of modelled) {
      const rule = real.find((r) => r.concept === l.modelled.concept);
      expect(rule, l.id).toBeDefined();
      expect(rule!.status).toBe('PENDING');
    }
  });

  it('ne contient aucune valeur de calcul : toute ligne non modélisée dit pourquoi', () => {
    for (const l of cat.lines.filter((x) => x.modelled.state === 'NO')) expect(l.modelled.reason.length).toBeGreaterThan(10);
  });
});
