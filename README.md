# mesimpo — POC

Plateforme de simulation et d'optimisation fiscale légale (Côte d'Ivoire), à l'initiative de MARABU. *Payez juste. Pas plus.*

> **Nom du produit : mesimpo** (anciennement FISC.CI). Le nom de code technique `fisc` reste dans le dépôt, les paquets `@fisc/*`, les bases et les comptes de démonstration `@fisc.test`. Charte : [docs/BRAND.md](docs/BRAND.md).

**État : sprint 2 terminé (checkpoint 3).** Moteur, registre, API, interface, export PDF, tests de bout en bout et accessibilité. Voir les limites dans `docs/SPRINT-2-REPORT.md`.

```
pnpm install
pnpm check      # lint, types, tests (les tests API exigent TEST_DATABASE_URL)
pnpm coverage   # tests + seuil de couverture 90 % sur le moteur
# Démarrage complet : docs/runbook/RUNBOOK.md
```

- Plan : [docs/PLAN.md](docs/PLAN.md)
- Spécification du moteur et vérification des cas dorés : [docs/ENGINE-SPEC.md](docs/ENGINE-SPEC.md)
- Décisions d'architecture : [docs/adr/](docs/adr/)
- Rapport de sprint 2 (checkpoint 3) : [docs/SPRINT-2-REPORT.md](docs/SPRINT-2-REPORT.md)
- Runbook : [docs/runbook/RUNBOOK.md](docs/runbook/RUNBOOK.md)
- Captures : `docs/screenshots/` ; exemples de PDF fictifs : `docs/examples/`
- Rapport de sprint 1 : [docs/SPRINT-1-REPORT.md](docs/SPRINT-1-REPORT.md)
- Questions ouvertes : [docs/OPEN-QUESTIONS.md](docs/OPEN-QUESTIONS.md)

Les données de ce dépôt sont fictives. Les règles de TEST sont bloquées en mode client.
