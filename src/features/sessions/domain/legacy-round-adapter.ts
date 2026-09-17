import type { Round } from './session';
import {
  sessionIntervalSchema,
  type SessionInterval,
} from './session-timeline';

/**
 * Temporary boundary for the existing round-based screens. Remove this when
 * those screens write timeline intervals directly.
 */
export function legacyRoundsToIntervals(rounds: Round[]): SessionInterval[] {
  return rounds.flatMap((round) =>
    round.parts.map((part) => sessionIntervalSchema.parse(part)),
  );
}
