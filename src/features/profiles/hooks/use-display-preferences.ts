import { useAuth } from '@/features/auth/auth-context';
import type { TemperatureUnit } from '@/lib/format';

export type DisplayPreferences = {
  userId: string;
  timeZone: string;
  temperatureUnit: TemperatureUnit;
};

/**
 * Account scope and presentation settings every session screen needs. Hooks
 * must be called unconditionally, so an empty userId stands in for signed out.
 */
export function useDisplayPreferences(): DisplayPreferences {
  const { profile, user } = useAuth();
  return {
    userId: user?.id ?? '',
    timeZone: profile?.timezone_name
      ?? Intl.DateTimeFormat().resolvedOptions().timeZone
      ?? 'UTC',
    temperatureUnit: profile?.temperature_unit === 'fahrenheit' ? 'fahrenheit' : 'celsius',
  };
}
