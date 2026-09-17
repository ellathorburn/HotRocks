/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { createContext, use } from 'react';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/**
 * Pins a subtree to one scheme. The timer and share card are designed
 * dark-first and render dark regardless of the system setting.
 */
export const ThemeSchemeContext = createContext<'light' | 'dark' | null>(null);

export function useTheme() {
  const forced = use(ThemeSchemeContext);
  const scheme = useColorScheme();
  const theme = forced ?? (scheme === 'dark' ? 'dark' : 'light');

  return Colors[theme];
}
