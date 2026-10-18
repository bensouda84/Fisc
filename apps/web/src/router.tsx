import Button, { type ButtonProps } from '@mui/material/Button';
import { useSyncExternalStore, type MouseEvent } from 'react';
import { DEMO } from './flags.ts';

/**
 * Routage par fragment (`#/diagnostic`). Dans la démonstration, le chemin reste en mémoire : une page publiée dans
 * un cadre isolé (iframe `srcdoc`) résout `#/…` par rapport à l'adresse de la page parente et naviguerait hors de la page.
 */
const listeners = new Set<() => void>();
let memory = '';

export const currentPath = (): string => (DEMO ? memory : window.location.hash);

export function navigate(path: string): void {
  if (DEMO) {
    memory = path;
    listeners.forEach((l) => l());
  } else {
    window.location.hash = path;
  }
}

function subscribe(listener: () => void): () => void {
  if (DEMO) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
}

export const usePath = (): string => useSyncExternalStore(subscribe, currentPath);

/** Lien-bouton : garde un vrai `href` (clic droit, nouvel onglet) mais navigue sans quitter la page. */
export function NavButton({ to, ...props }: { to: string } & Omit<ButtonProps<'a'>, 'component' | 'href'>) {
  return (
    <Button
      {...props}
      component="a"
      href={to}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        navigate(to);
        window.scrollTo(0, 0);
      }}
    />
  );
}

/** Lien d'évitement : met le focus sur le contenu sans modifier l'adresse. */
export function focusMain(e: MouseEvent): void {
  e.preventDefault();
  document.getElementById('main')?.focus();
}
