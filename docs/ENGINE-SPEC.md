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

## Décisions d'implémentation du sprint 1 (défauts validés, à confirmer en relecture fiscaliste)

- **Imputation des crédits (Q4).** Dans l'ordre d'affichage (CDI, apprentis, puis stagiaires), en commençant par les leviers calculables ; un levier non calculable passe en dernier. Les montants des leviers calculables ne dépendent donc jamais d'un montant inconnu. L'ordre n'a d'effet que si le plafond (impôt) est atteint ; l'excédent est signalé par levier.
- **Dépendance au levier dons.** Si le levier dons est non calculable (don possible, mais règle non confirmée ou donnée manquante), l'impôt après déductions est indéterminé : les leviers de crédit deviennent non calculables (`DEPENDS_ON_DONATIONS_LEVER`).
- **Décaissements.** Dons : rattachés au levier dons. Salaires supplémentaires et autres : non rattachés (`unallocatedOutflows`). Les trois doivent être saisis (0 est une saisie valide) pour que le net soit complet.
- **Total partiel (Q6).** `PARTIAL` porte un sous-total et la liste des éléments manquants ; l'interface l'étiquette « partiel » ; commission non calculée.
- **Règles bloquées en mode client.** `blockedRules` liste les règles REAL non confirmées (identifiant, statut) pour dire à l'écran ce qui manque. Une règle de TEST n'y figure jamais avec son identifiant (T7). À faire valider par le juriste : R1 dit qu'une sortie client ne contient que des règles CONFIRMÉES ; cette liste ne contient aucune valeur ni aucun montant.
- **Paramètres commerciaux.** Taux de commission, TVA, plafond : fournis à part (`CommercialParams`), avec un indicateur `validated`. En mode client, non validés → commission non calculée.
- **Garde-fou.** `simulate` appelle `assertClientSafe` avant de rendre un résultat CLIENT.

## Modules startup (R08) et TVA sur le carburant agricole (R11)

Ajoutés après le sprint 2 à la demande de MARABU, à partir du classeur `docs/sources`. **Aucun des deux n'a de règle confirmée** : en mode client ils sont NON CALCULABLES tant que les règles ne sont pas renseignées, validées et publiées. Les règles de TEST valident l'arithmétique.

### Exonération startup (`STARTUP_EXEMPTION`)
- Portes de saisie : `isStartup` (Oui / Non / Je ne sais pas) ; si Oui, `startupLabelYear` et `startupRegime` (« régime réel, hors zone franche biotechnologie et TIC », deux conditions cumulées du texte, une seule question).
- Paramètres de la règle (décisions des validateurs, jamais du moteur) : `durationYears`, `includesLabelYear`, `appliesToProfitTax`. Le texte vise « l'impôt sur les bénéfices industriels et commerciaux » (CGI 12 septies) : le classeur demande de le rattacher à l'IS (CGI 51) ; tant que `appliesToProfitTax` n'est pas posé par les validateurs, la règle ne peut pas être confirmée.
- Exercice = année de la date de calcul (`asOf`). Période = `[année de labellisation + (includesLabelYear ? 0 : 1), … + durationYears − 1]`.
- États : porte « Non », régime exclu, hors période ou règle non applicable à l'IS → **NULLE** (zéro établi) ; « Je ne sais pas », donnée manquante, règle non confirmée → **NON CALCULABLE** ; sinon **CALCULÉE** : économie brute = impôt avant opérations.
- Effet sur les autres leviers : l'exonération s'applique en premier. Exonérée, l'impôt après opérations est 0 : dons et crédits restent CALCULÉS à 0 (zéro réel, motif « l'exonération supprime déjà l'impôt »), les crédits non imputés apparaissent en excédent ; aucun double compte (somme des leviers = impôt avant opérations). Si l'exonération est NON CALCULABLE, l'impôt après opérations est indéterminé : dons et crédits deviennent NON CALCULABLES (`DEPENDS_ON_STARTUP_LEVER`).
- **Non modélisés** (R08 b à e) : impôt des microentreprises (CGI 71 quinquies), taxe d'État de l'entreprenant (80 bis), impôt sur le revenu des créances (236 sexies), TOB sur intérêts de prêts (398, 16°).

### TVA sur le carburant agricole (`VAT_FUEL_RECOVERY`)
- Portes : `vatAgri` (assujetti à la TVA par option **et** produits dans le champ de la TVA : conditions cumulatives du texte, une seule question), puis `fuelVat` (TVA supportée sur le gaz, le gas-oil, les huiles et les graisses des engins).
- Paramètre de la règle : `capPercent` (fraction ou null). Le plafond de 95 % cité par l'exposé n'est **pas** codé : à établir par les validateurs.
- États : porte « Non » ou TVA nulle → NULLE ; « Je ne sais pas », donnée manquante ou règle non confirmée → NON CALCULABLE ; sinon CALCULÉE : économie brute = `fuelVat` (× plafond s'il existe). Indépendant de l'IS : calculable même sans taux de l'IS.
- Non retenus comme leviers (voir `docs/OPEN-QUESTIONS.md`) : R03/R04 (taux de 9 % sur des opérations, ordonnance non lue), R05, R14, R15, N09.

### Total et portes
Un levier non interrogé (donnée absente) est NON CALCULABLE, comme pour tout levier. Un total sans aucun levier CALCULÉ est NON CALCULABLE (des zéros établis par les portes « Non » ne forment pas un sous-total).

## Crédit stagiaires (N04, `CREDIT_INTERN`)

Crédit par stagiaire (CGI 111 ter) traité comme CDI et apprentis : nombre saisi × montant du registre, imputé après les autres crédits, limité à l'impôt, excédent signalé. Une saisie à 0 donne un levier NUL ; une saisie manquante, un levier NON CALCULABLE. Le registre ne porte **qu'un montant par stagiaire** : la condition qui distingue 25 000 F de 50 000 F (seuil PME) est ouverte (Q26) et ne sera ajoutée comme question qu'une fois tranchée. Règle réelle EN ATTENTE, règle de TEST à 25 000 F pour l'arithmétique.
