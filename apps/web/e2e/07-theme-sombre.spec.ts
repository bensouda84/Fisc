import { expect, test, type Page } from '@playwright/test';
import { VIEWPORTS, expectNoCriticalA11y, expectNoHorizontalScroll, login, shot } from './helpers.ts';

const seed = async (page: Page): Promise<void> => {
  await page.evaluate(async () => {
    const token = (JSON.parse(sessionStorage.getItem('fisc.session') ?? '{}') as { token?: string }).token ?? '';
    const answers = { profit: '40000000', donations: '4000000', cdiHires: 2, apprentices: 1, extraSalaries: '0', otherOutflows: '0' };
    await fetch('/api/diagnostic', { method: 'PUT', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ answers, step: 3 }) });
  });
};
const bodyBg = (page: Page): Promise<string> => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const lightness = (rgb: string): number => (rgb.match(/\d+/g) ?? []).slice(0, 3).map(Number).reduce((a, b) => a + b, 0) / 3;

test.describe('thème sombre', () => {
  test.use({ colorScheme: 'dark' });

  test('suit la préférence du système, sans défilement horizontal, sans violation axe', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(lightness(await bodyBg(page))).toBeLessThan(60);
    await expectNoCriticalA11y(page, 'sombre-connexion');
    await shot(page, 'sombre-connexion-mobile');

    await login(page, 'consultant@fisc.test');
    await seed(page);
    await page.reload();
    await expectNoCriticalA11y(page, 'sombre-diagnostic');
    await shot(page, 'sombre-diagnostic-mobile');
    await page.getByRole('button', { name: 'Pourquoi cette question ?' }).click();
    await expectNoCriticalA11y(page, 'sombre-pourquoi');
    await shot(page, 'sombre-pourquoi-mobile');
    await page.keyboard.press('Escape');

    await page.goto('/#/result');
    await expect(page.getByTestId('gross')).toBeVisible();
    await expectNoCriticalA11y(page, 'sombre-resultat');
    await expectNoHorizontalScroll(page);
    await shot(page, 'sombre-resultat-mobile');
    await page.getByRole('button', { name: 'Voir la source : Crédit d’impôt — CDI' }).click();
    await expectNoCriticalA11y(page, 'sombre-source');
    await page.keyboard.press('Escape');

    await page.goto('/#/simulation');
    await expect(page.getByTestId('gross')).toBeVisible();
    await expectNoCriticalA11y(page, 'sombre-simulation');
    await shot(page, 'sombre-simulation-mobile');
  });

  test('aperçu client, registre et tablette/bureau en sombre', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await login(page, 'client@fisc.test');
    await seed(page);
    await page.goto('/#/result');
    await expect(page.getByTestId('gross')).toContainText('Non calculable');
    await expectNoCriticalA11y(page, 'sombre-client');
    await shot(page, 'sombre-client-bureau');
    await page.getByRole('button', { name: 'Se déconnecter' }).click();

    await login(page, 'admin@fisc.test');
    await page.goto('/#/registry');
    await expect(page.getByTestId('rule-is-rate')).toBeVisible();
    await expectNoCriticalA11y(page, 'sombre-registre');
    await shot(page, 'sombre-registre-bureau');
    await page.getByTestId('rule-is-rate').getByRole('button', { name: 'Renseigner' }).click();
    await expectNoCriticalA11y(page, 'sombre-dialogue');
    await page.keyboard.press('Escape');
    await page.getByRole('tab', { name: 'Versions' }).click();
    await expectNoCriticalA11y(page, 'sombre-versions');
    await page.getByRole('tab', { name: 'Journal d’audit' }).click();
    await expectNoCriticalA11y(page, 'sombre-audit');

    await page.setViewportSize(VIEWPORTS.tablet);
    await page.goto('/#/result');
    await shot(page, 'sombre-tablette');
    await expectNoHorizontalScroll(page);
  });

  test('le bouton bascule en clair, le choix est mémorisé, puis un second clic revient au sombre', async ({ page }) => {
    await login(page, 'consultant@fisc.test');
    const dark = lightness(await bodyBg(page));
    await page.getByTestId('scheme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    expect(lightness(await bodyBg(page))).toBeGreaterThan(dark + 100);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.getByRole('button', { name: 'Passer au thème sombre' })).toBeVisible();
    await expectNoCriticalA11y(page, 'clair-apres-bascule');
    await page.getByTestId('scheme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByRole('button', { name: 'Passer au thème clair' })).toBeVisible();
  });

  test('les chips de statut gardent icône + texte et un contraste suffisant en sombre', async ({ page }) => {
    await login(page, 'consultant@fisc.test');
    await seed(page);
    await page.goto('/#/result');
    const card = page.getByTestId('lever-DONATIONS');
    await expect(card.getByText('Calculée')).toBeVisible();
    await expect(card.locator('svg').first()).toBeVisible();
    await expectNoCriticalA11y(page, 'sombre-chips');
  });
});

test('thème clair par défaut quand le système est en clair', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});
