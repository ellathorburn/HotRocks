import { describe, expect, jest, test } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({ borderStrong: '#ccc', text: '#000', textSecondary: '#555' }),
}));

jest.mock('@/constants/theme', () => ({
  Radius: { md: 10 },
  Rubik: { medium: 'Rubik', semibold: 'Rubik' },
}));

jest.mock('@/components/ds/icon', () => {
  const { Text } = require('react-native');
  return { Icon: () => <Text>icon</Text> };
});

const { StravaConnect } = require('../src/components/ds/strava-connect');

describe('the Connect with Strava button', () => {
  test('is a real button, not a placeholder slot', async () => {
    const screen = await render(<StravaConnect />);

    expect(screen.getByText('Connect with Strava')).toBeTruthy();
    // Guards against the dashed placeholder that shipped before this was built.
    expect(screen.queryByText(/goes here/i)).toBeNull();
  });

  test('calls its handler when pressed', async () => {
    const onPress = jest.fn();
    const screen = await render(<StravaConnect onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('shows progress and cannot be pressed twice while connecting', async () => {
    const onPress = jest.fn();
    const screen = await render(<StravaConnect loading onPress={onPress} />);

    // The label is replaced by a spinner, so there is visible feedback while
    // the browser opens.
    expect(screen.queryByText('Connect with Strava')).toBeNull();
    await fireEvent.press(screen.getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  test('does not fire when disabled', async () => {
    const onPress = jest.fn();
    const screen = await render(<StravaConnect disabled onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button'));

    expect(onPress).not.toHaveBeenCalled();
  });

  test('reports its state to assistive technology', async () => {
    const screen = await render(<StravaConnect loading />);
    const button = screen.getByRole('button');

    expect(button.props.accessibilityLabel).toBe('Connect with Strava');
    expect(button.props.accessibilityState).toMatchObject({ disabled: true, busy: true });
  });
});
