import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { CONCEPT_TITLE_FR, describeAggregate, formatMoney } from '@fisc/engine';
import type { Aggregate, EngineResult, LeverResult } from '@fisc/schemas';
import { StatusChip } from './StatusChip.tsx';
import { SourcesSheet } from './Sheets.tsx';

const aggChip = (a: Aggregate) => (a.state === 'PARTIAL' ? <StatusChip kind="PARTIAL" /> : a.state === 'NOT_COMPUTABLE' ? <StatusChip kind="NOT_COMPUTABLE" /> : null);

export function Synthesis({ result }: { result: EngineResult }) {
  const n = (s: LeverResult['state']): number => result.levers.filter((l) => l.state === s).length;
  const cells = [
    { kind: 'CALCULATED', count: n('CALCULATED'), label: 'calculé' },
    { kind: 'NOT_COMPUTABLE', count: n('NOT_COMPUTABLE'), label: 'non calculable' },
    { kind: 'NULL', count: n('NULL'), label: 'nul' },
  ] as const;
  return (
    <Box component="section" aria-labelledby="synthesis-title">
      <Typography id="synthesis-title" variant="h4" component="h2" sx={{ mb: 1.5 }}>Synthèse</Typography>
      <Stack direction="row" sx={{ gap: 1.5, flexWrap: 'wrap' }}>
        {cells.map((c) => (
          <Card key={c.kind} sx={{ flex: { xs: '1 1 100%', sm: '1 1 150px' } }} data-testid={`count-${c.kind}`}>
            <CardContent>
              <Typography variant="h2" component="p" aria-label={`${c.count} ${c.label}${c.count > 1 ? 's' : ''}`}>{c.count}</Typography>
              <StatusChip kind={c.kind} />
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Box>
  );
}

function AmountRow({ label, agg, testId }: { label: string; agg: Aggregate; testId: string }) {
  return (
    <Box sx={{ py: 1.5 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Stack direction="row" sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography variant="h3" component="p" data-testid={testId}>{describeAggregate(agg)}</Typography>
        {aggChip(agg)}
      </Stack>
    </Box>
  );
}

/** R3 : trois montants distincts, jamais le mot « économie » seul. */
export function ThreeAmounts({ result }: { result: EngineResult }) {
  const incomplete = result.net.state !== 'COMPLETE';
  return (
    <Box component="section" aria-labelledby="amounts-title">
      <Typography id="amounts-title" variant="h4" component="h2" sx={{ mb: 1 }}>Trois montants distincts</Typography>
      <Card><CardContent>
        <AmountRow label="Économie fiscale brute" agg={result.gross} testId="gross" />
        <AmountRow label="Décaissements (dons, salaires, autres)" agg={result.outflows} testId="outflows" />
        <AmountRow label="Économie nette (brute moins décaissements)" agg={result.net} testId="net" />
        {incomplete && (
          <Alert severity="warning" icon={<InfoOutlinedIcon />} sx={{ mt: 1 }}>
            Le total n’est pas complet : au moins un montant manque ou n’est pas calculable. Aucun total complet n’est affiché.
          </Alert>
        )}
      </CardContent></Card>
    </Box>
  );
}

export function Fees({ result }: { result: EngineResult }) {
  const c = result.commission;
  return (
    <Box component="section" aria-labelledby="fees-title">
      <Typography id="fees-title" variant="h4" component="h2" sx={{ mb: 1 }}>Honoraires</Typography>
      <Card><CardContent>
        {c.state === 'COMPUTED' ? (
          <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 3, rowGap: 0.5 }} data-testid="fees">
            <Typography component="dt">Commission HT</Typography><Typography component="dd" sx={{ m: 0, textAlign: 'right' }} data-testid="fee-ht">{formatMoney(c.excl)}</Typography>
            <Typography component="dt">TVA</Typography><Typography component="dd" sx={{ m: 0, textAlign: 'right' }} data-testid="fee-vat">{formatMoney(c.vat)}</Typography>
            <Typography component="dt" sx={{ fontWeight: 700 }}>Commission TTC</Typography><Typography component="dd" sx={{ fontWeight: 700, m: 0, textAlign: 'right' }} data-testid="fee-ttc">{formatMoney(c.incl)}</Typography>
          </Box>
        ) : (
          <Typography data-testid="fees-none">{c.reason.message}</Typography>
        )}
      </CardContent></Card>
    </Box>
  );
}

function LeverCard({ lever }: { lever: LeverResult }) {
  const [open, setOpen] = useState(false);
  const calculable = lever.state !== 'NOT_COMPUTABLE';
  return (
    <Card component="li" sx={{ listStyle: 'none' }} data-testid={`lever-${lever.id}`}>
      <CardContent>
        <Stack direction="row" sx={{ gap: 1, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Typography variant="h5" component="h3">{lever.label}</Typography>
          <StatusChip kind={lever.state} />
        </Stack>
        {calculable ? (
          <Box component="dl" sx={{ m: 0, mt: 1.5, display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 3, rowGap: 0.5 }}>
            <Typography component="dt" color="text.secondary">Économie fiscale brute</Typography><Typography component="dd" sx={{ m: 0, textAlign: 'right' }}>{formatMoney(lever.gross ?? 0n)}</Typography>
            <Typography component="dt" color="text.secondary">Décaissements</Typography><Typography component="dd" sx={{ m: 0, textAlign: 'right' }}>{formatMoney(lever.outflows ?? 0n)}</Typography>
            <Typography component="dt" color="text.secondary">Économie nette</Typography><Typography component="dd" sx={{ fontWeight: 700, m: 0, textAlign: 'right' }}>{formatMoney(lever.net ?? 0n)}</Typography>
            {(lever.creditExcess ?? 0n) > 0n && (
              <>
                <Typography component="dt" color="text.secondary">Excédent non remboursable sans texte</Typography>
                <Typography component="dd" sx={{ m: 0, textAlign: 'right' }}>{formatMoney(lever.creditExcess ?? 0n)}</Typography>
              </>
            )}
          </Box>
        ) : (
          <Typography sx={{ mt: 1.5 }} color="text.secondary">Aucun montant n’est affiché : ce levier n’est pas calculable.</Typography>
        )}
        {lever.reasons.length > 0 && (
          <Box component="ul" sx={{ pl: 2.5, mt: 1.5, mb: 0 }}>
            {lever.reasons.map((r) => <li key={r.code + (r.field ?? '')}><Typography variant="body2">{r.message}</Typography></li>)}
          </Box>
        )}
        <Button variant="text" onClick={() => setOpen(true)} sx={{ mt: 1, ml: -1.5 }} aria-label={`Voir la source : ${lever.label}`}>
          Voir la source
        </Button>
      </CardContent>
      <SourcesSheet open={open} onClose={() => setOpen(false)} title={`Source : ${lever.label}`} sources={lever.sources} />
    </Card>
  );
}

export function Levers({ result }: { result: EngineResult }) {
  return (
    <Box component="section" aria-labelledby="levers-title">
      <Typography id="levers-title" variant="h4" component="h2" sx={{ mb: 1.5 }}>Détail par levier</Typography>
      <Stack component="ul" spacing={1.5} sx={{ p: 0, m: 0 }}>
        {result.levers.map((l) => <LeverCard key={l.id} lever={l} />)}
      </Stack>
    </Box>
  );
}

/** Bandeaux du haut de page : mode, hypothèses, ce qui manque. */
export function Notices({ result }: { result: EngineResult }) {
  return (
    <Stack spacing={1.5}>
      {result.mode === 'INTERNAL' && <Alert severity="warning" data-testid="internal-banner">Mode interne : ce résultat ne doit pas être remis à un client.</Alert>}
      {result.assumptions.length > 0 && (
        <Alert severity="info" data-testid="assumptions">
          <Typography variant="h6" component="p">Hypothèses</Typography>
          <Box component="ul" sx={{ pl: 2.5, m: 0 }}>{result.assumptions.map((a) => <li key={a.ruleId}>{a.message}</li>)}</Box>
        </Alert>
      )}
      {result.blockedRules.length > 0 && (
        <Alert severity="info" data-testid="blocked">
          <Typography variant="h6" component="p">Ce qui manque pour calculer</Typography>
          <Box component="ul" sx={{ pl: 2.5, m: 0 }}>
            {result.blockedRules.map((b) => <li key={b.concept}>{CONCEPT_TITLE_FR[b.concept]} : règle non confirmée.</li>)}
          </Box>
        </Alert>
      )}
    </Stack>
  );
}

/** Pied de page : avertissements et mention de non-avis (R9). */
export function Footnotes({ result }: { result: EngineResult }) {
  return (
    <Stack spacing={1.5}>
      <Typography variant="h5" component="h2">Avertissements</Typography>
      <Box component="ul" sx={{ pl: 2.5, m: 0 }}>
        {result.warnings.filter((w) => w.code !== 'INTERNAL_MODE').map((w) => <li key={w.code}><Typography variant="body2">{w.message}</Typography></li>)}
      </Box>
      <Typography variant="body2" color="text.secondary" data-testid="disclaimer">{result.disclaimer}</Typography>
    </Stack>
  );
}
