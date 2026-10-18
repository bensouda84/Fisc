# Rapport de sprint 1 — checkpoint 2

Date : 18 octobre 2026. Commande : `pnpm check` (lint, types, tests) et `pnpm coverage`.

## Cas dorés

| Cas | Test | Résultat |
|---|---|---|
| T1 | `golden.test.ts` — brut 3 500 000, décaissements 4 000 000, net −500 000, commission 0 ; par levier +1 M/−3 M, +2 M, +0,5 M | vert |
| T2 | brut 1 000 000, net −3 000 000, commission 0 | vert |
| T3 | client, CDI non confirmée : levier NON CALCULABLE (montants `null`), total PARTIEL, commission non calculée | vert |
| T4 | client, taux IS non confirmé : impôt `null`, tous les leviers dépendants non calculables | vert |
| T5 | don non déductible : brut 2 500 000 / net −1 500 000 ; sans crédits 0 / −4 000 000 | vert |
| T6 | brut 2 000 000, net 2 000 000, commission 400 000 HT, 72 000 TVA, 472 000 TTC | vert |
| T7 | règle de TEST en mode client : aucune occurrence de « TEST » dans la sortie, aucune source, aucun total complet ; garde-fou testé seul | vert |

## Autres tests

- États : « Je ne sais pas », donnée manquante, décaissement manquant (net PARTIEL), règle EN ATTENTE, règle hors vigueur, plafond de crédit et excédent, bénéfice négatif, plafond de commission.
- Propriétés (fast-check, 300 tirages) : net = brut − décaissements ; commission ≥ 0 ; aucun levier non calculable ne porte de montant ; somme des leviers = brut ; en mode client, toute source est REAL et CONFIRMÉE.
- Arrondi : écart au résultat exact ≤ 0,5 F.
- Registre : registre V1 initial 100 % EN ATTENTE (client : tout non calculable) ; validation à deux niveaux (auteur ≠ validateurs, deux personnes distinctes) ; modification d'une règle confirmée retire la confirmation ; empreinte d'instantané ; comparaison entre deux versions ; journal d'audit chaîné et détection d'altération.
- Garde-fous de lint sur `packages/engine/src` : pas de `Number`, `parseFloat`, littéral décimal, `Date`, `Math.random`, `fetch`, ni import `node:*` (vérifié sur un fichier sonde).

## Couverture (seuil 90 %)

```
packages/engine coverage: Statements   : 99.55% ( 222/223 )
packages/engine coverage: Branches     : 95.56% ( 194/203 )
packages/engine coverage: Functions    : 100% ( 32/32 )
packages/engine coverage: Lines        : 99.5% ( 199/200 )
packages/registry coverage: Statements   : 100% ( 78/78 )
packages/registry coverage: Branches     : 100% ( 42/42 )
packages/registry coverage: Functions    : 100% ( 25/25 )
packages/registry coverage: Lines        : 100% ( 55/55 )
```

## Écarts et limites

- Les schémas Zod couvrent règles, instantanés et entrées. Le **résultat** du moteur est typé en TypeScript, pas encore en Zod : le schéma de sortie arrive avec l'API (sprint 2).
- Le registre est implémenté en logique pure et en données JSON. Les tables PostgreSQL et les droits « ajout seul » du journal d'audit sont au sprint 2.
- Aucune relecture réelle par un fiscaliste ou un juriste n'a eu lieu. Les décisions marquées « à confirmer » dans `ENGINE-SPEC.md` restent à valider.
- Registre V1 : 4 règles, toutes EN ATTENTE ; aucune sortie client réelle possible (Q1).
