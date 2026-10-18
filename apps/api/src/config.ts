export interface Config {
  databaseUrl: string;
  jwtSecret: string;
  port: number;
  corsOrigin: string | boolean;
}

/** Aucun secret par défaut : tout vient de l'environnement (voir .env.example). */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const databaseUrl = env.DATABASE_URL;
  const jwtSecret = env.JWT_SECRET;
  if (!databaseUrl) throw new Error('DATABASE_URL est requis');
  if (!jwtSecret || jwtSecret.length < 32) throw new Error('JWT_SECRET est requis (32 caractères minimum)');
  return {
    databaseUrl,
    jwtSecret,
    port: Number.parseInt(env.PORT ?? '3001', 10),
    corsOrigin: env.CORS_ORIGIN ?? false,
  };
}
