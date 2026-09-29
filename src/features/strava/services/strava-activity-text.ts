import type { SessionTimelineTotals } from '@/features/sessions/types/session-types';
import {
  describeComposition,
  formatTemperature,
  formatTotalDuration,
  type TemperatureUnit,
} from '@/lib/format';

/**
 * Turns a session into the name and description Strava shows.
 *
 * `profiles.strava_description_template` predates the timeline cutover and
 * still refers to `{rounds}`, so it is deliberately not used. Sessions are
 * described directly here, where the wording is covered by tests.
 */

export type StravaActivityText = {
  name: string;
  description: string;
};

/** Strava's sport type for a session. It has no sauna type, so this is the closest. */
export const DEFAULT_STRAVA_SPORT_TYPE = 'Workout';

/** Strava truncates a longer name, so it is kept short deliberately. */
const MAX_NAME_LENGTH = 255;

export function buildStravaActivityText({
  venueName,
  totals,
  note,
  temperatureUnit,
}: {
  venueName: string | null;
  totals: SessionTimelineTotals;
  note: string | null;
  temperatureUnit: TemperatureUnit;
}): StravaActivityText {
  const activity = totals.coldSeconds > 0 && totals.heatSeconds > 0
    ? 'Sauna & cold plunge'
    : totals.coldSeconds > 0
      ? 'Cold plunge'
      : 'Sauna';
  const name = (venueName ? `${activity} at ${venueName}` : activity).slice(0, MAX_NAME_LENGTH);

  const lines: string[] = [];
  const composition = describeComposition(totals);
  if (composition) lines.push(composition);

  const totalsLine = [
    totals.heatSeconds > 0 ? `Sauna ${formatTotalDuration(totals.heatSeconds)}` : null,
    totals.coldSeconds > 0 ? `Plunge ${formatTotalDuration(totals.coldSeconds)}` : null,
    totals.restSeconds > 0 ? `Break ${formatTotalDuration(totals.restSeconds)}` : null,
  ].filter(Boolean).join(' · ');
  if (totalsLine) lines.push(totalsLine);

  const temperatureLine = [
    totals.peakHeatCTenths !== null
      ? `Peak sauna ${formatTemperature(totals.peakHeatCTenths, temperatureUnit)}`
      : null,
    totals.coldestColdCTenths !== null
      ? `Coldest plunge ${formatTemperature(totals.coldestColdCTenths, temperatureUnit)}`
      : null,
  ].filter(Boolean).join(' · ');
  if (temperatureLine) lines.push(temperatureLine);

  const trimmedNote = note?.trim();
  if (trimmedNote) lines.push('', trimmedNote);

  return { name, description: lines.join('\n') };
}
