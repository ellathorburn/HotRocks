type SessionPartDisplay = {
  kind: 'heat' | 'cold';
  durationSeconds: number;
  temperatureCTenths: number | null;
};

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}

/** Week totals on Home: "1:29" from an hour up, "20m" below. */
export function formatHoursMinutes(totalSeconds: number): string {
  const minutes = Math.round(Math.max(0, totalSeconds) / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}` : `${minutes}m`;
}

export function formatTimerClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function describeSessionPart(part: SessionPartDisplay): string {
  const duration = part.durationSeconds % 60 === 0
    ? `${part.durationSeconds / 60} min`
    : `${Math.floor(part.durationSeconds / 60)}m ${part.durationSeconds % 60}s`;
  const temperature = part.temperatureCTenths === null ? '' : ` at ${part.temperatureCTenths / 10}°`;
  return `${part.kind === 'heat' ? 'Sauna' : 'Plunge'} ${duration}${temperature}`;
}
