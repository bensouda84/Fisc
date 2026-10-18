import { reviveResult } from '@fisc/engine';
import type { EngineResult, Mode } from '@fisc/schemas';
import type { Answers, User, WireRule, WireSnapshot } from './wire.ts';

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

const KEY = 'fisc.session';
type Session = { token: string; user: User };

export function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}
export function saveSession(s: Session | null): void {
  try {
    if (s) sessionStorage.setItem(KEY, JSON.stringify(s));
    else sessionStorage.removeItem(KEY);
  } catch {
    /* stockage indisponible : la session reste en mémoire */
  }
}

let session: Session | null = loadSession();
export const currentSession = (): Session | null => session;
export function setSession(s: Session | null): void {
  session = s;
  saveSession(s);
}

async function request(method: string, path: string, body?: unknown): Promise<Response> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(session ? { authorization: `Bearer ${session.token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!res.ok) {
    let message = 'Une erreur est survenue. Réessayez.';
    try {
      message = ((await res.json()) as { message?: string }).message ?? message;
    } catch { /* corps vide */ }
    if (res.status === 401 && session) setSession(null);
    throw new ApiError(res.status, message);
  }
  return res;
}
const json = async <T>(method: string, path: string, body?: unknown): Promise<T> => (await request(method, path, body)).json() as Promise<T>;

export const api = {
  login: (email: string, password: string) => json<Session>('POST', '/auth/login', { email, password }),
  registry: () => json<WireSnapshot>('GET', '/registry'),
  diagnostic: () => json<{ answers: Answers; step: number }>('GET', '/diagnostic'),
  saveDiagnostic: (answers: Answers, step: number) => json<{ saved: true }>('PUT', '/diagnostic', { answers, step }),
  async simulate(input: Answers, opts: { mode?: Mode; persist?: boolean } = {}): Promise<{ id: string | null; result: EngineResult }> {
    const r = await json<{ id: string | null; result: unknown }>('POST', '/simulate', { input, ...opts });
    return { id: r.id, result: reviveResult(r.result) };
  },
  async pdf(calculationId: string): Promise<Blob> {
    return (await request('POST', '/reports/pdf', { calculationId })).blob();
  },
  rules: () => json<WireRule[]>('GET', '/rules'),
  revise: (id: string, body: unknown) => json<WireRule>('POST', `/rules/${id}/revise`, body),
  validate: (id: string) => json<WireRule>('POST', `/rules/${id}/validate`),
  snapshots: () => json<{ version: string; publishedAt: string; hash: string }[]>('GET', '/registry/snapshots'),
  publish: (version: string) => json<{ version: string }>('POST', '/registry/publish', { version }),
  diff: (from: string, to: string) =>
    json<{ ruleId: string; change: string; fields: string[] }[]>('GET', `/registry/diff?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  audit: () => json<{ intact: boolean; entries: { seq: number; at: string; actor: string; action: string; target: string }[] }>('GET', '/audit'),
  commercial: () => json<{ commissionRate: { num: string; den: string }; vatRate: { num: string; den: string }; commissionCap: string | null; validated: boolean }>('GET', '/commercial'),
  setCommercial: (body: unknown) => json<unknown>('PUT', '/commercial', body),
};
