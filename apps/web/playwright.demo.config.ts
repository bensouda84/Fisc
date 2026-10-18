import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

const chromium = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium';
/** Tests de la démonstration : page autonome `dist-demo/artifact.html`, sans serveur ni base. */
export default defineConfig({
  testDir: 'e2e-demo',
  workers: 1,
  timeout: 60_000,
  reporter: [['list']],
  use: {
    locale: 'fr-FR',
    timezoneId: 'Africa/Abidjan',
    launchOptions: existsSync(chromium) ? { executablePath: chromium, args: ['--no-sandbox', '--disable-background-networking', '--no-first-run'] } : {},
  },
});
