export const MIN_PASSWORD_LENGTH = 6;

export type PasswordAuthMode = 'signIn' | 'signUp';

export const MAX_NAME_LENGTH = 80;

export type AuthFieldErrors = {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
};

export type PersonName = {
  firstName: string;
  lastName: string;
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

export function validateName(value: string, field: 'first' | 'last'): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return field === 'first' ? 'Enter your first name.' : 'Enter your surname.';
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    return `Keep it under ${MAX_NAME_LENGTH} characters.`;
  }
  return undefined;
}

export function validatePersonName(name: PersonName): AuthFieldErrors {
  const firstName = validateName(name.firstName, 'first');
  const lastName = validateName(name.lastName, 'last');
  return {
    ...(firstName ? { firstName } : {}),
    ...(lastName ? { lastName } : {}),
  };
}

export function validateSignUp(name: PersonName, email: string, password: string): AuthFieldErrors {
  return {
    ...validatePersonName(name),
    ...validatePasswordCredentials(email, password, 'signUp'),
  };
}

/** Trimmed names ready to store. Throws the first validation message. */
export function normalizePersonName(name: PersonName): PersonName {
  const errors = validatePersonName(name);
  const firstError = errors.firstName ?? errors.lastName;
  if (firstError) throw new Error(firstError);
  return { firstName: name.firstName.trim(), lastName: name.lastName.trim() };
}

export function validateNewAccountCredentials(email: string, password: string): void {
  const errors = validatePasswordCredentials(email, password, 'signUp');
  const firstError = errors.email ?? errors.password;
  if (firstError) {
    throw new Error(firstError);
  }
}
