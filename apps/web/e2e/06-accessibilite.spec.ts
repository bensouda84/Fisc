import { expect, test } from '@playwright/test';
import { expectNoCriticalA11y, expectNoHorizontalScroll, login } from './helpers.ts';

async function seedDiagnostic(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(async () => {
    const token = (JSON.parse(sessionStorage.getItem('fisc.session') ?? '{}') as { token?: string }).token ?? '';
    const answers = { profit: '40000000', donations: '4000000', cdiHires: 2, apprentices: 1, extraSalaries: '0', otherOutflows: '0', isStartup: 'NO', vatAgri: 'NO' };
    await fetch('/api/diagnostic', { method: 'PUT', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ answers, step: 3 }) });
  });
}

test('mouvement réduit : les transitions sont neutralisées', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page, 'consultant@fisc.test');
  const durations = await page.evaluate(() => [...document.querySelectorAll('button')].map((b) => getComputedStyle(b).transitionDuration));
  expect(durations.length).toBeGreaterThan(0);
  for (const d of durations) {
    for (const part of d.split(',')) {
      const seconds = part.trim().endsWith('ms') ? Number.parseFloat(part) / 1000 : Number.parseFloat(part);
      expect(seconds).toBeLessThan(0.001);
    }
  }
});

test('reflux à 320 px (zoom 400 %) : aucun défilement horizontal, aucune violation axe', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await login(page, 'consultant@fisc.test');
  await seedDiagnostic(page);
  for (const route of ['diagnostic', 'result', 'simulation', 'registry']) {
    await page.goto(`/#/${route}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    if (route === 'result') await expect(page.getByTestId('gross')).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoCriticalA11y(page, `320px-${route}`);
  }
});

test('taille de texte x2 : les contenus restent accessibles sans défilement horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await login(page, 'consultant@fisc.test');
  await seedDiagnostic(page);
  await page.goto('/#/result');
  await expect(page.getByTestId('gross')).toBeVisible();
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await expectNoHorizontalScroll(page);
  await expect(page.getByRole('button', { name: 'Exporter le dossier de preuve (PDF)' })).toBeVisible();
});

test('lecteur d’écran : repères, titres et annonces', async ({ page }) => {
  await login(page, 'consultant@fisc.test');
  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toHaveCount(1);
  await expect(page.getByRole('banner')).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Aller au contenu' })).toHaveCount(1);
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  // Le titre de l'étape reçoit le focus à chaque changement d'écran.
  await page.getByLabel('Bénéfice imposable (F CFA)').fill('1000');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await expect(page.locator('[aria-live="polite"]').first()).toBeAttached();
});
