import { expect, test, type Page } from '@playwright/test';
import { VIEWPORTS, expectNoCriticalA11y, expectNoHorizontalScroll, login, shot } from './helpers.ts';

async function logout(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();
}

test('registre — de EN ATTENTE à CONFIRMÉE par deux validateurs distincts, publication et comparaison', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.desktop);
  await login(page, 'admin@fisc.test');
  await page.goto('/#/registry');
  await expect(page.getByRole('heading', { level: 1, name: 'Registre des règles' })).toBeVisible();
  const rule = page.getByTestId('rule-is-rate');
  await expect(rule).toContainText('En attente');
  await expect(rule).toContainText('Sources candidates');
  await expectNoCriticalA11y(page, 'registre-regles');
  await shot(page, 'registre-desktop');

  await rule.getByRole('button', { name: 'Renseigner' }).click();
  await page.getByLabel('Article').fill('FICTIF-IS');
  await page.getByLabel('Page du texte source').fill('12');
  await page.getByLabel('Date d’effet (AAAA-MM-JJ)').fill('2026-01-01');
  await page.getByLabel('Source (texte, numéro, date)').fill('Source fictive de démonstration');
  await page.getByLabel('Numérateur').fill('1');
  await page.getByLabel('Dénominateur').fill('4');
  await expectNoCriticalA11y(page, 'registre-dialogue');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(rule).toContainText('Projet');
  await expect(rule).toContainText('FICTIF-IS, page 12');
  // L'administrateur ne valide pas lui-même.
  await expect(rule.getByRole('button', { name: /Valider/ })).toHaveCount(0);
  await logout(page);

  await login(page, 'juriste@fisc.test');
  await page.goto('/#/registry');
  await page.getByTestId('rule-is-rate').getByRole('button', { name: 'Valider (juridique)' }).click();
  await expect(page.getByTestId('rule-is-rate')).toContainText('Validée (juridique)');
  await expect(page.getByTestId('rule-is-rate').getByRole('button', { name: /Valider/ })).toHaveCount(0);
  await logout(page);

  await login(page, 'expert@fisc.test');
  await page.goto('/#/registry');
  await page.getByTestId('rule-is-rate').getByRole('button', { name: 'Valider (comptable)' }).click();
  await expect(page.getByTestId('rule-is-rate')).toContainText('Confirmée');
  await logout(page);

  await login(page, 'admin@fisc.test');
  await page.goto('/#/registry');
  await page.getByRole('tab', { name: 'Versions' }).click();
  await page.getByLabel('Nouvelle version (vX.Y.Z)').fill('v1.1.0');
  await page.getByRole('button', { name: 'Publier' }).click();
  await expect(page.getByText('Version v1.1.0 publiée.')).toBeVisible();
  await page.getByLabel('De').click();
  await page.getByRole('option', { name: 'v1.0.0' }).click();
  await page.getByLabel('À').click();
  await page.getByRole('option', { name: 'v1.1.0' }).click();
  await page.getByRole('button', { name: 'Comparer' }).click();
  await expect(page.getByTestId('diff')).toContainText('is-rate');
  await expect(page.getByTestId('diff')).toContainText('modifiée');
  await expectNoCriticalA11y(page, 'registre-versions');
  await shot(page, 'registre-versions-desktop');

  await page.getByRole('tab', { name: 'Journal d’audit' }).click();
  await expect(page.getByText('Chaîne d’empreintes intacte')).toBeVisible();
  await expect(page.getByText('REGISTRY_PUBLISHED')).toBeVisible();
  await expectNoCriticalA11y(page, 'registre-audit');

  // Le client voit maintenant le taux confirmé et sa source, mais pas les autres règles.
  await logout(page);
  await login(page, 'client@fisc.test');
  await page.getByRole('button', { name: 'Pourquoi cette question ?' }).click();
  await expect(page.getByRole('dialog')).toContainText('FICTIF-IS, page 12');
  await expect(page.getByRole('dialog')).toContainText('Confirmée');
});

test('registre sur mobile : pas de défilement horizontal', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.mobile);
  await login(page, 'admin@fisc.test');
  await page.goto('/#/registry');
  await expect(page.getByTestId('rule-is-rate')).toBeVisible();
  await expectNoHorizontalScroll(page);
  await shot(page, 'registre-mobile');
});
