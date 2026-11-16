# Supabase and Vercel setup

The CRM now reads and writes workspace collections in Supabase. The repository contains no seeded leads, clients, projects, tasks, or calendar events. The first login flow requires each invited account to enroll in TOTP MFA before CRM data is available.

## 1. Create the Supabase project

1. Create a Supabase project and open its SQL Editor.
2. Run [`supabase/migrations/20261116000000_crm_core.sql`](supabase/migrations/20261116000000_crm_core.sql).
3. In Authentication settings, enable the desired sign-in method(s) and configure the site URL and redirect URL for both local development (`http://127.0.0.1:55010`) and the eventual Vercel domain. For Google sign-in, also configure the OAuth provider credentials in Supabase.
4. In Authentication, invite or create the initial user. Copy that user’s UUID from the Users list.
5. Run this one-time SQL in the SQL Editor, substituting the invited account’s real UUID and email:

```sql
with created_workspace as (
  insert into public.workspaces (name) values ('StrataForge Workspace') returning id
)
insert into public.workspace_members (workspace_id, user_id, email, display_name, role)
select id, 'AUTH_USER_UUID'::uuid, 'REAL_USER_EMAIL', 'Workspace owner', 'owner'
from created_workspace;
```

Do not use a service-role/secret key in the browser. The client uses only the Supabase publishable key; row-level security restricts all CRM rows to the signed-in member’s workspace and an AAL2 (MFA-verified) session.

## 2. Configure local development

Copy `.env.example` to `.env.local` and fill in values from Supabase Project Settings → API:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

Run `npm install` and `npm run dev`. The Vite app runs at `http://127.0.0.1:55010`. `.env.local` is ignored by Git.

## 3. Deploy on Vercel

1. Import this Git repository into Vercel and select the Vite framework preset. `vercel.json` sets the build command and `dist` output directory, including a client-side route fallback.
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` under Vercel Project Settings → Environment Variables for Preview and Production.
3. For in-app team invitations, add `SUPABASE_SECRET_KEY` under Vercel Project Settings → Environment Variables for the environments where invitations should work. This key is used only by the server-side invitation function; never name it with a `VITE_` prefix or put it in browser code.
4. Deploy, then add the final Vercel domain to Supabase Auth’s Site URL and Redirect URLs. The invite redirect must be in Supabase Auth’s allowed redirect URLs. Redeploy if environment values were changed.

The Vercel deployment cannot be linked or published until a Supabase project and a Vercel account/project are provided. There are no project credentials in this workspace.

## Data model

`crm_collections` stores each CRM collection as JSONB under `(workspace_id, collection_key)`. The browser keeps a small in-memory cache; Supabase is the persistent source. Collections are initialized empty when first used. `workspace_members` and `workspaces` contain membership metadata, not CRM demo records. Migration installs RLS policies that require workspace membership and MFA assurance for CRM access.

Workspace owners and admins can invite teammates from the Access page. The Vercel function verifies the signed-in user and MFA assurance, checks their role for the requested workspace, sends new-user invitations through Supabase Auth, and writes the resulting membership server-side. Existing Auth accounts are added to the workspace directly; unconfirmed accounts receive a confirmation email resend. Invitees set a password and complete authenticator setup before CRM access.

Account and lead profile photos are resized to a 512-pixel WebP and saved in the workspace-scoped `profilePhotos` CRM collection. The browser uploads the image through the signed-in member's existing Supabase session, so photo updates do not require a server-only secret or a separate storage bucket. Profile images are available to members of the same workspace.

The old SQLite API has been removed and all collection rows in the existing local store were deleted. There is no SQLite fallback; the leftover empty database file is ignored by Git and is not used by the app.
