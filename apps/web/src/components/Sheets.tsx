import CloseIcon from '@mui/icons-material/Close';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { CONCEPT_TITLE_FR, formatDate } from '@fisc/engine';
import { RULE_STATUS_LABEL_FR, type RuleConcept, type SourceRef } from '@fisc/schemas';
import type { Role, WireRule } from '../wire.ts';

function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <Drawer anchor="bottom" open={open} onClose={onClose} slotProps={{ paper: { role: 'dialog', 'aria-labelledby': 'sheet-title', sx: { maxHeight: '85vh', borderTopLeftRadius: 28, borderTopRightRadius: 28, mx: 'auto', width: '100%', maxWidth: 640 } } as never }}>
      <Box sx={{ p: 3, pb: 4 }}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography id="sheet-title" variant="h4" component="h2">{title}</Typography>
          <IconButton aria-label="Fermer" onClick={onClose}><CloseIcon /></IconButton>
        </Stack>
        {children}
      </Box>
    </Drawer>
  );
}

function Fact({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography component="dt" variant="caption" color="text.secondary">{term}</Typography>
      <Typography component="dd" variant="body1" sx={{ m: 0 }}>{children}</Typography>
    </Box>
  );
}

export function SourcesSheet({ open, onClose, title, sources }: { open: boolean; onClose: () => void; title: string; sources: SourceRef[] }) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {sources.length === 0 ? (
        <Typography>Aucun texte n’est rattaché à ce montant : il n’est pas calculé.</Typography>
      ) : (
        <Stack spacing={3}>
          {sources.map((s) => (
            <Box key={s.ruleId} component="dl" sx={{ m: 0, display: 'grid', gap: 1.5 }}>
              <Fact term="Texte">{s.label}</Fact>
              <Fact term="Article">{s.article}</Fact>
              <Fact term="Page">{s.page}</Fact>
              <Fact term="Référence">{s.source}</Fact>
              <Fact term="Statut">{RULE_STATUS_LABEL_FR[s.status]}{s.kind === 'TEST' ? ' — règle de TEST' : ''}</Fact>
              <Fact term="Date d’effet">{formatDate(s.effectiveDate)}</Fact>
              <Fact term="Version du registre">{s.registryVersion}</Fact>
            </Box>
          ))}
        </Stack>
      )}
    </Sheet>
  );
}

export function WhySheet({ open, onClose, why, concepts, rules, role }: {
  open: boolean; onClose: () => void; why: string; concepts: RuleConcept[]; rules: WireRule[]; role: Role;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Pourquoi cette question ?">
      <Typography sx={{ mb: 2 }}>{why}</Typography>
      <Stack spacing={2}>
        {concepts.map((concept) => {
          const matches = rules.filter((r) => r.concept === concept);
          const best = matches.find((r) => r.status === 'CONFIRMED') ?? (role === 'client' ? undefined : matches[0]);
          return (
            <Box key={concept} component="dl" sx={{ m: 0, display: 'grid', gap: 1 }}>
              <Fact term="Règle concernée">{CONCEPT_TITLE_FR[concept]}</Fact>
              {best && best.article && best.page ? (
                <>
                  <Fact term="Article et page">{best.article}, page {best.page}</Fact>
                  <Fact term="Statut">{RULE_STATUS_LABEL_FR[best.status]}{best.kind === 'TEST' ? ' — règle de TEST' : ''}</Fact>
                  {best.effectiveDate && <Fact term="Date d’effet">{formatDate(best.effectiveDate)}</Fact>}
                </>
              ) : best?.sourceToObtain ? (
                <Fact term="Source à obtenir">{best.sourceToObtain}</Fact>
              ) : (
                <Fact term="Texte">Le texte applicable est en cours de confirmation. Aucun chiffre n’est affiché tant qu’il n’est pas confirmé.</Fact>
              )}
            </Box>
          );
        })}
        {concepts.length === 0 && <Typography color="text.secondary">Cette question ne dépend d’aucune règle fiscale : c’est un montant que vous connaissez.</Typography>}
      </Stack>
    </Sheet>
  );
}
