import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';
import type { Mode } from '@fisc/schemas';
import { api } from '../api.ts';
import { Fees, Levers, Notices, Synthesis, ThreeAmounts } from '../components/ResultView.tsx';
import { useApp } from '../state.tsx';

export function Result({ onStart }: { onStart: () => void }) {
  const { role, last, setLast, notify } = useApp();
  const staff = role !== 'client';
  const [mode, setMode] = useState<Mode>('INTERNAL');
  const [loading, setLoading] = useState(false);
  const [empty, setEmpty] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function compute(m: Mode): Promise<void> {
    setLoading(true);
    try {
      const d = await api.diagnostic();
      if (Object.keys(d.answers).length === 0) { setEmpty(true); return; }
      setEmpty(false);
      setLast(await api.simulate(d.answers, { mode: m }));
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (!last) void compute(mode); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function exportPdf(): Promise<void> {
    if (!last?.id) return;
    setExporting(true);
    try {
      const blob = await api.pdf(last.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dossier-de-preuve-${last.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      notify('Dossier de preuve téléchargé.');
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setExporting(false);
    }
  }

  if (loading && !last) return <Stack sx={{ alignItems: 'center', py: 8 }}><CircularProgress aria-label="Calcul en cours" /></Stack>;
  if (!last || empty) {
    return (
      <Stack spacing={2} component="section" sx={{ alignItems: 'flex-start' }}>
        <Typography variant="h3" component="h1">Résultat</Typography>
        <Typography>Aucun levier calculé pour l’instant. Répondez aux questions pour commencer.</Typography>
        <Button variant="contained" onClick={onStart}>Commencer le diagnostic</Button>
      </Stack>
    );
  }
  const { result } = last;
  return (
    <Stack spacing={3} component="section" aria-labelledby="result-title">
      <Stack direction="row" sx={{ gap: 2, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <Typography id="result-title" variant="h3" component="h1">Résultat de la simulation</Typography>
        {staff && (
          <ToggleButtonGroup exclusive size="small" value={mode} aria-label="Mode d’affichage"
            onChange={(_e, m: Mode | null) => { if (m) { setMode(m); void compute(m); } }}>
            <ToggleButton value="INTERNAL" sx={{ minHeight: 48, px: 2 }}>Interne</ToggleButton>
            <ToggleButton value="CLIENT" sx={{ minHeight: 48, px: 2 }}>Aperçu client</ToggleButton>
          </ToggleButtonGroup>
        )}
      </Stack>
      <Notices result={result} />
      <Synthesis result={result} />
      <ThreeAmounts result={result} />
      <Fees result={result} />
      <Levers result={result} />
      {last.id ? (
        <Button variant="contained" startIcon={<PictureAsPdfIcon />} onClick={exportPdf} disabled={exporting} sx={{ alignSelf: 'flex-start' }}>
          Exporter le dossier de preuve (PDF)
        </Button>
      ) : (
        <Alert severity="info">Cette simulation n’est pas enregistrée : lancez le diagnostic pour exporter un dossier de preuve.</Alert>
      )}
    </Stack>
  );
}
