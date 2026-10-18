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
  // Attendre la fin des transitions : axe lirait sinon des couleurs intermédiaires.
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))));
  await page.waitForTimeout(350);
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

export interface Gates {
  /** `null` = « Non » ; sinon l'année de labellisation et la réponse sur le régime (« Oui », « Non » ou « Je ne sais pas »). */
  startup?: null | { year: string; regime: 'Oui' | 'Non' | 'Je ne sais pas' };
  /** `null` = « Non » ; sinon la TVA supportée sur le carburant. */
  agri?: null | { fuelVat: string };
}

/** Réponses des deux derniers écrans (startup, TVA agricole). Par défaut : « Non » aux deux portes. */
export async function answerGates(page: Page, gates: Gates = {}): Promise<void> {
  const startup = gates.startup ?? null;
  if (startup === null) {
    await page.getByRole('radio', { name: 'Non', exact: true }).check();
  } else {
    await page.getByRole('radio', { name: 'Oui', exact: true }).check();
    await page.getByLabel('Année de labellisation').fill(startup.year);
    await page.getByRole('group', { name: 'Régime réel, hors zone franche biotechnologie et TIC' }).getByRole('radio', { name: startup.regime, exact: true }).check();
  }
  await page.getByRole('button', { name: 'Continuer' }).click();
  const agri = gates.agri ?? null;
  if (agri === null) {
    await page.getByRole('radio', { name: 'Non', exact: true }).check();
  } else {
    await page.getByRole('radio', { name: 'Oui', exact: true }).check();
    await page.getByLabel(/TVA supportée sur le gaz/).fill(agri.fuelVat);
  }
}

/** Remplit les six écrans et s'arrête sur le dernier, avant « Voir le résultat ». */
export const fillDiagnostic = async (
  page: Page,
  v: { profit: string; donations: string; cdi: string; app: string; sal: string; other: string },
  gates: Gates = {},
): Promise<void> => {
  await page.getByLabel('Bénéfice imposable (F CFA)').fill(v.profit);
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByLabel('Dons effectués (F CFA)').fill(v.donations);
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByLabel('Embauches en CDI').fill(v.cdi);
  await page.getByLabel('Apprentis').fill(v.app);
  await page.getByLabel('Stagiaires').fill('0');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByLabel('Salaires supplémentaires (F CFA)').fill(v.sal);
  await page.getByLabel('Autres décaissements (F CFA)').fill(v.other);
  await page.getByRole('button', { name: 'Continuer' }).click();
  await answerGates(page, gates);
};

/** Sauvegarde directe d'un diagnostic complet (les deux portes « Non » par défaut). */
export async function seedDiagnostic(page: Page, extra: Record<string, string | number> = {}): Promise<void> {
  await page.evaluate(async (extraAnswers) => {
    const token = (JSON.parse(sessionStorage.getItem('fisc.session') ?? '{}') as { token?: string }).token ?? '';
    const answers = { profit: '40000000', donations: '4000000', cdiHires: 2, apprentices: 1, interns: 0, extraSalaries: '0', otherOutflows: '0', isStartup: 'NO', vatAgri: 'NO', ...extraAnswers };
    await fetch('/api/diagnostic', { method: 'PUT', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ answers, step: 5 }) });
  }, extra);
}
