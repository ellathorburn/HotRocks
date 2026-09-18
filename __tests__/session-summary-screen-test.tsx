import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

const mockReplace = jest.fn();
const mockSaveDraft = jest.fn<() => Promise<string>>().mockResolvedValue('session-1');

const draft = {
  schemaVersion: 2 as const,
  intervals: [
    { id: 'heat-1', kind: 'heat' as const, durationSeconds: 900, temperatureCTenths: 900 },
    { id: 'rest-1', kind: 'rest' as const, durationSeconds: 300, temperatureCTenths: null },
  ],
  venueName: 'Löyly Kallio',
  rating: null,
  note: null,
  startedAt: '2026-09-17T12:00:00.000Z',
  elapsedSeconds: 1500,
  entryMethod: 'manual' as const,
};

jest.mock('expo-router', () => ({
  router: { replace: mockReplace, push: jest.fn() },
  useLocalSearchParams: () => ({ draftId: 'draft-1' }),
}));

jest.mock('drizzle-orm/expo-sqlite', () => ({
  useLiveQuery: () => ({ data: [{ payloadJson: JSON.stringify(draft) }], updatedAt: 1 }),
}));

const mockQuery = {
  from: jest.fn(() => mockQuery),
  where: jest.fn(() => mockQuery),
  limit: jest.fn(() => mockQuery),
};
jest.mock('@/services/database/client', () => ({
  database: { select: jest.fn(() => mockQuery) },
}));

jest.mock('@/features/auth/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    profile: { timezone_name: 'Africa/Johannesburg', temperature_unit: 'celsius' },
  }),
}));

jest.mock('@/constants/theme', () => ({
  displayText: (fontSize: number) => ({ fontSize, lineHeight: fontSize }),
  Rubik: { bold: 'Rubik', medium: 'Rubik', regular: 'Rubik', semibold: 'Rubik' },
  ScreenGutter: 20,
  Type: { body: 16, small: 14, subheading: 18, heading: 24, label: 12 },
}));

jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    background: '#fff',
    card: '#fff',
    cedar: '#900',
    cold: '#00f',
    coldInk: '#00a',
    hot: '#f00',
    rest: '#505081',
    restInk: '#fff',
    text: '#000',
    textSecondary: '#555',
    textOnAccent: '#000',
  }),
}));

jest.mock('@/features/sessions/services/session-service', () => ({
  sessionService: { saveDraft: mockSaveDraft },
}));

jest.mock('@/components/nav-bar', () => {
  const { Text } = require('react-native');
  return { NavBar: ({ title }: { title: string }) => <Text>{title}</Text> };
});

jest.mock('@/components/ds', () => {
  const { Text, View } = require('react-native');
  return {
    Button: ({ children, onPress, disabled }: { children: ReactNode; onPress?: () => void; disabled?: boolean }) => (
      <Text accessibilityRole="button" accessibilityState={{ disabled }} onPress={disabled ? undefined : onPress}>{children}</Text>
    ),
    Card: ({ children }: { children: ReactNode }) => <View>{children}</View>,
    Icon: () => null,
    Input: () => null,
    Label: ({ children }: { children: ReactNode }) => <Text>{children}</Text>,
    ListRow: ({ title }: { title: string }) => <Text>{title}</Text>,
    Rating: () => null,
    TimelineList: ({ label }: { label?: string }) => <Text>{label}</Text>,
    TimelineStrip: () => null,
  };
});

const SessionSummaryScreen = require('../src/app/session/summary').default;

describe('session summary screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('shows the draft totals and composition from the timeline', async () => {
    const screen = await render(<SessionSummaryScreen />);

    expect(screen.getByText('25 min')).toBeTruthy();
    expect(screen.getByText('Sauna 15 min')).toBeTruthy();
    expect(screen.getByText('Break 5 min')).toBeTruthy();
    expect(screen.getByText('1 sauna · 1 break')).toBeTruthy();
    expect(screen.getByText('Löyly Kallio')).toBeTruthy();
  });

  test('saves the draft as a session and opens it', async () => {
    const screen = await render(<SessionSummaryScreen />);
    fireEvent.press(screen.getByText('Save session'));

    await waitFor(() => expect(mockSaveDraft).toHaveBeenCalledTimes(1));
    expect(mockSaveDraft).toHaveBeenCalledWith(expect.objectContaining({
      draftId: 'draft-1',
      userId: 'user-1',
      timezoneName: 'Africa/Johannesburg',
    }));
    expect(mockReplace).toHaveBeenCalledWith('/session/session-1');
  });
});
