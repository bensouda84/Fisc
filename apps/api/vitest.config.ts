import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 20000,
    coverage: { provider: 'v8', include: ['src/**/*.ts'], exclude: ['src/main.ts', 'src/migrate.ts', 'src/seed-cli.ts'] },
  },
});
