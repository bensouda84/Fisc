import { expect, test } from '@playwright/test';
import { VIEWPORTS, expectNoCriticalA11y, expectNoHorizontalScroll, fillDiagnostic, login, shot } from './helpers.ts';

const NB = ' ';
const money = (n: string): string => `${n.replace(/\B(?=(\d{3})+$)/g, NB)}${NB}F${NB}CFA`;

test('parcours 1 — du diagnostic au résultat sourcé en moins de 5 minutes (mode interne)', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.mobile);
  const t0 = Date.now();
  await login(page, 'consultant@fisc.test');
  await expect(page.getByText('Question 1 sur 4')).toBeVisible();
  await expectNoCriticalA11y(page, 'diagnostic-1');
  await expectNoHorizontalScroll(page);
  await shot(page, 'diagnostic-1-mobile');

  // « Pourquoi cette question ? » renvoie au texte concerné.
  await page.getByRole('button', { name: 'Pourquoi cette question ?' }).click();
  await expect(page.getByRole('dialog', { name: 'Pourquoi cette question ?' })).toContainText('Taux de l’impôt sur les sociétés');
  await expectNoCriticalA11y(page, 'pourquoi');
  await shot(page, 'pourquoi-mobile');
  await page.keyboard.press('Escape');

  // Validation en français, sans bloquer la saisie.
  await page.getByLabel('Bénéfice imposable (F CFA)').fill('12,5');
  await expect(page.getByText('Saisissez un montant entier en F CFA, sans virgule ni espace.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continuer' })).toBeDisabled();

  await fillDiagnostic(page, { profit: '40000000', donations: '4000000', cdi: '2', app: '1', sal: '0', other: '0' });
  await expectNoCriticalA11y(page, 'diagnostic-4');
  await page.getByRole('button', { name: 'Voir le résultat' }).click();

  await expect(page.getByRole('heading', { name: 'Résultat de la simulation' })).toBeVisible();
  await expect(page.getByTestId('gross')).toHaveText(money('3500000'));
  await expect(page.getByTestId('outflows')).toHaveText(money('4000000'));
  await expect(page.getByTestId('net')).toHaveText(`−${money('500000')}`);
  await expect(page.getByTestId('fee-ttc')).toHaveText(money('0'));
  await expect(page.getByTestId('internal-banner')).toBeVisible();
  await expect(page.getByTestId('count-CALCULATED')).toContainText('3');

  // Source en un clic : article, page, statut, date d'effet, version du registre.
  await page.getByRole('button', { name: 'Voir la source : Crédit d’impôt — CDI' }).click();
  const sheet = page.getByRole('dialog');
  for (const t of ['Article', 'Page', 'Statut', 'Date d’effet', 'Version du registre', 'règle de TEST']) await expect(sheet).toContainText(t);
  await expectNoCriticalA11y(page, 'source');
  await shot(page, 'source-mobile');
  await page.keyboard.press('Escape');

  const seconds = (Date.now() - t0) / 1000;
  test.info().annotations.push({ type: 'temps jusqu’au premier résultat sourcé (s)', description: seconds.toFixed(1) });
  expect(seconds).toBeLessThan(300);

  await expectNoCriticalA11y(page, 'resultat');
  await expectNoHorizontalScroll(page);
  await shot(page, 'resultat-mobile');
});

test('« Je ne sais pas » rend le levier non calculable, jamais nul', async ({ page }) => {
  await login(page, 'consultant@fisc.test');
  await page.getByLabel('Bénéfice imposable (F CFA)').fill('40000000');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByLabel('Je ne sais pas').check();
  await expect(page.getByLabel('Dons effectués (F CFA)')).toBeDisabled();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByLabel('Embauches en CDI').fill('0');
  await page.getByLabel('Apprentis').fill('0');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByLabel('Salaires supplémentaires (F CFA)').fill('0');
  await page.getByLabel('Autres décaissements (F CFA)').fill('0');
  await page.getByRole('button', { name: 'Voir le résultat' }).click();
  const donations = page.getByTestId('lever-DONATIONS');
  await expect(donations).toContainText('Non calculable');
  await expect(donations).toContainText('Vous ne savez pas le montant des dons');
  await expect(donations).not.toContainText('0 F CFA');
  await expect(page.getByTestId('gross')).toContainText('Partielle');
  await expect(page.getByTestId('net')).toContainText('Partielle');
  await expect(page.getByTestId('fees-none')).toBeVisible();
});

test('la sauvegarde automatique conserve le diagnostic après rechargement', async ({ page }) => {
  await login(page, 'consultant@fisc.test');
  await page.getByLabel('Bénéfice imposable (F CFA)').fill('123456789');
  await expect(page.getByText('Brouillon enregistré.')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Bénéfice imposable (F CFA)')).toHaveValue('123456789');
});

test('adaptatif : défilement horizontal absent et navigation adaptée à 360, 768 et 1440 px', async ({ page }) => {
  await login(page, 'consultant@fisc.test');
  await page.evaluate(async () => {
    const token = (JSON.parse(sessionStorage.getItem('fisc.session') ?? '{}') as { token?: string }).token ?? '';
    const answers = { profit: '40000000', donations: '4000000', cdiHires: 2, apprentices: 1, extraSalaries: '0', otherOutflows: '0' };
    await fetch('/api/diagnostic', { method: 'PUT', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ answers, step: 3 }) });
  });
  for (const [name, size] of Object.entries(VIEWPORTS)) {
    await page.setViewportSize(size);
    for (const route of ['diagnostic', 'result', 'simulation', 'registry']) {
      await page.goto(`/#/${route}`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expectNoHorizontalScroll(page);
    }
    await page.goto('/#/result');
    await expect(page.getByTestId('gross')).toBeVisible();
    await shot(page, `resultat-${name}`);
    const nav = page.getByRole('navigation', { name: 'Navigation principale' });
    await expect(nav).toBeVisible();
    const box = (await nav.boundingBox())!;
    if (name === 'mobile') expect(box.y).toBeGreaterThan(size.height / 2);
    else expect(box.x).toBeLessThan(8);
    if (name === 'tablet') expect(box.width).toBeLessThan(120);
    if (name === 'desktop') expect(box.width).toBeGreaterThan(240);
  }
});

test('accessibilité clavier : focus visible et cibles de 48 px', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.mobile);
  await login(page, 'consultant@fisc.test');
  await page.getByLabel('Bénéfice imposable (F CFA)').fill('1');
  // Au clavier, chaque bouton atteint par Tab montre un indicateur de focus visible.
  const outlines: string[] = [];
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement!;
      const cs = getComputedStyle(el);
      return { tag: el.tagName, role: el.getAttribute('role'), outline: cs.outlineStyle, width: cs.outlineWidth };
    });
    if (info.tag === 'BUTTON' || info.tag === 'A') outlines.push(`${info.outline} ${info.width}`);
  }
  expect(outlines.length).toBeGreaterThan(2);
  for (const o of outlines) expect(o).not.toMatch(/^none/);
  for (const name of ['Continuer', 'Se déconnecter', 'Pourquoi cette question ?']) {
    const b = (await page.getByRole('button', { name }).boundingBox())!;
    expect(b.height, name).toBeGreaterThanOrEqual(48);
    expect(b.width, name).toBeGreaterThanOrEqual(48);
  }
});
