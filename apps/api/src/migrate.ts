import { loadConfig } from './config.ts';
import { createDb, migrate } from './db.ts';

const db = createDb(loadConfig().databaseUrl);
console.log('Migrations appliquées :', await migrate(db));
await db.end();
