import { loadConfig } from './config.ts';
import { createDb, migrate } from './db.ts';
import { seed } from './seed.ts';

const password = process.env.SEED_PASSWORD;
if (!password || password.length < 12) throw new Error('SEED_PASSWORD est requis (12 caractères minimum)');
const db = createDb(loadConfig().databaseUrl);
await migrate(db);
console.log(await seed(db, { password, withTestRules: process.env.SEED_TEST_RULES !== 'false', now: new Date() }));
await db.end();
