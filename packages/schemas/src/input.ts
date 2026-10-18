import { z } from 'zod';
import { Money, NonNegativeMoney, Rate } from './primitives.ts';

/** « Je ne sais pas » est une réponse valide : elle rend le levier non calculable, jamais nul. */
export const UNKNOWN = 'UNKNOWN' as const;

const Amount = z.union([z.literal(UNKNOWN), NonNegativeMoney]);
const Count = z.union([z.literal(UNKNOWN), z.number().int().nonnegative()]);

export const EngineInput = z.object({
  /** Bénéfice imposable ; peut être négatif (perte). */
  profit: z.union([z.literal(UNKNOWN), Money]).optional(),
  donations: Amount.optional(),
  cdiHires: Count.optional(),
  apprentices: Count.optional(),
  extraSalaries: Amount.optional(),
  otherOutflows: Amount.optional(),
});
export type EngineInput = z.output<typeof EngineInput>;

export const Mode = z.enum(['INTERNAL', 'CLIENT']);
export type Mode = z.infer<typeof Mode>;

/** Paramètres commerciaux (R4, R5) : pas des règles fiscales, validés par MARABU. */
export const CommercialParams = z.object({
  commissionRate: Rate,
  vatRate: Rate,
  commissionCap: NonNegativeMoney.nullable(),
  validated: z.boolean(),
});
export type CommercialParams = z.output<typeof CommercialParams>;
