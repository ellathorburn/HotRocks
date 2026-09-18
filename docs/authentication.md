# Authentication

## Account contract

HotRocks requires a permanent Supabase account. Strava connection is optional
and is never used as the HotRocks identity.

The UI can call the functions exported by
`src/features/auth/auth-service.ts`:

- `signInWithApple()` uses native Apple Authentication on iOS and browser OAuth
  elsewhere.
- `signInWithGoogle()` uses Supabase PKCE OAuth in the system browser.
- `signInWithPassword(email, password)` and
  `createAccountWithPassword({ firstName, lastName }, email, password)`
  provide a development fallback that needs no SMTP when email confirmation is
  disabled in the Supabase project.
- `requestEmailOtp(email)` and `verifyEmailOtp(email, code)` remain ready for
  the six-digit production fallback once custom SMTP is configured.
- `signOut(userId)` ends the Supabase session and purges that account's local
  SQLite data.
- `deleteAccount(userId)` invokes the authenticated server function, removes
  stored photos, deletes the Auth user and purges local account data.

`useAuth()` exposes configuration, loading, session, user, profile, retry,
profile-update and `updateName` state. The root navigator uses Expo Router
protected routes to admit only the routes valid for the current state:

1. Signed out: `/sign-in` (returning users) and `/sign-up` (new accounts).
2. Signed in without a name: `/complete-profile`.
3. Named but not onboarded: onboarding.
4. Otherwise: the app.

Every profile has `first_name` and `last_name`. Email sign-up sends them as
metadata and the `handle_new_user` trigger seeds the profile; Google's
`given_name`/`family_name` are used the same way; Apple's name, which arrives
only after the account exists, is applied by `profileService.fillMissingName`.
Anyone still without a name completes it before onboarding. The name can be
changed from Settings. Native sessions are stored in chunked Expo SecureStore values; web
sessions use AsyncStorage. Refreshing runs only while the native app is
foregrounded.

The custom `hotrocks` URL scheme is sufficient for installed development and
production builds; owning a web domain is not required for native OAuth. Use a
development build when testing OAuth because Expo Go cannot provide a stable,
app-owned callback scheme. Email/password login does not need a callback.

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

1. Run `npx supabase login` locally. Never paste the access token into chat or
   commit it.
2. Link with `npx supabase link --project-ref <project-ref>`, check migration
   status, and push the reviewed migrations.
3. Copy the hosted project URL and publishable key into the ignored `.env`
   file as `EXPO_PUBLIC_SUPABASE_URL` and
   `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Never put a secret or service-role
   key in an `EXPO_PUBLIC_` variable.
4. Add `hotrocks://auth/callback` to Authentication > URL Configuration.
5. Configure the Google provider with the Supabase callback URL in Google
   Cloud, and then add its client ID and secret in Supabase.
6. Choose permanent iOS and Android application identifiers. Enable Sign in
   with Apple for the iOS App ID, then configure the Apple provider in
   Supabase. Provider secrets stay in Apple/Supabase, not in the Expo app.
7. Replace both hosted Confirmation and Magic Link email templates with the
   committed OTP wording and include `{{ .Token }}`.
8. Configure production SMTP before launch; the built-in sender is for limited
   testing only.
9. Deploy `delete-account` with user authentication enabled and verify it in
   the target hosted project.

Google and Apple cannot complete end-to-end locally until their provider
credentials and final app identifiers exist. Email OTP can be exercised
entirely against the Docker stack.

## Development without SMTP or a domain

Hosted development can use email and password without sending any email. In
Supabase Dashboard, open Authentication > Sign In / Providers > Email and turn
off **Confirm email**. Account creation then returns a session immediately.
Re-enable confirmation before production email/password sign-up, or expose the
OTP interface after custom SMTP is configured.

This setup needs neither a purchased domain nor a hosted website. Native OAuth
returns to `hotrocks://auth/callback`; password login stays inside the app.
