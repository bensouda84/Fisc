# Runbook d'exploitation — POC mesimpo

## Démarrage local (une séquence)

```bash
cp .env.example .env            # puis remplacer chaque « change-me »
docker compose up -d db         # PostgreSQL 16
set -a; . ./.env; set +a
pnpm install
pnpm -F @fisc/api seed          # migrations + comptes de démonstration (.test) + registre V1
pnpm -F @fisc/api start &       # API sur le port 3001
pnpm -F @fisc/web build && pnpm -F @fisc/web preview   # interface sur le port 4173 (proxy /api)
```

Comptes de démonstration (mot de passe : `SEED_PASSWORD`) : `consultant@`, `client@`, `juriste@`, `expert@`, `admin@fisc.test`. Aucun compte ni donnée réels (R8).
`SEED_TEST_RULES=false` démarre sans règle de TEST : aucun calcul interne possible tant qu'une règle réelle n'est pas confirmée.

## Vérifications

| Contrôle | Commande |
|---|---|
| Lint, types, tests unitaires | `pnpm check` |
| Couverture (moteur ≥ 90 %) | `pnpm coverage` |
| API (base jetable `TEST_DATABASE_URL`) | `pnpm -F @fisc/api test` |
| Bout en bout + axe | `E2E_DATABASE_URL=… pnpm -F @fisc/web e2e` |
| Lighthouse mobile | `pnpm -F @fisc/web lighthouse` |
| Santé | `GET /health` ; contrat `GET /openapi.json` |

## Opérations courantes

- **Confirmer une règle** : admin « Renseigner » (article, page, date d'effet, source, valeur) → validateur juridique puis validateur comptable (deux personnes, différentes de l'auteur) → admin publie une version (onglet Versions). Un client ne voit un chiffre qu'après publication.
- **Modifier une règle confirmée** : toute modification crée une version et retire les validations. Republier après nouvelle validation.
- **Paramètres commerciaux** : tant que « validés par MARABU » est désactivé, aucun client ne voit de commission.
- **Journal d'audit** : table `audit_log`, ajout seul (triggers). L'onglet Journal vérifie la chaîne d'empreintes ; « rompue » = incident de sécurité.
- **Sauvegarde** : `pg_dump` quotidien de la base ; conserver les instantanés de registre (ils portent l'empreinte).
- **Rotation du secret JWT** : changer `JWT_SECRET` et redémarrer ; toutes les sessions sont invalidées.

## Inscription et estimation sans compte

- `POST /auth/register` crée uniquement des comptes `client`. Limite : 5 créations par heure et par adresse IP (en mémoire : perdue au redémarrage, non partagée entre plusieurs instances ; derrière un reverse proxy, activer `trustProxy` sinon toutes les demandes partagent l'IP du proxy).
- `POST /public/estimate` : sans jeton, mode client, rien n'est enregistré, 30 demandes par minute et par IP.
- Pas de vérification d'e-mail ni de réinitialisation de mot de passe dans le POC : un administrateur doit réinitialiser un mot de passe en base. Suppression d'un compte sur demande : `delete from users where email = …` (les diagnostics et calculs sont supprimés en cascade).

## Incidents

| Symptôme | Cause probable | Action |
|---|---|---|
| Client voit « Non calculable » partout | Aucune règle confirmée publiée | Normal tant que Q1 n'est pas levée ; voir `docs/OPEN-QUESTIONS.md` |
| 503 `NO_REGISTRY` | Base non initialisée | `pnpm -F @fisc/api seed` |
| 500 `INTERNAL` | Erreur serveur | Journaux du processus ; ne jamais exposer la trace au client |
| Audit « rompu » | Altération directe en base | Isoler, restaurer depuis sauvegarde, enquêter |

## Sécurité du POC (limites connues)

HTTPS est à terminer devant l'API (reverse proxy). Limitation de débit de la connexion en mémoire seulement (5 échecs / 15 min, réponse 429). Jetons de 8 h non révocables. Mots de passe hachés avec scrypt. Aucune donnée personnelle de salarié nominative n'est saisie : seuls des montants et effectifs agrégés (minimisation).
