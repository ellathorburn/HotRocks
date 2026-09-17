import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

const mockReplace = jest.fn();
const mockSaveSession = jest.fn<() => Promise<string>>().mockResolvedValue('session-1');
const mockDeleteSessionDraft = jest.fn();

const draft = {
  schemaVersion: 1 as const,
  rounds: [{
    id: 'round-1',
    parts: [{ id: 'part-1', kind: 'heat' as const, durationSeconds: 900, temperatureCTenths: 900 }],
  }],
  venueName: null,
  rating: null,
  note: null,
  startedAt: '2026-09-16T12:00:00.000Z',
  elapsedSeconds: 900,
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
    profile: { timezone_name: 'Africa/Johannesburg' },
  }),
}));

jest.mock('@/constants/theme', () => ({
  displayText: (fontSize: number) => ({ fontSize, lineHeight: fontSize }),
  Rubik: { bold: 'Rubik', medium: 'Rubik' },
  ScreenGutter: 20,
}));

jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    background: '#fff',
    card: '#fff',
    cedar: '#900',
    cold: '#00f',
    hot: '#f00',
    text: '#000',
    textSecondary: '#555',
  }),
}));

jest.mock('@/features/sessions/data/session-repository', () => ({
  saveSession: mockSaveSession,
}));

jest.mock('@/features/sessions/data/session-draft-repository', () => {
  const actual = jest.requireActual('@/features/sessions/data/session-draft-repository') as object;
  return {
    ...actual,
    deleteSessionDraft: mockDeleteSessionDraft,
    updateSessionDraft: jest.fn(),
  };
});

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
    RoundStrip: () => null,
  };
});

const SessionSummaryScreen = require('../src/app/session/summary').default;

describe('session summary save action', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('saves, removes the draft, and returns home', async () => {
    const screen = await render(<SessionSummaryScreen />);
    fireEvent.press(screen.getByText('Save session'));

    await waitFor(() => expect(mockSaveSession).toHaveBeenCalledTimes(1));
    expect(mockDeleteSessionDraft).toHaveBeenCalledWith('draft-1', 'user-1');
    expect(mockReplace).toHaveBeenCalledWith('/');
  });
});
