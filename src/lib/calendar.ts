const dayFormatterCache = new Map<string, Intl.DateTimeFormat>();

function dayFormatter(timeZone: string): Intl.DateTimeFormat {
  const existing = dayFormatterCache.get(timeZone);
  if (existing) return existing;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  dayFormatterCache.set(timeZone, formatter);
  return formatter;
}

/** Returns YYYY-MM-DD for an instant in the requested IANA timezone. */
export function calendarDayKey(value: Date, timeZone: string): string {
  const parts = dayFormatter(timeZone).formatToParts(value);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) throw new Error('Could not calculate calendar day.');
  return `${year}-${month}-${day}`;
}

/** Monday-based week identifier for an instant in the requested timezone. */
export function calendarWeekKey(value: Date, timeZone: string): string {
  const localDay = dateFromDayKey(calendarDayKey(value, timeZone));
  const day = localDay.getUTCDay() || 7;
  localDay.setUTCDate(localDay.getUTCDate() - day + 1);
  return dayKeyFromUtcDate(localDay);
}

export function calendarMonthKey(value: Date, timeZone: string): string {
  return calendarDayKey(value, timeZone).slice(0, 7);
}

/** Oldest-to-newest local calendar day keys, including the day containing `end`. */
export function recentCalendarDayKeys(end: Date, count: number, timeZone: string): string[] {
  const finalDay = dateFromDayKey(calendarDayKey(end, timeZone));
  return Array.from({ length: count }, (_, index) => {
    const day = new Date(finalDay);
    day.setUTCDate(finalDay.getUTCDate() - count + index + 1);
    return dayKeyFromUtcDate(day);
  });
}

function dateFromDayKey(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function dayKeyFromUtcDate(value: Date): string {
  return [
    value.getUTCFullYear(),
    String(value.getUTCMonth() + 1).padStart(2, '0'),
    String(value.getUTCDate()).padStart(2, '0'),
  ].join('-');
}
