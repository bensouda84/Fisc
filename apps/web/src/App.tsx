import AssignmentIcon from '@mui/icons-material/Assignment';
import GavelIcon from '@mui/icons-material/Gavel';
import InsightsIcon from '@mui/icons-material/Insights';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
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
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Snackbar from '@mui/material/Snackbar';
import Toolbar from '@mui/material/Toolbar';
import useMediaQuery from '@mui/material/useMediaQuery';
import { ThemeProvider, useTheme } from '@mui/material/styles';
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, currentSession, setSession } from './api.ts';
import { Diagnostic } from './pages/Diagnostic.tsx';
import { Estimate } from './pages/Estimate.tsx';
import { Login } from './pages/Login.tsx';
import { Register } from './pages/Register.tsx';
import { Result } from './pages/Result.tsx';
import { Simulation } from './pages/Simulation.tsx';
import { Provider } from './state.tsx';
import { LOGO } from './brand.ts';
import { DemoBanner } from './components/DemoBanner.tsx';
import { DEMO } from './flags.ts';
import { currentPath, focusMain, navigate, usePath } from './router.tsx';
import { applyScheme, initialScheme, rememberScheme, type Scheme } from './scheme.ts';
import { buildTheme, tokens } from './theme.ts';
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
  const id = currentPath().replace('#/', '') as RouteId;
  return ITEMS.some((i) => i.id === id) ? id : 'diagnostic';
};

function SchemeToggle({ scheme, onToggle }: { scheme: Scheme; onToggle: () => void }) {
  const dark = scheme === 'dark';
  return (
    <IconButton aria-label={dark ? 'Passer au thème clair' : 'Passer au thème sombre'} onClick={onToggle} data-testid="scheme-toggle">
      {dark ? <LightModeIcon /> : <DarkModeIcon />}
    </IconButton>
  );
}

function Shell({ user, onLogout, scheme, onToggleScheme }: { user: User; onLogout: () => void; scheme: Scheme; onToggleScheme: () => void }) {
  const theme = useTheme();
  const tablet = useMediaQuery(theme.breakpoints.between('sm', 'lg'));
  const desktop = useMediaQuery(theme.breakpoints.up('lg'));
  const [route, setRoute] = useState<RouteId>(routeFromHash);
  const [rules, setRules] = useState<WireRule[]>([]);
  const headerRef = useRef<HTMLDivElement>(null);
  // Le tiroir latéral démarre sous l'en-tête, bandeau de démonstration compris (sa hauteur varie avec la largeur).
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const set = (): void => document.documentElement.style.setProperty('--fisc-header-h', `${el.offsetHeight}px`);
    set();
    const observer = new ResizeObserver(set);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const items = ITEMS.filter((i) => (!i.roles || i.roles.includes(user.role)) && !(DEMO && i.id === 'registry'));

  const path = usePath();
  useEffect(() => { setRoute(routeFromHash()); }, [path]);
  useEffect(() => { api.registry().then((s) => setRules(s.rules)).catch(() => undefined); }, []);

  const go = useCallback((id: RouteId): void => { navigate(`#/${id}`); }, []);
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
      <Box component="a" href="#main" onClick={focusMain} sx={{ position: 'absolute', left: -9999, '&:focus': { left: 8, top: 8, zIndex: 2000, bgcolor: 'background.paper', p: 1.5, borderRadius: 2 } }}>
        Aller au contenu
      </Box>
      <Box ref={headerRef} sx={{ position: 'sticky', top: 0, zIndex: (t) => t.zIndex.drawer + 1 }}>
      <DemoBanner />
      <AppBar position="static" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
        <Toolbar sx={{ gap: 1, flexWrap: 'wrap', py: 0.5 }}>
          <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', minHeight: 48 }}>
            <Box component="img" src={scheme === 'dark' ? LOGO.dark : LOGO.light} alt="mesimpo" width={160} height={40} sx={{ height: 32, width: 'auto', display: 'block' }} />
          </Box>
          <Chip label={ROLE_LABEL[user.role]} variant="outlined" />
          <SchemeToggle scheme={scheme} onToggle={onToggleScheme} />
          <IconButton aria-label="Se déconnecter" onClick={onLogout}><LogoutIcon /></IconButton>
        </Toolbar>
      </AppBar>
      </Box>
      {(tablet || desktop) && (
        <Drawer variant="permanent" open sx={{ width: railWidth, '& .MuiDrawer-paper': { width: railWidth, top: 'var(--fisc-header-h, 64px)', height: 'calc(100% - var(--fisc-header-h, 64px))', borderRight: 1, borderColor: 'divider' } }}>
          <nav aria-label="Navigation principale">
            <Box sx={{ p: tablet ? 1 : 2, display: "grid", gap: 0.5 }}>
              {items.map((i) => (
                <ListItemButton key={i.id} selected={route === i.id} onClick={() => go(i.id)} aria-current={route === i.id ? 'page' : undefined}
                  sx={{ borderRadius: tablet ? 3 : 7, minHeight: 56, flexDirection: tablet ? 'column' : 'row', justifyContent: 'center', gap: tablet ? 0.25 : 0, py: 1 }}>
                  <ListItemIcon sx={{ minWidth: tablet ? 0 : 40, justifyContent: 'center', color: 'inherit' }}>{i.icon}</ListItemIcon>
                  <ListItemText primary={i.label} slotProps={{ primary: { variant: tablet ? 'caption' : 'body1', sx: { fontWeight: 700, textAlign: tablet ? 'center' : 'left' } } }} sx={{ flex: 'none' }} />
                </ListItemButton>
              ))}
            </Box>
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

function PublicRoutes({ onLogin, scheme, onToggleScheme }: { onLogin: (u: User) => void; scheme: Scheme; onToggleScheme: () => void }) {
  const hash = usePath();
  if (hash === '#/estimation') return <Estimate scheme={scheme} onToggleScheme={onToggleScheme} />;
  if (hash === '#/inscription') return <Register onLogin={onLogin} scheme={scheme} onToggleScheme={onToggleScheme} />;
  return <Login onLogin={onLogin} scheme={scheme} onToggleScheme={onToggleScheme} />;
}

export function App() {
  const [user, setUser] = useState<User | null>(currentSession()?.user ?? null);
  const [message, setMessage] = useState<string | null>(null);
  const [scheme, setScheme] = useState<Scheme>(initialScheme);
  const theme = useMemo(() => buildTheme(scheme), [scheme]);
  useEffect(() => { applyScheme(scheme, tokens[scheme].background); }, [scheme]);
  const toggle = useCallback(() => setScheme((s) => { const next = s === 'dark' ? 'light' : 'dark'; rememberScheme(next); return next; }), []);
  const notify = useCallback((m: string) => setMessage(m), []);
  useEffect(() => { if (!currentSession()) setUser(null); });

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {user ? (
        <Provider user={user} notify={notify}>
          <Shell user={user} scheme={scheme} onToggleScheme={toggle} onLogout={() => { setSession(null); setUser(null); navigate(''); }} />
        </Provider>
      ) : (
        <PublicRoutes onLogin={setUser} scheme={scheme} onToggleScheme={toggle} />
      )}
      <Snackbar open={message !== null} autoHideDuration={5000} onClose={() => setMessage(null)} message={message} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} sx={{ bottom: { xs: 88, sm: 24 }, pointerEvents: 'none' }} />
    </ThemeProvider>
  );
}
