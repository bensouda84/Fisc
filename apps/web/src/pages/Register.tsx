import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState, type FormEvent } from 'react';
import { api, setSession } from '../api.ts';
import { PublicFrame } from '../components/PublicFrame.tsx';
import type { Scheme } from '../scheme.ts';
import type { User } from '../wire.ts';
import { ESTIMATE_KEY } from './Estimate.tsx';

/** Reporte le bénéfice estimé de l'estimation express dans le diagnostic du nouveau compte. */
async function carryOverEstimate(): Promise<void> {
  try {
    const raw = sessionStorage.getItem(ESTIMATE_KEY);
    sessionStorage.removeItem(ESTIMATE_KEY);
    const profit = raw ? (JSON.parse(raw) as { estimatedProfit: string | null }).estimatedProfit : null;
    if (profit) await api.saveDiagnostic({ profit }, 0);
  } catch {
    /* le diagnostic démarre vide */
  }
}

export function Register({ onLogin, scheme, onToggleScheme }: { onLogin: (u: User) => void; scheme: Scheme; onToggleScheme: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const passwordShort = password !== '' && password.length < 12;

  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const s = await api.register(email.trim(), password, consent);
      setSession(s);
      await carryOverEstimate();
      window.location.hash = '#/diagnostic';
      onLogin(s.user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PublicFrame scheme={scheme} onToggleScheme={onToggleScheme}>
      <Stack component="form" spacing={2.5} onSubmit={submit} noValidate aria-labelledby="register-title">
        <Typography variant="h2" component="h1" id="register-title">Créer votre compte</Typography>
        <Typography color="text.secondary">Gratuit. Votre diagnostic est enregistré et vous retrouvez vos résultats à chaque connexion.</Typography>
        {error && <Alert severity="error" role="alert">{error}</Alert>}
        <TextField label="Adresse e-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required fullWidth />
        <TextField
          label="Mot de passe" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required fullWidth
          error={passwordShort} helperText={passwordShort ? 'Saisissez au moins 12 caractères.' : '12 caractères au moins.'}
        />
        <Accordion disableGutters variant="outlined" sx={{ borderRadius: 2, '&:before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls="privacy-body" id="privacy-head">Vos données personnelles</AccordionSummary>
          <AccordionDetails id="privacy-body">
            <Typography variant="body2">
              mesimpo conserve votre adresse e-mail et un condensé de votre mot de passe pour gérer votre compte, ainsi que les montants et effectifs que vous saisissez pour calculer vos simulations. Aucun nom de salarié n’est demandé. Vos données ne sont pas vendues. Vous pouvez demander la suppression de votre compte.
            </Typography>
          </AccordionDetails>
        </Accordion>
        <FormControlLabel
          control={<Checkbox checked={consent} onChange={(e) => setConsent(e.target.checked)} sx={{ p: 1.5 }} />}
          label="J’accepte que mesimpo traite mon adresse e-mail pour gérer mon compte."
        />
        <Button type="submit" variant="contained" disabled={busy || !email || password.length < 12 || !consent}>Créer mon compte</Button>
        <Button component="a" href="#/" variant="text">J’ai déjà un compte</Button>
        <Typography variant="body2" color="text.secondary">Environnement de démonstration : données fictives.</Typography>
      </Stack>
    </PublicFrame>
  );
}
