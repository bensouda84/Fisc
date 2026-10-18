import { loadRealRules, loadTestRules, publishSnapshot } from '@fisc/registry';
import type { Db } from './db.ts';
import { hashPassword } from './password.ts';
import { audit, saveRule, saveSnapshot, setCommercial, getCommercial, latestRules } from './store.ts';

/** Utilisateurs de démonstration : adresses en .test, aucun compte réel (R8). */
export const DEMO_USERS = [
  { email: 'consultant@fisc.test', display: 'Consultant MARABU (démo)', role: 'consultant', specialty: null },
  { email: 'client@fisc.test', display: 'Dirigeant (démo)', role: 'client', specialty: null },
  { email: 'juriste@fisc.test', display: 'Juriste validateur (démo)', role: 'validator', specialty: 'LEGAL' },
  { email: 'expert@fisc.test', display: 'Expert-comptable validateur (démo)', role: 'validator', specialty: 'ACCOUNTING' },
  { email: 'admin@fisc.test', display: 'Administrateur (démo)', role: 'admin', specialty: null },
] as const;

export interface SeedOptions {
  password: string;
  withTestRules: boolean;
  now: Date;
}

/** Idempotent : ne fait rien si le registre contient déjà des règles. */
export async function seed(db: Db, options: SeedOptions): Promise<{ seeded: boolean }> {
  for (const u of DEMO_USERS) {
    await db.query(
      'insert into users(email, display, role, specialty, pass_hash) values ($1,$2,$3,$4,$5) on conflict (email) do nothing',
      [u.email, u.display, u.role, u.specialty, await hashPassword(options.password)],
    );
  }
  if ((await latestRules(db)).length > 0) return { seeded: false };

  const rules = [...loadRealRules(), ...(options.withTestRules ? loadTestRules() : [])];
  for (const rule of rules) await saveRule(db, rule);
  const snapshot = publishSnapshot(rules, 'v1.0.0', options.now.toISOString());
  await saveSnapshot(db, snapshot);
  await setCommercial(db, await getCommercial(db));
  await audit(db, { actor: 'système', action: 'REGISTRY_SEEDED', target: snapshot.version, detail: { rules: rules.length, withTestRules: options.withTestRules } }, options.now);
  return { seeded: true };
}
