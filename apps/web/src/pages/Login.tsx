import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState, type FormEvent } from 'react';
import { api, setSession } from '../api.ts';
import { PublicFrame } from '../components/PublicFrame.tsx';
import type { Scheme } from '../scheme.ts';
import type { User } from '../wire.ts';

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
        {error && <Alert severity="error" role="alert">{error}</Alert>}
        <TextField label="Adresse e-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required fullWidth />
        <TextField label="Mot de passe" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required fullWidth />
        <Button type="submit" variant="contained" disabled={busy || !email || !password}>Se connecter</Button>
        <Stack spacing={0.5}>
          <Button component="a" href="#/estimation" variant="outlined">Estimer sans compte</Button>
          <Button component="a" href="#/inscription" variant="text">Créer un compte</Button>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          Environnement de démonstration : données fictives. Cette simulation ne remplace pas l’avis d’un professionnel.
        </Typography>
      </Stack>
    </PublicFrame>
  );
}
