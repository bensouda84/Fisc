#!/usr/bin/env python3
"""Extrait le classeur de règles (docs/sources) vers packages/registry/data/catalogue-2026.json.

Le catalogue est INFORMATIF : le moteur ne le lit jamais (R7). Seule la colonne « modélisé »
est écrite à la main ci-dessous ; tout le reste est copié du classeur, sans reformulation.
Usage : python3 -I scripts/build-catalogue.py
"""
import hashlib, json, pathlib, openpyxl

ROOT = pathlib.Path(__file__).resolve().parent.parent
XLSX = ROOT / 'docs/sources/mesimpo_Regles_Applicables_POC_2026-10-18.xlsx'
OUT = ROOT / 'packages/registry/data/catalogue-2026.json'

YES, NO = 'YES', 'NO'
Y = lambda concept, why: {'state': YES, 'concept': concept, 'reason': why}
N = lambda why: {'state': NO, 'concept': None, 'reason': why}
PENDING = " Le moteur sait le calculer ; l'entrée du registre reste EN ATTENTE tant que la valeur n'est pas confirmée par deux validateurs."
OPER = "Impôt ou taxe prélevé sur une opération (retenue, TVA, taxe sectorielle) : le moteur ne calcule que l'impôt sur les bénéfices et ses leviers, pas ce flux."
PROC = "Procédure ou conformité, sans effet sur un montant : rien à calculer."
OUT_ = "Hors périmètre des entreprises (personnes physiques ou autre acteur)."

MODEL = {
  'R01': N(OPER + " Retenue de 7,5 % sur les sommes versées à des intervenants audiovisuels."),
  'R02': N("Déductibilité des charges : touche la base imposable, mais le POC n'a pas de saisie par moyen de paiement. À modéliser avec une question « règlements en espèces au-dessus de 250 000 F »."),
  'R03': N(OPER + " Suppression d'exonérations de TVA ; le taux applicable (9 % ou 18 %) dépend de l'ordonnance 2026-03 non lue (R04)."),
  'R04': N("Taux de TVA : opération par opération, et ordonnance 2026-03 non lue. Aucune valeur n'est codée."),
  'R05': N(OPER + " Assujettissement de l'affacturage à la TVA."),
  'R06': N(OPER + " Taxe spéciale sur emballages."),
  'R07': N(OPER + " Taxe touristique de 2,5 %."),
  'R08': Y('STARTUP_EXEMPTION', "Levier « Exonération startup » : durée, année du label et impôts visés sont des paramètres du registre." + PENDING),
  'R09': N("Calendrier de paiement d'une taxe de l'entreprenant : échéancier, pas un montant d'économie."),
  'R10': N(OPER + " Retenue sur primes de réassurance versées à des non-résidents."),
  'R11': Y('VAT_FUEL_RECOVERY', "Levier « TVA carburant agricole » : deux conditions cumulatives en questions ; plafond en paramètre (95 % à vérifier)." + PENDING),
  'R12': N("Impôt sur le patrimoine foncier : impôt distinct de l'impôt sur les bénéfices, hors des leviers du POC."),
  'R13': N("Droits de douane de promoteurs immobiliers : opération par opération, secteur étroit."),
  'R14': N("Seuil d'option TVA (50 M F TTC) : un seuil de statut, pas un levier ; sens de la comparaison à confirmer."),
  'R15': N("Taux de la banane dessert à confirmer ; TVA par produit, hors périmètre du moteur."),
  'R16': N("Bloquant : le sens de « produit non exonéré » (art. 39) doit être tranché par un fiscaliste avant tout calcul."),
  'R17': N(PROC),
  'R18': N(PROC + " Déclaration de patente."),
  'R19': N(PROC + " Pièces en langue étrangère."),
  'R20': N(OUT_ + " Crédit d'impôt pour le premier logement."),
  'R21': N("IRVM sur plus-values de cession de titres : impôt de l'actionnaire, pas de l'entreprise."),
  'R22': N(OUT_ + " SGI et OPCVM."),
  'R23': N("Corrections techniques sans effet de calcul."),
  'N01': Y('IS_RATE', "Taux de l'impôt sur les sociétés (25 % ; 30 % télécoms et TIC) : paramètre du registre, valeur non codée." + PENDING),
  'N02': Y('CREDIT_CDI', "Crédit d'impôt CDI : montant par CDI en paramètre. 1 M F vient d'un rapport, pas d'un texte." + PENDING),
  'N03': Y('CREDIT_APPRENTICE', "Crédit d'impôt apprentis : montant en paramètre (500 000 F selon l'annexe 2020, validité 2026 non vérifiée)." + PENDING),
  'N04': N("Levier non construit : le seuil PME (CA inférieur à 1 Md F ou 50 M F) qui distingue 25 000 F de 50 000 F est à trancher. Réalisable sur demande."),
  'N05': Y('DONATION_DEDUCTIBILITY', "Levier « Dons » prêt à recevoir un plafond ; aucun texte trouvé, donc rien n'est codé." + PENDING),
  'N06': N("Réinvestissement des bénéfices (art. 110, 110 bis) : textes non lus, ne pas modéliser sans eux."),
  'N07': N("IMF : aucun texte trouvé."),
  'N08': N("Taux de la taxe de l'entreprenant et de l'impôt des microentreprises : à vérifier (annexe 2021, art. 33)."),
  'N09': N("TVA obligatoire au réel pour le transport public : exposé seulement, texte non lu."),
  'N10': N(OUT_ + " Exonérations de logement."),
}

