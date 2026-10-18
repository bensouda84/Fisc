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

## Sources à obtenir (entrées EN ATTENTE du registre)

1. CGI consolidé 2026
2. Texte adopté de la loi de finances 2026 et son numéro
3. LPF consolidé
4. Registres V1, V3 et V4
5. Note de service DGI n° 0096 du 9 janvier 2025
6. Note DGI sur les dons
7. BODGI 2026 HS21
8. Auteur et date du commentaire des annexes 2026
9. Articles 22 et 31 de l'annexe
10. Arrêté d'application de l'article 2

Aucune de ces sources n'a été lue ni supposée dans ce dépôt.
