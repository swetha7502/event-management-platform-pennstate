# GEO Event Management Platform — Frontend

Real React + Vite + TypeScript app, built from the approved prototype
(`GEOPrototype.jsx` / `GEO_Prototype_Local.html`). Same visual design
Ruhi already signed off on, now a proper multi-file app with routing,
role-based auth state, and a data layer ready to swap onto Supabase.

## Getting started

Requires Node 18+.

```bash
npm install
npm run dev
```

Opens at http://localhost:5173. Log in as either role from the login
screen — auth is a placeholder (see `src/context/AuthContext.tsx`) and
accepts any name/password.

## Project structure

```
src/
  types/index.ts        # Types mirroring the Supabase schema (001_init_schema.sql)
  data/mockData.ts       # Hardcoded data — same content as the old prototype
  lib/
    supabaseClient.ts    # Supabase client, reads .env.local, no-ops if unconfigured
    dataClient.ts        # THE SEAM — pages call this, not mockData/supabase directly
  context/
    AuthContext.tsx       # Session/role state (placeholder auth)
    useToast.ts            # Toast notification hook
  components/
    AppLayout.tsx          # Sidebar shell + Outlet, shared by all authenticated pages
    ProtectedRoute.tsx      # Redirects to /login if no session
    NavItem.tsx / StatusBadge.tsx / Toast.tsx
  pages/
    LoginPage.tsx
    DashboardPage.tsx
    AIChatPage.tsx          # Rule-based mock AI — swap for real API in Phase 4
    TasksPage.tsx
    StatsPage.tsx
    InventoryPage.tsx
  App.tsx                  # Routes
  main.tsx                 # Entry point
```

## Connecting to Supabase later

This was deliberately built so the frontend-backend wiring is a small,
contained change:

1. Copy `.env.example` to `.env.local` and fill in your Supabase
   project URL + anon key.
2. Set `VITE_USE_SUPABASE=true` in `.env.local`.
3. Fill in the real query bodies in `src/lib/dataClient.ts` (the
   `USE_SUPABASE` branches are stubbed in with `TODO` comments and
   table names matching the schema in the handoff doc).
4. No page component needs to change — they all go through
   `dataClient.ts` already.

Table names assumed by the stubs: `tasks`, `inventory_items`, `events`,
`users`. Adjust to match your actual Supabase table names if they
differ from the schema draft.

## Notes / things intentionally left as-is from the prototype

- **AI Chat** still uses simple keyword matching (`getAiReply` in
  `AIChatPage.tsx`) since the real OpenAI/Azure API key is pending IT
  approval per the handoff doc. Swap that one function for a real
  fetch call once unblocked.
- **Task status values** were changed from the prototype's
  `todo/in_progress/completed` to `not_started/in_progress/done` to
  match the DB schema's `task_status` enum exactly.
- **Role values** are `"Student"` / `"Coordinator"` (capitalized) to
  match the DB's `user_role` enum, rather than the prototype's
  lowercase strings.
- **Notes on tasks** are kept as a UI-only field (`notes?` on `Task`)
  since there's no `notes` column in the finalized schema yet — flag
  this with Ruhi if you want it persisted for real.

## Not yet built (backend, separate from this repo)

Per the handoff doc, the Express + TS backend and DB schema/seed SQL
already exist as a separate scaffold/zip. This repo is frontend-only;
wiring the two together is the "later" step mentioned — either via
this app calling your Express API, or calling Supabase directly from
`dataClient.ts` and skipping Express for read paths.
