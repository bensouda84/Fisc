import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

export type Db = pg.Pool;

export const createDb = (databaseUrl: string): Db => new pg.Pool({ connectionString: databaseUrl });

const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

/** Migrations versionnées, appliquées une seule fois, dans l'ordre du nom de fichier. */
export async function migrate(db: Db): Promise<string[]> {
  await db.query('create table if not exists schema_migration (name text primary key, applied_at timestamptz not null default now())');
  const done = new Set((await db.query<{ name: string }>('select name from schema_migration')).rows.map((r) => r.name));
  const applied: string[] = [];
  for (const file of (await readdir(MIGRATIONS)).filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(file)) continue;
    const client = await db.connect();
    try {
      await client.query('begin');
      await client.query(await readFile(join(MIGRATIONS, file), 'utf8'));
      await client.query('insert into schema_migration(name) values ($1)', [file]);
      await client.query('commit');
      applied.push(file);
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }
  return applied;
}
