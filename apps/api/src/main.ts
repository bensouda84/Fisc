import { buildApp } from './app.ts';
import { loadConfig } from './config.ts';
import { createDb, migrate } from './db.ts';

const config = loadConfig();
const db = createDb(config.databaseUrl);
await migrate(db);
const app = await buildApp({ config, db });
await app.listen({ port: config.port, host: process.env.HOST ?? '127.0.0.1' });
console.log(`API FISC.CI sur le port ${config.port}`);
