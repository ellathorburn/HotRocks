import { AuthApiError } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ComponentProps, ReactNode } from 'react';
import type { TextInput } from 'react-native';

const mockRequestEmailOtp = jest.fn<() => Promise<void>>();
const mockVerifyEmailOtp = jest.fn<() => Promise<void>>();

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: mockPush, replace: jest.fn(), back: mockBack },
}));

// Mutable so the unconfigured branch can be rendered without resetting
// modules, which would detach React's hook dispatcher mid-file.
let mockIsConfigured = true;

jest.mock('@/features/auth/auth-context', () => ({
  useAuth: () => ({ isConfigured: mockIsConfigured }),
}));

jest.mock('@/features/auth/auth-service', () => ({
  requestEmailOtp: mockRequestEmailOtp,
  verifyEmailOtp: mockVerifyEmailOtp,
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

const EmailCodeScreen = require('../src/app/email-code').default;

type Screen = Awaited<ReturnType<typeof render>>;

const CODE_LABEL = '6-digit sign-in code';

/** Gets a code sent so the screen is showing its verification step. */
async function requestCode(screen: Screen, email = 'person@example.com') {
  await fireEvent.changeText(screen.getByLabelText('Email address'), email);
  await fireEvent.press(screen.getByText('Email me a code'));
  await waitFor(() => expect(screen.getByLabelText(CODE_LABEL)).toBeTruthy());
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsConfigured = true;
  mockRequestEmailOtp.mockResolvedValue(undefined);
  mockVerifyEmailOtp.mockResolvedValue(undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('email code sign in', () => {
  test('asks for an address before spending an email on it', async () => {
    const screen = await render(<EmailCodeScreen />);

    await fireEvent.press(screen.getByText('Email me a code'));

    expect(screen.getByText('Enter your email address.')).toBeTruthy();
    expect(mockRequestEmailOtp).not.toHaveBeenCalled();
  });

  test('rejects a malformed address without contacting Supabase', async () => {
    const screen = await render(<EmailCodeScreen />);
    await fireEvent.changeText(screen.getByLabelText('Email address'), 'person@example');

    await fireEvent.press(screen.getByText('Email me a code'));

    expect(screen.getByText('Enter a valid email address.')).toBeTruthy();
    expect(mockRequestEmailOtp).not.toHaveBeenCalled();
  });

  test('sends a code, then says where to look for it', async () => {
    const screen = await render(<EmailCodeScreen />);
    await requestCode(screen);

    expect(mockRequestEmailOtp).toHaveBeenCalledWith('person@example.com');
    expect(screen.getByText('Check person@example.com for a 6-digit code. It expires in an hour.')).toBeTruthy();
  });

  test('the code field only appears once a code has been sent', async () => {
    const screen = await render(<EmailCodeScreen />);

    expect(screen.queryByLabelText(CODE_LABEL)).toBeNull();
    await requestCode(screen);
    expect(screen.getByLabelText(CODE_LABEL)).toBeTruthy();
  });

  test('verifies the code against the address it was sent to', async () => {
    const screen = await render(<EmailCodeScreen />);
    await requestCode(screen);

    await fireEvent.changeText(screen.getByLabelText(CODE_LABEL), '123456');
    await fireEvent.press(screen.getByText('Sign in'));

    await waitFor(() => expect(mockVerifyEmailOtp).toHaveBeenCalledWith('person@example.com', '123456'));
  });

  test('will not spend a verification attempt on an incomplete code', async () => {
    const screen = await render(<EmailCodeScreen />);
    await requestCode(screen);

    await fireEvent.changeText(screen.getByLabelText(CODE_LABEL), '123');
    await fireEvent.press(screen.getByText('Sign in'));

    expect(screen.getByText('The code is 6 digits.')).toBeTruthy();
    expect(mockVerifyEmailOtp).not.toHaveBeenCalled();
  });

  test('asks for the code when the field is left empty', async () => {
    const screen = await render(<EmailCodeScreen />);
    await requestCode(screen);

    await fireEvent.press(screen.getByText('Sign in'));

    expect(screen.getByText('Enter the code from your email.')).toBeTruthy();
    expect(mockVerifyEmailOtp).not.toHaveBeenCalled();
  });

  test('strips anything that is not a digit as it is typed', async () => {
    const screen = await render(<EmailCodeScreen />);
    await requestCode(screen);

    await fireEvent.changeText(screen.getByLabelText(CODE_LABEL), '12-34 56');
    await fireEvent.press(screen.getByText('Sign in'));

    await waitFor(() => expect(mockVerifyEmailOtp).toHaveBeenCalledWith('person@example.com', '123456'));
  });

  test('explains an expired code using its own message, not the password one', async () => {
    mockVerifyEmailOtp.mockRejectedValue(new AuthApiError('Backend details', 403, 'otp_expired'));
    const screen = await render(<EmailCodeScreen />);
    await requestCode(screen);

    await fireEvent.changeText(screen.getByLabelText(CODE_LABEL), '123456');
    await fireEvent.press(screen.getByText('Sign in'));

    expect(await screen.findByText('That code has expired. Request a new one.')).toBeTruthy();
  });

  test('a wrong code is reported without leaking backend detail', async () => {
    mockVerifyEmailOtp.mockRejectedValue(new AuthApiError('Token has expired or is invalid', 403, 'unexpected_failure'));
    const screen = await render(<EmailCodeScreen />);
    await requestCode(screen);

    await fireEvent.changeText(screen.getByLabelText(CODE_LABEL), '999999');
    await fireEvent.press(screen.getByText('Sign in'));

    expect(await screen.findByText('That code is incorrect or has expired. Request a new one.')).toBeTruthy();
    expect(screen.queryByText('Token has expired or is invalid')).toBeNull();
  });

  test('surfaces the send rate limit rather than failing silently', async () => {
    mockRequestEmailOtp.mockRejectedValue(
      new AuthApiError('Backend details', 429, 'over_email_send_rate_limit'),
    );
    const screen = await render(<EmailCodeScreen />);
    await fireEvent.changeText(screen.getByLabelText('Email address'), 'person@example.com');

    await fireEvent.press(screen.getByText('Email me a code'));

    expect(await screen.findByText('Too many emails were requested. Wait a moment and try again.')).toBeTruthy();
    // The step must not advance when no code was actually sent.
    expect(screen.queryByLabelText(CODE_LABEL)).toBeNull();
  });

  test('a new code can be requested for the same address', async () => {
    const screen = await render(<EmailCodeScreen />);
    await requestCode(screen);

    await fireEvent.press(screen.getByText('Send a new code'));

    await waitFor(() => expect(mockRequestEmailOtp).toHaveBeenCalledTimes(2));
    expect(mockRequestEmailOtp).toHaveBeenLastCalledWith('person@example.com');
  });

  test('switching address returns to the first step and clears the code', async () => {
    const screen = await render(<EmailCodeScreen />);
    await requestCode(screen);
    await fireEvent.changeText(screen.getByLabelText(CODE_LABEL), '123456');

    await fireEvent.press(screen.getByText('Use a different email'));

    expect(screen.queryByLabelText(CODE_LABEL)).toBeNull();
    expect(screen.getByText('Email me a code')).toBeTruthy();

    // A second address gets its own code, not the first one's.
    await requestCode(screen, 'other@example.com');
    await fireEvent.changeText(screen.getByLabelText(CODE_LABEL), '654321');
    await fireEvent.press(screen.getByText('Sign in'));

    await waitFor(() => expect(mockVerifyEmailOtp).toHaveBeenCalledWith('other@example.com', '654321'));
  });

  test('offers a way back to password sign in', async () => {
    const screen = await render(<EmailCodeScreen />);

    await fireEvent.press(screen.getByText('Back to sign in'));

    expect(mockBack).toHaveBeenCalled();
  });

  test('says what is missing when Supabase is not configured', async () => {
    mockIsConfigured = false;

    const screen = await render(<EmailCodeScreen />);

    expect(screen.getByText('HotRocks authentication')).toBeTruthy();
    expect(screen.queryByText('Email me a code')).toBeNull();
    expect(screen.queryByLabelText('Email address')).toBeNull();
  });
});
