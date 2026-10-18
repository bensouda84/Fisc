import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.ts';
import { createDb, migrate, type Db } from '../src/db.ts';
import { seed } from '../src/seed.ts';

export const PASSWORD = 'mot-de-passe-de-test-fictif';
export const NOW = new Date('2026-10-18T09:00:00Z');

export interface Harness {
  app: FastifyInstance;
  db: Db;
  login(email: string): Promise<string>;
  call(token: string | null, method: 'GET' | 'POST' | 'PUT', url: string, payload?: unknown): Promise<{ status: number; json: any; raw: Buffer }>;
  close(): Promise<void>;
}

export async function harness(options: { withTestRules: boolean }): Promise<Harness> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL est requis pour les tests de l’API (base PostgreSQL jetable).');
  const db = createDb(url);
  await db.query('drop schema public cascade; create schema public;');
  await migrate(db);
  await seed(db, { password: PASSWORD, withTestRules: options.withTestRules, now: NOW });
  const app = await buildApp({
    config: { databaseUrl: url, jwtSecret: 'secret-de-test-fictif-0123456789abcdef', port: 0, corsOrigin: false },
    db,
    now: () => NOW,
  });
  const call: Harness['call'] = async (token, method, path, payload) => {
    const res = await app.inject({ method, url: path, payload: payload as never, headers: token ? { authorization: `Bearer ${token}` } : {} });
    let json: unknown = null;
    try { json = res.json(); } catch { /* binaire */ }
    return { status: res.statusCode, json, raw: res.rawPayload };
  };
  return {
    app, db, call,
    login: async (email) => (await call(null, 'POST', '/auth/login', { email, password: PASSWORD })).json.token as string,
    close: async () => { await app.close(); await db.end(); },
  };
}

export const NBSP_TO_SPACE = (s: string): string => s.replace(/[  ]/g, ' ');

export function pdfText(pdf: Buffer): string {
  const dir = mkdtempSync(join(tmpdir(), 'fisc-pdf-'));
  try {
    const file = join(dir, 'out.pdf');
    writeFileSync(file, pdf);
    return NBSP_TO_SPACE(execFileSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8' }));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export const T1 = { profit: '40000000', donations: '4000000', cdiHires: 2, apprentices: 1, extraSalaries: '0', otherOutflows: '0' };
