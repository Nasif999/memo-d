# Memo'd — Inter-Office Memo Management System

Multi-tenant web application for internal organizational memos with sequential
approval workflows, comments, notifications, search, reporting, audit logs, and
PDF export. Built for CSE226 (Foundations of Vibe Coding), North South University.

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend + backend | Next.js 14 (App Router, TypeScript, Server Actions) |
| Database | Supabase Postgres with Row Level Security (RLS) |
| Authentication | Supabase Auth (email + password) |
| File storage | Supabase Storage (private bucket, signed URLs) |
| UI | Tailwind CSS + shadcn/ui + Tiptap rich text editor |
| PDF export | @react-pdf/renderer |
| Hosting | Vercel |

## Multi-Tenancy & Security Model

- Every tenant-scoped table carries an `org_id` column.
- Postgres **Row Level Security** enforces org isolation on every table —
  a user can never read or write another organization's rows, regardless of
  application bugs.
- Workflow "is it your turn" logic runs inside `SECURITY DEFINER` Postgres
  functions (`submit_memo`, `perform_workflow_action`) that re-validate the
  caller against the active workflow step atomically.
- All mutations go through Server Actions / Route Handlers with server-side
  session validation. UI hiding is never the authorization boundary.
- Attachments live in a **private** bucket; downloads require an RLS-checked
  route that issues a 60-second signed URL.
- Passwords are hashed by Supabase Auth (bcrypt). HTTPS via Vercel.
- Comments and audit logs have no UPDATE/DELETE policies — immutable by
  construction.

## Local Setup

### 1. Required software

- Node.js 18+ (tested on 24)
- npm 9+
- A free [Supabase](https://supabase.com) account
- (optional) [Vercel](https://vercel.com) account for deployment

### 2. Install dependencies

```bash
npm install
```

### 3. Create the Supabase project

1. Create a new project at https://supabase.com/dashboard.
2. Open the **SQL Editor** and run the three migration files **in order**:
   1. `supabase/migrations/0001_init_schema.sql` — tables, indexes, RLS policies
   2. `supabase/migrations/0002_workflow_functions.sql` — workflow engine functions
   3. `supabase/migrations/0003_storage_and_seed.sql` — private storage bucket + demo data

### 4. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in from Supabase **Project Settings → API**:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` public key |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` secret key (server-only) |

### 5. Run locally

```bash
npm run dev
```

Open http://localhost:3000.

### 6. Production build

```bash
npm run build && npm start
```

## Deployment (Vercel)

1. Push this repo to GitHub.
2. Import it in Vercel and set the three environment variables above.
3. Deploy — no other configuration needed.

## Demo Accounts (seeded)

All demo accounts use password **`Passw0rd!`**.

| Organization | Email | Role |
|---|---|---|
| Acme Corporation | admin@acme.example | Org Admin |
| Acme Corporation | bob@acme.example | User (Engineer) |
| Acme Corporation | carol@acme.example | User (Department Head) |
| Acme Corporation | dave@acme.example | User (Finance Manager) |
| Acme Corporation | erin@acme.example | User (Director) |
| Globex Industries | admin@globex.example | Org Admin |
| Globex Industries | henry@globex.example | User (Operations Lead) |

**Tenant-isolation demo:** create a memo as `bob@acme.example`, then log in as
`henry@globex.example` — the memo is invisible in every list, search, and by
direct URL (RLS returns no rows).

**Workflow demo:** as Bob, create a memo with workflow Carol → Dave → Erin,
submit it, then log in as each participant in turn and approve / reject /
request changes. The timeline, notifications, and audit log update at every step.

## Known Limitations

- Email notifications not implemented (in-app notification center only).
- Delegation is data-model + workflow-function supported (a delegate can act on
  behalf of an assignee and both identities are recorded) but has no management UI.
- Version history shows metadata; side-by-side content diff not implemented.
- Reports are tabular counts; no charts or CSV export.
