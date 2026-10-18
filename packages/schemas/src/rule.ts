import { z } from 'zod';
import { IsoDate, IsoDateTime, NonNegativeMoney, Rate } from './primitives.ts';

export const RuleConcept = z.enum([
  'IS_RATE',
  'DONATION_DEDUCTIBILITY',
  'CREDIT_CDI',
  'CREDIT_APPRENTICE',
  'STARTUP_EXEMPTION',
  'VAT_FUEL_RECOVERY',
]);
export type RuleConcept = z.infer<typeof RuleConcept>;

export const RuleKind = z.enum(['REAL', 'TEST']);
export type RuleKind = z.infer<typeof RuleKind>;

export const RuleStatus = z.enum([
  'PENDING',
  'DRAFT',
  'LEGAL_VALIDATED',
  'ACCOUNTING_VALIDATED',
  'CONFIRMED',
]);
export type RuleStatus = z.infer<typeof RuleStatus>;

export const ValidationRole = z.enum(['LEGAL', 'ACCOUNTING']);
export type ValidationRole = z.infer<typeof ValidationRole>;

export const RuleValidation = z.object({
  role: ValidationRole,
  validator: z.string().min(1),
  at: IsoDateTime,
});
export type RuleValidation = z.infer<typeof RuleValidation>;

const baseFields = {
  id: z.string().min(1),
  label: z.string().min(1),
  kind: RuleKind,
  status: RuleStatus,
  article: z.string().min(1).nullable(),
  page: z.number().int().positive().nullable(),
  effectiveDate: IsoDate.nullable(),
  source: z.string().min(1).nullable(),
  author: z.string().min(1),
  version: z.number().int().positive(),
  validations: z.array(RuleValidation),
  sourceToObtain: z.string().min(1).nullable().default(null),
};

export const IsRateParams = z.object({ rate: Rate });
export const DonationParams = z.object({ deductible: z.boolean() });
export const CreditCdiParams = z.object({ amountPerHire: NonNegativeMoney });
export const CreditApprenticeParams = z.object({ amountPerApprentice: NonNegativeMoney });

/**
 * Exonération des startups labellisées (R08). Les paramètres sont des décisions de la règle validée,
 * pas du moteur : durée, année de labellisation comprise ou non, application à l'impôt sur les sociétés
 * (le texte vise l'impôt sur les bénéfices industriels et commerciaux, CGI 12 septies : à rattacher à l'IS par le fiscaliste).
 */
export const StartupParams = z.object({
  durationYears: z.number().int().min(1).max(10),
  includesLabelYear: z.boolean(),
  appliesToProfitTax: z.boolean(),
});
/** Récupération de la TVA sur le carburant agricole (R11). `capPercent` : plafond de la TVA récupérable s'il est établi, sinon null. */
export const VatFuelParams = z.object({ capPercent: Rate.nullable() });

const RuleUnion = z.discriminatedUnion('concept', [
  z.object({ ...baseFields, concept: z.literal('IS_RATE'), params: IsRateParams.nullable() }),
  z.object({
    ...baseFields,
    concept: z.literal('DONATION_DEDUCTIBILITY'),
    params: DonationParams.nullable(),
  }),
  z.object({ ...baseFields, concept: z.literal('CREDIT_CDI'), params: CreditCdiParams.nullable() }),
  z.object({
    ...baseFields,
    concept: z.literal('CREDIT_APPRENTICE'),
    params: CreditApprenticeParams.nullable(),
  }),
  z.object({ ...baseFields, concept: z.literal('STARTUP_EXEMPTION'), params: StartupParams.nullable() }),
  z.object({ ...baseFields, concept: z.literal('VAT_FUEL_RECOVERY'), params: VatFuelParams.nullable() }),
]);

/** Invariants du registre : aucune règle n'est inventée (R7), les règles de TEST ne sont jamais confirmées. */
export const Rule = RuleUnion.superRefine((rule, ctx) => {
  const issue = (message: string): void => {
    ctx.addIssue({ code: 'custom', message, path: ['status'] });
  };
  const has = (role: ValidationRole): boolean => rule.validations.some((v) => v.role === role);

  if (rule.status === 'PENDING') {
    if (rule.params !== null) issue('Une règle EN ATTENTE ne porte aucune valeur.');
    if (rule.validations.length > 0) issue('Une règle EN ATTENTE ne porte aucune validation.');
    if (rule.sourceToObtain === null) issue('Une règle EN ATTENTE indique la source à obtenir.');
  } else if (
    rule.params === null ||
    rule.article === null ||
    rule.page === null ||
    rule.effectiveDate === null ||
    rule.source === null
  ) {
    issue('Une règle hors EN ATTENTE porte article, page, date d’effet, source et valeurs.');
  }
  if (rule.kind === 'TEST') {
    if (!rule.label.startsWith('TEST')) issue('Le libellé d’une règle de TEST commence par « TEST ».');
    if (rule.status === 'CONFIRMED') issue('Une règle de TEST n’est jamais CONFIRMÉE.');
  }
  if (rule.status === 'LEGAL_VALIDATED' && !has('LEGAL')) issue('Validation juridique manquante.');
  if (rule.status === 'ACCOUNTING_VALIDATED' && !has('ACCOUNTING')) {
    issue('Validation comptable manquante.');
  }
  if (rule.status === 'CONFIRMED') {
    const legal = rule.validations.find((v) => v.role === 'LEGAL');
    const accounting = rule.validations.find((v) => v.role === 'ACCOUNTING');
    if (legal === undefined || accounting === undefined) {
      issue('Une règle CONFIRMÉE porte les deux validations.');
    } else if (
      legal.validator === accounting.validator ||
      legal.validator === rule.author ||
      accounting.validator === rule.author
    ) {
      issue('Auteur et validateurs doivent être trois personnes distinctes.');
    }
  }
});
export type Rule = z.output<typeof Rule>;

export const RegistrySnapshot = z
  .object({
    version: z.string().min(1),
    publishedAt: IsoDateTime,
    rules: z.array(Rule),
    hash: z.string().nullable().default(null),
  })
  .refine((s) => new Set(s.rules.map((r) => `${r.id}@${r.version}`)).size === s.rules.length, {
    message: 'Identifiants de règle en double.',
  });
export type RegistrySnapshot = z.output<typeof RegistrySnapshot>;

export const RULE_STATUS_LABEL_FR: Record<RuleStatus, string> = {
  PENDING: 'En attente',
  DRAFT: 'Projet',
  LEGAL_VALIDATED: 'Validée (juridique)',
  ACCOUNTING_VALIDATED: 'Validée (comptable)',
  CONFIRMED: 'Confirmée',
};
