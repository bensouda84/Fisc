import { argbFromHex, hexFromArgb, themeFromSourceColor, type Scheme } from '@material/material-color-utilities';

export const SOURCE = '#51606f';
export const ROLES = [
  'primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer', 'secondary', 'onSecondary',
  'secondaryContainer', 'onSecondaryContainer', 'tertiary', 'onTertiary', 'tertiaryContainer', 'onTertiaryContainer',
  'error', 'onError', 'errorContainer', 'onErrorContainer', 'background', 'onBackground', 'surface', 'onSurface',
  'surfaceVariant', 'onSurfaceVariant', 'outline', 'outlineVariant',
] as const;
export type Tokens = Record<(typeof ROLES)[number], string>;

const toTokens = (s: Scheme): Tokens => Object.fromEntries(ROLES.map((r) => [r, hexFromArgb(s[r])])) as Tokens;
const theme = themeFromSourceColor(argbFromHex(SOURCE));
export const light = toTokens(theme.schemes.light);
export const dark = toTokens(theme.schemes.dark);

const kebab = (s: string): string => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** Pose les rôles M3 en variables CSS --md-sys-color-* : Material Web les lit nativement. */
export function applyTokens(t: Tokens, scheme: 'light' | 'dark'): void {
  const root = document.documentElement;
  root.dataset.theme = scheme;
  root.style.colorScheme = scheme;
  for (const [k, v] of Object.entries(t)) root.style.setProperty(`--md-sys-color-${kebab(k)}`, v);
  root.style.setProperty('--md-ref-typeface-plain', 'Mulish, sans-serif');
  root.style.setProperty('--md-ref-typeface-brand', 'Mulish, sans-serif');
  // Niveaux de surface M3 absents du Scheme de material-color-utilities 0.4.0 : dérivés comme dans le thème MUI.
  const mix = (a: string, b: string, k: number): string => {
    const c = (h: string, i: number): number => Number.parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
    return `#${[0, 1, 2].map((i) => Math.round(c(a, i) * (1 - k) + c(b, i) * k).toString(16).padStart(2, '0')).join('')}`;
  };
  for (const [name, k] of [['surface-container-low', 0.04], ['surface-container', 0.08], ['surface-container-high', 0.11], ['surface-container-highest', 0.14]] as const) {
    root.style.setProperty(`--md-sys-color-${name}`, mix(t.surface, t.primary, k));
  }
  document.body.style.background = t.background;
  document.body.style.color = t.onBackground;
}

(globalThis as unknown as { __tokens: unknown }).__tokens = { light, dark };

export const initialScheme = (): 'light' | 'dark' => (new URLSearchParams(location.search).get('scheme') === 'dark' ? 'dark' : 'light');

export const CHIPS = [
  { id: 'CALCULATED', label: 'Calculée', bg: 'primaryContainer', fg: 'onPrimaryContainer', path: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-2 15-5-5 1.4-1.4L10 14.2l7.6-7.6L19 8l-9 9Z' },
  { id: 'NOT_COMPUTABLE', label: 'Non calculable', bg: 'errorContainer', fg: 'onErrorContainer', path: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM4 12a8 8 0 0 1 12.9-6.3L5.7 16.9A8 8 0 0 1 4 12Zm8 8a8 8 0 0 1-4.9-1.7L18.3 7.1A8 8 0 0 1 12 20Z' },
  { id: 'NULL', label: 'Nulle', bg: 'secondaryContainer', fg: 'onSecondaryContainer', path: 'M7 11v2h10v-2H7Zm5-9a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z' },
  { id: 'PARTIAL', label: 'Partielle', bg: 'tertiaryContainer', fg: 'onTertiaryContainer', path: 'M6 2v6l4 4-4 4v6h12v-6l-4-4 4-4V2H6Zm10 14.5V20H8v-3.5l4-4 4 4Z' },
] as const;
