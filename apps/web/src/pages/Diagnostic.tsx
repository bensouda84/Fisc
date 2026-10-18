import HelpOutlineIcon from '@mui/icons-material/HelpOutlineOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEffect, useRef, useState } from 'react';
import { formatMoney } from '@fisc/engine';
import { api } from '../api.ts';
import { WhySheet } from '../components/Sheets.tsx';
import { ALL_FIELDS, STEPS, UNKNOWN, fieldError, parseDraft, type Field } from '../questions.ts';
import { useApp } from '../state.tsx';
import type { Answers, WireRule } from '../wire.ts';

type Draft = Record<string, string>;

const toDraft = (a: Answers): Draft => Object.fromEntries(Object.entries(a).map(([k, v]) => [k, String(v)]));

function toAnswers(draft: Draft): Answers {
  const out: Answers = {};
  for (const f of ALL_FIELDS) {
    const v = parseDraft(f, draft[f.key] ?? '');
    if (v !== null && v !== undefined) out[f.key] = v;
  }
  return out;
}

function FieldInput({ field, value, onChange }: { field: Field; value: string; onChange: (v: string) => void }) {
  const unknown = value === UNKNOWN;
  const error = fieldError(field, value);
  const id = `f-${field.key}`;
  const preview = !unknown && !error && value.trim() !== '' && field.kind === 'money' ? formatMoney(BigInt(value.trim())) : null;
  return (
    <Box>
      <TextField
        id={id}
        label={field.label}
        value={unknown ? '' : value}
        disabled={unknown}
        onChange={(e) => onChange(e.target.value)}
        fullWidth
        error={Boolean(error)}
        helperText={error ?? field.hint}
        slotProps={{ htmlInput: { inputMode: field.kind === 'count' ? 'numeric' : field.allowNegative ? 'text' : 'numeric', autoComplete: 'off', 'aria-describedby': `${id}-preview` } }}
      />
      <Typography id={`${id}-preview`} variant="body2" color="text.secondary" aria-live="polite" sx={{ mt: 0.5, minHeight: 20, pl: 0.5 }}>
        {preview ? `Soit ${preview}` : ''}
      </Typography>
      <FormControlLabel
        control={<Checkbox checked={unknown} onChange={(e) => onChange(e.target.checked ? UNKNOWN : '')} sx={{ p: 1.5 }} />}
        label="Je ne sais pas"
      />
    </Box>
  );
}

export function Diagnostic({ rules, onDone }: { rules: WireRule[]; onDone: () => void }) {
  const { role, notify, setLast } = useApp();
  const [draft, setDraft] = useState<Draft>({});
  const [step, setStep] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [why, setWhy] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);

  useEffect(() => {
    api.diagnostic().then((d) => { setDraft(toDraft(d.answers)); setStep(Math.min(d.step, STEPS.length - 1)); }).catch(() => undefined).finally(() => setLoaded(true));
  }, []);

  // Sauvegarde automatique.
  useEffect(() => {
    if (!loaded) return;
    if (first.current) { first.current = false; return; }
    setSaved('saving');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      api.saveDiagnostic(toAnswers(draft), step).then(() => setSaved('saved')).catch(() => setSaved('idle'));
    }, 400);
    return () => clearTimeout(timer.current);
  }, [draft, step, loaded]);

  useEffect(() => { heading.current?.focus(); }, [step]);

  if (!loaded) return <Stack alignItems="center" sx={{ py: 8 }}><CircularProgress aria-label="Chargement du diagnostic" /></Stack>;
  const current = STEPS[step]!;
  const stepHasError = current.fields.some((f) => fieldError(f, draft[f.key] ?? '') !== null);
  const stepEmpty = current.fields.some((f) => (draft[f.key] ?? '').trim() === '');
  const last = step === STEPS.length - 1;

  async function finish(): Promise<void> {
    setBusy(true);
    try {
      clearTimeout(timer.current);
      await api.saveDiagnostic(toAnswers(draft), step);
      setLast(await api.simulate(toAnswers(draft)));
      notify('Résultat calculé.');
      onDone();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack spacing={3} component="section" aria-labelledby="step-title">
      <Box>
        <Typography variant="body2" color="text.secondary" id="step-count">Question {step + 1} sur {STEPS.length}</Typography>
        <LinearProgress variant="determinate" value={((step + 1) / STEPS.length) * 100} aria-labelledby="step-count" sx={{ height: 8, borderRadius: 4, mt: 1 }} />
      </Box>
      <Typography id="step-title" variant="h3" component="h1" tabIndex={-1} ref={heading} sx={{ outline: 'none' }}>{current.title}</Typography>
      <Stack spacing={2}>
        {current.fields.map((f) => (
          <FieldInput key={f.key} field={f} value={draft[f.key] ?? ''} onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))} />
        ))}
      </Stack>
      <Box>
        <Button variant="text" startIcon={<HelpOutlineIcon />} onClick={() => setWhy(true)} sx={{ ml: -1.5 }}>Pourquoi cette question ?</Button>
      </Box>
      <Typography variant="body2" color="text.secondary" role="status" aria-live="polite">
        {saved === 'saving' ? 'Enregistrement…' : saved === 'saved' ? 'Brouillon enregistré.' : ' '}
      </Typography>
      <Stack direction="row" sx={{ gap: 2, alignItems: 'center', justifyContent: 'space-between' }}>
        <Button variant="text" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>Retour</Button>
        <Button
          variant="contained"
          disabled={stepHasError || stepEmpty || busy}
          onClick={() => (last ? finish() : setStep((s) => s + 1))}
        >
          {last ? 'Voir le résultat' : 'Continuer'}
        </Button>
      </Stack>
      {stepEmpty && !stepHasError && (
        <Typography variant="body2" color="text.secondary">Saisissez une valeur ou cochez « Je ne sais pas » pour continuer.</Typography>
      )}
      <WhySheet
        open={why}
        onClose={() => setWhy(false)}
        why={current.why}
        concepts={current.fields.flatMap((f) => (f.concept ? [f.concept] : []))}
        rules={rules}
        role={role}
      />
    </Stack>
  );
}
