# ADR-0004 — Arithmétique exacte et arrondi

- Statut : **Proposée** ; règle d'arrondi **À VALIDER** par le fiscaliste (Q2)
- Rôle qui tranche : Architecte (technique), Fiscaliste (règle d'arrondi)

## Décision
- Montants : `bigint` en F CFA entiers. En JSON : chaîne décimale. Jamais de `number` pour un montant.
- Taux : fraction `{num, den}` en `bigint`. Les schémas Zod rejettent un taux flottant.
- Un seul point d'arrondi : conversion fraction × montant → entier, au franc le plus proche, demi vers le haut.
- Affichage : `Intl.NumberFormat('fr-FR')` avec espace insécable ; suffixe « F CFA » ; dates « 18 octobre 2026 ».
- Test de propriété : aucune fonction du moteur n'accepte ni ne renvoie un `number` non entier ; lint interdisant `parseFloat` et `Number(` dans `packages/engine`.

## Conséquences
Résultats reproductibles et vérifiables à la main. Le choix d'arrondi (demi-haut, bas, haut) peut changer d'un franc : il est isolé dans une fonction unique et testée.
