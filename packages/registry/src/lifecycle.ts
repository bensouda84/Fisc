import { Rule, type RuleValidation } from '@fisc/schemas';

export class RegistryError extends Error {}

type Content = Pick<Rule, 'article' | 'page' | 'effectiveDate' | 'source' | 'params'>;

/**
 * Modifier le contenu d'une règle crée une nouvelle version et retire toute validation :
 * une règle CONFIRMÉE modifiée n'est plus confirmée.
 */
export function reviseRule(rule: Rule, content: Partial<Content>): Rule {
  const merged = { ...rule, ...content };
  const status = merged.params === null ? 'PENDING' : 'DRAFT';
  return Rule.parse({ ...merged, status, validations: [], version: rule.version + 1 });
}

/**
 * Validation à deux niveaux : un juriste (LEGAL) et un expert-comptable (ACCOUNTING),
 * deux personnes distinctes, toutes deux différentes de l'auteur.
 */
export function validateRule(rule: Rule, validation: RuleValidation): Rule {
  if (rule.status === 'PENDING') throw new RegistryError('Règle EN ATTENTE : aucune valeur à valider.');
  if (rule.kind === 'TEST') throw new RegistryError('Une règle de TEST ne se valide pas.');
  if (rule.status === 'CONFIRMED') throw new RegistryError('Règle déjà confirmée.');
  if (validation.validator === rule.author) {
    throw new RegistryError('L’auteur ne peut pas valider sa propre règle.');
  }
  if (rule.validations.some((v) => v.role === validation.role)) {
    throw new RegistryError('Cette validation est déjà posée.');
  }
  if (rule.validations.some((v) => v.validator === validation.validator)) {
    throw new RegistryError('Les deux validations viennent de deux personnes distinctes.');
  }
  const validations = [...rule.validations, validation];
  const legal = validations.some((v) => v.role === 'LEGAL');
  const accounting = validations.some((v) => v.role === 'ACCOUNTING');
  const status = legal && accounting ? 'CONFIRMED' : legal ? 'LEGAL_VALIDATED' : 'ACCOUNTING_VALIDATED';
  return Rule.parse({ ...rule, status, validations });
}
