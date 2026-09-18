import { useRef, useState } from 'react';

import { type AuthAction, getAuthErrorMessage } from './auth-error-message';

/**
 * Runs one authentication request at a time and turns failures into safe,
 * user-facing messages. Shared by the sign-in and sign-up screens.
 */
export function useAuthSubmission() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const inProgress = useRef(false);

  async function submit(action: AuthAction, request: () => Promise<unknown>) {
    if (inProgress.current) return;
    inProgress.current = true;
    setErrorMessage(null);
    setNotice(null);
    setIsSubmitting(true);
    try {
      await request();
    } catch (error) {
      if (__DEV__) console.error('Authentication request failed', error);
      setErrorMessage(getAuthErrorMessage(error, action));
    } finally {
      inProgress.current = false;
      setIsSubmitting(false);
    }
  }

  function clearFeedback() {
    setErrorMessage(null);
    setNotice(null);
  }

  return { submit, isSubmitting, errorMessage, notice, setNotice, clearFeedback };
}
