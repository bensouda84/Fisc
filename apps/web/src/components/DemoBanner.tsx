import Alert from '@mui/material/Alert';
import { DEMO } from '../flags.ts';

/** Bandeau permanent de la démonstration : règles de TEST, aucune donnée enregistrée. */
export function DemoBanner() {
  if (!DEMO) return null;
  return (
    <Alert severity="warning" icon={false} role="note" data-testid="demo-banner" sx={{ borderRadius: 0, justifyContent: 'center', py: 0.5, '& .MuiAlert-message': { textAlign: 'center' } }}>
      <strong>Démonstration</strong> : règles et montants fictifs (règles de TEST), rien n’est envoyé ni enregistré. Ne constitue pas un avis fiscal.
    </Alert>
  );
}
