import { expect, test } from '@playwright/test';
import { VIEWPORTS, expectNoCriticalA11y, expectNoHorizontalScroll, shot } from './helpers.ts';

const NB = ' ';
const money = (n: string): string => `${n.replace(/\B(?=(\d{3})+$)/g, NB)}${NB}F${NB}CFA`;

test('estimation sans compte : le chiffre d’affaires seul montre ce qui manque, sans chiffre inventé', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.mobile);
  await page.goto('/');
  await page.getByRole('link', { name: 'Estimer sans compte' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Estimation express' })).toBeVisible();
  await expectNoCriticalA11y(page, 'estimation-vide');
  await shot(page, 'estimation-1-mobile');

  // Validation en français.
  await page.getByLabel('Chiffre d’affaires annuel (F CFA)').fill('12,5');
  await expect(page.getByText('Saisissez un montant entier supérieur à 0 F CFA, sans virgule ni espace.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Estimer' })).toBeDisabled();
  await page.getByLabel('Chiffre d’affaires annuel (F CFA)').fill('100000000');
  await expect(page.getByText(`Soit ${money('100000000')}`)).toBeVisible();
  await page.getByLabel(/Marge bénéficiaire estimée/).fill('101');
  await expect(page.getByText('Saisissez un nombre entier entre 0 et 100.')).toBeVisible();
  await page.getByLabel(/Marge bénéficiaire estimée/).fill('');

  await page.getByRole('button', { name: 'Estimer' }).click();
  const result = page.getByTestId('estimate-result');
  await expect(result).toBeVisible();
  await expect(page.getByTestId('estimate-tax-none')).toHaveText('Non calculable');
  await expect(page.getByTestId('estimate-tax-reason')).toContainText('Indiquez une marge bénéficiaire estimée');
  for (const id of ['DONATIONS', 'CREDIT_CDI', 'CREDIT_APPRENTICE']) {
    const card = page.getByTestId(`lever-${id}`);
    await expect(card).toContainText('Non calculable');
    await expect(card).not.toContainText('F CFA');
  }
  expect(await page.locator('body').innerText()).not.toContain('TEST');
  await expect(page.getByTestId('disclaimer')).toContainText('ne remplace pas l’avis d’un professionnel');
  await expect(page.getByTestId('estimate-date')).toContainText(/Estimation établie le \d{1,2}(er)? \w+ \d{4} · registre des règles v/);
  await expect(page.getByRole('link', { name: 'Créer mon compte pour compléter le diagnostic' })).toBeVisible();
  await expectNoCriticalA11y(page, 'estimation-resultat');
  await expectNoHorizontalScroll(page);
  await shot(page, 'estimation-2-resultat-mobile');
});

test('avec une marge, l’impôt avant optimisation est chiffré et sourcé (règle confirmée), les leviers restent non calculables', async ({ page }) => {
  await page.goto('/#/estimation');
  await page.getByLabel('Chiffre d’affaires annuel (F CFA)').fill('100000000');
  await page.getByLabel(/Marge bénéficiaire estimée/).fill('10');
  await page.getByRole('button', { name: 'Estimer' }).click();
  await expect(page.getByTestId('estimate-tax')).toHaveText(money('2500000'));
  await expect(page.getByText(`Hypothèse : bénéfice estimé à ${money('10000000')} (10 % de votre chiffre d’affaires).`)).toBeVisible();
  await expect(page.getByTestId('lever-DONATIONS')).toContainText('Non calculable');
  await page.getByRole('button', { name: 'Voir la source', exact: true }).first().click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toContainText('FICTIF-IS');
  await expect(sheet).toContainText('Confirmée');
  await expect(sheet).toContainText('v1.1.0');
  await expectNoCriticalA11y(page, 'estimation-source');
});

test('de l’estimation à l’inscription : compte client, estimation reportée dans le diagnostic', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.mobile);
  await page.goto('/#/estimation');
  await page.getByLabel('Chiffre d’affaires annuel (F CFA)').fill('200000000');
  await page.getByLabel(/Marge bénéficiaire estimée/).fill('5');
  await page.getByRole('button', { name: 'Estimer' }).click();
  await expect(page.getByTestId('estimate-tax')).toHaveText(money('2500000'));
  await page.getByRole('link', { name: 'Créer mon compte pour compléter le diagnostic' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Créer votre compte' })).toBeVisible();
  await expectNoCriticalA11y(page, 'inscription');
  await shot(page, 'inscription-mobile');
  const email = `prospect-${Date.now()}@exemple.test`;
  await page.getByRole('textbox', { name: 'Adresse e-mail' }).fill(email);
  await page.getByLabel('Mot de passe').fill('court');
  await expect(page.getByText('Saisissez au moins 12 caractères.')).toBeVisible();
  await page.getByLabel('Mot de passe').fill('un-mot-de-passe-solide');
  const submit = page.getByRole('button', { name: 'Créer mon compte' });
  await expect(submit).toBeDisabled(); // consentement requis
  await page.getByRole('button', { name: 'Vos données personnelles' }).click();
  await expect(page.getByText('Aucun nom de salarié n’est demandé.')).toBeVisible();
  await page.getByLabel('J’accepte que mesimpo traite mon adresse e-mail pour gérer mon compte.').check();
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect(page.getByRole('button', { name: 'Se déconnecter' })).toBeVisible();
  await expect(page.getByText('Question 1 sur 6')).toBeVisible();
  await expect(page.getByLabel('Bénéfice imposable (F CFA)')).toHaveValue('10000000');
  await expect(page.getByRole('navigation', { name: 'Navigation principale' }).getByText('Registre')).toHaveCount(0);
  await expect(page.getByText('Client', { exact: true })).toBeVisible();
  await expectNoCriticalA11y(page, 'apres-inscription');

  // Un second compte avec la même adresse est refusé avec un message clair.
  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await page.goto('/#/inscription');
  await page.getByRole('textbox', { name: 'Adresse e-mail' }).fill(email.toUpperCase());
  await page.getByLabel('Mot de passe').fill('un-mot-de-passe-solide');
  await page.getByLabel('J’accepte que mesimpo traite mon adresse e-mail pour gérer mon compte.').check();
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page.getByRole('alert')).toContainText('Un compte existe déjà avec cette adresse. Connectez-vous.');
});

test.describe('en sombre et à 320 px', () => {
  test.use({ colorScheme: 'dark' });
  test('estimation et inscription : axe, pas de défilement horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    for (const route of ['/', '/#/estimation', '/#/inscription']) {
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      await expectNoHorizontalScroll(page);
      await expectNoCriticalA11y(page, `sombre-public-${route}`);
    }
    await page.goto('/#/estimation');
    await page.getByLabel('Chiffre d’affaires annuel (F CFA)').fill('100000000');
    await page.getByLabel(/Marge bénéficiaire estimée/).fill('10');
    await page.getByRole('button', { name: 'Estimer' }).click();
    await expect(page.getByTestId('estimate-tax')).toBeVisible();
    await expectNoCriticalA11y(page, 'sombre-estimation-resultat');
    await shot(page, 'estimation-sombre-320');
  });
});