def rows(ws):
    return [r for r in ws.iter_rows(values_only=True)][1:]

def s(v):
    return None if v is None else str(v).strip()

wb = openpyxl.load_workbook(XLSX)
lines = []
for r in rows(wb['Règles 2026']):
    if not r[0]:
        continue
    lines.append({'id': s(r[0]), 'family': 'R', 'theme': s(r[1]), 'rule': s(r[2]), 'effect': s(r[3]), 'legalBasis': s(r[4]),
                  'source': s(r[5]), 'modifiedBy2026': True, 'status': s(r[6]), 'priority': s(r[7]), 'toVerify': s(r[8]), 'modelled': MODEL[s(r[0])]})
for r in rows(wb['Non modifiées ou à vérifier']):
    if not r[0]:
        continue
    lines.append({'id': s(r[0]), 'family': 'N', 'theme': s(r[1]), 'rule': s(r[2]), 'effect': None, 'legalBasis': s(r[3]),
                  'source': s(r[4]), 'modifiedBy2026': False, 'modifiedNote': s(r[5]), 'status': s(r[6]), 'priority': None, 'toVerify': s(r[7]), 'modelled': MODEL[s(r[0])]})
assert {l['id'] for l in lines} == set(MODEL), 'MODEL incomplet'

data = {
  'workbook': {'file': XLSX.name, 'sha256': hashlib.sha256(XLSX.read_bytes()).hexdigest(), 'asOf': '2026-10-18'},
  'summary': [{'label': s(r[0]), 'text': s(r[1])} for r in list(wb['Synthèse'].iter_rows(values_only=True))[2:] if r[0]],
  'lines': lines,
  'v4Gaps': [{'ref': s(r[0]), 'v4': s(r[1]), 'texts': s(r[2]), 'fix': s(r[3]), 'priority': s(r[4])} for r in rows(wb['Écarts V4']) if r[0]],
  'unreadArticles': [{'article': s(r[0]), 'title': s(r[1]), 'relevance': s(r[2]), 'reading': s(r[3])} for r in rows(wb['Articles non lus']) if r[0]],
  'sources': [{'level': s(r[0]), 'document': s(r[1]), 'link': s(r[2]), 'establishes': s(r[3]), 'limit': s(r[4]), 'reading': s(r[5])} for r in rows(wb['Sources']) if r[0]],
}
OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(len(lines), 'lignes;', len(data['v4Gaps']), 'écarts;', len(data['unreadArticles']), 'articles;', len(data['sources']), 'sources;', len(data['summary']), 'synthèses')
