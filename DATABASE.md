# Database and standalone accounts

The CRM continues to store workspace data in Supabase Postgres. Authentication and workspace accounts now use the standalone `public.users` table; they do not use Supabase Auth or `auth.users`. The server-side account API also proxies CRM collection reads and writes so browser sessions never need a Supabase Auth token.

## 1. Apply the account-table migration

In the Supabase SQL Editor, run [`supabase/migrations/20261118000000_standalone_users.sql`](supabase/migrations/20261118000000_standalone_users.sql) after the existing CRM migration. It creates `public.users` and copies the current `workspace_members` roster, keeping existing user and workspace IDs and roles. Passwords and MFA secrets are not copied. The first existing owner or admin sets a new password through the one-time bootstrap flow, then enrolls in an authenticator.

For a brand-new workspace with no existing `workspace_members` rows, create the initial workspace and owner row once, substituting the owner’s email:

```sql
insert into public.workspaces (name)
select 'StrataForge Workspace'
where not exists (select 1 from public.workspaces);

insert into public.users (id, workspace_id, email, display_name, role, status)
select gen_random_uuid(), id, lower('OWNER_EMAIL'), 'Workspace Owner', 'owner', 'active'
from public.workspaces
order by created_at asc
limit 1
on conflict do nothing;
```

The `users` table has no foreign key to `auth.users`; direct access is revoked from `anon` and `authenticated`. Only the server-side API uses the Supabase secret key. Keep that key out of browser variables and source code.

## 2. Configure local development

Copy `.env.example` to `.env.local`, fill in the server values, and restart `npm run dev`:

```dotenv
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SECRET_KEY=YOUR_SERVER_SIDE_SUPABASE_SECRET_KEY
AUTH_SESSION_SECRET=YOUR_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
AUTH_BOOTSTRAP_TOKEN=YOUR_DIFFERENT_RANDOM_ONE_TIME_SECRET
GOOGLE_CLIENT_ID=YOUR_GOOGLE_OAUTH_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_OAUTH_CLIENT_SECRET
```

Generate random secrets, for example, with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. Use separate random values for the session secret and bootstrap token. The bootstrap token is only needed to set the first existing admin or owner’s password; remove it from the environment after that step. Google variables are needed only if Google sign-in is enabled.

Open the app, choose **Set up the first workspace admin**, enter the existing admin email, bootstrap token, and a new password of at least 12 characters. Then sign in and enroll in TOTP. The bootstrap can only set the first administrator password. New accounts use a one-time invitation link from the Access page; the app does not send invitation email.

## 3. Configure Vercel

Add `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and `AUTH_SESSION_SECRET` as server environment values for Preview and Production. Add `AUTH_BOOTSTRAP_TOKEN` only until the production owner finishes first-time setup, then remove it and redeploy. Add Google OAuth credentials if Google sign-in is required.

For Google OAuth, register `https://YOUR_DOMAIN/api/auth?action=google-callback` as an authorized redirect URI in the Google OAuth client. The server exchanges the code, verifies the returned profile, and allows only emails already present in the workspace `users` table. Do not configure Google through Supabase Auth for this flow.

## Data and account behavior

- `crm_collections` remains the CRM data store, keyed by `(workspace_id, collection_key)`. The account API derives the workspace ID from a signed, 12-hour session and ignores client-supplied workspace IDs.
- `public.users` stores email, display name, workspace role, account status, PBKDF2 password hash, Google identity, encrypted TOTP secret, and one-time invitation token hash/expiry.
- `public.user_audit_events` records invitation, account reset, first-password setup, MFA enrollment, sign-in, and sign-out events without storing passwords or authenticator codes.
- Invitations are created by owners and admins. The Access page shows a seven-day setup link once; an administrator copies it and delivers it to the invited person. Setup requires a password and TOTP enrollment. Admins can reset another account, revoke its sessions, and issue a fresh setup link.
- Password login and Google login both require TOTP before a session is issued. Passwords use PBKDF2-SHA-256 with per-password random salts. TOTP secrets are encrypted with a key derived from `AUTH_SESSION_SECRET`.
- Sessions are signed and held in an `HttpOnly`, `SameSite=Lax` cookie for 12 hours; sign-out revokes sessions through a per-account session version. The API verifies account status and role on each request. CRM reads and writes are scoped to the account’s workspace. Database credentials are server-only because the API uses a server secret key to bypass the existing Supabase Auth-based RLS policies.
- Password and MFA attempts are throttled per account and client address; eight failures within 15 minutes trigger a 15-minute lockout.

## Migration notes

The migration preserves user IDs and roles, but it does not copy credentials from Supabase Auth. Current users must set a new password or use invited Google sign-in and enroll in TOTP. Keep the old Auth project and `workspace_members` table during rollout so you can recover from an account migration issue. Once all users can sign in through the standalone table, Supabase Auth is no longer part of the application’s account flow.

This workspace does not configure an email delivery provider for custom invitations or password recovery. Invitation and recovery links are delivered manually. Keep `AUTH_SESSION_SECRET` stable: changing it signs out everyone and prevents decrypting stored TOTP keys. Online payment collection remains out of scope.
