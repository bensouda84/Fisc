import { Rule } from '@fisc/schemas';
import realRules from '../data/rules-v1.json' with { type: 'json' };
import testRules from '../data/test-rules.json' with { type: 'json' };

/** Registre V1 : une entrée EN ATTENTE par règle dont la source manque. Aucune valeur codée (R7). */
export const loadRealRules = (): Rule[] => realRules.map((r) => Rule.parse(r));

/** Règles de TEST, étiquetées « TEST » : arithmétique seulement, bloquées en mode client. */
export const loadTestRules = (): Rule[] => testRules.map((r) => Rule.parse(r));
