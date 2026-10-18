import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import Fastify, { type FastifyInstance } from 'fastify';
import { z, ZodError } from 'zod';
import { simulate } from '@fisc/engine';
import {
  RegistryError, diffSnapshots, publishSnapshot, reviseRule, validateRule, verifyAudit,
} from '@fisc/registry';
import {
  ClientResultSchema, CommercialParams, EngineInput, EngineResultSchema, IsoDate, Mode, type EngineResult, type RegistrySnapshot,
} from '@fisc/schemas';
import type { Config } from './config.ts';
import type { Db } from './db.ts';
import { EstimateBody, createLimiter, estimatedProfit } from './estimate.ts';
import { HttpError, buildOpenApi, type AuthUser, type RouteDef } from './http.ts';
import { renderProofPdf } from './pdf.ts';
import { hashPassword, verifyPassword } from './password.ts';
import * as store from './store.ts';
import { toWire } from './wire.ts';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AuthUser;
    user: AuthUser;
  }
}

const STAFF = ['consultant', 'admin', 'validator'] as const;
const ALL = ['consultant', 'client', 'validator', 'admin'] as const;

export interface AppOptions {
  config: Config;
  db: Db;
  /** Horloge injectable : le moteur ne la lit jamais, l'API la lui passe. */
  now?: () => Date;
}

const isoDay = (d: Date): string => d.toISOString().slice(0, 10);
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 5;
const DUMMY_HASH = await hashPassword('mot-de-passe-factice-pour-temps-constant');

/** Un client ne voit que les règles REAL au statut CONFIRMED (R1). */
function clientView(s: RegistrySnapshot): RegistrySnapshot {
  return { ...s, rules: s.rules.filter((r) => r.kind === 'REAL' && r.status === 'CONFIRMED') };
}

interface CalcRow {
  id: string;
  user_id: string;
  mode: 'INTERNAL' | 'CLIENT';
  registry_version: string;
  as_of: Date;
  input: unknown;
  commercial: unknown;
  result: unknown;
}

