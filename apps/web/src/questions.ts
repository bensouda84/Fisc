import type { EngineInput, RuleConcept } from '@fisc/schemas';

export interface Field {
  key: keyof EngineInput;
  label: string;
  kind: 'money' | 'count';
  allowNegative?: boolean;
  hint: string;
  concept?: RuleConcept;
}

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
];

export const ALL_FIELDS: Field[] = STEPS.flatMap((s) => s.fields);
export const UNKNOWN = 'UNKNOWN';

/** Texte saisi → valeur de l'API, ou `null` si la saisie est invalide. Une saisie vide n'est pas invalide : elle n'est pas envoyée. */
export function parseDraft(field: Field, text: string): string | number | null | undefined {
  if (text === UNKNOWN) return UNKNOWN;
  const t = text.trim();
  if (t === '') return undefined;
  const re = field.kind === 'count' ? /^\d{1,4}$/ : field.allowNegative ? /^-?\d{1,15}$/ : /^\d{1,15}$/;
  if (!re.test(t)) return null;
  return field.kind === 'count' ? Number.parseInt(t, 10) : t;
}

export function fieldError(field: Field, text: string): string | null {
  if (text === UNKNOWN || text.trim() === '') return null;
  return parseDraft(field, text) === null
    ? field.kind === 'count'
      ? 'Saisissez un nombre entier, sans virgule.'
      : 'Saisissez un montant entier en F CFA, sans virgule ni espace.'
    : null;
}
