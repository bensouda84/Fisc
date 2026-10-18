import { z } from 'zod';
import { Mode } from './input.ts';
import { RuleConcept, RuleKind, RuleStatus } from './rule.ts';

const Amount = z.coerce.bigint();
const NullableAmount = Amount.nullable();

const Reason = z.object({
  code: z.string(),
  message: z.string(),
  field: z.string().optional(),
  concept: RuleConcept.optional(),
});

const SourceRef = z.object({
  ruleId: z.string(),
  concept: RuleConcept,
  label: z.string(),
  kind: RuleKind,
  status: RuleStatus,
  article: z.string().min(1),
  page: z.number().int().positive(),
  effectiveDate: z.iso.date(),
  source: z.string().min(1),
  registryVersion: z.string().min(1),
});

const Lever = z.object({
  id: z.enum(['STARTUP_EXEMPTION', 'DONATIONS', 'CREDIT_CDI', 'CREDIT_APPRENTICE', 'VAT_FUEL_RECOVERY']),
  label: z.string(),
  state: z.enum(['CALCULATED', 'NOT_COMPUTABLE', 'NULL']),
  gross: NullableAmount,
  outflows: NullableAmount,
  net: NullableAmount,
  creditExcess: NullableAmount,
  reasons: z.array(Reason),
  sources: z.array(SourceRef),
});

const Aggregate = z.discriminatedUnion('state', [
  z.object({ state: z.literal('COMPLETE'), value: Amount }),
  z.object({ state: z.literal('PARTIAL'), subtotal: Amount, missing: z.array(z.string()) }),
  z.object({ state: z.literal('NOT_COMPUTABLE'), missing: z.array(z.string()) }),
]);

const Commission = z.discriminatedUnion('state', [
  z.object({ state: z.literal('COMPUTED'), base: Amount, excl: Amount, vat: Amount, incl: Amount, capApplied: z.boolean() }),
  z.object({ state: z.literal('NOT_COMPUTED'), reason: Reason }),
]);

/** Schéma de sortie du moteur (JSON réseau → montants en bigint). */
export const EngineResultSchema = z.object({
  mode: Mode,
  asOf: z.iso.date(),
  registryVersion: z.string().min(1),
  taxBefore: NullableAmount,
  taxSources: z.array(SourceRef),
  taxAfterDeductions: NullableAmount,
  levers: z.array(Lever),
  gross: Aggregate,
  outflows: Aggregate,
  unallocatedOutflows: Aggregate,
  net: Aggregate,
  commission: Commission,
  blockedRules: z.array(z.object({ concept: RuleConcept, ruleId: z.string().optional(), status: RuleStatus.optional() })),
  assumptions: z.array(z.object({ ruleId: z.string(), label: z.string(), kind: RuleKind, status: RuleStatus, message: z.string() })),
  warnings: z.array(z.object({ code: z.string(), message: z.string() })),
  disclaimer: z.string().min(1),
});

/**
 * Sortie destinée à un client (R1, R2) : aucune règle de TEST ni non confirmée, aucune hypothèse,
 * aucun levier non calculable chiffré, tout montant non nul porte au moins une source complète.
 */
export const ClientResultSchema = EngineResultSchema.superRefine((r, ctx) => {
  const issue = (message: string): void => { ctx.addIssue({ code: 'custom', message }); };
  if (r.mode !== 'CLIENT') issue('Une sortie client est en mode CLIENT.');
  if (r.assumptions.length > 0) issue('Aucune hypothèse en sortie client.');
  for (const s of r.taxSources) {
    if (s.kind !== 'REAL' || s.status !== 'CONFIRMED') issue(`Source ${s.ruleId} interdite en sortie client.`);
  }
  if (r.taxBefore !== null && r.taxBefore !== 0n && r.taxSources.length === 0) issue('Impôt sans source.');
  for (const lever of r.levers) {
    for (const s of lever.sources) {
      if (s.kind !== 'REAL' || s.status !== 'CONFIRMED') issue(`Source ${s.ruleId} interdite en sortie client.`);
    }
    if (lever.state === 'NOT_COMPUTABLE' && (lever.gross !== null || lever.net !== null)) issue(`Levier ${lever.id} non calculable mais chiffré.`);
    if (lever.state === 'CALCULATED' && lever.gross !== 0n && lever.sources.length === 0) issue(`Montant sans source : ${lever.id}.`);
  }
  if (JSON.stringify(r, (_k, v: unknown) => (typeof v === 'bigint' ? v.toString() : v)).includes('TEST')) {
    issue('Aucune mention de TEST en sortie client.');
  }
});
export type EngineResultWire = z.input<typeof EngineResultSchema>;
