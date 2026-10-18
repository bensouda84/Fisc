import type { EngineInput, RuleConcept } from '@fisc/schemas';

export type Draft = Record<string, string>;

export interface Field {
  key: keyof EngineInput;
  label: string;
  kind: 'money' | 'count' | 'yesno' | 'year';
  allowNegative?: boolean;
  hint: string;
  concept?: RuleConcept;
  /** Question conditionnelle : posée seulement si la porte correspondante est « Oui ». */
  showIf?: (draft: Draft) => boolean;
}

export const isVisible = (f: Field, draft: Draft): boolean => f.showIf === undefined || f.showIf(draft);

export interface Step {
  id: string;
  title: string;
  why: string;
  fields: Field[];
}

/** 4 écrans, 6 questions au plus 12 (§ 7.1). Les champs liés sont regroupés. */
export const STEPS: Step[] = [
  {
    id: 'profit',
    title: 'Quel est le bénéfice imposable de l’entreprise ?',
    why: 'Le bénéfice imposable est la base du calcul de l’impôt avant toute opération. Sans lui, aucun impôt n’est calculable.',
    fields: [
      { key: 'profit', label: 'Bénéfice imposable (F CFA)', kind: 'money', allowNegative: true, hint: 'Saisissez un montant entier, sans virgule. Une perte s’écrit avec un signe moins.', concept: 'IS_RATE' },
    ],
  },
  {
    id: 'donations',
    title: 'Quel montant de dons l’entreprise a-t-elle effectué ?',
    why: 'Les dons peuvent réduire le bénéfice imposable si le texte le prévoit. Ils restent aussi un décaissement : ils comptent dans l’économie nette.',
    fields: [
      { key: 'donations', label: 'Dons effectués (F CFA)', kind: 'money', hint: 'Saisissez 0 s’il n’y a eu aucun don.', concept: 'DONATION_DEDUCTIBILITY' },
    ],
  },
  {
    id: 'jobs',
    title: 'Combien de personnes l’entreprise a-t-elle embauchées ?',
    why: 'Les embauches en CDI et les apprentis peuvent ouvrir droit à des crédits d’impôt, appliqués après le calcul de l’impôt et limités à son montant.',
    fields: [
      { key: 'cdiHires', label: 'Embauches en CDI', kind: 'count', hint: 'Saisissez 0 s’il n’y en a pas.', concept: 'CREDIT_CDI' },
      { key: 'apprentices', label: 'Apprentis', kind: 'count', hint: 'Saisissez 0 s’il n’y en a pas.', concept: 'CREDIT_APPRENTICE' },
    ],
  },
  {
    id: 'outflows',
    title: 'Quels autres décaissements faut-il compter ?',
    why: 'Les décaissements sont retranchés de l’économie brute pour donner l’économie nette. L’effet fiscal des salaires n’est pas modélisé dans cette version.',
    fields: [
      { key: 'extraSalaries', label: 'Salaires supplémentaires (F CFA)', kind: 'money', hint: 'Saisissez 0 s’il n’y en a pas.' },
      { key: 'otherOutflows', label: 'Autres décaissements (F CFA)', kind: 'money', hint: 'Saisissez 0 s’il n’y en a pas.' },
    ],
  },
  {
    id: 'startup',
    title: 'L’entreprise est-elle une startup numérique labellisée ?',
    why: 'Une startup numérique labellisée peut être exonérée de l’impôt sur les bénéfices pendant une durée fixée par le texte. L’exonération prime sur les autres leviers : sans impôt, ni déduction ni crédit n’ont d’effet.',
    fields: [
      { key: 'isStartup', label: 'Startup numérique labellisée', kind: 'yesno', hint: 'Label délivré par le comité du ministère chargé de la Transition numérique.', concept: 'STARTUP_EXEMPTION' },
      { key: 'startupLabelYear', label: 'Année de labellisation', kind: 'year', hint: 'Saisissez l’année sur 4 chiffres, par exemple 2024.', concept: 'STARTUP_EXEMPTION', showIf: (d) => d.isStartup === 'YES' },
      { key: 'startupRegime', label: 'Régime réel, hors zone franche biotechnologie et TIC', kind: 'yesno', hint: 'Les deux conditions doivent être remplies : répondez « Non » si l’une d’elles ne l’est pas.', concept: 'STARTUP_EXEMPTION', showIf: (d) => d.isStartup === 'YES' },
    ],
  },
  {
    id: 'agri',
    title: 'Exploitez-vous une activité agricole assujettie à la TVA ?',
    why: 'Un exploitant agricole assujetti à la TVA par option peut déduire la TVA supportée sur le carburant de ses engins, si ses produits sont dans le champ de la TVA. Les deux conditions sont cumulatives.',
    fields: [
      { key: 'vatAgri', label: 'Exploitant agricole assujetti à la TVA par option, pour des produits dans le champ de la TVA', kind: 'yesno', hint: 'Répondez « Non » si l’une des deux conditions n’est pas remplie.', concept: 'VAT_FUEL_RECOVERY' },
      { key: 'fuelVat', label: 'TVA supportée sur le gaz, le gas-oil, les huiles et les graisses des engins (F CFA)', kind: 'money', hint: 'Saisissez le montant de TVA payée sur l’exercice, ou 0.', concept: 'VAT_FUEL_RECOVERY', showIf: (d) => d.vatAgri === 'YES' },
    ],
  },
];

export const ALL_FIELDS: Field[] = STEPS.flatMap((s) => s.fields);
export const UNKNOWN = 'UNKNOWN';

/** Texte saisi → valeur de l'API, ou `null` si la saisie est invalide. Une saisie vide n'est pas invalide : elle n'est pas envoyée. */
export function parseDraft(field: Field, text: string): string | number | null | undefined {
  if (text === UNKNOWN) return UNKNOWN;
  const t = text.trim();
  if (t === '') return undefined;
  if (field.kind === 'yesno') return t === 'YES' || t === 'NO' ? t : null;
  if (field.kind === 'year') {
    const year = /^\d{4}$/.test(t) ? Number.parseInt(t, 10) : 0;
    return year >= 1990 && year <= 2100 ? year : null;
  }
  const re = field.kind === 'count' ? /^\d{1,4}$/ : field.allowNegative ? /^-?\d{1,15}$/ : /^\d{1,15}$/;
  if (!re.test(t)) return null;
  return field.kind === 'count' ? Number.parseInt(t, 10) : t;
}

export function fieldError(field: Field, text: string): string | null {
  if (text === UNKNOWN || text.trim() === '') return null;
  if (parseDraft(field, text) !== null) return null;
  if (field.kind === 'year') return 'Saisissez une année sur 4 chiffres, entre 1990 et 2100.';
  if (field.kind === 'yesno') return 'Choisissez Oui, Non ou Je ne sais pas.';
  return field.kind === 'count' ? 'Saisissez un nombre entier, sans virgule.' : 'Saisissez un montant entier en F CFA, sans virgule ni espace.';
}
