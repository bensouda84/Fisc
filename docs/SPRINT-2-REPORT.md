# Rapport de sprint 2 — checkpoint 3 (mesimpo)

Date : 18 octobre 2026. Environnement : Chromium headless local, PostgreSQL 16 local, données fictives.

## Ce qui est livré

| Livrable du prompt | Où | État |
|---|---|---|
| Diagnostic guidé (4 écrans, 6 questions, « Je ne sais pas », « Pourquoi ? », sauvegarde auto) | `apps/web/src/pages/Diagnostic.tsx` | fait |
| Résultat en trois couches (synthèse, détail par levier, source en un clic) | `ResultView.tsx`, `Sheets.tsx` | fait |
| Simulation (champs + curseurs, recalcul immédiat, n'écrit rien) | `Simulation.tsx` | fait |
| Export PDF « dossier de preuve », même moteur que l'écran | `apps/api/src/pdf.ts` | fait |
| Registre (statuts, deux validations, versions, diff, audit en lecture seule) | `Registry.tsx`, `apps/api` | fait |
| API Fastify + OpenAPI généré, PostgreSQL + migrations, rôles, audit | `apps/api` | fait |
| Docker Compose, runbook, CI | `docker-compose.yml`, `docs/runbook`, `.github/workflows` | fait, **Docker et CI non exécutés ici** |

Exemples de PDF (données fictives) : `docs/examples/`. Captures : `docs/screenshots/`.

## Résultats mesurés

| Contrôle | Résultat |
|---|---|
| Cas dorés T1–T7 (moteur) | 7/7 verts, plus T1/T6/T7 rejoués par l'API et T3/T4/T7 par l'interface |
| Tests unitaires et propriétés | schémas 13, moteur 34, registre 14 |
| Tests API (PostgreSQL réel) | 21 verts (dont schémas de sortie, limites de débit, inscription, estimation sans compte et leviers startup/TVA) |
| Couverture moteur | 95,96 % lignes, 90,82 % branches (seuil 90 %) |
| Couverture registre | 100 % |
| Couverture API | 93,7 % lignes, 71,5 % branches (pas de seuil fixé) |
| Tests de bout en bout Playwright | 33/33 verts (dont thème sombre, marque, estimation sans compte, inscription, startup et TVA) |
| axe-core (WCAG 2.2 AA, toutes gravités) | 0 violation sur diagnostic, « pourquoi », source, résultat, simulation, export, client, registre (3 onglets, dialogue) |
| Lighthouse mobile (simulé), après ajout de la marque | connexion 99/100/100 ; diagnostic 100/100/100 ; résultat 99/100/100 ; simulation 99/100/100 (performance / accessibilité / bonnes pratiques) |
| Parité écran / PDF | les 6 montants de l'écran se retrouvent à l'identique dans le texte extrait du PDF (test e2e) |
| Mode client | aucun « TEST » dans la page, dans l'API ni dans le PDF ; aucun montant à la place d'une lacune |
| Aucun défilement horizontal | 320, 360, 768 et 1440 px, sur les 4 écrans ; texte à 200 % ; axe à 320 px |
| Mouvement réduit | transitions neutralisées (test) |
| Repères lecteur d'écran | un seul `main`, `nav`, `banner`, lien d'évitement, `lang=fr`, focus sur le titre de chaque étape (test de structure, pas un test avec lecteur d'écran) |

## Ce qui n'est PAS mesuré

- **« Moins de 5 minutes » et « 4 testeurs sur 5 distinguent brut, décaissements et net »** : ce sont des mesures sur de vraies personnes. Le test automatisé saisit le parcours en ~4 s ; cela prouve qu'il n'y a pas d'étape bloquante, pas le temps d'un humain. **Aucun testeur n'a été sollicité.**
- **Résultat client réel sourcé** : impossible tant qu'aucune règle réelle n'est confirmée (Q1). Les démonstrations sourcées utilisent des règles fictives « FICTIF-… » confirmées dans la base de test.
- Lighthouse est mesuré en local avec la limitation réseau simulée de Lighthouse ; un test sur l'hébergement réel reste à faire.
- axe ne couvre qu'une partie de WCAG 2.2 AA. Vérifié en plus par test : focus visible, cibles de 48 px, absence de défilement horizontal. **Non vérifié** : lecteur d'écran réel (NVDA, VoiceOver), appareils réels.
- Docker Compose et le workflow GitHub Actions n'ont pas été exécutés dans cet environnement.

## Modules startup et TVA (après le checkpoint 3)

Deux leviers ajoutés à la demande de MARABU, d'après le classeur `docs/sources` : **exonération des startups labellisées** (R08) et **TVA sur le carburant des exploitants agricoles** (R11). Détail et choix de modélisation : `docs/ENGINE-SPEC.md`.
- **Aucun des deux n'est confirmé** : les règles sont des entrées EN ATTENTE dans le registre (texte, article et page du classeur dans « source à obtenir », décisions à prendre listées). En mode client, ils sont NON CALCULABLES ; les règles de TEST valident l'arithmétique en mode interne.
- Le moteur ne tranche aucune interprétation : le rattachement de l'exonération à l'IS, la durée, l'année de labellisation comprise ou non et le plafond de TVA sont des **paramètres de la règle**, posés puis validés par deux personnes (Q23, Q24).
- Interface : deux écrans de plus (6 au total) avec questions conditionnelles (Oui / Non / Je ne sais pas), 11 questions au plus. Résultat, PDF et registre (formulaire de saisie des paramètres) mis à jour.
- Effet notable : une startup exonérée n'a plus d'impôt à réduire ; dons et crédits restent à zéro (zéro réel, expliqué) et les crédits non imputés apparaissent en excédent.
- Tests ajoutés : 20 pour le moteur (portes, période, exclusivité, aucun double compte, propriété « brut total = impôt avant opérations »), parcours API de confirmation, 5 de bout en bout.
- **Ce que « la TVA » couvre** : uniquement R11. Les autres lignes TVA du classeur ne sont pas des réductions de TVA du redevable ou manquent de texte (Q24). Pas de TVA générale (collectée, déductible, crédit de TVA).

## Estimation sans compte et inscription

Écrans publics `#/estimation` et `#/inscription`, accessibles depuis la connexion.
- **Estimation express** : une seule donnée obligatoire (chiffre d'affaires annuel), une marge bénéficiaire estimée facultative (hypothèse de l'utilisateur, jamais une règle). `POST /public/estimate` fait tourner le **moteur en mode client** : mêmes règles, mêmes garde-fous (schéma de sortie client appliqué), rien n'est enregistré (ni calcul, ni compte), limite de 30 demandes par minute et par IP.
- **Ce que l'invité voit aujourd'hui** : aucun montant. Le chiffre d'affaires seul ne permet pas de chiffrer un impôt (l'impôt se calcule sur le bénéfice imposable) et le taux de l'IS n'est pas confirmé : l'impôt et les trois leviers sont « Non calculable », avec ce qu'il manque pour chacun. Dès que le taux de l'IS sera confirmé et publié, l'invité qui indique une marge verra l'**impôt avant optimisation**, sourcé (article, page, statut, date d'effet, version) ; les leviers resteront non calculables sans les détails, ce qui motive l'inscription. Vérifié sur la règle fictive des tests (CA 100 M F, marge 10 % → bénéfice estimé 10 M F → impôt 2,5 M F).
- **Inscription** : e-mail, mot de passe de 12 caractères au moins, case de consentement, rôle `client` imposé côté serveur (tout rôle demandé est ignoré), connexion immédiate, bénéfice estimé reporté dans le diagnostic du nouveau compte. L'adresse n'est pas écrite dans le journal d'audit.
- **Limites** : pas de vérification de l'adresse e-mail, pas de réinitialisation de mot de passe, limiteurs en mémoire, notice de données personnelles non relue par un juriste (Q21, Q22). Le moteur a gagné un champ `taxSources` pour sourcer l'impôt avant optimisation (R2).
- **Pourquoi pas de chiffre d'économie** : afficher un gain à partir du seul chiffre d'affaires exigerait des règles confirmées (R1) et un taux de marge inventé (R7), et ressemblerait à une promesse de résultat (R9).

