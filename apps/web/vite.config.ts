import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const api = { '/api': { target: process.env.API_URL ?? 'http://127.0.0.1:3001', rewrite: (p: string) => p.replace(/^\/api/, '') } };
const here = (p: string): string => resolve(import.meta.dirname, p);

export default defineConfig(({ mode }) => {
  const demo = mode === 'demo';
  return {
    plugins: [react()],
    server: { proxy: api },
    preview: { proxy: api, port: 4173 },
    // Démonstration : moteur dans le navigateur, une seule page autonome (voir scripts/make-artifact.mjs).
    resolve: demo
      ? {
          alias: [
            { find: /^(\.{1,2}\/)+api\.ts$/, replacement: here('src/demo/api.ts') },
            { find: /^(\.{1,2}\/)+brand\.ts$/, replacement: here('src/brand.demo.ts') },
            { find: /^(\.{1,2}\/)+fonts\.ts$/, replacement: here('src/fonts.demo.ts') },
          ],
        }
      : {},
    build: {
      target: 'es2022',
      chunkSizeWarningLimit: 900,
      ...(demo
        ? { outDir: 'dist-demo', assetsInlineLimit: 400_000, cssCodeSplit: false, rollupOptions: { output: { inlineDynamicImports: true } } }
        : {}),
    },
  };
});
