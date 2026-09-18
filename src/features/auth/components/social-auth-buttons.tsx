import * as AppleAuthentication from 'expo-apple-authentication';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Platform, Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Label } from '@/components/ds';
import { Radius } from '@/constants/theme';
import { signInWithApple, signInWithGoogle } from '@/features/auth/auth-service';
import { useTheme, useThemeScheme } from '@/hooks/use-theme';

type Intent = 'signIn' | 'signUp';

type SocialAuthButtonsProps = {
  intent: Intent;
  disabled: boolean;
  onSubmit: (request: () => Promise<unknown>) => void;
};

const BUTTON_HEIGHT = 50;

/**
 * Apple and Google buttons drawn to each provider's branding rules, followed
 * by the "Or with email" divider. On iOS the Apple button is Apple's own
 * native control, which App Review expects; elsewhere it follows Apple's web
 * button spec (black, Apple logo, "Sign in with Apple").
 */
export function SocialAuthButtons({ intent, disabled, onSubmit }: SocialAuthButtonsProps) {
  const theme = useTheme();

  return (
    <>
      <View style={{ gap: 10, opacity: disabled ? 0.55 : 1 }} pointerEvents={disabled ? 'none' : 'auto'}>
        <AppleButton intent={intent} onPress={() => onSubmit(signInWithApple)} />
        <GoogleButton intent={intent} onPress={() => onSubmit(signInWithGoogle)} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
        <Label>Or with email</Label>
        <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
      </View>
    </>
  );
}

function AppleButton({ intent, onPress }: { intent: Intent; onPress: () => void }) {
  const scheme = useThemeScheme();

  // Sign in with Apple is offered on Apple platforms and the web, as before.
  if (Platform.OS === 'android') return null;

  if (Platform.OS === 'ios') {
    return (
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={intent === 'signUp'
          ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
          : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
        // White on dark backgrounds, black on light, as Apple's guidelines ask.
        buttonStyle={scheme === 'dark'
          ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
          : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={Radius.md}
        style={{ width: '100%', height: BUTTON_HEIGHT }}
        onPress={onPress}
      />
    );
  }

  const dark = scheme === 'dark';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        height: BUTTON_HEIGHT,
        borderRadius: Radius.md,
        backgroundColor: dark ? '#FFFFFF' : '#000000',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        opacity: pressed ? 0.85 : 1,
      })}>
      <Ionicons name="logo-apple" size={20} color={dark ? '#000000' : '#FFFFFF'} />
      <Text style={{ fontSize: 17, fontWeight: '600', color: dark ? '#000000' : '#FFFFFF' }}>
        {intent === 'signUp' ? 'Sign up with Apple' : 'Sign in with Apple'}
      </Text>
    </Pressable>
  );
}

/** Google's standard button: neutral fill, 1px stroke, full-colour "G", fixed copy. */
function GoogleButton({ intent, onPress }: { intent: Intent; onPress: () => void }) {
  const dark = useThemeScheme() === 'dark';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        height: BUTTON_HEIGHT,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: dark ? '#8E918F' : '#747775',
        backgroundColor: dark ? '#131314' : '#FFFFFF',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        opacity: pressed ? 0.85 : 1,
      })}>
      <GoogleLogo />
      {/* The system font is Roboto on Android, as Google specifies. */}
      <Text style={{ fontSize: 16, fontWeight: '500', color: dark ? '#E3E3E3' : '#1F1F1F' }}>
        {intent === 'signUp' ? 'Sign up with Google' : 'Sign in with Google'}
      </Text>
    </Pressable>
  );
}

function GoogleLogo() {
  return (
    <Svg width={20} height={20} viewBox="0 0 48 48" accessibilityElementsHidden importantForAccessibility="no">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}
