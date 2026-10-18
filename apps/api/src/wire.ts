/** Les bigint circulent en chaîne décimale dans le JSON (ADR-0004). */
export const toWire = (value: unknown): unknown =>
  JSON.parse(JSON.stringify(value, (_k, v: unknown) => (typeof v === 'bigint' ? v.toString() : v)));
