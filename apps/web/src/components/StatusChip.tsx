import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutlineOutlined';
import Chip from '@mui/material/Chip';
import { LEVER_STATE_LABEL_FR } from '@fisc/engine';
import type { LeverState } from '@fisc/schemas';
import { tokens } from '../theme.ts';

export type ChipKind = LeverState | 'PARTIAL';

const LABEL: Record<ChipKind, string> = { ...LEVER_STATE_LABEL_FR, PARTIAL: 'Partielle' };
const ICON = {
  CALCULATED: <CheckCircleIcon />,
  NOT_COMPUTABLE: <BlockIcon />,
  NULL: <RemoveCircleOutlineIcon />,
  PARTIAL: <HourglassTopIcon />,
} as const;

const t = tokens.light;
// Le sens passe par l'icône et le texte, jamais par la couleur seule.
const COLORS: Record<ChipKind, { bg: string; fg: string }> = {
  CALCULATED: { bg: t.primaryContainer, fg: t.onPrimaryContainer },
  NOT_COMPUTABLE: { bg: t.errorContainer, fg: t.onErrorContainer },
  NULL: { bg: t.secondaryContainer, fg: t.onSecondaryContainer },
  PARTIAL: { bg: t.tertiaryContainer, fg: t.onTertiaryContainer },
};

export function StatusChip({ kind }: { kind: ChipKind }) {
  const c = COLORS[kind];
  return (
    <Chip
      icon={ICON[kind]}
      label={LABEL[kind]}
      sx={{
        bgcolor: c.bg, color: c.fg, fontWeight: 700, borderRadius: 2, height: 32,
        '& .MuiChip-icon': { color: c.fg },
      }}
    />
  );
}
