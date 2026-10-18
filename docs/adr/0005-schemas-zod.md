# ADR-0005 — Schémas Zod comme contrat unique

- Statut : **Proposée**
- Rôle qui tranche : Architecte

## Décision
`packages/schemas` définit en Zod : règle, instantané de registre, entrées du diagnostic, résultat du moteur, dossier de preuve. Les types TypeScript en sont dérivés. L'API valide toute entrée avec ces schémas, et le contrat OpenAPI en est généré. Un résultat sans source (article, page, statut, date d'effet, version) **ne passe pas le schéma de sortie client** : c'est le contrôle automatique de R2.

## Conséquences
Une seule définition pour l'interface, l'API, la base et le PDF. Zod 4 : les entiers `bigint` sont sérialisés explicitement (ADR-0004).
