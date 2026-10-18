import { expect, test, type Page } from '@playwright/test';
import { VIEWPORTS, expectNoCriticalA11y, expectNoHorizontalScroll, fillDiagnostic, login, shot } from './helpers.ts';

const NB = ' ';
const money = (n: string): string => `${n.replace(/\B(?=(\d{3})+$)/g, NB)}${NB}F${NB}CFA`;
const base = { profit: '40000000', donations: '4000000', cdi: '2', app: '1', sal: '0', other: '0' };

/** Parcourt les quatre premiers écrans avec des zéros et s'arrête sur l'écran startup. */
async function reachStartupStep(page: Page): Promise<void> {
  for (const field of ['Bénéfice imposable (F CFA)', 'Dons effectués (F CFA)']) {
    await page.getByLabel(field).fill('0');
    await page.getByRole('button', { name: 'Continuer' }).click();
  }
  await page.getByLabel('Embauches en CDI').fill('0');
  await page.getByLabel('Apprentis').fill('0');
  await page.getByLabel('Stagiaires').fill('0');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByLabel('Salaires supplémentaires (F CFA)').fill('0');
  await page.getByLabel('Autres décaissements (F CFA)').fill('0');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(page.getByText('Question 5 sur 6')).toBeVisible();
}

test('questions conditionnelles : année et régime ne sont posés qu’après « Oui », validation en français, réponse masquée non envoyée', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.mobile);
  await login(page, 'consultant@fisc.test');
  await reachStartupStep(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('L’entreprise est-elle une startup numérique labellisée ?');
  await expect(page.getByLabel('Année de labellisation')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Continuer' })).toBeDisabled();

  await page.getByRole('radio', { name: 'Oui', exact: true }).check();
  await expect(page.getByLabel('Année de labellisation')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continuer' })).toBeDisabled();
  await page.getByLabel('Année de labellisation').fill('24');
  await expect(page.getByText('Saisissez une année sur 4 chiffres, entre 1990 et 2100.')).toBeVisible();
  await page.getByLabel('Année de labellisation').fill('2024');
  await page.getByRole('group', { name: 'Régime réel, hors zone franche biotechnologie et TIC' }).getByRole('radio', { name: 'Non', exact: true }).check();
  await expect(page.getByRole('button', { name: 'Continuer' })).toBeEnabled();
  await expectNoCriticalA11y(page, 'startup-oui');
  await expectNoHorizontalScroll(page);
  await shot(page, 'startup-question-mobile');

  // Repasser sur « Non » masque les questions dépendantes ; l'année saisie n'est plus enregistrée.
  await page.getByRole('radio', { name: 'Non', exact: true }).first().check();
  await expect(page.getByLabel('Année de labellisation')).toHaveCount(0);
  await expect(page.getByText('Brouillon enregistré.')).toBeVisible();
  const saved = await page.evaluate(async () => {
    const token = (JSON.parse(sessionStorage.getItem('fisc.session')!) as { token: string }).token;
    return (await (await fetch('/api/diagnostic', { headers: { authorization: `Bearer ${token}` } })).json()) as { answers: Record<string, unknown> };
  });
  expect(saved.answers.isStartup).toBe('NO');
  expect(saved.answers).not.toHaveProperty('startupLabelYear');
  expect(saved.answers).not.toHaveProperty('startupRegime');
});

test('startup labellisée en 2024 : l’exonération supprime l’impôt, dons et crédits sans effet supplémentaire, pas de double compte (mode interne)', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.desktop);
  await login(page, 'consultant@fisc.test');
  await fillDiagnostic(page, base, { startup: { year: '2024', regime: 'Oui' } });
  await page.getByRole('button', { name: 'Voir le résultat' }).click();

  await expect(page.getByTestId('lever-STARTUP_EXEMPTION')).toContainText('Calculée');
  await expect(page.getByTestId('lever-STARTUP_EXEMPTION')).toContainText(money('10000000'));
  await expect(page.getByTestId('gross')).toHaveText(money('10000000'));
  await expect(page.getByTestId('outflows')).toHaveText(money('4000000'));
  await expect(page.getByTestId('net')).toHaveText(money('6000000'));
  await expect(page.getByTestId('lever-DONATIONS')).toContainText('supprime déjà l’impôt');
  await expect(page.getByTestId('lever-CREDIT_CDI')).toContainText('Excédent non remboursable sans texte');
  await expect(page.getByTestId('fee-ht')).toHaveText(money('1200000'));
  await expect(page.getByTestId('fee-ttc')).toHaveText(money('1416000'));
  await expect(page.getByTestId('assumptions')).toContainText('Exonération des startups labellisées');
  await expectNoCriticalA11y(page, 'startup-resultat');
  await shot(page, 'startup-resultat-bureau');
});

test('startup hors période (labellisée en 2020) : levier nul, le calcul habituel reprend', async ({ page }) => {
  await login(page, 'consultant@fisc.test');
  await fillDiagnostic(page, base, { startup: { year: '2020', regime: 'Oui' } });
  await page.getByRole('button', { name: 'Voir le résultat' }).click();
  await expect(page.getByTestId('lever-STARTUP_EXEMPTION')).toContainText('Nulle');
  await expect(page.getByTestId('lever-STARTUP_EXEMPTION')).toContainText('2021 à 2023');
  await expect(page.getByTestId('gross')).toHaveText(money('3500000'));
});

test('TVA sur le carburant agricole : conditions remplies → TVA récupérée, ajoutée aux trois montants (mode interne)', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.mobile);
  await login(page, 'consultant@fisc.test');
  await fillDiagnostic(page, { ...base, donations: '0', cdi: '0', app: '0' }, { agri: { fuelVat: '1200000' } });
  await expectNoCriticalA11y(page, 'tva-agricole-oui');
  await shot(page, 'tva-agricole-question-mobile');
  await page.getByRole('button', { name: 'Voir le résultat' }).click();
  const card = page.getByTestId('lever-VAT_FUEL_RECOVERY');
  await expect(card).toContainText('Calculée');
  await expect(card).toContainText(money('1200000'));
  await expect(page.getByTestId('gross')).toHaveText(money('1200000'));
  await expect(page.getByTestId('net')).toHaveText(money('1200000'));
  await card.getByRole('button', { name: /Voir la source/ }).click();
  await expect(page.getByRole('dialog')).toContainText('TEST — TVA sur carburant entièrement récupérable (fictif)');
  await expect(page.getByRole('dialog')).toContainText('règle de TEST');
  await expectNoCriticalA11y(page, 'tva-agricole-source');
});

test('mode client : les deux nouveaux leviers restent non calculables tant que leurs règles ne sont pas confirmées et publiées', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.mobile);
  await login(page, 'client@fisc.test');
  await fillDiagnostic(page, { ...base, donations: '0', cdi: '0', app: '0' }, { startup: { year: '2024', regime: 'Oui' }, agri: { fuelVat: '1200000' } });
  await page.getByRole('button', { name: 'Voir le résultat' }).click();
  for (const id of ['STARTUP_EXEMPTION', 'VAT_FUEL_RECOVERY']) {
    const card = page.getByTestId(`lever-${id}`);
    await expect(card).toContainText('Non calculable');
    await expect(card).not.toContainText('F CFA');
  }
  await expect(page.getByTestId('blocked')).toContainText('Exonération des startups labellisées');
  await expect(page.getByTestId('blocked')).toContainText('TVA sur le carburant des exploitants agricoles');
  expect(await page.locator('body').innerText()).not.toContain('TEST');
  await expectNoCriticalA11y(page, 'client-startup-tva');
  await shot(page, 'startup-tva-client-mobile');
});
