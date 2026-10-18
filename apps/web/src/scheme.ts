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
  document.documentElement.dataset.theme = s;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', background);
}
