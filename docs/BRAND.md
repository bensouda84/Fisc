# Charte mesimpo — application dans le POC

Fournie par MARABU le 18 octobre 2026 (logo et planche d'ambiance). Le produit s'appelle **mesimpo** (ancien nom : FISC.CI).

## Palette (échantillonnée sur le logo fourni)

| Rôle dans la charte | Valeur échantillonnée | Usage dans le POC |
|---|---|---|
| Vert | `#109150` (point du « i »), `#1c9f5b` (cercle), dégradé jusqu'à `#014f48` | **Couleur source M3** : tous les rôles primaires, conteneurs et surfaces teintées en sont générés (`apps/web/src/theme.ts`) |
| Orange | `#fda92b` (flèche) | **Couleur d'accent** : groupe de rôles M3 personnalisé, utilisé pour le chip « Partielle » |
| Bleu nuit | `#031b30` (« mes ») | Texte du logo ; fond du logo inversé. Non utilisé comme rôle M3 |

Les valeurs viennent d'un échantillonnage de pixels sur une image, pas d'un fichier de charte officiel : à confirmer par MARABU (Q14). Les rôles M3 clair et sombre sont recalculés à partir de ces deux couleurs ; leur contraste est vérifié par axe (0 violation) dans les deux thèmes.

## Logo

| Fichier | Origine | Usage |
|---|---|---|
| `apps/web/public/logo-light.png` | logo sur fond blanc, fond rendu transparent | thème clair, écran de connexion, PDF (`apps/api/assets/logo.png`) |
| `apps/web/public/logo-dark.png` | version inversée de la planche d'ambiance, fond rendu transparent | thème sombre |
| `apps/web/public/icon-192.png`, `favicon.png` | cercle et flèche | favicon, icône d'écran d'accueil |

**Limites** : ces fichiers sont des **recadrages de bitmaps**, pas des fichiers vectoriels. La version inversée vient d'une vignette de faible résolution (~750 px de large) : quelques pixels parasites autour des lettres, acceptables à 32 px de haut, pas pour l'impression. **À remplacer par les fichiers sources (SVG ou PDF) de MARABU.**

## Typographie

La charte fournie ne nomme pas de police. Le logo est une sans-serif géométrique grasse proche de Mulish (police retenue, licence OFL 1.1). La décision Avenir / Mulish (Q3) reste ouverte.

## Signature et textes

« Payez juste. Pas plus. » est affiché sous le logo sur l'écran de connexion. Les autres textes de la planche (« Votre assistant intelligent pour vos impôts », « Aujourd'hui vous optimisez, demain vous grandissez », « Moins de stress. Plus d'opportunités. ») ne sont **pas** repris dans l'application.

## Points de conformité à faire valider (Q19, Q20)

La planche d'ambiance contient des formulations qui entrent en tension avec les règles du prompt :

1. **« Économies identifiées 32 500 000 FCFA »** : le mot « économie » seul est interdit (R3 : économie fiscale brute, décaissements, économie nette). Le montant devrait aussi s'écrire « 32 500 000 F CFA » (format § 8), avec sa source (R2) et sa date.
2. **« Payez juste. Pas plus. »** et **« Aujourd'hui vous optimisez, demain vous grandissez »** peuvent se lire comme une promesse de réduction d'impôt, alors que R9 interdit toute garantie de résultat. Le juriste doit les valider avant toute diffusion.
3. **« Assistant intelligent »** : le POC n'utilise aucune IA générative dans le calcul (hors périmètre). Le terme peut laisser croire le contraire.
4. **Nom « mesimpo »** : aucune recherche d'antériorité (marque OAPI, nom de domaine, dénominations existantes) n'a été faite.
5. Les captures de la planche (téléphone, panneau publicitaire) montrent un **prénom (« Koffi »)** et un portrait : s'assurer des droits d'image si elles sont publiées.
