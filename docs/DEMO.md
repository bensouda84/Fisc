# Démonstration partageable

Une version de l'interface qui **tourne entièrement dans le navigateur**, publiée comme page unique. Elle sert à montrer le produit à des collègues, des validateurs ou de futurs testeurs sans installer ni héberger de serveur.

**Lien** : https://claude.ai/artifact/PriBBYL15UZwV9LzKG8bmk (privé par défaut : le propriétaire l'ouvre à d'autres personnes depuis le menu « Partager » de la page).

## Ce qu'elle contient

- Le **vrai moteur** (même code que l'API), le registre V1 réel (toutes les règles EN ATTENTE, aucune valeur) et les règles de TEST.
- Deux profils : **consultant** (mode interne : les règles de TEST permettent un calcul complet, avec hypothèses affichées ; aperçu client en un clic) et **dirigeant** (mode client : rien n'est chiffré, comportement réel du produit aujourd'hui).
- Diagnostic en 6 écrans, résultat, simulation, estimation express sans compte, thème clair et sombre, bandeau permanent « Démonstration ».

## Ce qu'elle ne contient pas

- **Aucun serveur, aucune base, aucun compte réel** : rien n'est envoyé ni enregistré ; le brouillon vit en mémoire et disparaît au rechargement.
- Pas d'export PDF, pas de registre ni de journal d'audit, pas de création de compte (message explicite).
- Les montants calculés en mode interne viennent de **règles fictives** : ils valident l'arithmétique, ils ne disent rien du droit fiscal. Ne pas présenter cette démonstration comme un résultat client.

## Reconstruire et republier

```bash
pnpm -F @fisc/web build:demo      # produit apps/web/dist-demo/artifact.html (une seule page, ~1,2 Mo)
pnpm -F @fisc/web exec playwright test -c playwright.demo.config.ts   # 6 tests, dont un cadre iframe isolé
```
Puis publier `apps/web/dist-demo/artifact.html` avec l'outil Artifact (même chemin = même lien).

## Choix techniques

- `vite build --mode demo` remplace par alias `src/api.ts` (→ `src/demo/api.ts`, moteur dans le navigateur), `src/brand.ts` (logos incorporés) et `src/fonts.ts` (police latin seule). Le code normal n'est pas modifié.
- Routage **en mémoire** (pas de `#/…`) : une page dans un cadre isolé résout les fragments par rapport à l'adresse de la page parente.
- Le thème suit l'attribut `data-theme` posé par l'hôte ; la page ne le modifie pas.
- Aucun appel réseau, aucune police ni image externe ; stockage navigateur absent ou refusé toléré.

## Vers un vrai lien public

Cette page n'est pas l'application. Pour partager l'application complète (comptes, PDF, registre), il faut l'héberger : un service pour l'API, une base PostgreSQL, HTTPS, et traiter les points du runbook (limites de débit partagées, vérification d'e-mail, notice de données personnelles). Rien de cela n'est en place.
