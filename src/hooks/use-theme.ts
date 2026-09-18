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

/** The scheme a subtree renders in, for components that pick brand assets by scheme. */
export function useThemeScheme(): 'light' | 'dark' {
  const forced = use(ThemeSchemeContext);
  const scheme = useColorScheme();
  return forced ?? (scheme === 'dark' ? 'dark' : 'light');
}

export function useTheme() {
  return Colors[useThemeScheme()];
}
