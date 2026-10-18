import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const only = process.env.ENTRY;
const page = (name: string): string => resolve(import.meta.dirname, `${name}.html`);

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    outDir: only ? `dist-${only}` : 'dist',
    rollupOptions: { input: only ? { [only]: page(only) } : { mw: page('mw'), mui: page('mui') } },
  },
});
