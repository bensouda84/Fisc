# ADR-0002 — Versions figées

- Statut : **Proposée**
- Rôle qui tranche : Architecte
- Date de vérification : 18 octobre 2026, sur le registre npm (`npm view`)

## Constat
Versions stables publiées au jour de la vérification :

| Paquet | Version | Note |
|---|---|---|
| Node.js | 22.22.0 | version présente dans l'environnement ; à confirmer LTS avant le sprint 1 |
| pnpm | **10.28.0 retenu** (12.14.0 publié) | version de l'environnement, épinglée dans `packageManager` ; migration à étudier plus tard |
| typescript | **7.0.2 publiée, mais 6.0.3 retenue** | `typescript-eslint` 8.71.2 déclare `typescript >=4.8.4 <6.1.0` |
| vite | 8.3.4 | |
| react | 19.3.1 | |
| vitest | 5.0.5 | |
| zod | 4.6.7 | |
| fastify | 5.12.7 | `@fastify/swagger` 9.9.2 |
| @mui/material | 9.5.0 | candidat (ADR-0003) |
| @material/web | 2.5.0 | candidat (ADR-0003) |
| @material/material-color-utilities | 0.4.0 | tokens de rôle depuis la couleur source |
| @playwright/test | 1.64.1 | |
| @axe-core/playwright | 4.14.0 | |
| @lhci/cli | 0.15.1 | dernière publication juin 2025 : vérifier la compatibilité avec le Chrome fourni |
| pg | 8.23.1 | |

## Décision
- TypeScript **6.0.3**, mode strict, jusqu'à ce que `typescript-eslint` accepte TypeScript 7. Réévaluer à chaque sprint.
- Tout est figé par `pnpm-lock.yaml` et `packageManager`. Les numéros ci-dessus sont des **propositions** : le lockfile fait foi après l'installation.
- Aucune version « de mémoire » : toute mise à jour passe par une PR qui met à jour cet ADR.

## Conséquences
Reproductibilité. Risque : Lighthouse CI ancien ; solution de repli = `lighthouse` direct en CLI.
