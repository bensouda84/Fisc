import AssignmentIcon from '@mui/icons-material/Assignment';
import GavelIcon from '@mui/icons-material/Gavel';
import InsightsIcon from '@mui/icons-material/Insights';
import LogoutIcon from '@mui/icons-material/Logout';
import TuneIcon from '@mui/icons-material/Tune';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import Chip from '@mui/material/Chip';
import CssBaseline from '@mui/material/CssBaseline';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Snackbar from '@mui/material/Snackbar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { ThemeProvider, useTheme } from '@mui/material/styles';
import { Suspense, lazy, useCallback, useEffect, useState, type ReactNode } from 'react';
import { api, currentSession, setSession } from './api.ts';
import { Diagnostic } from './pages/Diagnostic.tsx';
import { Login } from './pages/Login.tsx';
import { Result } from './pages/Result.tsx';
import { Simulation } from './pages/Simulation.tsx';
import { Provider } from './state.tsx';
import { buildTheme } from './theme.ts';
import type { Role, User, WireRule } from './wire.ts';

const Registry = lazy(() => import('./pages/Registry.tsx'));

type RouteId = 'diagnostic' | 'result' | 'simulation' | 'registry';
const ITEMS: { id: RouteId; label: string; icon: ReactNode; roles?: Role[] }[] = [
  { id: 'diagnostic', label: 'Diagnostic', icon: <AssignmentIcon /> },
  { id: 'result', label: 'Résultat', icon: <InsightsIcon /> },
  { id: 'simulation', label: 'Simulation', icon: <TuneIcon /> },
  { id: 'registry', label: 'Registre', icon: <GavelIcon />, roles: ['consultant', 'validator', 'admin'] },
];
const ROLE_LABEL: Record<Role, string> = { consultant: 'Consultant', client: 'Client', validator: 'Validateur', admin: 'Administrateur' };

const routeFromHash = (): RouteId => {
  const id = window.location.hash.replace('#/', '') as RouteId;
  return ITEMS.some((i) => i.id === id) ? id : 'diagnostic';
};

function Shell({ user, onLogout }: { user: User; onLogout: () => void }) {
  const theme = useTheme();
  const tablet = useMediaQuery(theme.breakpoints.between('sm', 'lg'));
  const desktop = useMediaQuery(theme.breakpoints.up('lg'));
  const [route, setRoute] = useState<RouteId>(routeFromHash);
  const [rules, setRules] = useState<WireRule[]>([]);
  const items = ITEMS.filter((i) => !i.roles || i.roles.includes(user.role));

  useEffect(() => {
    const onHash = (): void => setRoute(routeFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => { api.registry().then((s) => setRules(s.rules)).catch(() => undefined); }, []);

  const go = useCallback((id: RouteId): void => { window.location.hash = `#/${id}`; }, []);
  const page = (
    <Suspense fallback={null}>
      {route === 'diagnostic' && <Diagnostic rules={rules} onDone={() => go('result')} />}
      {route === 'result' && <Result onStart={() => go('diagnostic')} />}
      {route === 'simulation' && <Simulation onStart={() => go('diagnostic')} />}
      {route === 'registry' && <Registry />}
    </Suspense>
  );
  const railWidth = tablet ? 88 : desktop ? 280 : 0;

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}>
      <Box component="a" href="#main" sx={{ position: 'absolute', left: -9999, '&:focus': { left: 8, top: 8, zIndex: 2000, bgcolor: 'background.paper', p: 1.5, borderRadius: 2 } }}>
        Aller au contenu
      </Box>
      <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.default', zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar sx={{ gap: 1.5 }}>
          <Typography variant="h4" component="p" sx={{ flexGrow: 1 }}>FISC.CI</Typography>
          <Chip label={ROLE_LABEL[user.role]} variant="outlined" />
          <IconButton aria-label="Se déconnecter" onClick={onLogout}><LogoutIcon /></IconButton>
        </Toolbar>
      </AppBar>
      {(tablet || desktop) && (
        <Drawer variant="permanent" open sx={{ width: railWidth, '& .MuiDrawer-paper': { width: railWidth, top: 64, height: 'calc(100% - 64px)', borderRight: 1, borderColor: 'divider' } }}>
          <nav aria-label="Navigation principale">
            <List sx={{ p: tablet ? 1 : 2 }}>
              {items.map((i) => (
                <ListItemButton key={i.id} selected={route === i.id} onClick={() => go(i.id)} aria-current={route === i.id ? 'page' : undefined}
                  sx={{ borderRadius: tablet ? 3 : 7, minHeight: 56, flexDirection: tablet ? 'column' : 'row', justifyContent: 'center', gap: tablet ? 0.25 : 0, py: 1 }}>
                  <ListItemIcon sx={{ minWidth: tablet ? 0 : 40, justifyContent: 'center', color: 'inherit' }}>{i.icon}</ListItemIcon>
                  <ListItemText primary={i.label} slotProps={{ primary: { variant: tablet ? 'caption' : 'body1', sx: { fontWeight: 700, textAlign: tablet ? 'center' : 'left' } } }} sx={{ flex: 'none' }} />
                </ListItemButton>
              ))}
            </List>
          </nav>
        </Drawer>
      )}
      <Box component="main" id="main" tabIndex={-1} sx={{ ml: `${railWidth}px`, px: { xs: 2, sm: 3 }, py: 3, pb: { xs: 12, sm: 4 }, maxWidth: 960, mx: railWidth ? undefined : 'auto', width: railWidth ? `calc(100% - ${railWidth}px)` : '100%', boxSizing: 'border-box', outline: 'none' }}>
        {page}
      </Box>
      {!tablet && !desktop && (
        <Box component="nav" aria-label="Navigation principale" sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper', zIndex: 1100 }}>
          <BottomNavigation showLabels value={route} onChange={(_e, v: RouteId) => go(v)} sx={{ height: 72, bgcolor: 'transparent' }}>
            {items.map((i) => (
              <BottomNavigationAction key={i.id} value={i.id} label={i.label} icon={i.icon} sx={{ minWidth: 48, minHeight: 48, '& .MuiBottomNavigationAction-label': { fontSize: '0.75rem', fontWeight: 700 } }} />
            ))}
          </BottomNavigation>
        </Box>
      )}
    </Box>
  );
}

export function App() {
  const [user, setUser] = useState<User | null>(currentSession()?.user ?? null);
  const [message, setMessage] = useState<string | null>(null);
  const notify = useCallback((m: string) => setMessage(m), []);
  useEffect(() => { if (!currentSession()) setUser(null); });

  return (
    <ThemeProvider theme={buildTheme('light')}>
      <CssBaseline />
      {user ? (
        <Provider user={user} notify={notify}>
          <Shell user={user} onLogout={() => { setSession(null); setUser(null); window.location.hash = ''; }} />
        </Provider>
      ) : (
        <Login onLogin={setUser} />
      )}
      <Snackbar open={message !== null} autoHideDuration={5000} onClose={() => setMessage(null)} message={message} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} sx={{ bottom: { xs: 88, sm: 24 } }} />
    </ThemeProvider>
  );
}
