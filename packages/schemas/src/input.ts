import { z } from 'zod';
import { Money, NonNegativeMoney, Rate } from './primitives.ts';

/** « Je ne sais pas » est une réponse valide : elle rend le levier non calculable, jamais nul. */
export const UNKNOWN = 'UNKNOWN' as const;

const Amount = z.union([z.literal(UNKNOWN), NonNegativeMoney]);
const Count = z.union([z.literal(UNKNOWN), z.number().int().nonnegative()]);
/** Réponse oui / non / « Je ne sais pas » à une condition d'application. */
export const YesNo = z.enum(['YES', 'NO', UNKNOWN]);
export type YesNo = z.infer<typeof YesNo>;
const Year = z.union([z.literal(UNKNOWN), z.number().int().min(1990).max(2100)]);

export const EngineInput = z.object({
  /** Bénéfice imposable ; peut être négatif (perte). */
  profit: z.union([z.literal(UNKNOWN), Money]).optional(),
  donations: Amount.optional(),
  cdiHires: Count.optional(),
  apprentices: Count.optional(),
  interns: Count.optional(),
  extraSalaries: Amount.optional(),
  otherOutflows: Amount.optional(),
  /** Startup numérique labellisée ? Si NO, les deux questions suivantes ne sont pas posées. */
  isStartup: YesNo.optional(),
  /** Année de labellisation (comité du ministère chargé de la Transition numérique). */
  startupLabelYear: Year.optional(),
  /** Régime réel, hors zone franche biotechnologie et TIC (conditions cumulées du texte, R08). */
  startupRegime: YesNo.optional(),
  /** Exploitant agricole assujetti à la TVA par option, pour des produits dans le champ de la TVA (conditions cumulées, R11). */
  vatAgri: YesNo.optional(),
  /** TVA supportée sur le gaz, le gas-oil, les huiles et les graisses utilisés pour les engins. */
  fuelVat: Amount.optional(),
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
