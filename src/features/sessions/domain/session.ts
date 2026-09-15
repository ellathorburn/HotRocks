import { z } from 'zod';

export const roundPartKindSchema = z.enum(['heat', 'cold']);
export type RoundPartKind = z.infer<typeof roundPartKindSchema>;

export const roundPartSchema = z.object({
  id: z.string().min(1),
  kind: roundPartKindSchema,
  durationSeconds: z.int().positive(),
  temperatureCTenths: z.int().min(-500).max(2000).nullable(),
});

export const roundSchema = z
  .object({
    id: z.string().min(1),
    parts: z.array(roundPartSchema).min(1).max(2),
  })
  .superRefine((round, context) => {
    if (new Set(round.parts.map((part) => part.kind)).size !== round.parts.length) {
      context.addIssue({
        code: 'custom',
        message: 'A round can contain at most one heat and one cold part.',
        path: ['parts'],
      });
    }
  });

export const sessionDraftSchema = z.object({
  id: z.string().min(1),
  startedAt: z.iso.datetime({ offset: true }),
  elapsedSeconds: z.int().positive(),
  venueName: z.string().trim().min(1).max(160).nullable(),
  rating: z.int().min(1).max(5).nullable(),
  note: z.string().max(4000).nullable(),
  rounds: z.array(roundSchema).min(1),
});

export type RoundPart = z.infer<typeof roundPartSchema>;
export type Round = z.infer<typeof roundSchema>;
export type SessionDraft = z.infer<typeof sessionDraftSchema>;

export type SessionTotals = {
  elapsedSeconds: number;
  activeSeconds: number;
  heatSeconds: number;
  coldSeconds: number;
  roundCount: number;
  peakHeatCTenths: number | null;
  coldestColdCTenths: number | null;
};

export function calculateSessionTotals(session: SessionDraft): SessionTotals {
  const parts = session.rounds.flatMap((round) => round.parts);
  const heatParts = parts.filter((part) => part.kind === 'heat');
  const coldParts = parts.filter((part) => part.kind === 'cold');
  const heatSeconds = sumDurations(heatParts);
  const coldSeconds = sumDurations(coldParts);

  if (session.elapsedSeconds < heatSeconds + coldSeconds) {
    throw new Error('Session elapsed time cannot be shorter than active time.');
  }

  return {
    elapsedSeconds: session.elapsedSeconds,
    activeSeconds: heatSeconds + coldSeconds,
    heatSeconds,
    coldSeconds,
    roundCount: session.rounds.length,
    peakHeatCTenths: temperatureExtreme(heatParts, Math.max),
    coldestColdCTenths: temperatureExtreme(coldParts, Math.min),
  };
}

function sumDurations(parts: RoundPart[]): number {
  return parts.reduce((total, part) => total + part.durationSeconds, 0);
}

function temperatureExtreme(
  parts: RoundPart[],
  compare: (...values: number[]) => number,
): number | null {
  const temperatures = parts.flatMap((part) =>
    part.temperatureCTenths === null ? [] : [part.temperatureCTenths],
  );

  return temperatures.length === 0 ? null : compare(...temperatures);
}
