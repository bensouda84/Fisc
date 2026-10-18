import { Catalogue, Rule } from '@fisc/schemas';
import catalogue from '../data/catalogue-2026.json' with { type: 'json' };
import realRules from '../data/rules-v1.json' with { type: 'json' };
import testRules from '../data/test-rules.json' with { type: 'json' };

/** Registre V1 : une entrée EN ATTENTE par règle dont la source manque. Aucune valeur codée (R7). */
export const loadRealRules = (): Rule[] => realRules.map((r) => Rule.parse(r));

/** Règles de TEST, étiquetées « TEST » : arithmétique seulement, bloquées en mode client. */
export const loadTestRules = (): Rule[] => testRules.map((r) => Rule.parse(r));

/** Catalogue informatif du classeur de règles (33 lignes + annexes). Jamais lu par le moteur. */
export const loadCatalogue = (): Catalogue => Catalogue.parse(catalogue);
