import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { formatMoney } from '@fisc/engine';
import { ClientResultSchema, EngineResultSchema } from '@fisc/schemas';
import { NBSP_TO_SPACE, T1, harness, pdfText, type Harness } from './helpers.ts';

const money = (n: bigint): string => NBSP_TO_SPACE(formatMoney(n));

describe.skipIf(!process.env.TEST_DATABASE_URL)('API — registre initial (aucune règle réelle confirmée)', () => {
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

  it('catalogue des 33 lignes : lecture réservée au personnel, valide, jamais vu par un client', async () => {
    const client = await h.login('client@fisc.test');
    expect((await h.call(client, 'GET', '/registry/catalogue')).status).toBe(403);
    expect((await h.call(null, 'GET', '/registry/catalogue')).status).toBe(401);
    const staff = await h.login('consultant@fisc.test');
    const { status, json } = await h.call(staff, 'GET', '/registry/catalogue');
    expect(status).toBe(200);
    expect(json.lines).toHaveLength(33);
    expect(json.v4Gaps.length).toBeGreaterThan(0);
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
    const open = json.result.levers.filter((l: any) => ['DONATIONS', 'CREDIT_CDI', 'CREDIT_APPRENTICE'].includes(l.id));
    expect(open.every((l: any) => l.state === 'NOT_COMPUTABLE' && l.gross === null)).toBe(true);
    expect(json.result.gross.state).toBe('NOT_COMPUTABLE'); // startup et TVA agricole : portes « Non » → nuls, aucun levier calculé
    expect(JSON.stringify(json)).not.toContain('TEST');
    const reg = await h.call(t, 'GET', '/registry');
    expect(reg.json.rules).toEqual([]);
  });

  it('les sorties de /simulate respectent les schémas de sortie (interne et client)', async () => {
    const staff = await h.call(await h.login('consultant@fisc.test'), 'POST', '/simulate', { input: T1 });
    expect(EngineResultSchema.safeParse(staff.json.result).success).toBe(true);
    const client = await h.call(await h.login('client@fisc.test'), 'POST', '/simulate', { input: T1 });
    expect(ClientResultSchema.safeParse(client.json.result).success).toBe(true);
    // Le même résultat interne ne passe pas pour une sortie client.
    expect(ClientResultSchema.safeParse(staff.json.result).success).toBe(false);
  });

  it('limite les tentatives de connexion (429 après 5 échecs) sans bloquer les autres comptes', async () => {
    for (let i = 0; i < 5; i++) expect((await h.call(null, 'POST', '/auth/login', { email: 'juriste@fisc.test', password: 'faux' })).status).toBe(401);
    const blocked = await h.call(null, 'POST', '/auth/login', { email: 'juriste@fisc.test', password: 'faux' });
    expect(blocked.status).toBe(429);
    expect((await h.call(null, 'POST', '/auth/login', { email: 'juriste@fisc.test', password: 'mot-de-passe-de-test-fictif' })).status).toBe(429);
    expect((await h.call(null, 'POST', '/auth/login', { email: 'expert@fisc.test', password: 'mot-de-passe-de-test-fictif' })).status).toBe(200);
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

  it('estimation sans compte : chiffre d’affaires seul → mode client, tout non calculable, rien d’enregistré', async () => {
    const before = (await h.db.query("select (select count(*)::int from calculation) as c, (select count(*)::int from users) as u")).rows[0];
    const r = await h.call(null, 'POST', '/public/estimate', { turnover: '250000000' });
    expect(r.status).toBe(200);
    expect(r.json.assumption).toEqual({ turnover: '250000000', marginPercent: null, estimatedProfit: null });
    expect(r.json.result.mode).toBe('CLIENT');
    expect(r.json.result.taxBefore).toBeNull();
    expect(r.json.result.levers.every((l: any) => l.state === 'NOT_COMPUTABLE' && l.gross === null)).toBe(true);
    expect(JSON.stringify(r.json)).not.toContain('TEST');
    expect(ClientResultSchema.safeParse(r.json.result).success).toBe(true);
    const after = (await h.db.query("select (select count(*)::int from calculation) as c, (select count(*)::int from users) as u")).rows[0];
    expect(after).toEqual(before);
  });

  it('estimation sans compte : la marge produit un bénéfice estimé en entiers (hypothèse), jamais une règle', async () => {
    const r = await h.call(null, 'POST', '/public/estimate', { turnover: '100000001', marginPercent: 10 });
    expect(r.json.assumption.estimatedProfit).toBe('10000000'); // 10 000 000,1 arrondi au franc
    const odd = await h.call(null, 'POST', '/public/estimate', { turnover: '15', marginPercent: 10 });
    expect(odd.json.assumption.estimatedProfit).toBe('2'); // 1,5 → 2 (demi vers le haut)
    expect(r.json.result.taxBefore).toBeNull(); // taux de l'IS non confirmé : pas de chiffre
  });

  it('estimation sans compte : saisies invalides refusées', async () => {
    for (const body of [{}, { turnover: '0' }, { turnover: '-5' }, { turnover: '12.5' }, { turnover: '1000', marginPercent: 101 }, { turnover: '1000', marginPercent: 12.5 }, { turnover: '1000', marginPercent: -1 }]) {
      expect((await h.call(null, 'POST', '/public/estimate', body)).status, JSON.stringify(body)).toBe(400);
    }
  });

  it('inscription : crée un compte client avec consentement, connecte, et ignore tout rôle demandé', async () => {
    const r = await h.call(null, 'POST', '/auth/register', { email: 'Nouveau.Client@exemple.test', password: 'un-mot-de-passe-solide', consent: true, role: 'admin' });
    expect(r.status).toBe(200);
    expect(r.json.user).toMatchObject({ email: 'nouveau.client@exemple.test', role: 'client' });
    const row = (await h.db.query("select role, consent_at from users where email = 'nouveau.client@exemple.test'")).rows[0];
    expect(row.role).toBe('client');
    expect(row.consent_at).toBeTruthy();
    const sim = await h.call(r.json.token, 'POST', '/simulate', { input: T1, mode: 'INTERNAL' });
    expect(sim.json.result.mode).toBe('CLIENT');
    expect((await h.call(r.json.token, 'GET', '/rules')).status).toBe(403);
    expect((await h.call(null, 'POST', '/auth/login', { email: 'nouveau.client@exemple.test', password: 'un-mot-de-passe-solide' })).status).toBe(200);
    // Le journal ne contient pas l'adresse e-mail.
    const audit = (await h.db.query("select detail, target from audit_log where action = 'USER_REGISTERED'")).rows;
    expect(audit.length).toBe(1);
    expect(JSON.stringify(audit)).not.toContain('exemple.test');
  });

  it('inscription : consentement, mot de passe court, adresse invalide et doublon refusés', async () => {
    const ok = { email: 'autre@exemple.test', password: 'un-mot-de-passe-solide', consent: true };
    expect((await h.call(null, 'POST', '/auth/register', { ...ok, consent: false })).status).toBe(400);
    expect((await h.call(null, 'POST', '/auth/register', { ...ok, consent: undefined })).status).toBe(400);
    const short = await h.call(null, 'POST', '/auth/register', { ...ok, password: 'court' });
    expect(short.status).toBe(400);
    expect(JSON.stringify(short.json.issues)).toContain('12 caractères');
    expect((await h.call(null, 'POST', '/auth/register', { ...ok, email: 'pas-une-adresse' })).status).toBe(400);
    const dup = await h.call(null, 'POST', '/auth/register', { ...ok, email: 'NOUVEAU.CLIENT@exemple.test' });
    expect(dup.status).toBe(409);
    expect(dup.json.error).toBe('EMAIL_TAKEN');
  });

  it('limite les créations de compte et les estimations par adresse IP', async () => {
    for (let i = 0; i < 3; i++) {
      expect((await h.call(null, 'POST', '/auth/register', { email: `lim${i}@exemple.test`, password: 'un-mot-de-passe-solide', consent: true })).status).toBe(200);
    }
    const blocked = await h.call(null, 'POST', '/auth/register', { email: 'lim9@exemple.test', password: 'un-mot-de-passe-solide', consent: true });
    expect(blocked.status).toBe(429);
    let last = 200;
    for (let i = 0; i < 40 && last === 200; i++) last = (await h.call(null, 'POST', '/public/estimate', { turnover: '1000' })).status;
    expect(last).toBe(429);
  });
});

describe.skipIf(!process.env.TEST_DATABASE_URL)('API — de EN ATTENTE à CONFIRMÉE jusqu’à une sortie client sourcée', () => {
  let h: Harness;
  beforeAll(async () => { h = await harness({ withTestRules: false }); });
  afterAll(async () => { await h.close(); });

  const FILLS: Record<string, object> = {
    'is-rate': { params: { rate: { num: '1', den: '4' } } },
    'donation-deductibility': { params: { deductible: true } },
    'credit-cdi': { params: { amountPerHire: '1000000' } },
    'credit-apprentice': { params: { amountPerApprentice: '500000' } },
    'startup-exemption': { params: { durationYears: 3, includesLabelYear: false, appliesToProfitTax: true } },
    'vat-fuel-recovery': { params: { capPercent: null } },
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
    expect(before.json.result.levers.find((l: any) => l.id === 'DONATIONS').state).toBe('NOT_COMPUTABLE');

    expect((await h.call(admin, 'POST', '/registry/publish', { version: 'v1.1.0' })).status).toBe(200);
    expect((await h.call(admin, 'POST', '/registry/publish', { version: 'v1.1.0' })).status).toBe(409);

    const sim = await h.call(client, 'POST', '/simulate', { input: T1 });
    expect(sim.json.result.gross).toEqual({ state: 'COMPLETE', value: '3500000' });
    expect(sim.json.result.levers.filter((l: any) => l.state === 'CALCULATED').every((l: any) => l.sources.length > 0 && l.sources.every((s: any) => s.status === 'CONFIRMED' && s.article && s.page && s.effectiveDate && s.registryVersion === 'v1.1.0'))).toBe(true);
    // Startup et TVA agricole : mêmes garde-fous, sourcés une fois confirmés et publiés.
    const modules = await h.call(client, 'POST', '/simulate', { input: { ...T1, donations: '0', cdiHires: 0, apprentices: 0, isStartup: 'YES', startupLabelYear: 2024, startupRegime: 'YES', vatAgri: 'YES', fuelVat: '1000000' } });
    const startupLever = modules.json.result.levers.find((l: any) => l.id === 'STARTUP_EXEMPTION');
    expect(startupLever).toMatchObject({ state: 'CALCULATED', gross: '10000000' });
    expect(startupLever.sources.map((s: any) => s.concept)).toEqual(['IS_RATE', 'STARTUP_EXEMPTION']);
    expect(modules.json.result.levers.find((l: any) => l.id === 'VAT_FUEL_RECOVERY')).toMatchObject({ state: 'CALCULATED', gross: '1000000' });
    expect(modules.json.result.gross).toEqual({ state: 'COMPLETE', value: '11000000' });
    expect(ClientResultSchema.safeParse(modules.json.result).success).toBe(true);
    // Paramètres commerciaux non validés : pas de commission pour un client.
    expect(sim.json.result.commission.state).toBe('NOT_COMPUTED');

    await h.call(admin, 'PUT', '/commercial', { commissionRate: { num: '1', den: '5' }, vatRate: { num: '9', den: '50' }, commissionCap: null, validated: true });
    const t6 = await h.call(client, 'POST', '/simulate', { input: { profit: '40000000', donations: '0', cdiHires: 2, apprentices: 0, extraSalaries: '0', otherOutflows: '0', isStartup: 'NO', vatAgri: 'NO' } });
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
    expect(diff.json.map((d: any) => d.ruleId)).toEqual(['credit-apprentice', 'credit-cdi', 'donation-deductibility', 'is-rate', 'startup-exemption', 'vat-fuel-recovery']);
    expect(diff.json[0].fields).toEqual(expect.arrayContaining(['status', 'params', 'article']));
    const audit = await h.call(expert, 'GET', '/audit');
    expect(audit.json.intact).toBe(true);
    expect(audit.json.entries.length).toBeGreaterThanOrEqual(14);
    expect((await h.call(client, 'GET', '/audit')).status).toBe(403);

    // Le client voit désormais les règles confirmées avec leur source.
    const reg = await h.call(client, 'GET', '/registry');
    expect(reg.json.rules).toHaveLength(6);
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
