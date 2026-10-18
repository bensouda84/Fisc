# Plan du POC mesimpo — Checkpoint 1

Version 1 · 18 octobre 2026 · **Statut : en attente de validation MARABU. Aucun code produit.**

Ce plan répond au prompt « POC mesimpo v1 ». Il s'arrête avant tout code, comme demandé (§ 11).
Les décisions d'architecture sont dans `docs/adr/`. Les points à trancher par MARABU sont dans `docs/OPEN-QUESTIONS.md`.

> **Limite à connaître.** Les sept rôles (§ 2 du prompt) sont tenus ici par un seul agent. Ce plan n'a donc reçu **aucune relecture réelle** d'un fiscaliste, d'un juriste ou d'une équipe QA. Toute mention « relu par » dans ce dépôt désigne une relecture à faire, pas une relecture faite. Les validations de règles dans le registre (§ 4) seront saisies par des personnes réelles de MARABU, jamais par moi.

## 1. Constats qui changent le plan

1. **Aucune source fiscale n'est disponible** (CGI 2026, LF 2026, LPF, notes DGI, etc. — liste en § 13 du prompt). Donc, par R1 et R7, **zéro règle réelle ne peut être CONFIRMÉE au démarrage**. Le POC démarre en **mode interne** et ne produit **aucune sortie client** tant que MARABU ne fournit pas au moins une source et ne fait pas valider une règle. Voir Q1.
2. **Conséquence sur les indicateurs (§ 10).** « Premier résultat sourcé en moins de 5 minutes » et « chaque montant client a une source cliquable » ne sont démontrables en mode client que si au moins une règle réelle est CONFIRMÉE. À défaut, la démonstration repose sur des règles de TEST en mode interne, et les tests T3, T4, T7 prouvent le blocage en mode client. C'est honnête, mais ce n'est pas la preuve du résultat sourcé. Voir Q1.
3. **TypeScript 7 est incompatible avec typescript-eslint** (peer `typescript >=4.8.4 <6.1.0`, vérifié sur le registre npm le 18 octobre 2026). → ADR-0002 fige TypeScript 6.0.3.
4. **Material Web (`@material/web`) existe en 2.5.0 mais Google ne l'a pas annoncé comme chemin principal en 2026** : le blog M3 ne parle que de Compose et d'Expressive à Google I/O 2026. → ADR-0003 : choix MUI vs Material Web décidé après l'essai d'une demi-journée prévu au prompt.
5. **Arithmétique des cas dorés vérifiée à la main** : T1 à T6 sont cohérents avec l'ordre de calcul du § 5.3 (voir `docs/ENGINE-SPEC.md`). Deux zones floues demandent une décision (répartition du plafond de crédit entre leviers ; commission globale ou par levier). Voir Q4 et Q5.

## 2. Qui tranche quoi

| Décision | Rôle qui tranche | Pourquoi |
|---|---|---|
| Périmètre (rien « pour plus tard »), mode interne par défaut | Stratège | Protège la promesse : aucun chiffre non sourcé |
| Cas dorés comme critères d'acceptation, 12 questions max | Product owner | Critères mesurables, démonstrable en fin de sprint |
| MUI vs Material Web, tokens de rôle, navigation adaptative | Designer UX/UI | Dépend de l'essai « chip de statut » |
| Monorepo, moteur pur, entiers/fractions, Fastify, PostgreSQL | Architecte | R6 et testabilité du moteur |
| Statut des règles, ordre de calcul, arrondi | Fiscaliste | **Décision réelle de MARABU requise** |
| Mentions de non-avis, honoraires au résultat, ARTCI | Juriste | **Décision réelle de MARABU requise** |
| Stratégie de test, WCAG 2.2 AA, critères de sortie | QA | Voir § 7 |

## 3. Architecture cible (résumé)

```
packages/
  engine/      TS pur : calcul, états, fractions exactes, aucune E/S          (ADR-0004)
  schemas/     Zod : règles, entrées, sorties, dossier de preuve              (ADR-0005)
  registry/    règles versionnées (JSON validé), logique de statut/validation (ADR-0006)
apps/
  api/         Fastify + OpenAPI, PostgreSQL, auth, audit                      (ADR-0007)
  web/         React + Vite, M3, 3 parcours + admin registre                   (ADR-0003)
docs/ adr/ runbook/
```

Principes :
- Le moteur reçoit `(entrées, instantané du registre, mode)` et renvoie un résultat. Il ne lit ni base, ni horloge, ni réseau. La date est un paramètre.
- Écran, serveur et PDF appellent **la même fonction** (R-parité, test dédié).
- Le PDF est généré **à partir du résultat sérialisé du moteur**, jamais recalculé.
- Le registre est un instantané immuable versionné. Un calcul embarque l'identifiant de version qu'il a utilisé.

## 4. Registre des règles

