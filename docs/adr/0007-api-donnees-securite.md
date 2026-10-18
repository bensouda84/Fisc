# ADR-0007 — API, données et sécurité du POC

- Statut : **Proposée**
- Rôles qui tranchent : Architecte, Juriste (données personnelles)

## Décisions
- **Fastify 5** avec `@fastify/swagger` (contrat OpenAPI généré depuis Zod). NestJS écarté : surcoût de structure pour un POC de deux semaines.
- **PostgreSQL** ; migrations versionnées ; Docker Compose en local.
- Authentification, rôles `consultant`, `client`, `validateur`, `administrateur` ; contrôle côté serveur (le mode client est imposé par le rôle `client`, pas par un paramètre modifiable).
- Journal d'audit en ajout seul (ADR-0006). Secrets par variables d'environnement, jamais dans le dépôt ; HTTPS en déploiement.
- **Données personnelles** : salaires et effectifs saisis concernent des salariés. Minimisation : montants agrégés, aucun nom, pas de données réelles dans le dépôt (R8). Durée de conservation à fixer. Déclaration ou autorisation ARTCI (loi n° 2013-450) : **à vérifier par le juriste sur le texte officiel** (Q8).
- Aucune IA générative dans le calcul (hors périmètre).

## Mode de session
Sauvegarde automatique du diagnostic côté serveur, rattachée au compte, supprimable.
