import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { formatMoney } from '@fisc/engine';
import { NBSP_TO_SPACE, T1, harness, pdfText, type Harness } from './helpers.ts';

const money = (n: bigint): string => NBSP_TO_SPACE(formatMoney(n));

describe('API — registre initial (aucune règle réelle confirmée)', () => {
  let h: Harness;
  beforeAll(async () => { h = await harness({ withTestRules: true }); });
  afterAll(async () => { await h.close(); });

  it('exige une authentification et des rôles', async () => {
    expect((await h.call(null, 'GET', '/registry')).status).toBe(401);
    const client = await h.login('client@fisc.test');
    expect((await h.call(client, 'GET', '/rules')).status).toBe(403);
    expect((await h.call(client, 'POST', '/registry/publish', { version: 'v9.0.0' })).status).toBe(403);
    const bad = await h.call(null, 'POST', '/auth/login', { email: 'client@fisc.test', password: 'faux' });
    expect(bad.status).toBe(401);
    expect((await h.call(null, 'POST', '/auth/login', {})).status).toBe(400);
  });

  it('T1 via l’API en mode interne : brut 3 500 000, net −500 000, commission 0', async () => {
    const t = await h.login('consultant@fisc.test');
    const { status, json } = await h.call(t, 'POST', '/simulate', { input: T1 });
    expect(status).toBe(200);
    expect(json.result.mode).toBe('INTERNAL');
    expect(json.result.gross).toEqual({ state: 'COMPLETE', value: '3500000' });
    expect(json.result.net).toEqual({ state: 'COMPLETE', value: '-500000' });
    expect(json.result.commission).toMatchObject({ state: 'COMPUTED', excl: '0', incl: '0' });
  });

  it('un client est forcé en mode client, même s’il demande le mode interne : tout est non calculable, aucune règle de TEST', async () => {
    const t = await h.login('client@fisc.test');
    const { json } = await h.call(t, 'POST', '/simulate', { input: T1, mode: 'INTERNAL' });
    expect(json.result.mode).toBe('CLIENT');
    expect(json.result.levers.every((l: any) => l.state === 'NOT_COMPUTABLE' && l.gross === null)).toBe(true);
    expect(json.result.gross.state).toBe('NOT_COMPUTABLE');
    expect(JSON.stringify(json)).not.toContain('TEST');
    const reg = await h.call(t, 'GET', '/registry');
    expect(reg.json.rules).toEqual([]);
  });

  it('une simulation exploratoire (persist: false) ne laisse aucune trace', async () => {
    const t = await h.login('consultant@fisc.test');
    const before = (await h.db.query('select count(*)::int as n from calculation')).rows[0].n;
    const r = await h.call(t, 'POST', '/simulate', { input: T1, persist: false });
    expect(r.json.id).toBeNull();
    expect((await h.db.query('select count(*)::int as n from calculation')).rows[0].n).toBe(before);
  });

  it('rejette une saisie invalide en français (flottant, négatif)', async () => {
    const t = await h.login('consultant@fisc.test');
    const r = await h.call(t, 'POST', '/simulate', { input: { profit: '12.5', donations: -1 } });
    expect(r.status).toBe(400);
    expect(r.json.message).toContain('Données invalides');
  });

  it('sauvegarde et relit le diagnostic', async () => {
    const t = await h.login('consultant@fisc.test');
    expect((await h.call(t, 'GET', '/diagnostic')).json).toEqual({ answers: {}, step: 0 });
    await h.call(t, 'PUT', '/diagnostic', { answers: { profit: '1000', donations: 'UNKNOWN' }, step: 2 });
    expect((await h.call(t, 'GET', '/diagnostic')).json).toEqual({ answers: { profit: '1000', donations: 'UNKNOWN' }, step: 2 });
    expect((await h.call(t, 'PUT', '/diagnostic', { answers: { profit: 'abc' }, step: 1 })).status).toBe(400);
  });

  it('PDF interne : mêmes montants que l’API (parité écran/PDF), hypothèses et mention de non-avis', async () => {
    const t = await h.login('consultant@fisc.test');
    const sim = await h.call(t, 'POST', '/simulate', { input: T1 });
    const res = await h.call(t, 'POST', '/reports/pdf', { calculationId: sim.json.id });
    expect(res.status).toBe(200);
    expect(res.raw.subarray(0, 4).toString()).toBe('%PDF');
    const text = pdfText(res.raw);
    for (const amount of [3_500_000n, 4_000_000n, -500_000n]) expect(text).toContain(money(amount));
    expect(text).toContain('DOCUMENT INTERNE');
    expect(text).toContain('18 octobre 2026');
    expect(text).toContain('v1.0.0');
    expect(text).toContain('ne remplace pas l’avis d’un professionnel');
    expect(text).toContain('Hypothèse');
  });

  it('PDF client : aucune règle de TEST, états non calculables, pas de faux zéro (T7)', async () => {
    const t = await h.login('client@fisc.test');
    const sim = await h.call(t, 'POST', '/simulate', { input: T1 });
    const res = await h.call(t, 'POST', '/reports/pdf', { calculationId: sim.json.id });
    const text = pdfText(res.raw);
    expect(text).not.toContain('TEST');
    expect(text).not.toContain('DOCUMENT INTERNE');
    expect(text).toContain('Non calculable');
    expect(text).not.toMatch(/Économie fiscale brute : 0 F CFA/);
  });

  it('un utilisateur ne télécharge pas le calcul d’un autre', async () => {
    const c = await h.login('consultant@fisc.test');
    const sim = await h.call(c, 'POST', '/simulate', { input: T1 });
    const other = await h.login('admin@fisc.test');
    expect((await h.call(other, 'POST', '/reports/pdf', { calculationId: sim.json.id })).status).toBe(404);
  });

  it('expose un contrat OpenAPI avec les montants en chaînes', async () => {
    const { json } = await h.call(null, 'GET', '/openapi.json');
    expect(json.openapi).toBe('3.1.0');
    expect(Object.keys(json.paths)).toEqual(expect.arrayContaining(['/simulate', '/reports/pdf', '/rules/{id}/validate']));
    const schema = json.paths['/simulate'].post.requestBody.content['application/json'].schema;
    expect(JSON.stringify(schema)).toContain('"pattern":"^-?\\\\d+$"');
  });

  it('le journal d’audit est en ajout seul, même pour le propriétaire de la base', async () => {
    await expect(h.db.query("update audit_log set actor = 'x'")).rejects.toThrow(/ajout seul/);
    await expect(h.db.query('delete from audit_log')).rejects.toThrow(/ajout seul/);
    await expect(h.db.query('truncate audit_log')).rejects.toThrow(/ajout seul/);
  });
});

