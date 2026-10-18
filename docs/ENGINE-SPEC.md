# Spécification du moteur (proposition, à relire par le fiscaliste)

## Types

- `Money` : entier de F CFA (`bigint` côté moteur ; sérialisé en chaîne décimale en JSON). Jamais `number`.
- `Rate` : fraction exacte `{ num: bigint; den: bigint }`. 25 % = 1/4 ; 20 % = 1/5 ; 18 % = 9/50.
- `LeverState` : `CALCULATED | NOT_COMPUTABLE | NULL`, avec `reasons[]` (codes + libellé fr-FR + donnée manquante ou règle bloquante).
- `NetState` : `COMPLETE | PARTIAL | NOT_COMPUTABLE`.
- Mode : `INTERNAL | CLIENT`.

## Arrondi (À VALIDER, Q2)

Une seule règle, appliquée uniquement au moment où une fraction est convertie en entier : `taux × montant` arrondi **au franc le plus proche, demi vers le haut**, calculé en arithmétique entière (`(num × m × 2 + den) / (2 × den)`). Appliqué à : impôts, commission HT, TVA. TTC = HT + TVA (somme d'entiers, sans nouvel arrondi). Les montants négatifs ne passent pas par cet arrondi (voir `max(0; …)`).

## Ordre de calcul (§ 5.3 du prompt, inchangé)

1. `taxBefore = rate × max(0, profit)` — taux CONFIRMÉ requis en mode client.
2. `profitAfter = profit − deductibleDonations` si la règle de déductibilité est CONFIRMÉE (mode client) ou activée (mode interne).
3. `taxAfterDeductions = rate × max(0, profitAfter)`.
4. `creditApplied = min(credits, taxAfterDeductions)`. Excédent : « excédent non remboursable sans texte ».
5. `gross = taxBefore − (taxAfterDeductions − creditApplied)`.
6. `outflows = donations + extraSalaries + others`. Salaires : effet fiscal non modélisé en V1, affiché.
7. `net = gross − outflows`.
8. `commission = rate × max(0, net)`, plafonnée si un plafond est défini (absent par défaut).

Si un décaissement n'est pas saisi : `net` = `PARTIAL`, avertissement visible, **commission non calculée**.

## États par levier

- **CALCULATED** : condition remplie, règle CONFIRMÉE (ou hypothèse étiquetée en mode interne), données complètes.
- **NOT_COMPUTABLE** : règle non CONFIRMÉE (mode client), donnée manquante, « Je ne sais pas », condition non établie. Aucun montant n'est produit (`null`, jamais `0`).
- **NULL** : condition établie comme fausse (aucun don, aucun salarié éligible). Le zéro est le vrai résultat.

Propagation : tout agrégat qui dépend d'un NOT_COMPUTABLE est NOT_COMPUTABLE ou PARTIAL, jamais un total présenté comme complet (T3, T4).

## Vérification arithmétique des cas dorés (à la main)

Base : bénéfice 40 000 000 ; taux 1/4 → `taxBefore` = 10 000 000.

| Cas | Calcul | Brut | Décaiss. | Net | Commission |
|---|---|---|---|---|---|
| T1 | profitAfter 36 M → impôt 9 M ; crédits 2,5 M ≤ 9 M → 6,5 M ; brut = 10 − 6,5 | 3 500 000 | 4 000 000 | −500 000 | 0 |
| T2 | impôt 9 M, pas de crédit ; brut = 10 − 9 | 1 000 000 | 4 000 000 | −3 000 000 | 0 |
| T5a | don non déductible : impôt 10 M ; crédits 2,5 M → 7,5 M | 2 500 000 | 4 000 000 | −1 500 000 | 0 |
| T5b | idem sans crédits | 0 | 4 000 000 | −4 000 000 | 0 |
| T6 | 2 CDI → crédits 2 M ; impôt 10 M → 8 M | 2 000 000 | 0 | 2 000 000 | HT 400 000 ; TVA 72 000 ; TTC 472 000 |

T3, T4 et T7 sont des tests d'états et de sortie, pas d'arithmétique.

## Zones floues à trancher (signalées, non résolues)

- **Répartition par levier (Q4).** Le prompt demande « économie brute / décaissements / net » **par levier** (§ 7.2), mais le plafond des crédits au montant de l'impôt est global. Défaut proposé : économie du levier « dons » = impôt avant − impôt après déductions (1 000 000 en T1) ; crédits imputés dans l'ordre d'affichage jusqu'à épuisement de l'impôt, l'excédent est montré une seule fois en global. Somme des leviers = total, vérifiée par test. Les décaissements sont rattachés au levier qui les génère (dons → levier dons : 4 000 000 ; net levier dons = −3 000 000 ; CDI +2 000 000 ; apprenti +500 000 ; total −500 000, cohérent avec T1).
- **Commission globale ou par levier (Q5).** Le prompt écrit `max(0 ; économie nette)` sur le total. Défaut : globale, donc un levier perdant en compense un autre (T1 : commission 0). À confirmer car cela change l'honoraire.
- **Total partiel en mode client (Q6).** T3 interdit un total « complet ». Défaut : aucun total ; un sous-total étiqueté « partiel, hors levier X » ; commission non calculée.
