# Authentication

## Account contract

HotRocks requires a permanent Supabase account. Strava connection is optional
and is never used as the HotRocks identity.

The UI can call the functions exported by
`src/features/auth/auth-service.ts`:

- `signInWithApple()` uses native Apple Authentication on iOS and browser OAuth
  elsewhere.
- `signInWithGoogle()` uses Supabase PKCE OAuth in the system browser.
- `signInWithPassword(email, password)` and `createAccountWithPassword(...)`
  provide the development fallback that needs no SMTP.
- `requestEmailOtp(email)` and `verifyEmailOtp(email, code)` remain ready for
  the six-digit production fallback once custom SMTP is configured.
- `signOut()` ends the Supabase session.
- `deleteAccount()` invokes the authenticated server function, removes stored
  photos, deletes the Auth user and clears the local session.

`useAuth()` exposes `isConfigured`, `isLoading`, `session` and `user`. The root
navigator admits only the sign-in route when there is no session. Native
sessions are stored in chunked Expo SecureStore values; web sessions use
AsyncStorage. Refreshing runs only while the native app is foregrounded.

The current `src/app/sign-in.tsx` is an integration harness, not the final
HotRocks interface. It can be replaced without changing the service contract.

## Local development

The local redirect allow-list contains `hotrocks://auth/callback`. Local email
messages appear in Supabase Studio's Inbucket view. The confirmation and magic
link templates both expose `{{ .Token }}` so the app can accept a six-digit
code instead of requiring an email deep link.

Changing an Auth template in `supabase/config.toml` requires restarting the
local Supabase stack.

## Hosted project checklist

When the hosted project exists:

An organization alone does not have a project URL. First create a project
inside the organization. Open that project and use the **Connect** button to
copy its Project URL and publishable key. The URL has the form
`https://<project-ref>.supabase.co`.

The HotRocks repository is currently linked to the hosted `HotRocks DB`
project. All three database migrations are deployed and match local history.

1. Run `npx supabase login` locally. Never paste the access token into chat or
   commit it.
2. Link with `npx supabase link --project-ref <project-ref>` and push the
   reviewed migrations.
3. Copy the hosted project URL and publishable key into the ignored `.env`
   file as `EXPO_PUBLIC_SUPABASE_URL` and
   `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Never put a secret or service-role
   key in an `EXPO_PUBLIC_` variable.
4. Add `hotrocks://auth/callback` to Authentication > URL Configuration.
5. Configure the Google provider with the Supabase callback URL in Google
   Cloud, and then add its client ID and secret in Supabase.
6. Choose the final iOS bundle identifier. Enable Sign in with Apple for that
   App ID, then configure the Apple provider in Supabase. Provider secrets stay
   in Apple/Supabase, not in the Expo app.
7. Replace both hosted Confirmation and Magic Link email templates with the
   committed OTP wording and include `{{ .Token }}`.
8. Configure production SMTP before launch; the built-in sender is for limited
   testing only.
9. Deploy `delete-account` with user authentication enabled. This is deployed
   and active in the hosted HotRocks project.

Google and Apple cannot complete end-to-end locally until their provider
credentials and final app identifiers exist. Email OTP can be exercised
entirely against the Docker stack.

## Development without SMTP

Hosted development can use email and password without sending any email. In
Supabase Dashboard, open Authentication > Sign In / Providers > Email and turn
off **Confirm email**. The sign-in harness then creates a normal permanent
Supabase user and receives a session immediately. Re-enable confirmation before
production email/password sign-up, or return the interface to OTP after custom
SMTP is configured.