Cycle de vie : `EN_ATTENTE` → `PROJET` → `VALIDÉE_JURIDIQUE` + `VALIDÉE_COMPTABLE` → `CONFIRMÉE` (les deux validations sont portées par deux personnes distinctes, différentes de l'auteur). Une règle de `TEST` n'est jamais CONFIRMÉE : le drapeau `kind: TEST` la bloque en mode client indépendamment de son statut (T7).

Champs : id, libellé, kind (RÉELLE/TEST), statut, article, page, date d'effet, source, auteur, deux validations (qui, quand), version. Journal d'audit en lecture seule (ajout seul, chaîné par empreinte). Détail : ADR-0006.

**Entrées EN ATTENTE à créer au jour 1** (une par source manquante, aucune valeur codée) :
taux de l'IS ; déductibilité des dons (plafond, bénéficiaires, justificatifs) ; crédit d'impôt CDI ; crédit d'impôt apprenti ; autres crédits d'impôt ; effet fiscal des salaires (hors V1) ; renvoi aux sources : CGI consolidé 2026, LF 2026, LPF, registres V1/V3/V4, note DGI 0096, note DGI dons, BODGI 2026 HS21, annexes 2026 (art. 22, 31), arrêté d'application de l'art. 2. Liste complète : `docs/OPEN-QUESTIONS.md`.

## 5. Parcours et critères d'acceptation

| Parcours | Critère d'acceptation (extrait) |
|---|---|
| Diagnostic guidé | ≤ 12 questions ; « Je ne sais pas » → NON CALCULABLE ; sauvegarde auto ; « Pourquoi ? » ouvre la source |
| Résultat | Synthèse (nb CALCULÉS / NON CALCULABLES / NULS) ; carte par levier ; source en un clic ; trois montants distincts (R3) ; honoraires HT/TVA/TTC (R5) |
| Simulation | Recalcul immédiat sur bénéfice, dons, salaires ; n'écrit jamais dans le registre |
| Export PDF | Date, version du registre, hypothèses, états, sources, avertissements, non-avis ; mêmes montants que l'écran (test) |
| Admin registre | Deux validations distinctes ; diff entre versions ; audit lecture seule |

## 6. Calendrier

**Sprint 1 (jours 1–5)**
- J1 : checkpoint 1 (ce document) ; après validation : squelette monorepo, CI, versions figées.
- J1–J2 : schémas Zod, fractions/arrondi, entiers.
- J2–J4 : moteur, états par levier, mode interne/client, commission et HT/TVA/TTC.
- J3–J5 : registre (statuts, validation à deux niveaux, diff, audit) ; les 7 cas dorés.
- **Checkpoint 2** : cas dorés verts, couverture moteur ≥ 90 %.

**Sprint 2 (jours 6–10)**
- J6 : essai chip de statut (MUI vs Material Web), thème M3 ; décision police. Plan visuel, revue contre le prompt.
- J6–J8 : API, base, auth/rôles, 3 parcours, admin.
- J8–J9 : export PDF, parité écran/PDF.
- J9–J10 : Playwright (3 parcours), axe, Lighthouse, captures regardées avant livraison.
- **Checkpoint 3** : démonstration, rapports.

## 7. Stratégie de test (QA)

- **Moteur** : Vitest, 7 cas dorés, tests de propriétés (fast-check) : commission ≥ 0 ; net = brut − décaissements ; jamais de `number` non entier ; aucun NON CALCULABLE ne devient 0 ; mode client n'accepte aucune règle non CONFIRMÉE ni TEST.
- **Garde-fou bloquant** : test de contrat qui scanne chaque sortie client (JSON et texte du PDF) pour toute règle `TEST`/non CONFIRMÉE (T7).
- **Sources** : contrôle automatique que chaque montant client porte article, page, statut, date d'effet, version.
- **Bout en bout** : Playwright sur 3 parcours ; captures à 360, 768, 1440 px.
- **Accessibilité** : axe-core (0 violation critique), vérification manuelle clavier et contraste ; WCAG 2.2 AA.
- **Performance** : Lighthouse CI mobile, seuil 90 par défaut (à valider).

## 8. Risques

| Risque | Impact | Parade |
|---|---|---|
| Aucune règle confirmée | Pas de démo client réelle | Q1 ; démo en interne + tests de blocage |
| Rémunération au résultat sur du conseil fiscal | Peut être restreinte pour des professions réglementées | Q7 ; le juriste décide avant toute mise en service |
| Données salariés | ARTCI, loi n° 2013-450 | Q8 ; minimisation, pas de données réelles (R8) |
| Licence Avenir | Coût / conformité | Q3 ; repli Mulish ou Nunito Sans (OFL) |
| Écosystème TS 7 | Outillage cassé | ADR-0002 : TS 6.0.3 |
| Périmètre qui grossit | Dérive | Rien « pour plus tard » ; tout ajout passe par le stratège |

## 9. Ce que j'attends de MARABU pour passer au code

1. Valider ou amender ce plan et les ADR-0001 à 0008.
2. Répondre aux questions marquées **Bloquant** dans `docs/OPEN-QUESTIONS.md` (Q1, Q3, Q4, Q6).
3. Fournir au moins une source fiscale, ou confirmer que le POC reste en mode interne.
