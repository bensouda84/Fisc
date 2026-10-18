import { DEMO } from './flags.ts';

export type Scheme = 'light' | 'dark';
const KEY = 'fisc.theme';

/** Choix explicite mémorisé, sinon préférence du système. Le stockage peut être indisponible. */
export function initialScheme(): Scheme {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    /* stockage indisponible */
  }
  // Dans le lecteur d'artefacts, le thème choisi par la personne est posé sur la racine par l'hôte.
  const host = document.documentElement.dataset.theme;
  if (DEMO && (host === 'light' || host === 'dark')) return host;
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function rememberScheme(s: Scheme): void {
  try {
    localStorage.setItem(KEY, s);
  } catch {
    /* le choix vaut pour cette session seulement */
  }
}

/** Reflète le thème sur le document : couleur du navigateur et barre d'adresse mobile. */
export function applyScheme(s: Scheme, background: string): void {
  document.documentElement.style.colorScheme = s;
  if (!DEMO) document.documentElement.dataset.theme = s; // en démonstration, l'attribut appartient à l'hôte
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', background);
}
