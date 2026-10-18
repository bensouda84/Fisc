import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState, type FormEvent } from 'react';
import { api, setSession } from '../api.ts';
import type { User } from '../wire.ts';

export function Login({ onLogin }: { onLogin: (u: User) => void }) {
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
    <Box component="main" id="main" sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', p: 2 }}>
      <Card sx={{ width: '100%', maxWidth: 440 }}>
        <CardContent sx={{ p: { xs: 2.5, sm: 4 } }}>
          <Stack component="form" spacing={2.5} onSubmit={submit} noValidate aria-labelledby="login-title">
            <Typography variant="h2" component="h1" id="login-title">FISC.CI</Typography>
            <Typography color="text.secondary">Simulation fiscale sourcée. Connectez-vous pour continuer.</Typography>
            {error && <Alert severity="error" role="alert">{error}</Alert>}
            <TextField label="Adresse e-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required fullWidth />
            <TextField label="Mot de passe" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required fullWidth />
            <Button type="submit" variant="contained" disabled={busy || !email || !password}>Se connecter</Button>
            <Typography variant="body2" color="text.secondary">
              Environnement de démonstration : données fictives. Cette simulation ne remplace pas l’avis d’un professionnel.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
