import { argbFromHex, hexFromArgb, themeFromSourceColor, type Scheme } from '@material/material-color-utilities';
import { createTheme, type Theme } from '@mui/material/styles';

/** Couleur source : neutre par défaut, à remplacer par celle de MARABU (question ouverte Q3, ADR-0003). */
export const SOURCE_COLOR = '#51606f';

const ROLES = [
  'primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer',
  'secondary', 'onSecondary', 'secondaryContainer', 'onSecondaryContainer',
  'tertiary', 'onTertiary', 'tertiaryContainer', 'onTertiaryContainer',
  'error', 'onError', 'errorContainer', 'onErrorContainer',
  'background', 'onBackground', 'surface', 'onSurface', 'surfaceVariant', 'onSurfaceVariant',
  'outline', 'outlineVariant', 'inverseSurface', 'inverseOnSurface', 'inversePrimary',
] as const;

type Role = (typeof ROLES)[number];
export type Tokens = Record<Role, string>;

const toTokens = (scheme: Scheme): Tokens =>
  Object.fromEntries(ROLES.map((r) => [r, hexFromArgb(scheme[r])])) as Tokens;

const source = themeFromSourceColor(argbFromHex(SOURCE_COLOR));
export const tokens = { light: toTokens(source.schemes.light), dark: toTokens(source.schemes.dark) };

const mix = (a: string, b: string, t: number): string => {
  const c = (hex: string, i: number): number => Number.parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2].map((i) => Math.round(c(a, i) * (1 - t) + c(b, i) * t).toString(16).padStart(2, '0')).join('')}`;
};

/** Niveaux de surface M3 (tone-based) dérivés de surface et primary. */
export const surfaces = (t: Tokens) => ({
  low: mix(t.surface, t.primary, 0.04),
  container: mix(t.surface, t.primary, 0.08),
  high: mix(t.surface, t.primary, 0.11),
  highest: mix(t.surface, t.primary, 0.14),
});

export function buildTheme(scheme: 'light' | 'dark' = 'light'): Theme {
  const t = tokens[scheme];
  const s = surfaces(t);
  const focus = { outline: `3px solid ${t.primary}`, outlineOffset: 2 };
  return createTheme({
    breakpoints: { values: { xs: 0, sm: 600, md: 840, lg: 1200, xl: 1600 } },
    palette: {
      mode: scheme,
      primary: { main: t.primary, contrastText: t.onPrimary },
      secondary: { main: t.secondary, contrastText: t.onSecondary },
      error: { main: t.error, contrastText: t.onError },
      background: { default: t.background, paper: s.low },
      text: { primary: t.onSurface, secondary: t.onSurfaceVariant },
      divider: t.outlineVariant,
    },
    shape: { borderRadius: 16 },
    typography: {
      fontFamily: '"Mulish", system-ui, -apple-system, "Segoe UI", sans-serif',
      // Échelle M3 : display, headline, title, body, label.
      h1: { fontSize: '2.25rem', lineHeight: 1.22, fontWeight: 700 }, // display small
      h2: { fontSize: '1.75rem', lineHeight: 1.29, fontWeight: 700 }, // headline medium
      h3: { fontSize: '1.5rem', lineHeight: 1.33, fontWeight: 700 }, // headline small
      h4: { fontSize: '1.375rem', lineHeight: 1.27, fontWeight: 600 }, // title large
      h5: { fontSize: '1rem', lineHeight: 1.5, fontWeight: 700 }, // title medium
      h6: { fontSize: '0.875rem', lineHeight: 1.43, fontWeight: 700 }, // title small
      body1: { fontSize: '1rem', lineHeight: 1.5 },
      body2: { fontSize: '0.875rem', lineHeight: 1.43 },
      button: { fontSize: '0.875rem', fontWeight: 700, textTransform: 'none', letterSpacing: '0.01em' },
      caption: { fontSize: '0.75rem', lineHeight: 1.33 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ':root': Object.fromEntries(Object.entries(t).map(([k, v]) => [`--md-sys-color-${k}`, v])),
          body: { backgroundColor: t.background },
          '*:focus-visible': focus,
          '@media (prefers-reduced-motion: reduce)': {
            '*, *::before, *::after': { animationDuration: '0.01ms !important', animationIterationCount: '1 !important', transitionDuration: '0.01ms !important', scrollBehavior: 'auto !important' },
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: { root: { borderRadius: 20, minHeight: 48, paddingInline: 24 } },
      },
      MuiIconButton: { styleOverrides: { root: { width: 48, height: 48 } } },
      MuiCard: { defaultProps: { variant: 'outlined' }, styleOverrides: { root: { borderRadius: 16, backgroundColor: s.low, borderColor: t.outlineVariant } } },
      MuiTextField: { defaultProps: { variant: 'outlined' } },
      MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 12, minHeight: 56 }, notchedOutline: { borderColor: t.outline } } },
      MuiDrawer: { styleOverrides: { paper: { backgroundColor: s.container, borderRadius: 0 } } },
      MuiAlert: { styleOverrides: { root: { borderRadius: 12 } } },
    },
  });
}
