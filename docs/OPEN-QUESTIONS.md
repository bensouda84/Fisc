# Questions ouvertes

Format : élément · impact · option par défaut retenue. **Bloquant** = nécessaire avant de coder la partie concernée.

| # | Élément | Impact | Défaut retenu | |
|---|---|---|---|---|
| Q1 | Aucune règle réelle n'est CONFIRMÉE (sources manquantes) | Pas de sortie client réelle ; les indicateurs « source cliquable » et « résultat sourcé < 5 min » ne se démontrent qu'avec des règles de TEST en interne | POC en mode interne ; T3, T4, T7 prouvent le blocage. MARABU peut fournir une source pour confirmer une première règle réelle | **Bloquant** |
| Q2 | Règle d'arrondi | Écart d'un franc sur impôts, commission, TVA | Au franc le plus proche, demi vers le haut, un seul point d'arrondi (ADR-0004) | À valider |
| Q3 | Couleur source M3, licence Avenir, seuil Lighthouse | Identité visuelle, coût | Couleur neutre ; Mulish (OFL 1.1) ; seuil 90 | **Bloquant** pour la police (avant sprint 1) |
| Q4 | Répartition par levier du plafond des crédits | Montants par levier affichés | Ordre d'affichage, somme des leviers = total (ENGINE-SPEC) | **Bloquant** |
| Q5 | Commission globale ou par levier | Honoraire (T1 : 0 en global) | Globale, comme écrit au § 5.3 | À valider |
| Q6 | Total partiel en mode client (levier NON CALCULABLE) | Ce que voit le client | Aucun total ; sous-total étiqueté « partiel » ; commission non calculée | **Bloquant** |
| Q7 | Rémunération au résultat sur un conseil fiscal : admissible pour la profession et le cadre de MARABU ? | Modèle économique | Taux 20 %, plancher 0, plafond absent. **Je ne tranche pas** : décision du juriste | À valider |
| Q8 | Déclaration ou autorisation ARTCI (loi n° 2013-450) ; durée de conservation | Mise en service | Minimisation, pas de données réelles ; vérification sur le texte officiel | À valider |
| Q9 | Plafond de commission | Honoraire | Absent | À valider |
| Q10 | Excédent de crédit non imputé | Montant affiché | « Excédent non remboursable sans texte », non compté dans l'économie | À valider (dépend de l'article concerné) |
| Q11 | TVA 18 % | Honoraires TTC | Paramètre sous forme de fraction 9/50, comme le 20 % | À valider |
| Q12 | Identité des validateurs réels (juriste, expert-comptable) | Validation à deux niveaux | Comptes nominatifs distincts ; aucun auto-validé | À fournir |
| Q13 | ~~Essai Material Web~~ **mené le 18 octobre 2026** : MUI confirmé (ADR-0003) | Fidélité M3 | MUI + jetons M3 ; à rouvrir si MARABU exige du M3 strict ou si Material Web retrouve des mainteneurs | Clos, sauf exigence M3 strict |
| Q14 | Couleur source M3 | Identité visuelle | **Vert `#109150` et orange `#fda92b` échantillonnés sur le logo fourni** (docs/BRAND.md) ; à confirmer avec le fichier de charte officiel | À confirmer |
| Q19 | Formulations de la planche d'ambiance : « Économies identifiées » (R3), « Payez juste. Pas plus. » (R9), « assistant intelligent » | Conformité des textes | Seule la signature « Payez juste. Pas plus. » est affichée (connexion) ; les autres textes ne sont pas repris | À valider (juriste) |
| Q20 | Antériorité du nom « mesimpo » (OAPI, domaine) et fichiers vectoriels du logo | Risque juridique, qualité d'impression | Rien vérifié ; logos recadrés depuis des bitmaps | À faire |
| Q15 | Mesures sur 5 testeurs (temps, compréhension brut/décaissements/net) | Indicateurs § 10 non mesurés | À planifier avec MARABU, sur un parcours sans règle fictive si Q1 est levée | À planifier |
| Q16 | Hébergement, HTTPS, limitation de débit, révocation des jetons | Mise en service | Hors POC ; liste dans le runbook | À décider |
| Q17 | Liste « ce qui manque pour calculer » visible d'un client | Cohérence avec R1 | Concept + statut, sans valeur ni montant | À valider (juriste) |
| Q18 | ~~Thème sombre~~ **fait** | Confort, accessibilité | Suit le système puis bouton ; pas de mode « système » explicite après un choix manuel | Clos |

