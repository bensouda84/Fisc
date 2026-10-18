# Sources fournies par MARABU

| Fichier | Fourni le | Contenu | Valeur probante |
|---|---|---|---|
| `mesimpo_Regles_Applicables_POC_2026-10-18.xlsx` | 18 octobre 2026 | Règles de l'annexe fiscale 2026 (R01 à R23), dispositifs non modifiés ou à vérifier (N01 à N10), écarts avec le registre V4, articles non lus, liste des sources | **Document de travail, ne fait pas foi.** Chaque ligne renvoie à sa source ; seul un texte officiel établit une règle (hiérarchie de preuves de l'onglet « Synthèse »). Le fichier d'origine s'intitulait « FISC_CI_Regles_Applicables… » ; renommé mesimpo, contenu interne inchangé (il porte encore l'ancien nom du produit). |

Empreinte SHA-256 du fichier versionné : `cc69d3ee4378af7ab978f64fb8047cfb51763e2f32b58186393296f15ed33501`.

Usage : lecture seule. Le registre des règles (`packages/registry/data/rules-v1.json`) en reprend le statut dans « source à obtenir » ; aucune valeur n'en est codée. Le classeur ne contient aucune donnée de client (R8).

Catalogue : `python3 -I scripts/build-catalogue.py` régénère `packages/registry/data/catalogue-2026.json` à partir de ce classeur (à relancer si le classeur change).
