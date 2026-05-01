# Team Task Manager

Full-stack Next.js 16 + Supabase MVP for project/task management with role-based access control.

## Features

- Email/password auth (signup/login/logout)
- Project creation and team membership
- Admin/member role permissions per project
- Task creation, assignment, status tracking
- Dashboard with open/completed/overdue metrics
- Invite-link flow for pending member invitations

## Environment

Create `.env.local` from `.env.example`:

```bash
cp .env.example .env.local
```

Required variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `SUPABASE_DISABLE_EMAIL_VERIFICATION` (`true` or `false`, default `false`)
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` (for example `onboarding@resend.dev`)
- `APP_BASE_URL` (for example `http://localhost:3000`)

If you hit Supabase email rate limits in development, set:

```env
SUPABASE_DISABLE_EMAIL_VERIFICATION=true
```

This creates users with email auto-confirmed via server-side admin API and signs them in without sending verification emails.

Invite emails:

- `POST /api/projects/[projectId]/invitations` now sends email through Resend.
- The email contains the invite link to `${APP_BASE_URL}/invitations/<token>`.

## Database Setup (Supabase SQL Editor)

Run this migration SQL in your Supabase project:

- `supabase/migrations/20260501153000_team_task_manager.sql`

## Run

```bash
npm install
npm run dev
```

App entry points:

- `/login`
- `/signup`
- `/dashboard`

## Tests and Checks

```bash
npm run test
npm run lint
npm run build
```

## Deploy on Railway

This repo includes `railway.json` with:

- Build: `npm run build`
- Start: `npm run start`
- Healthcheck: `/health`
