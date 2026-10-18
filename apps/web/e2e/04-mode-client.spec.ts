import { expect, test } from '@playwright/test';
import { VIEWPORTS, expectNoCriticalA11y, expectNoHorizontalScroll, fillDiagnostic, login, shot } from './helpers.ts';

test('mode client — aucun chiffre sans règle confirmée, aucun faux zéro, aucune règle de TEST', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.mobile);
  await login(page, 'client@fisc.test');
  await expect(page.getByRole('navigation', { name: 'Navigation principale' }).getByText('Registre')).toHaveCount(0);
  await fillDiagnostic(page, { profit: '40000000', donations: '4000000', cdi: '2', app: '1', sal: '0', other: '0' });
  await page.getByRole('button', { name: 'Voir le résultat' }).click();
  await expect(page.getByRole('heading', { name: 'Résultat de la simulation' })).toBeVisible();

  await expect(page.getByTestId('count-NOT_COMPUTABLE')).toContainText('3');
  await expect(page.getByTestId('count-CALCULATED')).toContainText('0');
  for (const id of ['gross', 'net']) await expect(page.getByTestId(id)).toContainText('Non calculable');
  await expect(page.getByTestId('fees-none')).toBeVisible();
  await expect(page.getByTestId('internal-banner')).toHaveCount(0);
  await expect(page.getByTestId('assumptions')).toHaveCount(0);
  await expect(page.getByTestId('blocked')).toContainText('Taux de l’impôt sur les sociétés');
  for (const id of ['DONATIONS', 'CREDIT_CDI', 'CREDIT_APPRENTICE']) {
    const card = page.getByTestId(`lever-${id}`);
    await expect(card).toContainText('Non calculable');
    await expect(card).not.toContainText('F CFA');
  }
  // T7 : la page entière ne mentionne aucune règle de TEST.
  expect(await page.locator('body').innerText()).not.toContain('TEST');
  await expectNoCriticalA11y(page, 'client-resultat');
  await expectNoHorizontalScroll(page);
  await shot(page, 'client-resultat-mobile');

  // Le « Pourquoi ? » ne révèle ni source interne ni règle de TEST.
  await page.goto('/#/diagnostic');
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Retour' }).click();
  await expect(page.getByText('Question 1 sur 4')).toBeVisible();
  await page.getByRole('button', { name: 'Pourquoi cette question ?' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('en cours de confirmation');
  expect(await dialog.innerText()).not.toContain('TEST');
});

test('le client ne voit pas le registre', async ({ page }) => {
  await login(page, 'client@fisc.test');
  await page.goto('/#/registry');
  const status = await page.evaluate(async () => {
    const token = (JSON.parse(sessionStorage.getItem('fisc.session')!) as { token: string }).token;
    return (await fetch('/api/rules', { headers: { authorization: `Bearer ${token}` } })).status;
  });
  expect(status).toBe(403);
});
