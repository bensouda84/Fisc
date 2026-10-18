import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState, type FormEvent } from 'react';
import { api, setSession } from '../api.ts';
import { PublicFrame } from '../components/PublicFrame.tsx';
import { DEMO } from '../flags.ts';
import { NavButton } from '../router.tsx';
import type { Scheme } from '../scheme.ts';
import type { User } from '../wire.ts';

function DemoProfiles({ onLogin }: { onLogin: (u: User) => void }) {
  async function enter(email: string): Promise<void> {
    const s = await api.login(email, '');
    setSession(s);
    onLogin(s.user);
  }
  return (
    <Stack spacing={1.5} aria-label="Choisir un profil de démonstration" role="group">
      <Typography variant="h5" component="p">Choisissez un profil</Typography>
      <Button variant="contained" onClick={() => enter('consultant@fisc.test')}>Consultant mesimpo</Button>
      <Typography variant="body2" color="text.secondary">Mode interne : les règles de TEST permettent de voir un calcul complet, avec ses hypothèses.</Typography>
      <Button variant="outlined" onClick={() => enter('client@fisc.test')}>Dirigeant (client)</Button>
      <Typography variant="body2" color="text.secondary">Mode client : aucune règle n’est confirmée, donc rien n’est chiffré. C’est le comportement réel du produit aujourd’hui.</Typography>
    </Stack>
  );
}

export function Login({ onLogin, scheme, onToggleScheme }: { onLogin: (u: User) => void; scheme: Scheme; onToggleScheme: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const s = await api.login(email.trim(), password);
      setSession(s);
      onLogin(s.user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PublicFrame scheme={scheme} onToggleScheme={onToggleScheme}>
      <Stack component="form" spacing={2.5} onSubmit={submit} noValidate aria-labelledby="login-title">
        <Typography variant="h2" component="h1" id="login-title">Connexion</Typography>
        <Typography color="text.secondary">Payez juste. Pas plus.</Typography>
        {DEMO && <DemoProfiles onLogin={onLogin} />}
        {error && <Alert severity="error" role="alert">{error}</Alert>}
        {!DEMO && <>
        <TextField label="Adresse e-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required fullWidth />
        <TextField label="Mot de passe" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required fullWidth />
        <Button type="submit" variant="contained" disabled={busy || !email || !password}>Se connecter</Button>
        </>}
        <Stack spacing={0.5}>
          <NavButton to="#/estimation" variant="outlined">Estimer sans compte</NavButton>
          <NavButton to="#/inscription" variant="text">Créer un compte</NavButton>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          Environnement de démonstration : données fictives. Cette simulation ne remplace pas l’avis d’un professionnel.
        </Typography>
      </Stack>
    </PublicFrame>
  );
}
