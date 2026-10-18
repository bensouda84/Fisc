import { createRequire } from 'node:module';
import PDFDocument from 'pdfkit';
import {
  CONCEPT_TITLE_FR, INPUT_KEYS, INPUT_LABEL_FR, LEVER_STATE_LABEL_FR, describeAggregate, describeInput, formatDate, formatMoney,
} from '@fisc/engine';
import { RULE_STATUS_LABEL_FR, type EngineInput, type EngineResult } from '@fisc/schemas';

const require = createRequire(import.meta.url);
const font = (weight: 400 | 600 | 700): string =>
  require.resolve(`@fontsource/mulish/files/mulish-latin-${weight}-normal.woff`);

const INK = '#1b1c1e';
const MUTED = '#44474c';

/**
 * Dossier de preuve. Le PDF ne recalcule rien : il met en page l'EngineResult rendu par le moteur,
 * avec les mêmes fonctions de texte que l'écran (parité testée).
 */
export function renderProofPdf(result: EngineResult, input: EngineInput): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 48,
    info: { Title: 'FISC.CI — Dossier de preuve', Author: 'FISC.CI', Subject: 'Simulation fiscale' },
  });
  doc.registerFont('body', font(400));
  doc.registerFont('semi', font(600));
  doc.registerFont('bold', font(700));
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const width = doc.page.width - 96;
  const h1 = (t: string): void => { doc.moveDown(0.8).font('bold').fontSize(13).fillColor(INK).text(t); doc.moveDown(0.2); };
  const p = (t: string, color = INK): void => { doc.font('body').fontSize(10).fillColor(color).text(t, { width }); };
  const line = (label: string, value: string, bold = false): void => {
    doc.font(bold ? 'bold' : 'body').fontSize(10).fillColor(INK).text(`${label} : ${value}`, { width });
  };

  doc.font('bold').fontSize(18).fillColor(INK).text('Dossier de preuve — simulation fiscale');
  doc.font('body').fontSize(10).fillColor(MUTED).text('FISC.CI · Côte d’Ivoire · données fictives en phase POC');
  if (result.mode === 'INTERNAL') {
    doc.moveDown(0.5).font('bold').fontSize(11).fillColor('#8c1d18')
      .text('DOCUMENT INTERNE — hypothèses non confirmées possibles. Ne pas remettre à un client.', { width });
  }

  h1('Contexte du calcul');
  line('Date du calcul', formatDate(result.asOf));
  line('Version du registre des règles', result.registryVersion);
  line('Mode', result.mode === 'CLIENT' ? 'Client (règles confirmées uniquement)' : 'Interne');

  h1('Hypothèses saisies');
  for (const key of INPUT_KEYS) line(INPUT_LABEL_FR[key], describeInput(key, input[key]));
  for (const a of result.assumptions) p(`Hypothèse — ${a.message}`, MUTED);

  h1('Résultat : trois montants distincts');
  line('Économie fiscale brute', describeAggregate(result.gross), true);
  line('Décaissements (dons, salaires, autres)', describeAggregate(result.outflows), true);
  line('Économie nette (brute moins décaissements)', describeAggregate(result.net), true);
  if (result.net.state !== 'COMPLETE') p('Le total n’est pas complet : au moins un montant manque ou n’est pas calculable.', '#8c1d18');

  h1('Honoraires');
  const c = result.commission;
  if (c.state === 'COMPUTED') {
    line('Commission HT', formatMoney(c.excl));
    line('TVA', formatMoney(c.vat));
    line('Commission TTC', formatMoney(c.incl), true);
    if (c.capApplied) p('Plafond de commission appliqué.', MUTED);
  } else {
    line('Commission', 'non calculée');
    p(c.reason.message, MUTED);
  }

  h1('États de chaque levier');
  for (const lever of result.levers) {
    doc.moveDown(0.3).font('semi').fontSize(11).fillColor(INK).text(`${lever.label} — ${LEVER_STATE_LABEL_FR[lever.state]}`, { width });
    if (lever.state !== 'NOT_COMPUTABLE') {
      line('  Économie brute', formatMoney(lever.gross ?? 0n));
      line('  Décaissements', formatMoney(lever.outflows ?? 0n));
      line('  Économie nette', formatMoney(lever.net ?? 0n));
      if ((lever.creditExcess ?? 0n) > 0n) line('  Excédent non remboursable sans texte', formatMoney(lever.creditExcess ?? 0n));
    }
    for (const r of lever.reasons) p(`  ${r.message}`, MUTED);
    for (const s of lever.sources) {
      p(`  Source : ${s.label} — ${s.article}, page ${s.page} — ${RULE_STATUS_LABEL_FR[s.status]} — en vigueur au ${formatDate(s.effectiveDate)} — registre ${s.registryVersion}`, MUTED);
    }
  }

  if (result.blockedRules.length > 0) {
    h1('Règles manquantes ou non confirmées');
    for (const b of result.blockedRules) {
      p(`${CONCEPT_TITLE_FR[b.concept]}${b.status ? ` — ${RULE_STATUS_LABEL_FR[b.status]}` : ''}`, MUTED);
    }
  }

  h1('Avertissements');
  for (const w of result.warnings) p(`• ${w.message}`);

  h1('Mention de non-avis');
  p(result.disclaimer);

  doc.end();
  return done;
}
