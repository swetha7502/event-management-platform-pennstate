# Event Platform — v1

Global Engagement Office event planning tool. Node/Express backend, React/Vite frontend, Supabase (Postgres) DB.

## Structure

```
backend/    Express + TypeScript API
frontend/   React + Vite + TypeScript UI
```

## Setup

### 1. Database
Run `001_init_schema.sql` (from the schema chat) against a Supabase project's SQL Editor.
This is a throwaway/dev Supabase project for now — swap the connection string once
IT confirms where the real DB should live.

### 2. Backend
```
cd backend
cp .env.example .env   # fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
npm install
npm run dev             # runs on http://localhost:4000
```

### 3. Frontend
```
cd frontend
cp .env.example .env.local   # fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
npm install
npm run dev                  # runs on http://localhost:5173
```
Ships with a built-in mock data set so it runs with zero config. Set
`VITE_USE_SUPABASE=true` in `.env.local` once you want it hitting real
Supabase data instead — see `frontend/README.md` for the data-layer seam
(`src/lib/dataClient.ts`).

## Auth (placeholder)

There's no real login yet. The frontend stores a raw `user_id` in localStorage
and sends it as `Authorization: Bearer <user_id>`. The backend looks that id up
in the `users` table and attaches role info to the request.

To test locally: insert a row into `users` via Supabase's table editor, copy its
`user_id`, paste it into the login screen.

Swap point for real SSO: `backend/src/middleware/auth.ts` (`requireAuth`) and
`frontend/src/context/AuthContext.tsx` (`login`) — keep the same shape
(`req.user` / stored session), replace the internals.

## What's built so far

- Full DB schema (9 tables) with RLS left off for dev
- Backend: Event CRUD (Coordinator-only writes), Task CRUD + "my tasks" endpoint,
  placeholder auth + role middleware
- Frontend: full page set (Login, Dashboard, Tasks, Stats, Inventory, AI Chat)
  built from the approved prototype, Tailwind-styled, running on mock data
  with a `dataClient.ts` seam ready to swap onto Supabase

## Not built yet (see plan)

- Role-based UI hiding, Task view screens, Reports screen
- Real auth/SSO, RLS policies
- AI prediction features (blocked on IT approval for API access)
- Inventory CRUD endpoints
