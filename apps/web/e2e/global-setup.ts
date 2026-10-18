import { createDb, migrate } from '../../api/src/db.ts';
import { seed } from '../../api/src/seed.ts';

export const PASSWORD = 'mot-de-passe-e2e-fictif';

/** Base jetable : jeu de données fictif avec règles de TEST pour le mode interne. */
export default async function setup(): Promise<void> {
  const url = process.env.E2E_DATABASE_URL;
  if (!url) throw new Error('E2E_DATABASE_URL est requis (base PostgreSQL jetable).');
  const db = createDb(url);
  await db.query('drop schema public cascade; create schema public;');
  await migrate(db);
  await seed(db, { password: PASSWORD, withTestRules: true, now: new Date() });
  await db.end();
}
