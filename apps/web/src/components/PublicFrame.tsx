import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import IconButton from '@mui/material/IconButton';
import type { ReactNode } from 'react';
import { LOGO } from '../brand.ts';
import { focusMain } from '../router.tsx';
import { DemoBanner } from './DemoBanner.tsx';
import type { Scheme } from '../scheme.ts';

/** Cadre des écrans sans compte : connexion, estimation express, inscription. Le titre h1 est celui de chaque page. */
export function PublicFrame({ scheme, onToggleScheme, wide = false, children }: { scheme: Scheme; onToggleScheme: () => void; wide?: boolean; children: ReactNode }) {
  const dark = scheme === 'dark';
  return (
    <>
    <DemoBanner />
    <Box component="main" id="main" tabIndex={-1} sx={{ position: 'relative', minHeight: '100dvh', display: 'grid', placeItems: 'start center', p: 2, pt: { xs: 8, sm: 10 }, outline: 'none' }}>
      <Box component="a" href="#main" onClick={focusMain} sx={{ position: 'absolute', left: -9999, '&:focus': { left: 8, top: 8, zIndex: 2000, bgcolor: 'background.paper', p: 1.5, borderRadius: 2 } }}>Aller au contenu</Box>
      <IconButton aria-label={dark ? 'Passer au thème clair' : 'Passer au thème sombre'} onClick={onToggleScheme} data-testid="scheme-toggle" sx={{ position: 'absolute', top: 8, right: 8 }}>
        {dark ? <LightModeIcon /> : <DarkModeIcon />}
      </IconButton>
      <Box sx={{ width: '100%', maxWidth: wide ? 640 : 440 }}>
        <Box component="img" src={dark ? LOGO.dark : LOGO.light} alt="mesimpo" width={240} height={60} sx={{ height: 48, width: 'auto', maxWidth: '100%', display: 'block', mb: 2 }} />
        <Card>
          <CardContent sx={{ p: { xs: 2.5, sm: 4 } }}>{children}</CardContent>
        </Card>
      </Box>
    </Box>
    </>
  );
}
