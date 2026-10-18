# ADR-0003 — Composants Material Design 3, thème et police

- Statut : **Décidée** : MUI 9.5.0 après essai de Material Web (voir ci-dessous) ; Mulish et couleur neutre par défaut, réponses MARABU toujours attendues (Q3, Q14)
- Rôle qui tranche : Designer UX/UI, avec l'Architecte
- Date : 18 octobre 2026

## Version de Material Design
Vérifié sur m3.material.io/blog le 18 octobre 2026 : dernières publications « What's new at Google I/O 2026 » (19 mai 2026) et « Start building with Material 3 Expressive » (13 mai 2025). Je n'ai trouvé aucun numéro de version publié pour le web ; la référence retenue est **« Material 3 (avec Expressive), état au 18 octobre 2026 »**. À re-vérifier à l'ouverture du sprint 2.

## Choix des composants : MUI 9.5.0 ou Material Web 2.5.0 — essai mené le 18 octobre 2026

Essai jetable : `spikes/material-web` (même page, mêmes jetons M3 générés depuis `#51606f`, clair et sombre). Il compare le chip de statut, le champ, le bouton et la barre de navigation. Il n'est pas livré. Commande : `pnpm -F @fisc/spike-material-web build && pnpm -F @fisc/spike-material-web spike`. Captures : `docs/screenshots/spike-*.png`.

| Critère | Material Web 2.5.0 | MUI 9.5.0 |
|---|---|---|
| Chip de statut avec icône + texte | possible, mais **aucun composant « statut »** : seul `md-assist-chip` existe, un **contrôle interactif** (rôle bouton). Les 4 chips deviennent 4 arrêts de tabulation annoncés « bouton » pour une information en lecture seule. La variante désactivée est retirée du clavier mais perd son contraste. | `Chip` non interactif : 0 arrêt de tabulation, 0 rôle bouton |
| Fond coloré du chip | le chip « plat » n'a **aucun jeton de couleur de fond** ; il faut la variante `elevated` et annuler son ombre | `sx` direct |
| Contraste des rôles M3 (11 paires, clair et sombre) | ≥ 4,5:1 (minimum 5,51 en sombre) | identique (mêmes jetons) |
| axe-core WCAG 2.2 AA, clair et sombre | 0 violation après avoir fourni les jetons de surface ; **1 violation de contraste en sombre** tant que `surface-container` n'était pas défini | 0 violation |
| Cible tactile 48 dp | bouton 40 px par défaut ; 48 px avec `--md-filled-button-container-height` | 48 px avec `minHeight` |
| Focus clavier | anneau de focus intégré, bien visible | à poser nous-mêmes (déjà fait, règle globale) |
| Intégration React 19 | fonctionne sans adaptateur, mais **typage JSX à écrire à la main** ; événements personnalisés non essayés | natif |
| Rendu du champ outlined | **le libellé chevauche la bordure** sur la capture (non diagnostiqué) | correct |
| Typographie | à fournir via `--md-ref-typeface-plain` ; sinon police serif par défaut (observé) | via le thème |
| Composants dont ce POC a besoin | **hors `labs` (expérimental)** : bouton, champ, dialogue, onglets, curseur, case, interrupteur, liste, menu, progression. **Dans `labs`** : barre de navigation, tiroir, carte, bouton segmenté. **Absents** : rail de navigation, snackbar, feuille du bas, bandeau d'alerte | tous présents |
| Poids de cette page seule (JS gzip, React et color-utilities compris) | 119,7 Ko | 159,2 Ko |
| Maintenance | le README du paquet indique : « **MWC is in maintenance mode pending new maintainers** » | active |

**Décision : MUI 9.5.0 est confirmé.** Raisons, par ordre de poids : (1) le chip de statut, cas d'essai du prompt, exige des contournements dans Material Web (contrôle interactif, pas de fond, variante élevée) ; (2) la moitié des composants nécessaires sont expérimentaux ou absents, dont le rail, le snackbar et la feuille du bas que le prompt demande ; (3) le paquet est en maintenance seule. L'avantage de Material Web (fidélité M3, ~40 Ko gzip de moins sur cette page, anneau de focus) ne compense pas ces points. **À rouvrir** si Material Web trouve de nouveaux mainteneurs ou si MARABU exige du M3 strict.

Limites de l'essai : une seule page, navigateur Chromium, pas d'essai des événements personnalisés ni de lecteur d'écran. L'écart de poids concerne cette page ; il se réduirait avec plus de composants MUI partagés.

## Couleurs
Tokens de rôle générés par `@material/material-color-utilities` à partir d'une **couleur source fournie par MARABU (À VALIDER, Q3)**. Défaut : couleur neutre (gris-bleu). Contraste vérifié automatiquement.

## Police
Avenir : usage web via projet Adobe Fonts (compte MARABU), ou licence Monotype auto-hébergée (payante, par pages vues et par domaine). **Défaut : Mulish** (SIL OFL 1.1), auto-hébergée, licence jointe. Nunito Sans en second. La décision de licence appartient à MARABU avant le sprint 1 ; sans réponse, le POC part sur Mulish. Le choix est isolé dans un token (`--font-family-base`) pour changer sans toucher aux composants.
