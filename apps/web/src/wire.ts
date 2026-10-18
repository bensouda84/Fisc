import type { Mode, Rule } from '@fisc/schemas';

export type Role = 'consultant' | 'client' | 'validator' | 'admin';

export interface User {
  email: string;
  display: string;
  role: Role;
  specialty: 'LEGAL' | 'ACCOUNTING' | null;
}

/** Les montants sont des chaînes décimales sur le réseau ; les règles gardent leurs champs en JSON. */
export type WireRule = Omit<Rule, 'params'> & { params: Record<string, unknown> | null };

export interface WireSnapshot {
  version: string;
  publishedAt: string;
  rules: WireRule[];
}

export type Answers = Record<string, string | number>;

export interface SimulateResponse {
  id: string | null;
  input: Answers;
  result: unknown;
  mode?: Mode;
}
