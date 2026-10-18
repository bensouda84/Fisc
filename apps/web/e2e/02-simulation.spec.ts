import { expect, test } from '@playwright/test';
import { VIEWPORTS, expectNoCriticalA11y, expectNoHorizontalScroll, fillDiagnostic, login, shot } from './helpers.ts';

const NB = ' ';
const money = (n: string): string => `${n.replace(/\B(?=(\d{3})+$)/g, NB)}${NB}F${NB}CFA`;

test('parcours 2 — la simulation recalcule immédiatement et ne modifie jamais le registre', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.mobile);
  await login(page, 'consultant@fisc.test');
  await fillDiagnostic(page, { profit: '40000000', donations: '4000000', cdi: '2', app: '1', sal: '0', other: '0' });
  await page.getByRole('button', { name: 'Voir le résultat' }).click();
  await expect(page.getByTestId('gross')).toHaveText(money('3500000'));

  const registryBefore = await page.evaluate(async () => {
    const token = (JSON.parse(sessionStorage.getItem('fisc.session')!) as { token: string }).token;
    return (await (await fetch('/api/registry', { headers: { authorization: `Bearer ${token}` } })).text());
  });

  await page.goto('/#/simulation');
  await expect(page.getByRole('heading', { level: 1, name: 'Simulation' })).toBeVisible();
  await expect(page.getByTestId('gross')).toHaveText(money('3500000'));
  await expectNoCriticalA11y(page, 'simulation');
  await expectNoHorizontalScroll(page);

  // T2 par la simulation : plus de crédits n'existe pas ici, on teste dons = 0 → brut 2 500 000.
  await page.getByLabel('Dons effectués (F CFA)').fill('0');
  await expect(page.getByTestId('gross')).toHaveText(money('2500000'));
  await expect(page.getByTestId('net')).toHaveText(money('2500000'));
  // Valeur invalide : message en français, le dernier résultat valide reste affiché.
  await page.getByLabel('Salaires supplémentaires (F CFA)').fill('1,5');
  await expect(page.getByText('Saisissez un montant entier en F CFA, sans virgule.')).toBeVisible();
  await page.getByLabel('Salaires supplémentaires (F CFA)').fill('1000000');
  await expect(page.getByTestId('net')).toHaveText(money('1500000'));
  // Curseur au clavier.
  const slider = page.getByRole('slider', { name: /Bénéfice imposable/ });
  await slider.focus();
  await page.keyboard.press('End');
  await expect(page.getByLabel('Bénéfice imposable (F CFA)')).toHaveValue('200000000');
  await shot(page, 'simulation-mobile');

  const registryAfter = await page.evaluate(async () => {
    const token = (JSON.parse(sessionStorage.getItem('fisc.session')!) as { token: string }).token;
    return (await (await fetch('/api/registry', { headers: { authorization: `Bearer ${token}` } })).text());
  });
  expect(registryAfter).toBe(registryBefore);
});

test('simulation sur grand écran', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.desktop);
  await login(page, 'consultant@fisc.test');
  await fillDiagnostic(page, { profit: '40000000', donations: '4000000', cdi: '2', app: '1', sal: '0', other: '0' });
  await page.getByRole('button', { name: 'Voir le résultat' }).click();
  await page.goto('/#/simulation');
  await expect(page.getByTestId('gross')).toHaveText(money('3500000'));
  await shot(page, 'simulation-desktop');
});
