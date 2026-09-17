export const MIN_PASSWORD_LENGTH = 6;

export type PasswordAuthMode = 'signIn' | 'signUp';

export type AuthFieldErrors = {
  email?: string;
  password?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function hasPasswordCredentials(email: string, password: string): boolean {
  return email.trim().length > 0 && password.length > 0;
}

export function validateEmail(email: string): string | undefined {
  const normalizedEmail = email.trim();
  if (!normalizedEmail) {
    return 'Enter your email address.';
  }
  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    return 'Enter a valid email address.';
  }
  return undefined;
}

export function validatePassword(
  password: string,
  mode: PasswordAuthMode,
): string | undefined {
  if (!password) {
    return 'Enter your password.';
  }
  if (mode === 'signUp' && password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return undefined;
}

export function validatePasswordCredentials(
  email: string,
  password: string,
  mode: PasswordAuthMode,
): AuthFieldErrors {
  const emailError = validateEmail(email);
  const passwordError = validatePassword(password, mode);

  return {
    ...(emailError ? { email: emailError } : {}),
    ...(passwordError ? { password: passwordError } : {}),
  };
}

export function validateNewAccountCredentials(email: string, password: string): void {
  const errors = validatePasswordCredentials(email, password, 'signUp');
  const firstError = errors.email ?? errors.password;
  if (firstError) {
    throw new Error(firstError);
  }
}
