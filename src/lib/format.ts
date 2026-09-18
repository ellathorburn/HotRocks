import type { SessionIntervalKind } from '@/features/sessions/types/session-types';

export type TemperatureUnit = 'celsius' | 'fahrenheit';

export const INTERVAL_LABELS: Record<SessionIntervalKind, string> = {
  heat: 'Sauna',
  cold: 'Cold plunge',
  rest: 'Break',
};

export const INTERVAL_SHORT_LABELS: Record<SessionIntervalKind, string> = {
  heat: 'Sauna',
  cold: 'Plunge',
  rest: 'Break',
};

/**
 * Durations display in steps of 30 seconds, then whole minutes, rounded to
 * the nearest step: 30–44 s read as 30 seconds, 45–89 s as 1 minute. Storage
 * keeps exact seconds.
 */
function durationStep(totalSeconds: number): { value: number; unit: 'sec' | 'min' } {
  const seconds = Math.max(0, totalSeconds);
  if (seconds > 0 && seconds < 45) return { value: 30, unit: 'sec' };
  return { value: Math.round(seconds / 60), unit: 'min' };
}

/** Entry durations and per-kind totals: "30 sec", "15 min". */
export function formatStepDuration(totalSeconds: number): string {
  const { value, unit } = durationStep(totalSeconds);
  return `${value} ${unit}`;
}

/** Compact form for tight spaces such as the timeline strip: 30″, 2′. */
export function formatStepDurationCompact(totalSeconds: number): string {
  const { value, unit } = durationStep(totalSeconds);
  return `${value}${unit === 'sec' ? '″' : '′'}`;
}

/**
 * The one format for any span of time outside the live timer: the step format
 * under an hour ("30 sec", "48 min"), then hours and minutes ("1 h 21 min"),
 * then whole hours from ten hours ("146 h"). Never a clock-like "28:00".
 */
export function formatTotalDuration(totalSeconds: number): string {
  const minutes = Math.round(Math.max(0, totalSeconds) / 60);
  if (minutes < 60) return formatStepDuration(totalSeconds);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 || hours >= 10 ? `${hours} h` : `${hours} h ${remainder} min`;
}

/** Only the live timer shows a clock face. */
export function formatTimerClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

/** "2 saunas · 1 plunge · 1 break", the shape of a visit in words. */
export function describeComposition(counts: {
  heatIntervalCount: number;
  coldIntervalCount: number;
  restIntervalCount: number;
}): string {
  const parts = [
    plural(counts.heatIntervalCount, 'sauna', 'saunas'),
    plural(counts.coldIntervalCount, 'plunge', 'plunges'),
    plural(counts.restIntervalCount, 'break', 'breaks'),
  ].filter((part): part is string => part !== null);
  return parts.join(' · ');
}

/** One timeline entry in words: "Sauna · 15 min · 90°C". */
export function describeInterval(
  interval: { kind: SessionIntervalKind; durationSeconds: number; temperatureCTenths: number | null },
  unit: TemperatureUnit,
): string {
  const parts = [formatStepDuration(interval.durationSeconds)];
  if (interval.temperatureCTenths !== null) {
    parts.push(formatTemperature(interval.temperatureCTenths, unit));
  }
  return parts.join(' · ');
}

export function temperatureUnitSymbol(unit: TemperatureUnit): string {
  return unit === 'fahrenheit' ? '°F' : '°C';
}

/** Canonical tenths of a degree Celsius shown in the account's unit. */
export function toDisplayTemperature(temperatureCTenths: number, unit: TemperatureUnit): number {
  const celsius = temperatureCTenths / 10;
  return Math.round(unit === 'fahrenheit' ? celsius * 9 / 5 + 32 : celsius);
}

/** A temperature typed or tapped in the account's unit, stored canonically. */
export function toTemperatureCTenths(value: number, unit: TemperatureUnit): number {
  const celsius = unit === 'fahrenheit' ? (value - 32) * 5 / 9 : value;
  return Math.round(celsius * 10);
}

export function formatTemperature(temperatureCTenths: number, unit: TemperatureUnit): string {
  return `${toDisplayTemperature(temperatureCTenths, unit)}${temperatureUnitSymbol(unit)}`;
}

/** "1 week", "3 weeks". */
export function formatCount(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * A session's title: its venue, or its day when none was set — "Monday's
 * session" within the last week, "Session on 12 Sept" before that, since
 * weekday names repeat.
 */
export function formatSessionTitle(
  venue: string | null,
  startedAt: string,
  timeZone: string,
  now = new Date(),
): string {
  if (venue?.trim()) return venue;
  const date = new Date(startedAt);
  const days = (now.getTime() - date.getTime()) / 86_400_000;
  if (days >= 0 && days < 6) {
    const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'long', timeZone }).format(date);
    return `${weekday}’s session`;
  }
  const day = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', timeZone }).format(date);
  return `Session on ${day}`;
}

/** Home and detail dates read as "Tuesday, 06:40". */
export function formatSessionDate(startedAt: string, timeZone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).format(new Date(startedAt));
}

/** Venue meta dates: "Tuesday" this week, otherwise a short date. */
export function formatRelativeDay(isoDate: string, timeZone: string, now = new Date()): string {
  const date = new Date(isoDate);
  const days = (now.getTime() - date.getTime()) / 86_400_000;
  return days >= 0 && days < 7
    ? new Intl.DateTimeFormat(undefined, { weekday: 'long', timeZone }).format(date)
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone }).format(date);
}

function plural(count: number, one: string, many: string): string | null {
  if (count <= 0) return null;
  return `${count} ${count === 1 ? one : many}`;
}
