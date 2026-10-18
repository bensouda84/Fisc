import { expect, test } from '@playwright/test';
import { VIEWPORTS, expectNoCriticalA11y, expectNoHorizontalScroll, login, shot } from './helpers.ts';

async function open(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/#/registry');
  await page.getByRole('tab', { name: 'Catalogue' }).click();
  await expect(page.getByRole('heading', { level: 2, name: /Lignes recensées \(33\)/ })).toBeVisible();
}

test.describe('catalogue des 33 lignes du classeur', () => {
  test('toutes les lignes sont visibles avec leur statut et « modélisé : pourquoi »', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await login(page, 'admin@fisc.test');
    await open(page);
    await expect(page.getByTestId('cat-R01')).toContainText('Retenue à la source');
    await expect(page.getByTestId('cat-R08')).toContainText('Modélisé');
    await expect(page.getByTestId('cat-R16')).toContainText('Non modélisé');
    await expect(page.getByTestId('cat-R16')).toContainText('Bloquant');
    await expect(page.getByTestId('cat-N05')).toContainText('NON TROUVÉ');
    await expect(page.locator('[data-testid^="cat-"]')).toHaveCount(33);
    await expect(page.getByRole('heading', { level: 2, name: /Écarts avec le registre V4/ })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: /Articles de l’annexe 2026 non lus/ })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: /Sources \(11\)/ })).toBeVisible();
    await expectNoCriticalA11y(page, 'catalogue');
    await shot(page, 'catalogue-bureau');

    await page.getByRole('radio', { name: 'Modélisées', exact: true }).click();
    await expect(page.locator('[data-testid^="cat-"]')).toHaveCount(6);
    await page.getByRole('radio', { name: 'Non modélisées', exact: true }).click();
    await expect(page.locator('[data-testid^="cat-"]')).toHaveCount(27);
  });

  test('mobile : pas de défilement horizontal', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await login(page, 'consultant@fisc.test');
    await open(page);
    await expectNoHorizontalScroll(page);
    await expectNoCriticalA11y(page, 'catalogue-mobile');
    await shot(page, 'catalogue-mobile');
  });

  test('thème sombre : contrastes conformes', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.addInitScript(() => { try { localStorage.setItem('fisc.theme', 'dark'); } catch { /* ignoré */ } });
    await login(page, 'admin@fisc.test');
    await open(page);
    await expectNoCriticalA11y(page, 'catalogue-sombre');
    await shot(page, 'catalogue-sombre');
  });

  test('un client n’y a pas accès', async ({ page }) => {
    await login(page, 'client@fisc.test');
    await page.goto('/#/registry');
    await expect(page.getByRole('tab', { name: 'Catalogue' })).toHaveCount(0);
  });
});
