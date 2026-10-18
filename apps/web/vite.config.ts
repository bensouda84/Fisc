import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const api = { '/api': { target: process.env.API_URL ?? 'http://127.0.0.1:3001', rewrite: (p: string) => p.replace(/^\/api/, '') } };

export default defineConfig({
  plugins: [react()],
  server: { proxy: api },
  preview: { proxy: api, port: 4173 },
  build: { target: 'es2022', chunkSizeWarningLimit: 600 },
});
