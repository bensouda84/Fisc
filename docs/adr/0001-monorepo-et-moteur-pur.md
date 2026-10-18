# ADR-0001 — Monorepo pnpm et moteur pur

- Statut : **Proposée** (checkpoint 1)
- Rôle qui tranche : Architecte
- Date : 18 octobre 2026

## Contexte
Le moteur doit être partagé par l'interface, le serveur et le PDF, sans E/S (R, § 4 et § 9). Le prompt propose un monorepo pnpm.

## Décision
Monorepo pnpm avec espaces de travail `packages/engine`, `packages/schemas`, `packages/registry`, `apps/api`, `apps/web`. Le package `engine` n'a **aucune dépendance** d'exécution hors `schemas` et interdit par règle de lint les imports `node:*`, `fs`, `Date.now`, `Math.random`, `fetch`. La date de calcul est un paramètre.

## Conséquences
- Parité écran / serveur / PDF garantie par une seule fonction.
- Tests du moteur rapides et déterministes.
- Une règle de lint (`no-restricted-imports`, `no-restricted-globals`) fait échouer la CI si le moteur touche aux E/S.

## Alternatives écartées
Moteur dans l'API seulement : l'interface ne pourrait pas recalculer instantanément la simulation (§ 7.3).
