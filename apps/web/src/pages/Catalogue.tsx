import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutlineOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';
import { CONCEPT_TITLE_FR } from '@fisc/engine';
import type { Catalogue as CatalogueData, CatalogueLine } from '@fisc/schemas';
import { api } from '../api.ts';
import { useApp } from '../state.tsx';

type Filter = 'ALL' | 'YES' | 'NO';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'ALL', label: 'Toutes' },
  { key: 'YES', label: 'Modélisées' },
  { key: 'NO', label: 'Non modélisées' },
];

function Field({ label, children }: { label: string; children: string | null | undefined }) {
  if (!children) return null;
  return (
    <Box>
      <Typography variant="body2" color="text.secondary" component="dt">{label}</Typography>
      <Typography component="dd" sx={{ m: 0, overflowWrap: 'anywhere' }}>{children}</Typography>
    </Box>
  );
}

function Line({ l }: { l: CatalogueLine }) {
  const yes = l.modelled.state === 'YES';
  return (
    <Card component="li" sx={{ listStyle: 'none' }} data-testid={`cat-${l.id}`}>
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
            <Typography variant="h6" component="h3" sx={{ mr: 1 }}>{l.id} · {l.theme}</Typography>
            <Chip variant="outlined" label={l.status} />
            <Chip
              variant={yes ? 'filled' : 'outlined'} color={yes ? 'primary' : 'default'}
              icon={yes ? <CheckCircleOutlinedIcon /> : <RemoveCircleOutlineIcon />}
              label={yes ? `Modélisé : ${l.modelled.concept ? CONCEPT_TITLE_FR[l.modelled.concept] : ''}` : 'Non modélisé'}
            />
          </Stack>
          <Box component="dl" sx={{ m: 0, display: 'grid', gap: 1.5 }}>
            <Field label={l.family === 'R' ? 'Règle' : 'Paramètre (dernier texte lu)'}>{l.rule}</Field>
            <Field label="Effet sur le calcul">{l.effect}</Field>
            <Field label="Base légale">{l.legalBasis}</Field>
            <Field label="Source (article, page)">{l.source}</Field>
            <Field label="Modifié par l’annexe 2026 ?">{l.family === 'N' ? l.modifiedNote : undefined}</Field>
            <Field label="Priorité POC">{l.priority}</Field>
            <Field label={l.family === 'R' ? 'Reste à vérifier' : 'Action'}>{l.toVerify}</Field>
            <Field label="Modélisé : pourquoi">{l.modelled.reason}</Field>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function Plain({ title, rows }: { title: string; rows: { head: string; fields: [string, string][] }[] }) {
  return (
    <Stack spacing={1.5} component="section" aria-label={title}>
      <Typography variant="h5" component="h2">{title}</Typography>
      <Stack component="ul" spacing={1.5} sx={{ p: 0, m: 0 }}>
        {rows.map((r) => (
          <Card component="li" key={r.head} sx={{ listStyle: 'none' }}><CardContent>
            <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 700 }}>{r.head}</Typography>
            <Box component="dl" sx={{ m: 0, mt: 1, display: 'grid', gap: 1 }}>
              {r.fields.map(([k, v]) => (
                <Box key={k}>
                  <Typography variant="body2" color="text.secondary" component="dt">{k}</Typography>
                  <Typography component="dd" sx={{ m: 0, overflowWrap: 'anywhere' }}>
                    {/^https?:\/\//.test(v) ? <Link href={v} target="_blank" rel="noopener noreferrer">{v}</Link> : v}
                  </Typography>
                </Box>
              ))}
            </Box>
          </CardContent></Card>
        ))}
      </Stack>
    </Stack>
  );
}

export default function Catalogue() {
  const { notify } = useApp();
  const [data, setData] = useState<CatalogueData | null>(null);
  const [filter, setFilter] = useState<Filter>('ALL');
  useEffect(() => { api.catalogue().then(setData).catch((e: Error) => notify(e.message)); }, [notify]);
  if (!data) return null;
  const lines = data.lines.filter((l) => filter === 'ALL' || l.modelled.state === filter);
  const yes = data.lines.filter((l) => l.modelled.state === 'YES').length;
  return (
    <Stack spacing={3}>
      <Alert severity="info">
        Catalogue informatif des {data.lines.length} lignes du classeur de référence (état au {data.workbook.asOf}). Le moteur ne le lit jamais :
        une ligne ne devient un calcul qu’à travers une règle du registre confirmée par deux validateurs. {yes} lignes sont modélisées, {data.lines.length - yes} ne le sont pas, avec la raison indiquée.
      </Alert>
      <Stack component="section" spacing={1} aria-label="Synthèse du classeur">
        <Typography variant="h5" component="h2">Synthèse</Typography>
        <Box component="dl" sx={{ m: 0, display: 'grid', gap: 1.5 }}>
          {data.summary.map((s) => (
            <Box key={s.label}>
              <Typography variant="body2" color="text.secondary" component="dt">{s.label}</Typography>
              <Typography component="dd" sx={{ m: 0 }}>{s.text}</Typography>
            </Box>
          ))}
        </Box>
      </Stack>
      <Stack component="section" spacing={1.5} aria-label="Lignes recensées">
        <Typography variant="h5" component="h2">Lignes recensées ({lines.length})</Typography>
        <Stack direction="row" spacing={1} role="radiogroup" aria-label="Filtrer les lignes" useFlexGap sx={{ flexWrap: 'wrap' }}>
          {FILTERS.map((f) => (
            <Chip
              key={f.key} label={f.label} role="radio" aria-checked={filter === f.key} clickable
              color={filter === f.key ? 'primary' : 'default'} variant={filter === f.key ? 'filled' : 'outlined'}
              onClick={() => setFilter(f.key)} sx={{ minHeight: 48, borderRadius: 3 }}
            />
          ))}
        </Stack>
        <Stack component="ul" spacing={1.5} sx={{ p: 0, m: 0 }} aria-label="Lignes du catalogue">
          {lines.map((l) => <Line key={l.id} l={l} />)}
        </Stack>
      </Stack>
      <Plain title={`Écarts avec le registre V4 (${data.v4Gaps.length})`} rows={data.v4Gaps.map((g) => ({
        head: `${g.ref} · priorité ${g.priority}`,
        fields: [['Ce que dit le V4', g.v4], ['Ce que disent les textes lus', g.texts], ['Correction proposée', g.fix]],
      }))} />
      <Plain title={`Articles de l’annexe 2026 non lus (${data.unreadArticles.length})`} rows={data.unreadArticles.map((a) => ({
        head: `Article ${a.article}`,
        fields: [['Titre', a.title], ['Pertinence', a.relevance], ['Lecture', a.reading]],
      }))} />
      <Plain title={`Sources (${data.sources.length})`} rows={data.sources.map((s) => ({
        head: s.document,
        fields: [['Niveau de preuve', s.level], ['Lien', s.link], ['Ce qu’elle établit', s.establishes], ['Limite', s.limit], ['Lecture', s.reading]],
      }))} />
    </Stack>
  );
}
