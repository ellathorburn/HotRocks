import { AuthApiError } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ComponentProps, ReactNode } from 'react';
import type { TextInput } from 'react-native';

const mockSignInWithPassword = jest.fn<() => Promise<void>>();
const mockCreateAccountWithPassword = jest.fn<() => Promise<'authenticated' | 'confirmationRequired'>>();

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
  Rubik: { bold: 'Rubik', medium: 'Rubik', regular: 'Rubik' },
  ScreenGutter: 20,
  Type: { body: 16, small: 14 },
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
    Label: ({ children }: { children: ReactNode }) => <Text>{children}</Text>,
    Logo: () => null,
  };
});

const SignInScreen = require('../src/app/sign-in').default;

async function fillCredentials(screen: Awaited<ReturnType<typeof render>>, password: string) {
  await fireEvent.changeText(screen.getByLabelText('Email address'), 'person@example.com');
  await fireEvent.changeText(screen.getByLabelText('Password'), password);
}

describe('email authentication form', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignInWithPassword.mockResolvedValue(undefined);
    mockCreateAccountWithPassword.mockResolvedValue('authenticated');
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('explains a short sign-up password and submits once it is corrected', async () => {
    const screen = await render(<SignInScreen />);
    await fillCredentials(screen, '12345');

    await fireEvent.press(screen.getByText('Create account'));
    expect(screen.getByText('Password must be at least 6 characters.')).toBeTruthy();
    expect(mockCreateAccountWithPassword).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Password'), '123456');
    expect(screen.queryByText('Password must be at least 6 characters.')).toBeNull();
    await fireEvent.press(screen.getByText('Create account'));

    await waitFor(() => expect(mockCreateAccountWithPassword).toHaveBeenCalledWith(
      'person@example.com',
      '123456',
    ));
  });

  test('allows an existing account to sign in with a short password', async () => {
    const screen = await render(<SignInScreen />);
    await fillCredentials(screen, 'x');

    await fireEvent.press(screen.getByText('Sign in'));

    await waitFor(() => expect(mockSignInWithPassword).toHaveBeenCalledWith(
      'person@example.com',
      'x',
    ));
  });

  test('shows safe, actionable feedback for a Supabase failure', async () => {
    mockSignInWithPassword.mockRejectedValue(
      new AuthApiError('Backend details', 400, 'invalid_credentials'),
    );
    const screen = await render(<SignInScreen />);
    await fillCredentials(screen, 'password');

    await fireEvent.press(screen.getByText('Sign in'));

    expect(await screen.findByText('Email or password is incorrect.')).toBeTruthy();
  });
});
