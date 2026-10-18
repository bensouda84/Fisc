import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState, type FormEvent } from 'react';
import { CONCEPT_TITLE_FR, formatDate, formatMoney } from '@fisc/engine';
import { api, type Estimation } from '../api.ts';
import { Levers } from '../components/ResultView.tsx';
import { PublicFrame } from '../components/PublicFrame.tsx';
import { StatusChip } from '../components/StatusChip.tsx';
import { SourcesSheet } from '../components/Sheets.tsx';
import { NavButton } from '../router.tsx';
import type { Scheme } from '../scheme.ts';

export const ESTIMATE_KEY = 'fisc.estimate';

const INTEGER = /^\d{1,15}$/;

/** Mémorise l'hypothèse pour la reporter dans le compte créé ensuite (stockage de session seulement). */
function remember(e: Estimation): void {
  try {
    sessionStorage.setItem(ESTIMATE_KEY, JSON.stringify(e.assumption));
  } catch {
    /* sans stockage, le diagnostic démarre vide */
  }
}

export function Estimate({ scheme, onToggleScheme }: { scheme: Scheme; onToggleScheme: () => void }) {
  const [turnover, setTurnover] = useState('');
  const [margin, setMargin] = useState('');
  const [out, setOut] = useState<Estimation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState(false);

  const turnoverOk = INTEGER.test(turnover.trim()) && BigInt(turnover.trim()) > 0n;
  const marginOk = margin.trim() === '' || (/^\d{1,3}$/.test(margin.trim()) && Number.parseInt(margin, 10) <= 100);

  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!turnoverOk || !marginOk) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.estimate(turnover.trim(), margin.trim() === '' ? undefined : Number.parseInt(margin, 10));
      setOut(r);
      remember(r);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const tax = out?.result.taxBefore ?? null;
  return (
    <PublicFrame scheme={scheme} onToggleScheme={onToggleScheme} wide>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h2" component="h1">Estimation express</Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>Sans compte, en une question. Vous verrez ce que mesimpo peut calculer et ce qui manque pour aller plus loin.</Typography>
        </Box>
        <Stack component="form" spacing={2} onSubmit={submit} noValidate aria-label="Estimation express">
          <TextField
            label="Chiffre d’affaires annuel (F CFA)"
            value={turnover}
            onChange={(e) => setTurnover(e.target.value)}
            error={turnover !== '' && !turnoverOk}
            helperText={turnover !== '' && !turnoverOk ? 'Saisissez un montant entier supérieur à 0 F CFA, sans virgule ni espace.' : turnoverOk ? `Soit ${formatMoney(BigInt(turnover.trim()))}` : 'Saisissez un montant entier, sans virgule.'}
            slotProps={{ htmlInput: { inputMode: 'numeric', autoComplete: 'off' } }}
            fullWidth
          />
          <TextField
            label="Marge bénéficiaire estimée (%)"
            value={margin}
            onChange={(e) => setMargin(e.target.value)}
            error={!marginOk}
            helperText={marginOk ? 'Facultatif. Votre hypothèse : sans elle, le bénéfice et l’impôt ne sont pas calculables.' : 'Saisissez un nombre entier entre 0 et 100.'}
            slotProps={{ htmlInput: { inputMode: 'numeric', autoComplete: 'off' } }}
            fullWidth
          />
          <Button type="submit" variant={out ? 'outlined' : 'contained'} disabled={busy || !turnoverOk || !marginOk} sx={{ alignSelf: 'flex-start' }}>
            {out ? 'Recalculer' : 'Estimer'}
          </Button>
        </Stack>
        {error && <Alert severity="error" role="alert">{error}</Alert>}

        {out && (
          <Stack spacing={3} aria-live="polite" data-testid="estimate-result">
            <Alert severity="info">
              Le chiffre d’affaires seul ne permet pas de chiffrer une économie fiscale : l’impôt se calcule sur le bénéfice imposable, et chaque levier demande des données précises.
            </Alert>
            <Box component="section" aria-labelledby="est-tax-title">
              <Typography id="est-tax-title" variant="h4" component="h2" sx={{ mb: 1 }}>Impôt avant optimisation (estimation)</Typography>
              {tax !== null ? (
                <Stack spacing={1}>
                  <Typography variant="h3" component="p" data-testid="estimate-tax">{formatMoney(tax)}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Hypothèse : bénéfice estimé à {formatMoney(BigInt(out.assumption.estimatedProfit ?? '0'))} ({out.assumption.marginPercent} % de votre chiffre d’affaires).
                  </Typography>
                  <Button variant="text" onClick={() => setSource(true)} sx={{ alignSelf: 'flex-start', ml: -1.5 }}>Voir la source</Button>
                  <SourcesSheet open={source} onClose={() => setSource(false)} title="Source : impôt avant optimisation" sources={out.result.taxSources} />
                </Stack>
              ) : (
                <Stack spacing={1}>
                  <Stack direction="row" sx={{ gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                    <Typography variant="h3" component="p" data-testid="estimate-tax-none">Non calculable</Typography>
                    <StatusChip kind="NOT_COMPUTABLE" />
                  </Stack>
                  <Typography variant="body2" color="text.secondary" data-testid="estimate-tax-reason">
                    {out.assumption.estimatedProfit === null
                      ? 'Indiquez une marge bénéficiaire estimée, ou créez un compte pour saisir votre bénéfice imposable.'
                      : out.result.blockedRules.some((b) => b.concept === 'IS_RATE')
                        ? `${CONCEPT_TITLE_FR.IS_RATE} : règle non confirmée. Aucun chiffre n’est affiché tant qu’elle ne l’est pas.`
                        : 'Les données disponibles ne suffisent pas.'}
                  </Typography>
                </Stack>
              )}
            </Box>
            <Levers result={out.result} />
            <Box component="section" aria-labelledby="est-cta-title" sx={{ p: 2.5, borderRadius: 3, bgcolor: 'action.hover' }}>
              <Typography id="est-cta-title" variant="h4" component="h2">Pour aller plus loin</Typography>
              <Typography sx={{ my: 1.5 }}>
                Un diagnostic de 4 écrans suffit pour calculer chaque levier avec vos données, texte et page à l’appui. Votre estimation est reportée dans votre compte.
              </Typography>
              <NavButton to="#/inscription" variant="contained">Créer mon compte pour compléter le diagnostic</NavButton>
            </Box>
            <Stack spacing={0.5}>
              <Typography variant="body2" data-testid="estimate-date">Estimation établie le {formatDate(out.result.asOf)} · registre des règles {out.result.registryVersion}.</Typography>
              <Typography variant="body2" color="text.secondary" data-testid="disclaimer">{out.result.disclaimer}</Typography>
            </Stack>
          </Stack>
        )}
        <NavButton to="#/" variant="text" sx={{ alignSelf: 'flex-start' }}>J’ai déjà un compte</NavButton>
      </Stack>
    </PublicFrame>
  );
}
