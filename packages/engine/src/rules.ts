import type {
  BlockedRule,
  Mode,
  Reason,
  RegistrySnapshot,
  Rule,
  RuleConcept,
  SourceRef,
} from '@fisc/schemas';

type Params<C extends RuleConcept> = Extract<Rule, { concept: C }>['params'] & object;

export type Resolution<C extends RuleConcept> =
  | { ok: true; rule: Extract<Rule, { concept: C }>; params: Params<C>; source: SourceRef }
  | { ok: false; reason: Reason; blocked: BlockedRule };

const CONCEPT_LABEL_FR: Record<RuleConcept, string> = {
  IS_RATE: 'le taux de l’impôt sur les sociétés',
  DONATION_DEDUCTIBILITY: 'la déductibilité des dons',
  CREDIT_CDI: 'le crédit d’impôt pour les CDI',
  CREDIT_APPRENTICE: 'le crédit d’impôt pour les apprentis',
};

export function conceptLabel(concept: RuleConcept): string {
  return CONCEPT_LABEL_FR[concept];
}

function toSource(rule: Rule, registryVersion: string): SourceRef {
  if (
    rule.article === null ||
    rule.page === null ||
    rule.effectiveDate === null ||
    rule.source === null
  ) {
    throw new Error(`Règle ${rule.id} utilisée sans source complète`);
  }
  return {
    ruleId: rule.id,
    concept: rule.concept,
    label: rule.label,
    kind: rule.kind,
    status: rule.status,
    article: rule.article,
    page: rule.page,
    effectiveDate: rule.effectiveDate,
    source: rule.source,
    registryVersion,
  };
}

function failure(rule: Rule | undefined, concept: RuleConcept, mode: Mode, asOf: string) {
  const what = conceptLabel(concept);
  const reason = (code: Reason['code'], message: string): Reason => ({ code, message, concept });
  if (rule === undefined) {
    return {
      reason: reason('RULE_MISSING', `Aucune règle n’est enregistrée pour ${what}.`),
      blocked: { concept } as BlockedRule,
    };
  }
  if (mode === 'CLIENT' && rule.kind === 'TEST') {
    return {
      reason: reason('RULE_NOT_AVAILABLE', `La règle pour ${what} n’est pas disponible.`),
      blocked: { concept } as BlockedRule,
    };
  }
  const blocked: BlockedRule = { concept, ruleId: rule.id, status: rule.status };
  if (rule.status === 'PENDING') {
    return {
      reason: reason('RULE_PENDING', `La source pour ${what} reste à obtenir.`),
      blocked,
    };
  }
  if (rule.effectiveDate !== null && rule.effectiveDate > asOf) {
    return {
      reason: reason('RULE_NOT_IN_FORCE', `La règle pour ${what} n’est pas en vigueur à cette date.`),
      blocked,
    };
  }
  return {
    reason: reason('RULE_NOT_CONFIRMED', `La règle pour ${what} n’est pas confirmée.`),
    blocked,
  };
}

/**
 * Règle utilisable pour un calcul.
 * - CLIENT : kind REAL, statut CONFIRMED, en vigueur (R1).
 * - INTERNAL : toute règle portant des valeurs et en vigueur ; les non confirmées deviennent des hypothèses.
 */
export function resolveRule<C extends RuleConcept>(
  snapshot: RegistrySnapshot,
  concept: C,
  mode: Mode,
  asOf: string,
): Resolution<C> {
  const candidates = snapshot.rules
    .filter((r): r is Extract<Rule, { concept: C }> => r.concept === concept)
    .sort((a, b) => (b.effectiveDate ?? '').localeCompare(a.effectiveDate ?? ''));

  for (const rule of candidates) {
    const inForce = rule.effectiveDate !== null && rule.effectiveDate <= asOf;
    const allowed =
      rule.status !== 'PENDING' &&
      rule.params !== null &&
      inForce &&
      (mode === 'INTERNAL' || (rule.kind === 'REAL' && rule.status === 'CONFIRMED'));
    if (allowed) {
      return {
        ok: true,
        rule,
        params: rule.params as unknown as Params<C>,
        source: toSource(rule, snapshot.version),
      };
    }
  }
  return { ok: false, ...failure(candidates[0], concept, mode, asOf) };
}
