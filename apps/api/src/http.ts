import { z } from 'zod';
import type { FastifyReply, FastifyRequest } from 'fastify';

export type Role = 'consultant' | 'client' | 'validator' | 'admin';

export interface AuthUser {
  sub: string;
  email: string;
  role: Role;
  specialty: 'LEGAL' | 'ACCOUNTING' | null;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface RouteContext<B, Q> {
  req: FastifyRequest;
  reply: FastifyReply;
  user: AuthUser;
  body: B;
  query: Q;
  params: Record<string, string>;
}

export interface RouteDef<B = undefined, Q = undefined> {
  method: 'get' | 'post' | 'put';
  url: string;
  summary: string;
  /** `public` : sans jeton. Sinon, liste des rôles autorisés. */
  roles: 'public' | Role[];
  body?: z.ZodType<B>;
  query?: z.ZodType<Q>;
  handler: (ctx: RouteContext<B, Q>) => Promise<unknown>;
}

const bigintToJson = (ctx: { zodSchema: unknown; jsonSchema: Record<string, unknown> }): void => {
  const def = (ctx.zodSchema as { _zod?: { def?: { type?: string } } })._zod?.def;
  if (def?.type === 'bigint') Object.assign(ctx.jsonSchema, { type: 'string', pattern: '^-?\\d+$', description: 'Entier en F CFA (chaîne décimale)' });
};

/** Contrat OpenAPI généré depuis les schémas Zod des routes (ADR-0005). */
export function buildOpenApi(routes: RouteDef<never, never>[]): unknown {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const r of routes) {
    const path = r.url.replace(/:(\w+)/g, '{$1}');
    paths[path] ??= {};
    paths[path][r.method] = {
      summary: r.summary,
      security: r.roles === 'public' ? [] : [{ bearer: [] }],
      'x-roles': r.roles,
      ...(r.body
        ? {
            requestBody: {
              required: true,
              content: { 'application/json': { schema: z.toJSONSchema(r.body, { unrepresentable: 'any', io: 'input', override: bigintToJson as never }) } },
            },
          }
        : {}),
      responses: { '200': { description: 'Succès' }, '400': { description: 'Données invalides' }, '401': { description: 'Non authentifié' }, '403': { description: 'Rôle insuffisant' } },
    };
  }
  return {
    openapi: '3.1.0',
    info: { title: 'mesimpo — API du POC', version: '0.1.0' },
    components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
    paths,
  };
}
