import type { Aggregate, EngineInput, LeverState, RuleConcept } from '@fisc/schemas';
import { formatMoney } from './format.ts';

export const LEVER_STATE_LABEL_FR: Record<LeverState, string> = {
  CALCULATED: 'Calculée',
  NOT_COMPUTABLE: 'Non calculable',
  NULL: 'Nulle',
};

export const CONCEPT_TITLE_FR: Record<RuleConcept, string> = {
  IS_RATE: 'Taux de l’impôt sur les sociétés',
  DONATION_DEDUCTIBILITY: 'Déductibilité des dons',
  CREDIT_CDI: 'Crédit d’impôt pour les CDI',
  CREDIT_APPRENTICE: 'Crédit d’impôt pour les apprentis',
  CREDIT_INTERN: 'Crédit d’impôt pour les stagiaires',
  STARTUP_EXEMPTION: 'Exonération des startups labellisées',
  VAT_FUEL_RECOVERY: 'TVA sur le carburant des exploitants agricoles',
};

export const INPUT_LABEL_FR: Record<keyof EngineInput, string> = {
  profit: 'Bénéfice imposable',
  donations: 'Dons effectués',
  cdiHires: 'Embauches en CDI',
  apprentices: 'Apprentis',
  interns: 'Stagiaires',
  extraSalaries: 'Salaires supplémentaires',
  otherOutflows: 'Autres décaissements',
  isStartup: 'Startup numérique labellisée',
  startupLabelYear: 'Année de labellisation',
  startupRegime: 'Régime réel, hors zone franche biotechnologie et TIC',
  vatAgri: 'Exploitant agricole assujetti à la TVA par option',
  fuelVat: 'TVA supportée sur le carburant des engins',
};

export const INPUT_KEYS = Object.keys(INPUT_LABEL_FR) as (keyof EngineInput)[];

/** Texte d'une valeur saisie, identique à l'écran et dans le PDF. */
export function describeInput(key: keyof EngineInput, value: EngineInput[keyof EngineInput]): string {
  if (value === undefined) return 'Non saisi';
  if (value === 'UNKNOWN') return 'Je ne sais pas';
  if (key === 'cdiHires' || key === 'apprentices' || key === 'interns' || key === 'startupLabelYear') return String(value);
  if (value === 'YES') return 'Oui';
  if (value === 'NO') return 'Non';
  return formatMoney(value as bigint);
}

/** Texte d'un agrégat : montant, sous-total partiel ou « Non calculable ». Jamais « 0 » pour une lacune. */
export function describeAggregate(agg: Aggregate): string {
  if (agg.state === 'COMPLETE') return formatMoney(agg.value);
  if (agg.state === 'PARTIAL') return `Partielle — sous-total ${formatMoney(agg.subtotal)}`;
  return 'Non calculable';
}

/** Questions réellement posées : les réponses dépendantes d'une porte « Non » ne sont ni demandées ni affichées. */
export function visibleInputKeys(input: EngineInput): (keyof EngineInput)[] {
  return INPUT_KEYS.filter((key) => {
    if (key === 'startupLabelYear' || key === 'startupRegime') return input.isStartup === 'YES';
    if (key === 'fuelVat') return input.vatAgri === 'YES';
    return true;
  });
}
