import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

const chromium = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium';
export default defineConfig({
  testDir: '.',
  testMatch: 'spike.spec.ts',
  workers: 1,
  timeout: 60_000,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4175',
    viewport: { width: 360, height: 780 },
    launchOptions: existsSync(chromium) ? { executablePath: chromium, args: ['--no-sandbox', '--disable-background-networking', '--no-first-run'] } : {},
  },
  webServer: { command: 'pnpm exec vite preview --port 4175 --strictPort', url: 'http://127.0.0.1:4175/mw.html', reuseExistingServer: false },
});