export async function buildApp({ config, db, now = () => new Date() }: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: config.corsOrigin });
  await app.register(jwt, { secret: config.jwtSecret, sign: { expiresIn: '8h' } });

  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: 'INVALID_REQUEST',
        message: 'Données invalides. Vérifiez les champs signalés.',
        issues: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    if (error instanceof HttpError) return reply.code(error.status).send({ error: error.code, message: error.message });
    if (error instanceof RegistryError) return reply.code(409).send({ error: 'REGISTRY_RULE', message: error.message });
    const status = (error as { statusCode?: number }).statusCode;
    if (status && status < 500) return reply.code(status).send({ error: 'REQUEST_ERROR', message: 'Requête refusée.' });
    app.log.error(error);
    return reply.code(500).send({ error: 'INTERNAL', message: 'Erreur interne. Réessayez plus tard.' });
  });

  const loginLimiter = createLimiter(LOGIN_MAX_FAILURES, LOGIN_WINDOW_MS, now);
  const registerLimiter = createLimiter(5, 60 * 60 * 1000, now);
  const publicLimiter = createLimiter(30, 60 * 1000, now);

  const routes: RouteDef<never, never>[] = [];
  function route<B = undefined, Q = undefined>(def: RouteDef<B, Q>): void {
    routes.push(def as unknown as RouteDef<never, never>);
    app[def.method](def.url, async (req, reply) => {
      let user = undefined as unknown as AuthUser;
      if (def.roles !== 'public') {
        try {
          await req.jwtVerify();
        } catch {
          throw new HttpError(401, 'UNAUTHENTICATED', 'Connectez-vous pour continuer.');
        }
        user = req.user;
        if (!def.roles.includes(user.role)) throw new HttpError(403, 'FORBIDDEN', 'Votre rôle ne permet pas cette action.');
      }
      const body = (def.body ? def.body.parse(req.body) : undefined) as B;
      const query = (def.query ? def.query.parse(req.query) : undefined) as Q;
      const out = await def.handler({ req, reply, user, body, query, params: req.params as Record<string, string> });
      if (out === reply) return reply;
      return reply.send(out);
    });
  }

  const requireSnapshot = async (): Promise<RegistrySnapshot> => {
    const s = await store.currentSnapshot(db);
    if (!s) throw new HttpError(503, 'NO_REGISTRY', 'Le registre des règles n’est pas encore publié.');
    return s;
  };

  /** Unique point de calcul de l'API : utilisé par /simulate et par l'export PDF (parité). */
  function compute(input: EngineInput, snapshot: RegistrySnapshot, commercial: CommercialParams, mode: Mode, asOf: string): EngineResult {
    const effective = mode === 'CLIENT' ? { ...snapshot, rules: snapshot.rules.filter((r) => r.kind === 'REAL') } : snapshot;
    const result = simulate(input, effective, commercial, { mode, asOf });
    // Ceinture et bretelles : le schéma de sortie client refuse toute règle de TEST, hypothèse ou montant sans source.
    (mode === 'CLIENT' ? ClientResultSchema : EngineResultSchema).parse(toWire(result));
    return result;
  }

  route({ method: 'get', url: '/health', summary: 'État du service', roles: 'public', handler: async () => ({ ok: true }) });

  route({
    method: 'post', url: '/auth/login', summary: 'Connexion', roles: 'public',
    body: z.object({ email: z.string().min(3), password: z.string().min(1) }),
    handler: async ({ req, reply, body }) => {
      const key = `${body.email.toLowerCase()}|${req.ip}`;
      if (loginLimiter.blocked(key)) {
        reply.header('retry-after', String(loginLimiter.windowSeconds));
        throw new HttpError(429, 'TOO_MANY_ATTEMPTS', 'Trop de tentatives. Réessayez dans quelques minutes.');
      }
      const user = await store.findUserByEmail(db, body.email);
      const ok = await verifyPassword(body.password, user?.pass_hash ?? DUMMY_HASH);
      if (!user || !ok) {
        loginLimiter.hit(key);
        throw new HttpError(401, 'BAD_CREDENTIALS', 'Adresse ou mot de passe incorrect.');
      }
      loginLimiter.clear(key);
      const payload: AuthUser = { sub: String(user.id), email: user.email, role: user.role, specialty: user.specialty };
      return { token: app.jwt.sign(payload), user: { email: user.email, display: user.display, role: user.role, specialty: user.specialty } };
    },
  });

  route({
    method: 'post', url: '/auth/register', summary: 'Inscription libre d’un client (rôle client uniquement)', roles: 'public',
    body: z.object({
      email: z.email().max(254),
      password: z.string().min(12, 'Le mot de passe compte au moins 12 caractères.').max(200),
      display: z.string().trim().min(1).max(80).optional(),
      consent: z.literal(true, { error: 'Le consentement est requis pour créer un compte.' }),
    }),
    handler: async ({ req, reply, body }) => {
      if (registerLimiter.blocked(req.ip)) {
        reply.header('retry-after', String(registerLimiter.windowSeconds));
        throw new HttpError(429, 'TOO_MANY_ATTEMPTS', 'Trop de créations de compte. Réessayez plus tard.');
      }
      registerLimiter.hit(req.ip);
      const email = body.email.toLowerCase();
      const display = body.display ?? email.split('@')[0]!;
      const inserted = await db.query<{ id: string }>(
        `insert into users(email, display, role, pass_hash, consent_at) values ($1, $2, 'client', $3, $4)
         on conflict (email) do nothing returning id`,
        [email, display, await hashPassword(body.password), now()],
      );
      if (inserted.rows.length === 0) throw new HttpError(409, 'EMAIL_TAKEN', 'Un compte existe déjà avec cette adresse. Connectez-vous.');
      await store.audit(db, { actor: 'système', action: 'USER_REGISTERED', target: `user:${inserted.rows[0]!.id}`, detail: { role: 'client' } }, now());
      const payload: AuthUser = { sub: inserted.rows[0]!.id, email, role: 'client', specialty: null };
      return { token: app.jwt.sign(payload), user: { email, display, role: 'client', specialty: null } };
    },
  });

  route({
    method: 'post', url: '/public/estimate', summary: 'Estimation express sans compte à partir du chiffre d’affaires (mode client, rien n’est enregistré)', roles: 'public',
    body: EstimateBody,
    handler: async ({ req, reply, body }) => {
      if (publicLimiter.blocked(req.ip)) {
        reply.header('retry-after', String(publicLimiter.windowSeconds));
        throw new HttpError(429, 'TOO_MANY_ATTEMPTS', 'Trop de demandes. Réessayez dans une minute.');
      }
      publicLimiter.hit(req.ip);
      const profit = body.marginPercent === undefined ? null : estimatedProfit(body.turnover, body.marginPercent);
      const input = profit === null ? {} : { profit };
      const result = compute(input, await requireSnapshot(), await store.getCommercial(db), 'CLIENT', isoDay(now()));
      return {
        assumption: {
          turnover: body.turnover.toString(),
          marginPercent: body.marginPercent ?? null,
          estimatedProfit: profit === null ? null : profit.toString(),
        },
        result: toWire(result),
      };
    },
  });

  route({ method: 'get', url: '/me', summary: 'Utilisateur courant', roles: [...ALL], handler: async ({ user }) => user });

  route({
    method: 'get', url: '/registry', summary: 'Registre courant (vue filtrée pour un client)', roles: [...ALL],
    handler: async ({ user }) => {
      const s = await requireSnapshot();
      return toWire(user.role === 'client' ? clientView(s) : s);
    },
  });

  route({
    method: 'post', url: '/simulate', summary: 'Calcule une simulation avec le moteur', roles: [...ALL],
    body: z.object({ input: EngineInput, mode: Mode.optional(), persist: z.boolean().default(true) }),
    handler: async ({ user, body }) => {
      const snapshot = await requireSnapshot();
      const commercial = await store.getCommercial(db);
      const mode: Mode = user.role === 'client' ? 'CLIENT' : (body.mode ?? 'INTERNAL');
      const asOf = isoDay(now());
      const result = compute(body.input, snapshot, commercial, mode, asOf);
      // Une simulation exploratoire (persist: false) ne laisse aucune trace et ne touche jamais au registre.
      const id = body.persist
        ? (await db.query<{ id: string }>(
            'insert into calculation(user_id, mode, registry_version, as_of, input, commercial, result) values ($1,$2,$3,$4,$5,$6,$7) returning id',
            [user.sub, mode, snapshot.version, asOf, toWire(body.input), toWire(commercial), toWire(result)],
          )).rows[0]!.id
        : null;
      return { id, input: toWire(body.input), result: toWire(result) };
    },
  });

  route({
    method: 'get', url: '/diagnostic', summary: 'Diagnostic en cours (sauvegarde automatique)', roles: [...ALL],
    handler: async ({ user }) => {
      const { rows } = await db.query<{ answers: unknown }>('select answers from diagnostic where user_id = $1', [user.sub]);
      return rows[0]?.answers ?? { answers: {}, step: 0 };
    },
  });

  route({
    method: 'put', url: '/diagnostic', summary: 'Sauvegarde le diagnostic', roles: [...ALL],
    body: z.object({ answers: z.record(z.string(), z.union([z.string(), z.number()])), step: z.number().int().min(0).max(20) }),
    handler: async ({ user, body }) => {
      EngineInput.parse(body.answers);
      await db.query(
        'insert into diagnostic(user_id, answers, updated_at) values ($1,$2,now()) on conflict (user_id) do update set answers = excluded.answers, updated_at = now()',
        [user.sub, body],
      );
      return { saved: true };
    },
  });

  route({
    method: 'post', url: '/reports/pdf', summary: 'Export PDF du dossier de preuve', roles: [...ALL],
    body: z.object({ calculationId: z.string().regex(/^\d+$/) }),
    handler: async ({ user, reply, body }) => {
      const { rows } = await db.query<CalcRow>('select * from calculation where id = $1 and user_id = $2', [body.calculationId, user.sub]);
      const row = rows[0];
      if (!row) throw new HttpError(404, 'NOT_FOUND', 'Calcul introuvable.');
      const snapshot = await store.snapshotByVersion(db, row.registry_version);
      if (!snapshot) throw new HttpError(404, 'NOT_FOUND', 'Version du registre introuvable.');
      const input = EngineInput.parse(row.input);
      const result = compute(input, snapshot, CommercialParams.parse(row.commercial), row.mode, row.as_of.toISOString().slice(0, 10));
      const pdf = await renderProofPdf(result, input);
      return reply
        .header('content-type', 'application/pdf')
        .header('content-disposition', `attachment; filename="dossier-de-preuve-${row.id}.pdf"`)
        .send(pdf);
    },
  });

  // --- Registre (espace administrateur) ---
  route({ method: 'get', url: '/rules', summary: 'Dernière version de chaque règle', roles: [...STAFF], handler: async () => toWire(await store.latestRules(db)) });

  route({
    method: 'get', url: '/rules/:id/history', summary: 'Historique des versions d’une règle', roles: [...STAFF],
    handler: async ({ params }) => toWire(await store.ruleHistory(db, params.id!)),
  });

  route({
    method: 'post', url: '/rules/:id/revise', summary: 'Renseigne ou modifie une règle (nouvelle version, validations retirées)', roles: ['admin'],
    body: z.object({
      article: z.string().min(1), page: z.number().int().positive(), effectiveDate: IsoDate,
      source: z.string().min(1), params: z.record(z.string(), z.unknown()),
    }),
    handler: async ({ user, params, body }) => {
      const history = await store.ruleHistory(db, params.id!);
      const current = history.at(-1);
      if (!current) throw new HttpError(404, 'NOT_FOUND', 'Règle introuvable.');
      const next = reviseRule(current, { ...body, params: body.params as never, author: user.email });
      await store.saveRule(db, next);
      await store.audit(db, { actor: user.email, action: 'RULE_REVISED', target: `${next.id}@${next.version}`, detail: { status: next.status } }, now());
      return toWire(next);
    },
  });

  route({
    method: 'post', url: '/rules/:id/validate', summary: 'Pose la validation du validateur connecté (juridique ou comptable)', roles: ['validator'],
    handler: async ({ user, params }) => {
      const current = (await store.ruleHistory(db, params.id!)).at(-1);
      if (!current) throw new HttpError(404, 'NOT_FOUND', 'Règle introuvable.');
      const next = validateRule(current, { role: user.specialty!, validator: user.email, at: now().toISOString() });
      await store.saveRule(db, next);
      await store.audit(db, { actor: user.email, action: `RULE_VALIDATED_${user.specialty}`, target: `${next.id}@${next.version}`, detail: { status: next.status } }, now());
      return toWire(next);
    },
  });

  route({
    method: 'post', url: '/registry/publish', summary: 'Publie un instantané immuable du registre', roles: ['admin'],
    body: z.object({ version: z.string().regex(/^v\d+\.\d+\.\d+$/) }),
    handler: async ({ user, body }) => {
      if (await store.snapshotByVersion(db, body.version)) throw new HttpError(409, 'VERSION_EXISTS', 'Cette version existe déjà.');
      const snapshot = publishSnapshot(await store.latestRules(db), body.version, now().toISOString());
      await store.saveSnapshot(db, snapshot);
      await store.audit(db, { actor: user.email, action: 'REGISTRY_PUBLISHED', target: snapshot.version, detail: { hash: snapshot.hash } }, now());
      return toWire({ version: snapshot.version, hash: snapshot.hash });
    },
  });

  route({ method: 'get', url: '/registry/snapshots', summary: 'Versions publiées', roles: [...STAFF], handler: async () => store.listSnapshots(db) });

  route({
    method: 'get', url: '/registry/diff', summary: 'Compare deux versions du registre', roles: [...STAFF],
    query: z.object({ from: z.string(), to: z.string() }),
    handler: async ({ query }) => {
      const [a, b] = await Promise.all([store.snapshotByVersion(db, query.from), store.snapshotByVersion(db, query.to)]);
      if (!a || !b) throw new HttpError(404, 'NOT_FOUND', 'Version introuvable.');
      return diffSnapshots(a, b);
    },
  });

  route({
    method: 'get', url: '/audit', summary: 'Journal d’audit (lecture seule)', roles: [...STAFF],
    handler: async () => {
      const entries = await store.readAudit(db);
      return { intact: verifyAudit(entries), entries };
    },
  });

  route({ method: 'get', url: '/commercial', summary: 'Paramètres commerciaux', roles: ['admin', 'consultant'], handler: async () => toWire(await store.getCommercial(db)) });

  route({
    method: 'put', url: '/commercial', summary: 'Met à jour les paramètres commerciaux (validation MARABU)', roles: ['admin'],
    body: CommercialParams,
    handler: async ({ user, body }) => {
      await store.setCommercial(db, body);
      await store.audit(db, { actor: user.email, action: 'COMMERCIAL_UPDATED', target: 'commercial', detail: { validated: body.validated } }, now());
      return toWire(body);
    },
  });

  const openapi = buildOpenApi(routes);
  app.get('/openapi.json', async () => openapi);
  return app;
}
