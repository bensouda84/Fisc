// Remplace brand.ts dans la démonstration : les logos sont incorporés au fichier (une seule page, sans fichiers annexes).
import dark from './assets/logo-dark.png?inline';
import light from './assets/logo-light.png?inline';

export const LOGO = { light, dark } as const;
