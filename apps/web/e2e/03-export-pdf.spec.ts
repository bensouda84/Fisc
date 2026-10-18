import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';
import { VIEWPORTS, expectNoCriticalA11y, fillDiagnostic, login } from './helpers.ts';

const NB = ' ';
const money = (n: string): string => `${n.replace(/\B(?=(\d{3})+$)/g, NB)}${NB}F${NB}CFA`;
const norm = (s: string): string => s.replace(/[  ]/g, ' ');

test('parcours 3 — le dossier de preuve PDF donne les mêmes montants que l’écran', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.desktop);
  await login(page, 'consultant@fisc.test');
  await fillDiagnostic(page, { profit: '40000000', donations: '0', cdi: '2', app: '0', sal: '0', other: '0' });
  await page.getByRole('button', { name: 'Voir le résultat' }).click();
  await expect(page.getByTestId('fee-ttc')).toHaveText(money('472000'));

  const screen = {
    gross: await page.getByTestId('gross').innerText(),
    outflows: await page.getByTestId('outflows').innerText(),
    net: await page.getByTestId('net').innerText(),
    ht: await page.getByTestId('fee-ht').innerText(),
    vat: await page.getByTestId('fee-vat').innerText(),
    ttc: await page.getByTestId('fee-ttc').innerText(),
  };
  await expectNoCriticalA11y(page, 'export');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exporter le dossier de preuve (PDF)' }).click(),
  ]);
  const file = await download.path();
  await expect(page.getByText('Dossier de preuve téléchargé.')).toBeVisible();
  mkdirSync('test-results/exports', { recursive: true });
  copyFileSync(file, 'test-results/exports/dossier-de-preuve-exemple-interne.pdf');

  const text = norm(execFileSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8' }));
  for (const v of Object.values(screen)) expect(text, `le PDF contient « ${v} »`).toContain(norm(v));
  expect(text).toContain('Dossier de preuve — simulation fiscale');
  expect(text).toContain('Version du registre des règles : v1.0.0');
  expect(text).toContain('Hypothèses saisies');
  expect(text).toContain('ne remplace pas l’avis d’un professionnel');
  expect(text).toContain('DOCUMENT INTERNE');
});
