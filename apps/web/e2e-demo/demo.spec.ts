import AxeBuilder from '@axe-core/playwright';
import { expect, test, type FrameLocator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const NB = ' ';
const money = (n: string): string => `${n.replace(/\B(?=(\d{3})+$)/g, NB)}${NB}F${NB}CFA`;
const artifact = readFileSync(new URL('../dist-demo/artifact.html', import.meta.url), 'utf8');

/** Squelette posé par l'hôte des artefacts : racine remplie des marges de sécurité, corps sans marge, police de 14 px. */
const skeleton = (theme?: 'dark' | 'light'): string => `<!doctype html><html lang="fr"${theme ? ` data-theme="${theme}"` : ''}><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>:root{color-scheme:light;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style>
</head><body>${artifact}</body></html>`;

async function open(page: Page, theme?: 'dark' | 'light'): Promise<void> {
  await page.setContent(skeleton(theme), { waitUntil: 'load' });
  await expect(page.getByTestId('demo-banner')).toBeVisible();
}

async function axe(page: Page, label: string): Promise<void> {
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))));
  await page.waitForTimeout(350);
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(r.violations.map((v) => `${label}: ${v.id} (${v.impact}) ${v.nodes.map((n) => n.target.join(' ')).slice(0, 2).join(' | ')}`)).toEqual([]);
}

async function t1(page: Page | FrameLocator): Promise<void> {
  const next = () => page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByLabel('Bénéfice imposable (F CFA)').fill('40000000'); await next();
  await page.getByLabel('Dons effectués (F CFA)').fill('4000000'); await next();
  await page.getByLabel('Embauches en CDI').fill('2'); await page.getByLabel('Apprentis').fill('1'); await next();
  await page.getByLabel('Salaires supplémentaires (F CFA)').fill('0'); await page.getByLabel('Autres décaissements (F CFA)').fill('0'); await next();
  await page.getByRole('radio', { name: 'Non', exact: true }).check(); await next();
  await page.getByRole('radio', { name: 'Non', exact: true }).check();
  await page.getByRole('button', { name: 'Voir le résultat' }).click();
}

test('la page autonome tient en un seul fichier, sans ressource externe', () => {
  expect(artifact.length).toBeLessThan(2_000_000);
  expect(artifact).not.toMatch(/<(html|head|body)\b/i);
  expect(artifact).not.toMatch(/(src|href)="https?:\/\//);
  const style = /<style>([\s\S]*?)<\/style>/.exec(artifact)?.[1] ?? '';
  expect(style.length).toBeGreaterThan(1000);
  expect(style).not.toMatch(/url\((?!data:|#)/);
  expect(artifact).toContain('<title>mesimpo</title>');
});

test('profil consultant : T1 complet en mode interne, bandeau de démonstration, pas de PDF, 0 violation axe', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await open(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Connexion' })).toBeVisible();
  await axe(page, 'demo-connexion');
  await page.getByRole('button', { name: 'Consultant mesimpo' }).click();
  await expect(page.getByText('Question 1 sur 6')).toBeVisible();
  await expect(page.getByTestId('demo-banner')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Navigation principale' }).getByText('Registre')).toHaveCount(0);
  await t1(page);
  await expect(page.getByTestId('gross')).toHaveText(money('3500000'));
  await expect(page.getByTestId('outflows')).toHaveText(money('4000000'));
  await expect(page.getByTestId('net')).toHaveText(`−${money('500000')}`);
  await expect(page.getByTestId('internal-banner')).toBeVisible();
  await expect(page.getByRole('button', { name: /Exporter le dossier de preuve/ })).toHaveCount(0);
  await expect(page.getByText('n’est pas disponible dans la démonstration')).toBeVisible();
  await axe(page, 'demo-resultat');
  // L'aperçu client montre ce que verrait un dirigeant : rien n'est chiffré.
  await page.getByRole('button', { name: 'Aperçu client' }).click();
  await expect(page.getByTestId('gross')).toContainText('Non calculable');
  expect(await page.locator('body').innerText()).not.toContain('TEST —');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});

test('profil client : mode client réel, aucun chiffre, aucune règle de TEST', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Dirigeant (client)' }).click();
  await t1(page);
  await expect(page.getByTestId('gross')).toContainText('Non calculable');
  await expect(page.getByTestId('fees-none')).toBeVisible();
  await expect(page.getByTestId('blocked')).toBeVisible();
  expect(await page.locator('body').innerText()).not.toContain('TEST —');
});

test('estimation sans compte et inscription désactivée', async ({ page }) => {
  await open(page);
  await page.getByRole('link', { name: 'Estimer sans compte' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Estimation express' })).toBeVisible();
  await page.getByLabel('Chiffre d’affaires annuel (F CFA)').fill('100000000');
  await page.getByLabel(/Marge bénéficiaire estimée/).fill('10');
  await page.getByRole('button', { name: 'Estimer' }).click();
  await expect(page.getByTestId('estimate-tax-none')).toHaveText('Non calculable');
  await axe(page, 'demo-estimation');
  await page.getByRole('link', { name: 'Créer mon compte pour compléter le diagnostic' }).click();
  await page.getByRole('textbox', { name: 'Adresse e-mail' }).fill('a@exemple.test');
  await page.getByLabel('Mot de passe').fill('un-mot-de-passe-solide');
  await page.getByLabel('J’accepte que mesimpo traite mon adresse e-mail pour gérer mon compte.').check();
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page.getByRole('alert')).toContainText('La création de compte n’est pas disponible dans la démonstration.');
});

test('thème de l’hôte : suit data-theme="dark" posé sur la racine, bascule sans toucher à cet attribut', async ({ page }) => {
  await open(page, 'dark');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect((bg.match(/\d+/g) ?? []).slice(0, 3).map(Number).reduce((a, b) => a + b, 0) / 3).toBeLessThan(60);
  await page.getByRole('button', { name: 'Consultant mesimpo' }).click();
  await axe(page, 'demo-sombre');
  await page.getByTestId('scheme-toggle').click();
  const light = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect((light.match(/\d+/g) ?? []).slice(0, 3).map(Number).reduce((a, b) => a + b, 0) / 3).toBeGreaterThan(200);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark'); // l'attribut appartient à l'hôte
});

test('dans un cadre isolé (iframe sandbox sans stockage), la navigation et le calcul fonctionnent', async ({ page }) => {
  await page.setContent(`<!doctype html><body style="margin:0"><iframe id="f" sandbox="allow-scripts" style="width:420px;height:900px;border:0"></iframe></body>`);
  await page.evaluate((html) => { (document.getElementById('f') as HTMLIFrameElement).srcdoc = html; }, skeleton());
  const frame = page.frameLocator('#f');
  await expect(frame.getByTestId('demo-banner')).toBeVisible();
  await frame.getByRole('link', { name: 'Estimer sans compte' }).click();
  await expect(frame.getByRole('heading', { level: 1, name: 'Estimation express' })).toBeVisible();
  await frame.getByRole('link', { name: 'J’ai déjà un compte' }).click();
  await frame.getByRole('button', { name: 'Consultant mesimpo' }).click();
  await t1(frame);
  await expect(frame.getByTestId('gross')).toHaveText(money('3500000'));
  await frame.getByTestId('scheme-toggle').click(); // le stockage est refusé : le choix vaut pour la session
});
