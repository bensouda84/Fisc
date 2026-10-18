import '@fontsource/mulish/400.css';
import '@fontsource/mulish/700.css';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';
import RemoveCircleOutlineOutlinedIcon from '@mui/icons-material/RemoveCircleOutlineOutlined';
import AssignmentIcon from '@mui/icons-material/Assignment';
import InsightsIcon from '@mui/icons-material/Insights';
import TuneIcon from '@mui/icons-material/Tune';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { createRoot } from 'react-dom/client';
import { CHIPS, applyTokens, dark, initialScheme, light } from './tokens.ts';

const scheme = initialScheme();
const t = scheme === 'dark' ? dark : light;
applyTokens(t, scheme);
const theme = createTheme({
  palette: { mode: scheme, primary: { main: t.primary, contrastText: t.onPrimary }, background: { default: t.background, paper: t.surface }, text: { primary: t.onSurface } },
  typography: { fontFamily: 'Mulish, sans-serif', button: { textTransform: 'none', fontWeight: 700 } },
});
const ICONS = { CALCULATED: <CheckCircleIcon />, NOT_COMPUTABLE: <BlockIcon />, NULL: <RemoveCircleOutlineOutlinedIcon />, PARTIAL: <HourglassTopIcon /> };

function App() {
  return (
    <ThemeProvider theme={theme}>
      <main style={{ fontFamily: 'Mulish, sans-serif', padding: 16, maxWidth: 480 }}>
        <h1>Essai MUI</h1>
        <ul style={{ listStyle: 'none', padding: 0, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {CHIPS.map((c) => (
            <li key={c.id} data-chip={c.id}>
              <Chip icon={ICONS[c.id]} label={c.label} sx={{ bgcolor: t[c.bg], color: t[c.fg], fontWeight: 700, height: 32, '& .MuiChip-icon': { color: t[c.fg] } }} />
            </li>
          ))}
        </ul>
        <TextField label="Bénéfice imposable (F CFA)" fullWidth />
        <p><Button variant="contained" sx={{ minHeight: 48, borderRadius: 5 }}>Continuer</Button></p>
        <nav aria-label="Navigation principale" style={{ position: 'fixed', bottom: 0, left: 0, right: 0 }}>
          <BottomNavigation showLabels value={0}>
            <BottomNavigationAction label="Diagnostic" icon={<AssignmentIcon />} />
            <BottomNavigationAction label="Résultat" icon={<InsightsIcon />} />
            <BottomNavigationAction label="Simulation" icon={<TuneIcon />} />
          </BottomNavigation>
        </nav>
      </main>
    </ThemeProvider>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
