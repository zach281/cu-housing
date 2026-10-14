# Campus Nest

A housing marketplace for CU Boulder students: apartments, rooms, subleases, lease takeovers, and roommates.
"Campus Nest" is a working name, set in `src/lib/site.ts`.

**Stack:** Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind CSS 4 · Supabase (Postgres, Auth, Storage) · Vercel

## Status

| Milestone | Scope | Status |
|---|---|---|
| 1 | Project setup, database, authentication | Done |
| 2 | Listing creation | Next |
| 3 | Browse, search, filters | |
| 4 | Listing details, favorites | |
| 5 | Messaging | |
| 6 | Profiles, roommate matching | |
| 7 | Admin dashboard, moderation | |
| 8 | Mobile optimization, polish | |

## Setup

1. **Create a Supabase project** at supabase.com (free tier is fine).

2. **Install and configure**
   ```bash
   npm install
   cp .env.example .env.local
   ```
   Fill in `.env.local` from Supabase → Project Settings → API: the project URL and the **publishable** key.
   Never put the secret / service-role key in this app.

3. **Apply the database schema**
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```

4. **Configure Auth in the Supabase dashboard** (the CLI config only applies to local dev):
   - Authentication → Sign In / Providers → Email: turn on **Confirm email**.
   - Authentication → URL Configuration: Site URL `http://localhost:3000`; add redirect URL `http://localhost:3000/**`
     (and your Vercel URL later).
   - Authentication → Email Templates: paste the three templates from `supabase/templates/`
     (Confirm signup, Reset password, Change email address). They send links to `/auth/confirm` with a token hash,
     so a student can sign up on a laptop and confirm from their phone.
   - Authentication → Policies (password): minimum 8 characters, letters and digits.
   - Supabase's built-in email sender is rate-limited to a few emails per hour. Before launch, add custom SMTP
     (Resend, Postmark, etc.) under Authentication → Emails → SMTP Settings.

5. **Run it**
   ```bash
   npm run dev
   ```

### Make yourself an admin
Roles can't be changed from the app. In the Supabase SQL editor:
```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'you@example.com');
```

### Regenerate database types after schema changes
```bash
npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts
```

## Testing

```bash
npm run check      # typecheck + lint + unit tests
npm run build      # production build (needs the env vars set)
TEST_DATABASE_URL=postgres://postgres@localhost:5432/postgres npm run test:db
```

`test:db` applies every migration to a throwaway database on any Postgres 15+ server, then runs
`supabase/tests/rls.test.sql`: about 100 assertions covering what each role can and can't read or write.
It drops and recreates a database named `cu_housing_test`. Never point it at production.

## How it's built

```
src/
  proxy.ts                 Refreshes the Supabase session; early redirect for protected routes
  app/
    page.tsx               Landing page
    (auth)/                Sign up, sign in, forgot password + their server actions
    auth/confirm/          Handles links from auth emails
    auth/signout/          POST-only sign out
    account/               Profile, verification status, password change
  lib/
    auth.ts                getCurrentUser / requireUser (server-only data access layer)
    supabase/              Browser, server and proxy clients; generated types
    validation/            Zod schemas shared by forms and server actions
    site.ts                Brand name and campus constants
supabase/
  migrations/              Schema, RLS policies, storage buckets
  templates/               Auth email templates
  tests/                   RLS test suite + Postgres stubs for running it without Supabase
```

### Security model
- Every table has Row Level Security. The app uses only the publishable key, so the database enforces who can
  see and change what, regardless of the UI.
- Users can edit only their name, bio and photo. Role, verification and suspension are changed by database
  triggers or admins.
- **CU verification** is automatic: confirming an `@colorado.edu` email sets it, and changing to a non-CU email
  removes it. **Provider verification** is a manual admin step. Badges describe what was checked; they never
  claim a listing is safe.
- Analytics events are written only through `track_event()`, which stamps the caller's identity.
- No payments are processed.
