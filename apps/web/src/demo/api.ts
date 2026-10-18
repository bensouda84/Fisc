/**
 * Remplace `src/api.ts` dans la démonstration (`vite build --mode demo`).
 * Le moteur tourne dans le navigateur avec le registre V1 réel (toutes les règles EN ATTENTE) et les règles de TEST.
 * Rien n'est envoyé : pas de serveur, pas de compte réel, pas de PDF.
 */
import { simulate } from '@fisc/engine';
import { EngineInput, Rule, type CommercialParams, type EngineResult, type Mode, type RegistrySnapshot } from '@fisc/schemas';
import realRules from '../../../../packages/registry/data/rules-v1.json';
import testRules from '../../../../packages/registry/data/test-rules.json';
import type { api as RealApi } from '../api.ts';
import type { Answers, User, WireRule } from '../wire.ts';

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

type Session = { token: string; user: User };
export interface Estimation {
  assumption: { turnover: string; marginPercent: number | null; estimatedProfit: string | null };
  result: EngineResult;
}

const USERS: Record<string, User> = {
  'consultant@fisc.test': { email: 'consultant@fisc.test', display: 'Consultant mesimpo (démo)', role: 'consultant', specialty: null },
  'client@fisc.test': { email: 'client@fisc.test', display: 'Dirigeant (démo)', role: 'client', specialty: null },
};

let session: Session | null = null;
export const loadSession = (): Session | null => session;
export const saveSession = (s: Session | null): void => { session = s; };
export const currentSession = (): Session | null => session;
export function setSession(s: Session | null): void { session = s; }

const rules = [...realRules, ...testRules] as unknown as WireRule[];
const snapshot = (mode: Mode): RegistrySnapshot => ({
  version: 'démo-1.0.0',
  publishedAt: '2026-10-18T00:00:00Z',
  rules: rules.map((r) => Rule.parse(r)).filter((r) => mode === 'INTERNAL' || r.kind === 'REAL'),
  hash: null,
});
// Commission non validée par MARABU : le mode client n'affiche aucune commission (comme le produit).
const commercial: CommercialParams = { commissionRate: { num: 1n, den: 5n }, vatRate: { num: 9n, den: 50n }, commissionCap: null, validated: false };
const today = (): string => new Date().toISOString().slice(0, 10);

let draft: { answers: Answers; step: number } = { answers: {}, step: 0 };
let counter = 0;
const unavailable = (what: string) => (): never => { throw new ApiError(404, `${what} n’est pas disponible dans la démonstration.`); };

function run(input: unknown, mode: Mode): EngineResult {
  const parsed = EngineInput.parse(input);
  return simulate(parsed, snapshot(mode), commercial, { mode, asOf: today() });
}
const modeFor = (requested?: Mode): Mode => (session?.user.role === 'client' ? 'CLIENT' : (requested ?? 'INTERNAL'));

export const api: typeof RealApi = {
  async login(email: string) {
    const user = USERS[email.toLowerCase()];
    if (!user) throw new ApiError(401, 'Profil inconnu : choisissez un profil de démonstration.');
    return { token: 'demo', user };
  },
  async registry() {
    const mode = modeFor();
    return { version: 'démo-1.0.0', publishedAt: '2026-10-18T00:00:00Z', rules: rules.filter((r) => mode === 'INTERNAL' || (r.kind === 'REAL' && r.status === 'CONFIRMED')) };
  },
  async diagnostic() { return draft; },
  async saveDiagnostic(answers: Answers, step: number) { draft = { answers, step }; return { saved: true as const }; },
  async simulate(input: Answers, opts: { mode?: Mode; persist?: boolean } = {}) {
    const result = run(input, modeFor(opts.mode));
    return { id: opts.persist === false ? null : `demo-${++counter}`, result };
  },
  async estimate(turnover: string, marginPercent?: number) {
    if (!/^\d{1,15}$/.test(turnover) || BigInt(turnover) <= 0n) throw new ApiError(400, 'Données invalides. Vérifiez les champs signalés.');
    const profit = marginPercent === undefined ? null : (2n * BigInt(turnover) * BigInt(marginPercent) + 100n) / 200n;
    const result = run(profit === null ? {} : { profit: profit.toString() }, 'CLIENT');
    return { assumption: { turnover, marginPercent: marginPercent ?? null, estimatedProfit: profit === null ? null : profit.toString() }, result };
  },
  async register() { throw new ApiError(403, 'La création de compte n’est pas disponible dans la démonstration.'); },
  pdf: unavailable('L’export PDF'),
  rules: unavailable('Le registre'),
  revise: unavailable('Le registre'),
  validate: unavailable('Le registre'),
  snapshots: unavailable('Le registre'),
  publish: unavailable('Le registre'),
  diff: unavailable('Le registre'),
  catalogue: unavailable('Le registre'),
  audit: unavailable('Le journal d’audit'),
  commercial: unavailable('Le registre'),
  setCommercial: unavailable('Le registre'),
};
