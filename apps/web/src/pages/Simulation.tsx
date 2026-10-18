import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEffect, useRef, useState } from 'react';
import type { EngineResult } from '@fisc/schemas';
import { formatMoney } from '@fisc/engine';
import { api } from '../api.ts';
import { Fees, Footnotes, Levers, ThreeAmounts, Synthesis } from '../components/ResultView.tsx';
import { useApp } from '../state.tsx';
import type { Answers } from '../wire.ts';

const FIELDS = [
  { key: 'profit', label: 'Bénéfice imposable (F CFA)', max: 200_000_000, step: 1_000_000 },
  { key: 'donations', label: 'Dons effectués (F CFA)', max: 50_000_000, step: 100_000 },
  { key: 'extraSalaries', label: 'Salaires supplémentaires (F CFA)', max: 50_000_000, step: 100_000 },
] as const;

export function Simulation({ onStart }: { onStart: () => void }) {
  const { role, notify } = useApp();
  const [base, setBase] = useState<Answers | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<EngineResult | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    api.diagnostic().then((d) => {
      setBase(d.answers);
      setValues(Object.fromEntries(FIELDS.map((f) => [f.key, d.answers[f.key] === undefined || d.answers[f.key] === 'UNKNOWN' ? '0' : String(d.answers[f.key])])));
    }).catch((e: Error) => notify(e.message));
  }, [notify]);

  const valid = FIELDS.every((f) => /^-?\d{1,15}$/.test(values[f.key] ?? '') && (f.key === 'profit' || !(values[f.key] ?? '').startsWith('-')));

  // Recalcul immédiat : la simulation n'est jamais enregistrée et ne touche pas au registre.
  useEffect(() => {
    if (!base || !valid) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const input: Answers = { cdiHires: 0, apprentices: 0, interns: 0, otherOutflows: '0', ...base, ...values };
      api.simulate(input, { persist: false }).then((r) => setResult(r.result)).catch((e: Error) => notify(e.message));
    }, 120);
    return () => clearTimeout(timer.current);
  }, [base, values, valid, notify]);

  if (base && Object.keys(base).length === 0) {
    return (
      <Stack spacing={2} component="section" sx={{ alignItems: 'flex-start' }}>
        <Typography variant="h3" component="h1">Simulation</Typography>
        <Typography>Aucun levier calculé pour l’instant. Répondez aux questions pour commencer.</Typography>
        <Button variant="contained" onClick={onStart}>Commencer le diagnostic</Button>
      </Stack>
    );
  }

  return (
    <Stack spacing={3} component="section" aria-labelledby="sim-title">
      <Typography id="sim-title" variant="h3" component="h1">Simulation</Typography>
      <Alert severity="info">Vos changements ne sont pas enregistrés et ne modifient jamais le registre des règles.</Alert>
      <Stack spacing={3}>
        {FIELDS.map((f) => {
          const raw = values[f.key] ?? '';
          const ok = /^-?\d{1,15}$/.test(raw);
          return (
            <Box key={f.key}>
              <TextField
                label={f.label}
                value={raw}
                fullWidth
                error={!ok}
                helperText={ok ? `Soit ${formatMoney(BigInt(raw))}` : 'Saisissez un montant entier en F CFA, sans virgule.'}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                slotProps={{ htmlInput: { inputMode: 'numeric', autoComplete: 'off' } }}
              />
              <Slider
                aria-label={`${f.label}, curseur`}
                min={f.key === 'profit' ? 0 : 0}
                max={f.max}
                step={f.step}
                value={ok ? Math.min(Math.max(Number.parseInt(raw, 10), 0), f.max) : 0}
                onChange={(_e, v) => setValues((s) => ({ ...s, [f.key]: String(v as number) }))}
                getAriaValueText={(v) => formatMoney(BigInt(v))}
                sx={{ mt: 1, mx: 1, width: 'calc(100% - 16px)' }}
              />
            </Box>
          );
        })}
      </Stack>
      <Box aria-live="polite">
        {result && (
          <Stack spacing={3}>
            {role !== 'client' && result.mode === 'INTERNAL' && <Alert severity="warning">Mode interne : hypothèses possibles.</Alert>}
            <Synthesis result={result} />
            <ThreeAmounts result={result} />
            <Fees result={result} />
            <Levers result={result} />
            <Footnotes result={result} />
          </Stack>
        )}
      </Box>
    </Stack>
  );
}