## Thème sombre

Suit la préférence du système au premier chargement, puis un bouton (soleil / lune) dans la barre du haut et sur l'écran de connexion mémorise le choix dans `localStorage` (try/catch : sans stockage, le choix vaut pour la session). Mêmes jetons M3, schéma sombre généré depuis la même couleur source. Les chips de statut gardent icône + texte. Un script en tête de page évite le flash de fond clair.
Vérifié : axe 0 violation (toutes gravités) sur connexion, diagnostic, « pourquoi », résultat, source, simulation, aperçu client, registre (3 onglets, dialogue) ; persistance après rechargement ; absence de défilement horizontal. Captures : `docs/screenshots/sombre-*.png`.
Défaut trouvé et corrigé pendant l'ajout : le bouton supplémentaire dans la barre du haut provoquait un défilement horizontal avec le texte à 200 % ; la barre passe désormais à la ligne. Le titre de chaque étape recevait en plus un cadre de focus lors du changement d'écran ; le cadre est réservé aux éléments focalisables au clavier.

## Décisions prises pendant le sprint

- **ADR-0003 : MUI 9.5.0 confirmé après essai de Material Web 2.5.0** (`spikes/material-web`, résultats dans l'ADR). MUI n'est pas du M3 strict : tokens de rôle générés par `@material/material-color-utilities`, formes, échelle typographique et chips de statut reprennent M3. Écart connu : composants MUI standards (ex. `BottomNavigation`) plutôt que composants M3 natifs.
- **Police : Mulish (OFL 1.1)**, auto-hébergée via `@fontsource/mulish`. Avenir non utilisé (Q3).
- **Charte mesimpo appliquée** (voir `docs/BRAND.md`) : couleur source M3 = vert du logo `#109150`, accent orange `#fda92b` (chip « Partielle »), logos clair et sombre, favicon, signature « Payez juste. Pas plus. » sur la connexion. Les couleurs sont échantillonnées sur les images fournies, les logos sont des recadrages de bitmaps (pas de vectoriel). Le nom du produit est **mesimpo** ; `fisc` reste le nom de code technique.
- **Le moteur tourne côté serveur** pour l'écran comme pour le PDF : le mode client est imposé par le rôle, le navigateur d'un client ne reçoit jamais les règles de TEST ni les règles non confirmées. Conséquence : la simulation appelle l'API (≈ 120 ms de délai anti-rebond).
- **Les trois décaissements doivent être saisis** (0 compris) pour obtenir un net complet. L'interface les demande explicitement.
- **Paramètres commerciaux non validés par défaut** : un client ne voit aucune commission tant qu'un administrateur n'a pas coché « validés par MARABU » (Q7, Q9, Q11).
- Le PDF est recalculé par le moteur à partir de l'entrée, de la version de registre et des paramètres commerciaux enregistrés avec le calcul : il ne dépend pas de l'état courant du registre.

## Écarts relevés par la critique finale (sept rôles)

**Stratège** : la promesse « premier résultat sourcé en moins de 5 minutes » n'est pas démontrable avant Q1. Le POC démontre surtout la rigueur (rien sans source), pas encore la valeur chiffrée.

**Product owner** : parcours et critères d'acceptation couverts ; mesures sur testeurs à planifier. Le diagnostic ne propose pas d'exemple pré-rempli pour un test rapide (volontaire : pas de donnée réelle).

**Designer UX/UI** : l'interface est cohérente et lisible sur 360/768/1440 px, en clair et en sombre. Écarts : MUI et non M3 strict ; la liste « Détail par levier » est longue sur mobile (pas de repli) ; les cartes de synthèse occupent beaucoup de place sur mobile ; la carte registre répète le nom du concept sous le titre.

**Architecte** : limitation de débit de la connexion en mémoire (5 échecs / 15 min par adresse et IP, perdue au redémarrage, non partagée entre instances) ; jetons de 8 h non révocables ; HTTPS à terminer devant l'API ; pas de seuil de couverture sur l'API (branches 71 %) ; le schéma Zod du résultat existe (`EngineResultSchema`, `ClientResultSchema`) et valide chaque sortie de l'API, mais le type TypeScript du résultat n'en est pas encore dérivé ; `reviveResult` utilise des `any` à la frontière JSON ; le contrat OpenAPI ne décrit pas les réponses.

**Fiscaliste** : aucune règle réelle ; les conventions d'imputation (Q4), de commission globale (Q5) et d'arrondi (Q2) restent à valider ; l'effet fiscal des salaires n'est pas modélisé (annoncé à l'écran et dans le PDF).

**Juriste / déontologue** : la rémunération au résultat (Q7) et l'ARTCI (Q8) sont ouvertes ; la liste « ce qui manque pour calculer » est visible d'un client (concept + statut, sans valeur) : à valider vis-à-vis de R1 ; les mentions de non-avis sont présentes à l'écran et dans le PDF mais leur rédaction n'a pas été relue par un juriste.

**QA / accessibilité** : bonne couverture automatisée ; pas de test lecteur d'écran, zoom, ni appareil réel ; pas de test de charge ; tests e2e dépendants d'une base remise à zéro.

## Pour exécuter

```bash
pnpm check                                   # lint, types, tests (les tests API se sautent sans TEST_DATABASE_URL)
TEST_DATABASE_URL=… pnpm coverage            # couverture + tests API
E2E_DATABASE_URL=… pnpm -F @fisc/web build && pnpm -F @fisc/web e2e
E2E_DATABASE_URL=… pnpm -F @fisc/web lighthouse   # API (3101) et vite preview (4174) démarrés
```
