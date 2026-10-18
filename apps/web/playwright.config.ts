import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

const chromium = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium';
const env = {
  DATABASE_URL: process.env.E2E_DATABASE_URL ?? '',
  JWT_SECRET: 'secret-e2e-fictif-0123456789abcdefghij',
  PORT: '3101',
  API_URL: 'http://127.0.0.1:3101',
};

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  reporter: [['list'], ['json', { outputFile: 'test-results/report.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:4174',
    locale: 'fr-FR',
    timezoneId: 'Africa/Abidjan',
    launchOptions: existsSync(chromium) ? { executablePath: chromium, args: ['--no-sandbox', '--disable-background-networking', '--disable-sync', '--disable-component-update', '--no-first-run'] } : {},
  },
  webServer: [
    { command: 'pnpm -F @fisc/api start', url: 'http://127.0.0.1:3101/health', env, reuseExistingServer: false, timeout: 60_000 },
    { command: 'pnpm exec vite preview --port 4174 --strictPort', url: 'http://127.0.0.1:4174', env, reuseExistingServer: false, timeout: 60_000 },
  ],
});
