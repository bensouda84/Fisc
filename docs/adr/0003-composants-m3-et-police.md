# ADR-0003 — Composants Material Design 3, thème et police

- Statut : **Décidée par défaut au sprint 2** : MUI 9.5.0, Mulish, couleur neutre. L'essai Material Web n'a pas été mené (Q13) ; réponses MARABU toujours attendues (Q3, Q14)
- Rôle qui tranche : Designer UX/UI, avec l'Architecte
- Date : 18 octobre 2026

## Version de Material Design
Vérifié sur m3.material.io/blog le 18 octobre 2026 : dernières publications « What's new at Google I/O 2026 » (19 mai 2026) et « Start building with Material 3 Expressive » (13 mai 2025). Je n'ai trouvé aucun numéro de version publié pour le web ; la référence retenue est **« Material 3 (avec Expressive), état au 18 octobre 2026 »**. À re-vérifier à l'ouverture du sprint 2.

## Choix des composants : MUI 9.5.0 ou Material Web 2.5.0
Critères de l'essai, sur le seul « chip de statut » (Calculée / Non calculable / Nulle / Partielle) et le thème M3 :
1. Icône + texte dans le chip, sens non porté par la couleur seule.
2. Contraste ≥ 4,5:1 sur tous les rôles de couleur, clair et sombre.
3. Cible tactile 48 dp, focus visible.
4. Intégration React 19 sans contournement ; poids du bundle.
5. Navigation adaptative (barre / rail / panneau).

**Défaut si l'essai est non concluant : MUI**, car intégration React native et accessibilité éprouvée. MUI n'est toutefois pas un M3 strict : les écarts sont consignés ici. Material Web est M3 fidèle mais sans garantie de pérennité annoncée et à intégrer via composants web dans React.

## Couleurs
Tokens de rôle générés par `@material/material-color-utilities` à partir d'une **couleur source fournie par MARABU (À VALIDER, Q3)**. Défaut : couleur neutre (gris-bleu). Contraste vérifié automatiquement.

## Police
Avenir : usage web via projet Adobe Fonts (compte MARABU), ou licence Monotype auto-hébergée (payante, par pages vues et par domaine). **Défaut : Mulish** (SIL OFL 1.1), auto-hébergée, licence jointe. Nunito Sans en second. La décision de licence appartient à MARABU avant le sprint 1 ; sans réponse, le POC part sur Mulish. Le choix est isolé dans un token (`--font-family-base`) pour changer sans toucher aux composants.