## Classeur « règles applicables » (fourni le 18 octobre 2026)

Le classeur de MARABU recense 23 règles de l'annexe fiscale 2026 et 10 dispositifs non modifiés. **Aucun des quatre dispositifs du POC n'y est CONFIRMÉ** au sens de sa propre règle (texte officiel + article exact) :

| Levier du POC | Statut dans le classeur | Conséquence dans le registre |
|---|---|---|
| Taux de l'IS (N01) | PARTIELLEMENT CONFIRMÉ (25 % / 30 % télécoms et TIC, annexe 2019 art. 8 ; CGI consolidé non lu) | reste EN ATTENTE, aucune valeur codée |
| Dons (N05) | NON TROUVÉ : ne pas coder | reste EN ATTENTE |
| Crédit CDI (N02) | PARTIELLEMENT CONFIRMÉ (montant issu d'un rapport, pas d'un texte) | reste EN ATTENTE |
| Crédit apprentis (N03) | PARTIELLEMENT CONFIRMÉ (annexe 2020 ; validité 2026 non vérifiée) | reste EN ATTENTE |

Le contenu du classeur (statut, ce qui est lu, ce qui reste à lire) est repris dans le champ « source à obtenir » de chaque entrée du registre, visible du personnel seulement. Le classeur est versionné dans `docs/sources/` (lecture seule, ne fait pas foi). **Q1 reste donc ouverte** : il faut lire le CGI consolidé 2026 (art. 51, 110, 111, 111 bis, 111 ter, 18 G) pour confirmer une première règle.

Autres constats du classeur utiles au POC :
- le montant « 1 M F par CDI » **n'est pas** un texte (rapport 2019) : les règles de TEST ne doivent pas être confondues avec des valeurs réelles ;
- le taux de TVA 9 % (ordonnance 2026-03, non lue) contredit les 18 % du texte de l'annexe : **à trancher avant d'utiliser la TVA 18 % des honoraires comme paramètre fiscal** (Q11) ; hypothèse à faire confirmer par le fiscaliste : les honoraires relèvent de la TVA de droit commun et non des opérations de l'art. 6 ;
- R02 (mobile money, plafond de 250 000 F non appliqué) et R16 (charges déductibles : « produit non exonéré », sens à trancher) touchent la déductibilité des charges, hors des leviers du POC : à ne pas modéliser sans décision.

## Sources à obtenir (état au 18 octobre 2026, d'après le classeur)

| Source | État |
|---|---|
| CGI consolidé 2026 | **à obtenir** (art. 51, 110, 111, 111 bis, 111 ter, 18 G) |
| Loi de finances 2026 et son numéro | numéro indiqué par le classeur : **loi n° 2025-987 du 19 décembre 2025** (annexe fiscale 2026, version DGI) ; texte lu pour les art. 1 à 11, 18, 19, 35 à 39 |
| LPF consolidé | à obtenir |
| Registres V1, V3 et V4 | V4 fourni et lu (« ne fait pas foi », plusieurs statuts à corriger) ; V1 et V3 à obtenir |
| Note de service DGI n° 0096 du 9 janvier 2025 | à obtenir |
| Note DGI sur les dons | à obtenir (le texte de CGI 18 G est NON TROUVÉ) |
| BODGI 2026 HS21 | à obtenir (BODGI 2026 p. 23 lu) |
| Auteur et date du commentaire des annexes 2026 | à obtenir |
| Articles 22 et 31 de l'annexe | art. 22 : titre seulement (clé de répartition de la taxe télécoms et transfert d'argent) ; art. 31 : titre seulement (droits constatés, LPF) ; textes à lire |
| Arrêté d'application de l'article 2 | à obtenir (art. 2 = crédit premier logement, hors entreprises) |
| Ordonnance n° 2026-03 du 7 janvier 2026 (TVA 9 %) | non lue |
| Note de service n° 00380/MFB/DGI/DLCD-SDL/bke/01-2026 | non lue |

Aucune de ces sources n'a été lue par moi : les états ci-dessus reprennent le classeur de MARABU.
