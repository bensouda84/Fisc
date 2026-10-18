import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
type Tokens = Record<string, string>;

const lum = (hex: string): number => {
  const c = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};
const ratio = (a: string, b: string): number => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

const PAIRS: [string, string][] = [
  ['onPrimary', 'primary'], ['onPrimaryContainer', 'primaryContainer'], ['onSecondary', 'secondary'], ['onSecondaryContainer', 'secondaryContainer'],
  ['onTertiary', 'tertiary'], ['onTertiaryContainer', 'tertiaryContainer'], ['onError', 'error'], ['onErrorContainer', 'errorContainer'],
  ['onBackground', 'background'], ['onSurface', 'surface'], ['onSurfaceVariant', 'surfaceVariant'],
];

test('contraste de tous les rôles de couleur (clair et sombre) ≥ 4,5:1', async ({ page }) => {
  await page.goto('/mw.html');
  const { light, dark } = (await page.evaluate(() => (globalThis as unknown as { __tokens: unknown }).__tokens)) as { light: Tokens; dark: Tokens };
  const rows: string[] = [];
  for (const [name, t] of [['clair', light], ['sombre', dark]] as const) {
    for (const [fg, bg] of PAIRS) {
      const r = ratio(t[fg]!, t[bg]!);
      rows.push(`${name} ${fg}/${bg}: ${r.toFixed(2)}`);
      expect(r, `${name} ${fg}/${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  }
  console.log(rows.join('\n'));
});

async function report(page: Page, entry: string, scheme: string): Promise<Record<string, unknown>> {
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  const chip = page.locator('[data-chip="CALCULATED"] > *').first();
  const chipBg = await chip.evaluate((el) => { const inner = el.shadowRoot?.querySelector('.container') ?? el; return getComputedStyle(inner).backgroundColor; });
  const box = (await chip.boundingBox())!;
  const roleButtons = await page.getByRole('button', { name: /Calculée|Non calculable|Nulle|Partielle/ }).count();
  const tabStops: string[] = [];
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    tabStops.push(await page.evaluate(() => {
      let el: Element | null = document.activeElement;
      while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
      const host = document.activeElement;
      return `${host?.tagName.toLowerCase()}${host?.getAttribute('label') ? `[${host.getAttribute('label')}]` : ''}`;
    }));
  }
  const chipTabStops = tabStops.filter((s) => /chip|Calcul|Nulle|Partielle/i.test(s)).length;
  const btn = (await page.locator(entry === 'mw' ? 'md-filled-button' : 'button:has-text("Continuer")').first().boundingBox())!;
  const bg = await chip.evaluate((el) => {
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, fg: s.color };
  });
  return {
    entry, scheme,
    axeViolations: axe.violations.map((v) => `${v.id}(${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).slice(0, 2).join(' | ')}`),
    chipSize: `${Math.round(box.width)}x${Math.round(box.height)}`,
    chipsExposedAsButtons: roleButtons,
    tabStopsOnStatusChips: chipTabStops,
    continueButtonHeight: Math.round(btn.height),
    chipComputed: bg, chipContainerBg: chipBg,
  };
}

for (const entry of ['mw', 'mui'] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`${entry} — ${scheme}`, async ({ page }) => {
      await page.goto(`/${entry}.html?scheme=${scheme}`);
      await expect(page.locator('[data-chip="CALCULATED"]')).toBeVisible();
      await page.waitForTimeout(500);
      const r = await report(page, entry, scheme);
      console.log(JSON.stringify(r, null, 1));
      await page.screenshot({ path: `results/${entry}-${scheme}.png` });
    });
  }
}

test('captures du focus clavier (chip, champ, bouton) pour relecture visuelle', async ({ page }) => {
  for (const entry of ['mw', 'mui']) {
    await page.goto(`/${entry}.html`);
    for (let i = 0; i < 7; i++) await page.keyboard.press('Tab');
    await page.screenshot({ path: `results/${entry}-focus-button.png` });
    await page.goto(`/${entry}.html`);
    for (let i = 0; i < (entry === 'mw' ? 5 : 2); i++) await page.keyboard.press('Tab');
    await page.screenshot({ path: `results/${entry}-focus-field.png` });
  }
});

test('focus visible au clavier sur le bouton, le champ et le chip', async ({ page }) => {
  for (const entry of ['mw', 'mui']) {
    await page.goto(`/${entry}.html`);
    const out: string[] = [];
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      out.push(await page.evaluate(() => {
        const host = document.activeElement!;
        const inner = host.shadowRoot?.activeElement ?? host;
        const cs = getComputedStyle(inner);
        const hs = getComputedStyle(host);
        const ring = (s: CSSStyleDeclaration): string => `${s.outlineStyle} ${s.outlineWidth} ${s.boxShadow === 'none' ? '' : 'shadow'}`;
        return `${host.tagName.toLowerCase()} | host:${ring(hs)} | inner:${ring(cs)}`;
      }));
    }
    console.log(`${entry}\n${out.join('\n')}`);
  }
});
