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
- `requestEmailOtp(email)` and `verifyEmailOtp(email, code)` back the
  six-digit code sign-in on `/email-code`, reached from Sign in with "Email me
  a code instead". The screen asks for an address, sends a code, then verifies
  it; the address is locked while a code is outstanding so a code is always
  checked against the address it went to. Verifying creates the session and the
  root navigator routes onward, so the screen never navigates on success. Until
  custom SMTP is configured on the hosted project, codes only arrive locally in
  Mailpit.
- `signOut(userId)` ends the Supabase session and purges that account's local
  SQLite data. Revoking on the server is best-effort: an account deleted
  elsewhere or an unreachable network would otherwise leave the person signed in
  to an account they cannot use, so a failed revoke still clears this device and
  purges its data.
- `deleteAccount(userId)` invokes the authenticated server function, removes
  stored photos, deletes the Auth user and purges local account data.

`useAuth()` exposes configuration, loading, session, user, profile, retry,
profile-update and `updateName` state. The root navigator uses Expo Router
protected routes to admit only the routes valid for the current state:

1. Signed out: `/sign-in` (returning users), `/sign-up` (new accounts),
   `/email-code` (six-digit code) and `/forgot-password`.
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

A session restored from device storage is checked against the server, because an
account can be deleted or revoked elsewhere. `decideStoredSession`
(`src/features/auth/session-verification.ts`) separates the two answers the
server can give: an authoritative rejection signs the device out, while an
unreachable server leaves the stored session in place. HotRocks is local-first,
so treating a network failure as a rejection would sign people out whenever they
opened the app offline and hide data already on the device.

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
   testing only. The domain is `hotrocks.app`. Add it to the sending provider,
   publish the SPF and DKIM records it asks for, verify it, then set
   Authentication > Emails > SMTP Settings to that provider with a sender on
   `hotrocks.app`. The SMTP password is a secret: keep it in the dashboard, not
   in `config.toml`, `.env` or any `EXPO_PUBLIC_` variable. Raise
   `auth.rate_limit.email_sent` from its local value of 2 per hour once a real
   sender is in place, and keep it below the provider's own daily cap.
9. Add `https://hotrocks.app/auth/callback` to the redirect allow-list
   alongside `hotrocks://auth/callback` if the web build is ever hosted there.
   Native sign-in does not need it.
10. Deploy `delete-account` with user authentication enabled and verify it in
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

A domain is still required before launch, but for reasons other than OAuth:
a verified sending domain for production SMTP, the privacy policy and support
URLs both app stores require, and the production Authorization Callback Domain
for Strava. `hotrocks.app` covers all three.
