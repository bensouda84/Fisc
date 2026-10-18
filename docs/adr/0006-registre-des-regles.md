# ADR-0006 — Registre des règles, statuts et audit

- Statut : **Proposée** ; vocabulaire de statuts **À VALIDER** par MARABU
- Rôles qui tranchent : Fiscaliste (statuts), Juriste (validation), Architecte (stockage)

## Statuts
`EN_ATTENTE` (source à obtenir) → `PROJET` → `VALIDÉE_JURIDIQUE` et `VALIDÉE_COMPTABLE` → `CONFIRMÉE`.
`CONFIRMÉE` n'est atteint que lorsque **les deux validations sont posées par deux personnes distinctes, différentes de l'auteur**. Toute modification d'une règle confirmée crée une nouvelle version et retire le statut CONFIRMÉE.

## Règles de TEST
Champ `kind: TEST | REAL`. Une règle `TEST` est exclue du mode client **quel que soit son statut**, et porte le libellé « TEST » partout où elle s'affiche. Le garde-fou est dans le moteur (refus) et dans le schéma de sortie client (rejet), et testé (T7), y compris sur le texte extrait du PDF.

## Versions et instantanés
Chaque publication produit un instantané immuable avec identifiant (`v1.0.0`, …) et empreinte. Un calcul enregistre l'identifiant d'instantané. Comparaison entre deux versions : diff champ par champ.

## Stockage
PostgreSQL : tables `rule`, `rule_version`, `rule_validation`, `registry_snapshot`, `audit_log`. `audit_log` est en ajout seul (aucun UPDATE/DELETE accordé au rôle applicatif), chaque ligne contient l'empreinte de la précédente. Jeu initial en JSON validé par schéma, chargé par migration.

## Aucune règle inventée (R7)
Toute règle absente est créée `EN_ATTENTE` avec le champ `sourceToObtain`. Aucune valeur (taux, plafond) n'est codée en dur dans le moteur ; le moteur ne lit que l'instantané.
