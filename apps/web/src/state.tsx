import { createContext, useContext, useState, type ReactNode } from 'react';
import type { EngineResult } from '@fisc/schemas';
import type { Role, User } from './wire.ts';

export interface Notify { (message: string): void }

interface Ctx {
  user: User;
  role: Role;
  notify: Notify;
  /** Dernier calcul affiché, conservé entre les écrans. */
  last: { id: string | null; result: EngineResult } | null;
  setLast(v: Ctx['last']): void;
}
const C = createContext<Ctx | null>(null);

export function Provider({ user, notify, children }: { user: User; notify: Notify; children: ReactNode }) {
  const [last, setLast] = useState<Ctx['last']>(null);
  return <C.Provider value={{ user, role: user.role, notify, last, setLast }}>{children}</C.Provider>;
}

export function useApp(): Ctx {
  const v = useContext(C);
  if (!v) throw new Error('Provider manquant');
  return v;
}
