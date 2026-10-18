import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutlineOutlined';
import Chip from '@mui/material/Chip';
import { useTheme } from '@mui/material/styles';
import { LEVER_STATE_LABEL_FR } from '@fisc/engine';
import type { LeverState } from '@fisc/schemas';
import { tokens, type Tokens } from '../theme.ts';

export type ChipKind = LeverState | 'PARTIAL';

const LABEL: Record<ChipKind, string> = { ...LEVER_STATE_LABEL_FR, PARTIAL: 'Partielle' };
const ICON = {
  CALCULATED: <CheckCircleIcon />,
  NOT_COMPUTABLE: <BlockIcon />,
  NULL: <RemoveCircleOutlineIcon />,
  PARTIAL: <HourglassTopIcon />,
} as const;

// Le sens passe par l'icône et le texte, jamais par la couleur seule.
const ROLES: Record<ChipKind, { bg: keyof Tokens; fg: keyof Tokens }> = {
  CALCULATED: { bg: 'primaryContainer', fg: 'onPrimaryContainer' },
  NOT_COMPUTABLE: { bg: 'errorContainer', fg: 'onErrorContainer' },
  NULL: { bg: 'secondaryContainer', fg: 'onSecondaryContainer' },
  PARTIAL: { bg: 'accentContainer', fg: 'onAccentContainer' }, // orange de la marque
};

export function StatusChip({ kind }: { kind: ChipKind }) {
  const t = tokens[useTheme().palette.mode];
  const c = { bg: t[ROLES[kind].bg], fg: t[ROLES[kind].fg] };
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
