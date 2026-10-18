import { createHash } from 'node:crypto';

/** JSON canonique : clés triées, bigint en chaîne. Sert aux empreintes (instantané, audit). */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => {
    if (typeof v === 'bigint') return v.toString();
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      return Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)));
    }
    return v;
  });
}

export const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');
