import type { SessionIntervalKind } from '@/features/sessions/types/session-types';
import { INTERVAL_LABELS, INTERVAL_SHORT_LABELS } from '@/lib/format';

import type { IconName } from './icon';

type Theme = {
  hot: string;
  cold: string;
  rest: string;
  textOnAccent: string;
  restInk: string;
};

const ICONS: Record<SessionIntervalKind, IconName> = {
  heat: 'flame',
  cold: 'snowflake',
  rest: 'clock',
};

/**
 * One place where an activity kind becomes colour, icon and copy. Break is
 * built from the indigo family so it reads as neither hot nor cold.
 */
export function intervalMeta(kind: SessionIntervalKind, theme: Theme) {
  return {
    label: INTERVAL_LABELS[kind],
    shortLabel: INTERVAL_SHORT_LABELS[kind],
    icon: ICONS[kind],
    fill: kind === 'heat' ? theme.hot : kind === 'cold' ? theme.cold : theme.rest,
    ink: kind === 'rest' ? theme.restInk : theme.textOnAccent,
  };
}
