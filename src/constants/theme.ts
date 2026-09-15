/**
 * HotRocks design tokens, ported from the HotRocks design system's token
 * CSS files. Hot against cold: a deep midnight blue base lit by ember
 * orange, ice for the plunge.
 */

import '@/global.css';

import { Platform } from 'react-native';

const palette = {
  midnight900: '#0F0E47',
  midnight800: '#272757',
  midnight700: '#3A3A6B',
  indigo600: '#505081',
  indigo400: '#8686AC',
  ember500: '#E35336',
  ember600: '#C8462C',
  ember100: '#F9DCD4',
  sand400: '#F4A460',
  sand500: '#E08C42',
  cedar700: '#A0522D',
  linen100: '#F5F5DC',
  linen050: '#FCFCF0',
  linen200: '#E7E7C9',
  ice400: '#7EA8C4',
  ice600: '#4E7E9C',
  ice100: '#DCE8F0',
} as const;

export const HeatRamp = ['#EDEDD2', '#F3DFBE', '#F4A460', '#E35336', '#A0522D'] as const;
export const ColdRamp = ['#EDEDD2', '#DCE8F0', '#A9C8DC', '#7EA8C4', '#4E7E9C'] as const;

export const Colors = {
  light: {
    text: palette.midnight900,
    textSecondary: palette.indigo600,
    textInverse: palette.linen100,
    textOnAccent: palette.midnight900,
    background: palette.linen100,
    backgroundElement: palette.linen050,
    backgroundSelected: palette.ember100,
    surfaceSunken: '#EFEFD4',
    surfaceInverse: palette.midnight900,
    border: palette.linen200,
    borderStrong: palette.indigo600,
    accent: palette.ember500,
    accentPressed: palette.ember600,
    accentTint: palette.ember100,
    sand: palette.sand400,
    cedar: palette.cedar700,
    hot: palette.ember500,
    cold: palette.ice400,
    coldInk: palette.ice600,
    iceTint: palette.ice100,
    card: palette.linen050,
    shadowCard: 'rgba(15,14,71,0.08)',
    scrim: 'rgba(15,14,71,0.45)',
  },
  dark: {
    text: palette.linen100,
    textSecondary: palette.indigo400,
    textInverse: palette.midnight900,
    textOnAccent: palette.midnight900,
    background: palette.midnight900,
    backgroundElement: palette.midnight800,
    backgroundSelected: '#3A2038',
    surfaceSunken: '#0A0932',
    surfaceInverse: palette.linen100,
    border: palette.indigo600,
    borderStrong: palette.indigo400,
    accent: palette.ember500,
    accentPressed: palette.ember600,
    accentTint: '#3A2038',
    sand: palette.sand400,
    cedar: palette.cedar700,
    hot: palette.ember500,
    cold: palette.ice400,
    coldInk: palette.ice400,
    iceTint: palette.ice100,
    card: palette.midnight800,
    shadowCard: 'transparent',
    scrim: 'rgba(0,0,0,0.55)',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/** 8px scale from the HotRocks tokens, kept alongside the legacy Spacing above. */
export const Space = {
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s5: 24,
  s6: 32,
  s7: 40,
  s8: 48,
  s9: 64,
} as const;

export const ScreenGutter = 20;
export const CardPadding = 16;
export const SectionGap = 24;
export const TapMin = 44;

export const Radius = {
  sm: 6,
  md: 10,
  lg: 16,
  full: 9999,
} as const;

export const Type = {
  displayLg: 64,
  display: 48,
  heading: 24,
  subheading: 18,
  body: 16,
  small: 14,
  label: 12,
} as const;

export const Tracking = {
  display: -0.4,
  label: 0.5,
} as const;

export const Rubik = {
  regular: 'Rubik_400Regular',
  medium: 'Rubik_500Medium',
  semibold: 'Rubik_600SemiBold',
  bold: 'Rubik_700Bold',
} as const;

export const Motion = {
  fast: 120,
  base: 200,
  sheet: 280,
  pressScale: 0.98,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