describe('API — de EN ATTENTE à CONFIRMÉE jusqu’à une sortie client sourcée', () => {
  let h: Harness;
  beforeAll(async () => { h = await harness({ withTestRules: false }); });
  afterAll(async () => { await h.close(); });

  const FILLS: Record<string, object> = {
    'is-rate': { params: { rate: { num: '1', den: '4' } } },
    'donation-deductibility': { params: { deductible: true } },
    'credit-cdi': { params: { amountPerHire: '1000000' } },
    'credit-apprentice': { params: { amountPerApprentice: '500000' } },
  };

  it('parcours complet du registre', async () => {
    const admin = await h.login('admin@fisc.test');
    const legal = await h.login('juriste@fisc.test');
    const expert = await h.login('expert@fisc.test');
    const client = await h.login('client@fisc.test');

    // Valider une règle EN ATTENTE est refusé.
    expect((await h.call(legal, 'POST', '/rules/is-rate/validate')).status).toBe(409);

    for (const [id, fill] of Object.entries(FILLS)) {
      const r = await h.call(admin, 'POST', `/rules/${id}/revise`, {
        article: `FICTIF-${id}`, page: 7, effectiveDate: '2026-01-01', source: 'Source fictive de démonstration', ...fill,
      });
      expect(r.status).toBe(200);
      expect(r.json.status).toBe('DRAFT');
      // L'administrateur n'a pas le rôle de validateur.
      expect((await h.call(admin, 'POST', `/rules/${id}/validate`)).status).toBe(403);
      const lv = await h.call(legal, 'POST', `/rules/${id}/validate`); expect(lv.json, JSON.stringify(lv.json)).toMatchObject({ status: 'LEGAL_VALIDATED' });
      // Un validateur ne peut pas poser deux fois sa validation.
      expect((await h.call(legal, 'POST', `/rules/${id}/validate`)).status).toBe(409);
      expect((await h.call(expert, 'POST', `/rules/${id}/validate`)).json.status).toBe('CONFIRMED');
    }

    // Avant publication, le client voit toujours l'ancien registre : tout reste non calculable.
    const before = await h.call(client, 'POST', '/simulate', { input: T1 });
    expect(before.json.result.gross.state).toBe('NOT_COMPUTABLE');

    expect((await h.call(admin, 'POST', '/registry/publish', { version: 'v1.1.0' })).status).toBe(200);
    expect((await h.call(admin, 'POST', '/registry/publish', { version: 'v1.1.0' })).status).toBe(409);

    const sim = await h.call(client, 'POST', '/simulate', { input: T1 });
    expect(sim.json.result.gross).toEqual({ state: 'COMPLETE', value: '3500000' });
    expect(sim.json.result.levers.every((l: any) => l.sources.length > 0 && l.sources.every((s: any) => s.status === 'CONFIRMED' && s.article && s.page && s.effectiveDate && s.registryVersion === 'v1.1.0'))).toBe(true);
    // Paramètres commerciaux non validés : pas de commission pour un client.
    expect(sim.json.result.commission.state).toBe('NOT_COMPUTED');

    await h.call(admin, 'PUT', '/commercial', { commissionRate: { num: '1', den: '5' }, vatRate: { num: '9', den: '50' }, commissionCap: null, validated: true });
    const t6 = await h.call(client, 'POST', '/simulate', { input: { profit: '40000000', donations: '0', cdiHires: 2, apprentices: 0, extraSalaries: '0', otherOutflows: '0' } });
    expect(t6.json.result.commission).toMatchObject({ state: 'COMPUTED', excl: '400000', vat: '72000', incl: '472000' });

    // PDF client : sources visibles, honoraires HT/TVA/TTC.
    const pdf = pdfText((await h.call(client, 'POST', '/reports/pdf', { calculationId: t6.json.id })).raw);
    expect(pdf).toContain('400 000 F CFA');
    expect(pdf).toContain('72 000 F CFA');
    expect(pdf).toContain('472 000 F CFA');
    expect(pdf).toContain('FICTIF-credit-cdi, page 7');
    expect(pdf).toContain('Confirmée');
    expect(pdf).not.toContain('TEST');

    // Comparaison entre versions, journal d'audit intact.
    const diff = await h.call(admin, 'GET', '/registry/diff?from=v1.0.0&to=v1.1.0');
    expect(diff.json.map((d: any) => d.ruleId)).toEqual(['credit-apprentice', 'credit-cdi', 'donation-deductibility', 'is-rate']);
    expect(diff.json[0].fields).toEqual(expect.arrayContaining(['status', 'params', 'article']));
    const audit = await h.call(expert, 'GET', '/audit');
    expect(audit.json.intact).toBe(true);
    expect(audit.json.entries.length).toBeGreaterThanOrEqual(14);
    expect((await h.call(client, 'GET', '/audit')).status).toBe(403);

    // Le client voit désormais les règles confirmées avec leur source.
    const reg = await h.call(client, 'GET', '/registry');
    expect(reg.json.rules).toHaveLength(4);
  });

  it('modifier une règle confirmée la sort du registre publié suivant', async () => {
    const admin = await h.login('admin@fisc.test');
    await h.call(admin, 'POST', '/rules/is-rate/revise', { article: 'FICTIF-2', page: 8, effectiveDate: '2026-01-01', source: 'Source fictive', params: { rate: { num: '3', den: '10' } } });
    const rules = (await h.call(admin, 'GET', '/rules')).json;
    expect(rules.find((r: any) => r.id === 'is-rate')).toMatchObject({ status: 'DRAFT', version: 3 });
    const bad = await h.call(admin, 'POST', '/rules/is-rate/revise', { article: 'x', page: 1, effectiveDate: '2026-01-01', source: 's', params: { rate: { num: '1', den: '0' } } });
    expect(bad.status).toBe(400);
    expect((await h.call(admin, 'GET', '/rules/is-rate/history')).json).toHaveLength(3);
    expect((await h.call(admin, 'POST', '/rules/inconnue/revise', { article: 'x', page: 1, effectiveDate: '2026-01-01', source: 's', params: {} })).status).toBe(404);
  });
});
