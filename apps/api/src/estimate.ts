import { z } from 'zod';

/** Estimation express sans compte : une seule donnée obligatoire, le chiffre d'affaires. */
export const EstimateBody = z.object({
  turnover: z.coerce.bigint().positive().max(10n ** 15n),
  /** Marge bénéficiaire estimée, en pourcent entier : hypothèse de l'utilisateur, jamais une règle. */
  marginPercent: z.number().int().min(0).max(100).optional(),
});
export type EstimateBody = z.output<typeof EstimateBody>;

/** Bénéfice estimé = chiffre d'affaires × marge, arrondi au franc le plus proche (demi vers le haut), en entiers. */
export function estimatedProfit(turnover: bigint, marginPercent: number): bigint {
  return (2n * turnover * BigInt(marginPercent) + 100n) / 200n;
}

/** Limiteur en mémoire : `max` événements par fenêtre et par clé. Perdu au redémarrage, non partagé entre instances. */
export function createLimiter(max: number, windowMs: number, now: () => Date) {
  const events = new Map<string, number[]>();
  const recent = (key: string): number[] => {
    const t = now().getTime();
    const list = (events.get(key) ?? []).filter((x) => t - x < windowMs);
    events.set(key, list);
    return list;
  };
  return {
    blocked: (key: string): boolean => recent(key).length >= max,
    hit: (key: string): void => { recent(key).push(now().getTime()); },
    clear: (key: string): void => { events.delete(key); },
    windowSeconds: Math.ceil(windowMs / 1000),
  };
}
