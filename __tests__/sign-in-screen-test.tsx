import { AuthApiError } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ComponentProps, ReactNode } from 'react';
import type { TextInput } from 'react-native';

const mockSignInWithPassword = jest.fn<() => Promise<void>>();
const mockCreateAccountWithPassword = jest.fn<() => Promise<'authenticated' | 'confirmationRequired'>>();

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: mockPush, replace: mockReplace, back: jest.fn() },
}));

jest.mock('@/components/nav-bar', () => ({ NavBar: () => null }));

// Provider buttons render native Apple and SVG components; covered separately.
jest.mock('@/features/auth/components/social-auth-buttons', () => ({ SocialAuthButtons: () => null }));

jest.mock('@/features/auth/auth-context', () => ({
  useAuth: () => ({ isConfigured: true }),
}));

jest.mock('@/features/auth/auth-service', () => ({
  createAccountWithPassword: mockCreateAccountWithPassword,
  signInWithApple: jest.fn(),
  signInWithGoogle: jest.fn(),
  signInWithPassword: mockSignInWithPassword,
}));

jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    accent: '#f60',
    background: '#fff',
    border: '#ccc',
    cedar: '#900',
    text: '#000',
    textSecondary: '#555',
  }),
}));

jest.mock('@/constants/theme', () => ({
  Rubik: { bold: 'Rubik', medium: 'Rubik', regular: 'Rubik', semibold: 'Rubik' },
  ScreenGutter: 20,
  Type: { body: 16, small: 14, subheading: 18 },
}));

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: ({ children }: { children: ReactNode }) => <View>{children}</View> };
});

jest.mock('@/components/ds', () => {
  const React = require('react') as typeof import('react');
  const { Pressable, Text, TextInput } = require('react-native') as typeof import('react-native');
  return {
    Button: ({ children, disabled, loading, onPress }: {
      children: ReactNode;
      disabled?: boolean;
      loading?: boolean;
      onPress?: () => void;
    }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: Boolean(disabled || loading) }}
        disabled={disabled || loading}
        onPress={onPress}>
        <Text>{children}</Text>
      </Pressable>
    ),
    Input: React.forwardRef<TextInput, ComponentProps<typeof TextInput>>((props, ref) => (
      <TextInput ref={ref} {...props} />
    )),
    Card: ({ children }: { children: ReactNode }) => <>{children}</>,
    Label: ({ children }: { children: ReactNode }) => <Text>{children}</Text>,
    Logo: () => null,
  };
});

const SignInScreen = require('../src/app/sign-in').default;
const SignUpScreen = require('../src/app/sign-up').default;

type Screen = Awaited<ReturnType<typeof render>>;

async function fillCredentials(screen: Screen, password: string) {
  await fireEvent.changeText(screen.getByLabelText('Email address'), 'person@example.com');
  await fireEvent.changeText(screen.getByLabelText('Password'), password);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSignInWithPassword.mockResolvedValue(undefined);
  mockCreateAccountWithPassword.mockResolvedValue('authenticated');
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('sign in screen', () => {
  test('signs an existing account in, even with a short password', async () => {
    const screen = await render(<SignInScreen />);
    await fillCredentials(screen, 'x');

    await fireEvent.press(screen.getByText('Sign in'));

    await waitFor(() => expect(mockSignInWithPassword).toHaveBeenCalledWith('person@example.com', 'x'));
  });

  test('explains missing fields instead of ignoring the tap', async () => {
    const screen = await render(<SignInScreen />);

    await fireEvent.press(screen.getByText('Sign in'));

    expect(screen.getByText('Enter your email address.')).toBeTruthy();
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });

  test('shows safe, actionable feedback for a Supabase failure', async () => {
    mockSignInWithPassword.mockRejectedValue(new AuthApiError('Backend details', 400, 'invalid_credentials'));
    const screen = await render(<SignInScreen />);
    await fillCredentials(screen, 'password');

    await fireEvent.press(screen.getByText('Sign in'));

    expect(await screen.findByText('Email or password is incorrect.')).toBeTruthy();
  });

  test('sends new people to the separate sign-up screen', async () => {
    const screen = await render(<SignInScreen />);

    await fireEvent.press(screen.getByText('Create an account'));

    expect(mockPush).toHaveBeenCalledWith('/sign-up');
  });
});

describe('sign up screen', () => {
  test('responds to Create account on an empty form by explaining every missing field', async () => {
    const screen = await render(<SignUpScreen />);

    await fireEvent.press(screen.getByText('Create account'));

    expect(screen.getByText('Enter your first name.')).toBeTruthy();
    expect(screen.getByText('Enter your surname.')).toBeTruthy();
    expect(screen.getByText('Enter your email address.')).toBeTruthy();
    expect(mockCreateAccountWithPassword).not.toHaveBeenCalled();
  });

  test('creates the account with a name once the password is long enough', async () => {
    const screen = await render(<SignUpScreen />);
    await fireEvent.changeText(screen.getByLabelText('First name'), 'Ella');
    await fireEvent.changeText(screen.getByLabelText('Surname'), 'Thorburn');
    await fillCredentials(screen, '12345');

    await fireEvent.press(screen.getByText('Create account'));
    expect(screen.getByText('Password must be at least 6 characters.')).toBeTruthy();
    expect(mockCreateAccountWithPassword).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Password'), '123456');
    await fireEvent.press(screen.getByText('Create account'));

    await waitFor(() => expect(mockCreateAccountWithPassword).toHaveBeenCalledWith(
      { firstName: 'Ella', lastName: 'Thorburn' },
      'person@example.com',
      '123456',
    ));
  });

  test('tells the person to confirm their email when Supabase requires it', async () => {
    mockCreateAccountWithPassword.mockResolvedValue('confirmationRequired');
    const screen = await render(<SignUpScreen />);
    await fireEvent.changeText(screen.getByLabelText('First name'), 'Ella');
    await fireEvent.changeText(screen.getByLabelText('Surname'), 'Thorburn');
    await fillCredentials(screen, '123456');

    await fireEvent.press(screen.getByText('Create account'));

    expect(await screen.findByText('We sent a confirmation link to person@example.com. Open it, then sign in.')).toBeTruthy();
  });
});
