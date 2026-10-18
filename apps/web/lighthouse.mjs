// Lighthouse mobile sur les écrans connectés. Prérequis : API (port 3101) et `vite preview` (port 4174) démarrés,
// base seedée avec les comptes de démonstration (voir e2e/global-setup.ts).
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import lighthouse from 'lighthouse';
import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4174';
const PORT = 9333;
const PASSWORD = process.env.E2E_PASSWORD ?? 'mot-de-passe-e2e-fictif';
const exe = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium';
const THRESHOLD = Number(process.env.LH_THRESHOLD ?? 90);

const profile = mkdtempSync(join(tmpdir(), 'lh-'));
const chrome = spawn(existsSync(exe) ? exe : chromium.executablePath(), [
  `--remote-debugging-port=${PORT}`, '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-background-networking',
  '--disable-sync', '--no-first-run', `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
const page = await browser.contexts()[0].newPage();
const targets = [];

// Écran public.
targets.push({ name: 'connexion', url: `${BASE}/` });

// Écrans connectés.
await page.goto(BASE);
await page.getByLabel('Adresse e-mail').fill('consultant@fisc.test');
await page.getByLabel('Mot de passe').fill(PASSWORD);
await page.getByRole('button', { name: 'Se connecter' }).click();
await page.getByRole('button', { name: 'Se déconnecter' }).waitFor();
await page.evaluate(async () => {
  const token = JSON.parse(sessionStorage.getItem('fisc.session')).token;
  const answers = { profit: '40000000', donations: '4000000', cdiHires: 2, apprentices: 1, extraSalaries: '0', otherOutflows: '0' };
  await fetch('/api/diagnostic', { method: 'PUT', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ answers, step: 0 }) });
});
targets.push({ name: 'diagnostic', url: `${BASE}/#/diagnostic` }, { name: 'resultat', url: `${BASE}/#/result` }, { name: 'simulation', url: `${BASE}/#/simulation` });

mkdirSync('test-results/lighthouse', { recursive: true });
const summary = [];
for (const t of targets) {
  const run = await lighthouse(t.url, {
    port: PORT, output: 'json', logLevel: 'error', formFactor: 'mobile', screenEmulation: { mobile: true, width: 360, height: 780, deviceScaleFactor: 2, disabled: false },
    onlyCategories: ['performance', 'accessibility', 'best-practices'], disableStorageReset: true,
  });
  const c = run.lhr.categories;
  const row = { page: t.name, performance: Math.round(c.performance.score * 100), accessibility: Math.round(c.accessibility.score * 100), bestPractices: Math.round(c['best-practices'].score * 100),
    lcp: run.lhr.audits['largest-contentful-paint'].displayValue, tbt: run.lhr.audits['total-blocking-time'].displayValue, cls: run.lhr.audits['cumulative-layout-shift'].displayValue };
  summary.push(row);
  writeFileSync(`test-results/lighthouse/${t.name}.json`, JSON.stringify(run.lhr));
  console.log(JSON.stringify(row));
}
writeFileSync('test-results/lighthouse/summary.json', JSON.stringify(summary, null, 2));
await browser.close().catch(() => {});
chrome.kill();
const failing = summary.filter((r) => r.performance < THRESHOLD || r.accessibility < THRESHOLD);
if (failing.length) { console.error(`Sous le seuil de ${THRESHOLD} :`, failing.map((f) => f.page).join(', ')); process.exit(1); }
