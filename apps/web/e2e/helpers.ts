import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { PASSWORD } from './global-setup.ts';

export const VIEWPORTS = { mobile: { width: 360, height: 780 }, tablet: { width: 768, height: 1024 }, desktop: { width: 1440, height: 900 } } as const;

export async function login(page: Page, email: string, options: { fresh?: boolean } = {}): Promise<void> {
  await page.goto('/');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe').fill(PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('button', { name: 'Se déconnecter' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  if (options.fresh ?? true) {
    // Chaque test part d'un diagnostic vide.
    await page.evaluate(async () => {
      const token = (JSON.parse(sessionStorage.getItem('fisc.session') ?? '{}') as { token?: string }).token ?? '';
      await fetch('/api/diagnostic', { method: 'PUT', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ answers: {}, step: 0 }) });
    });
    await page.reload();
    await expect(page.getByRole('button', { name: 'Se déconnecter' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
}

/** Zéro violation critique ou grave (WCAG 2.2 AA). */
export async function expectNoCriticalA11y(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const bad = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  expect(bad.map((v) => `${label}: ${v.id} — ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`), `axe ${label}`).toEqual([]);
  expect(results.violations.map((v) => `${label}: ${v.id} (${v.impact})`), `axe (toutes gravités) ${label}`).toEqual([]);
}

export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'défilement horizontal').toBeLessThanOrEqual(0);
}

export async function shot(page: Page, name: string): Promise<void> {
  mkdirSync('test-results/screens', { recursive: true });
  await page.screenshot({ path: `test-results/screens/${name}.png`, fullPage: true });
}

export const fillDiagnostic = async (page: Page, v: { profit: string; donations: string; cdi: string; app: string; sal: string; other: string }): Promise<void> => {
  await page.getByLabel('Bénéfice imposable (F CFA)').fill(v.profit);
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByLabel('Dons effectués (F CFA)').fill(v.donations);
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByLabel('Embauches en CDI').fill(v.cdi);
  await page.getByLabel('Apprentis').fill(v.app);
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByLabel('Salaires supplémentaires (F CFA)').fill(v.sal);
  await page.getByLabel('Autres décaissements (F CFA)').fill(v.other);
};
