import { expect, test } from '@playwright/test';
import { expectNoCriticalA11y, login, shot } from './helpers.ts';

test('marque mesimpo : titre, logo, favicon et signature sur la connexion', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/^mesimpo — /);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const logo = page.getByRole('img', { name: 'mesimpo' });
  await expect(logo).toBeVisible();
  expect(await logo.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(100);
  await expect(page.getByText('Payez juste. Pas plus.')).toBeVisible();
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/favicon.png');
  expect((await page.request.get('/favicon.png')).status()).toBe(200);
  await expect(page.locator('body')).not.toContainText('FISC.CI');
  await expectNoCriticalA11y(page, 'marque-connexion');
  await shot(page, 'marque-connexion-clair');
});

test('le logo suit le thème et la couleur de marque pilote les rôles M3', async ({ page }) => {
  await login(page, 'consultant@fisc.test');
  const bar = page.getByRole('banner').getByRole('img', { name: 'mesimpo' });
  await expect(bar).toHaveAttribute('src', '/logo-light.png');
  await page.getByTestId('scheme-toggle').click();
  await expect(bar).toHaveAttribute('src', '/logo-dark.png');
  // Le bouton principal est vert (teinte dominante), pas gris : la couleur source M3 est celle du logo.
  await page.goto('/#/diagnostic');
  await page.getByLabel('Bénéfice imposable (F CFA)').fill('1');
  const button = page.getByRole('button', { name: 'Continuer' });
  await expect(button).toBeEnabled();
  // La couleur transite depuis l'état désactivé : on attend la valeur finale.
  await expect.poll(async () => {
    const rgb = await button.evaluate((el) => getComputedStyle(el).backgroundColor);
    const [r, g, b] = (rgb.match(/\d+/g) ?? []).map(Number) as [number, number, number];
    return g > r + 20 && g > b;
  }).toBe(true);
  await expectNoCriticalA11y(page, 'marque-sombre');
  await shot(page, 'marque-diagnostic-sombre');
  await page.getByTestId('scheme-toggle').click();
  await expectNoCriticalA11y(page, 'marque-clair');
  await shot(page, 'marque-diagnostic-clair');
});

test('le chip « Partielle » reprend l’orange de la marque, avec icône et texte', async ({ page }) => {
  await login(page, 'consultant@fisc.test');
  await page.evaluate(async () => {
    const token = (JSON.parse(sessionStorage.getItem('fisc.session') ?? '{}') as { token?: string }).token ?? '';
    const answers = { profit: '40000000', donations: '0', cdiHires: 2, apprentices: 0, extraSalaries: '0', isStartup: 'NO', vatAgri: 'NO' };
    await fetch('/api/diagnostic', { method: 'PUT', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ answers, step: 3 }) });
  });
  await page.goto('/#/result');
  const net = page.getByTestId('net').locator('xpath=..');
  await expect(net.getByText('Partielle', { exact: true })).toBeVisible();
  const bg = await net.getByText('Partielle', { exact: true }).locator('xpath=ancestor::*[contains(@class,"MuiChip-root")][1]').evaluate((el) => getComputedStyle(el).backgroundColor);
  const [r, g, b] = (bg.match(/\d+/g) ?? []).map(Number) as [number, number, number];
  expect(r).toBeGreaterThan(b + 30); // teinte chaude (orange/ambre) et non verte ou bleue
  await expectNoCriticalA11y(page, 'marque-partielle');
  await shot(page, 'marque-resultat-partiel');
  expect(g).toBeGreaterThan(0);
});
