# Memo'd — Inter-Office Memo Management System

Multi-tenant web application for internal organizational memos with sequential
approval workflows, comments, notifications, search, reporting, audit logs, and
PDF export. Built for CSE226 (Foundations of Vibe Coding), North South University.

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend + backend | Next.js 14 (App Router, TypeScript, Server Actions) |
| Database | Cloud Firestore (via Firebase Admin SDK, server-side only) |
| Authentication | Firebase Authentication (email + password, session cookies) |
| File storage | Firebase Storage (private bucket, signed URLs) |
| UI | Tailwind CSS + shadcn/ui + Tiptap rich text editor |
| PDF export | @react-pdf/renderer |
| Hosting | Vercel |

## Multi-Tenancy & Security Model

- **The browser never touches Firestore or Storage.** All data access runs
  server-side through the Firebase Admin SDK after verifying the caller's
  httpOnly session cookie. Firestore and Storage security rules **deny all
  client access** (`firestore.rules`, `storage.rules`) — a leaked web API key
  gives an attacker nothing.
- Every tenant-scoped document carries an `orgId`; every server-side read/write
  filters or checks it against the verified caller's org. Cross-org requests
  return "not found."
- Workflow "is it your turn" logic runs inside **Firestore transactions**
  (`submitMemoTx`, `performWorkflowActionTx` in `src/lib/data.ts`) that
  atomically re-validate the caller against the active workflow step.
- Login flow: client Firebase Auth sign-in → ID token → exchanged at
  `/api/auth/session` for an httpOnly, `secure`, `sameSite` session cookie.
  Deactivated accounts cannot establish sessions and existing refresh tokens
  are revoked on deactivation.
- Attachments live in a private bucket; downloads require a server-side access
  check that issues a 60-second signed URL.
- Passwords are hashed and managed by Firebase Auth. HTTPS via Vercel.
- Comments and audit log entries are written once and never updated or deleted
  by user-reachable code paths.

## Local Setup

### 1. Required software

- Node.js 18+ (tested on 24)
- npm 9+
- A free [Firebase](https://console.firebase.google.com) project
- (optional) [Vercel](https://vercel.com) account for deployment

### 2. Install dependencies

```bash
npm install
```

### 3. Create and configure the Firebase project

1. Create a project at https://console.firebase.google.com.
2. **Authentication → Sign-in method**: enable **Email/Password**.
3. **Firestore Database**: create a database (production mode). Publish the
   contents of `firestore.rules` (deny-all) as the rules.
4. **Storage**: create the default bucket. Publish `storage.rules` (deny-all).
5. **Project settings → General → Your apps**: add a Web app and note the
   `apiKey`, `authDomain`, `projectId`.
6. **Project settings → Service accounts**: Generate new private key
   (downloads a JSON file).

### 4. Configure environment variables

```bash
cp .env.example .env.local
```

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Web app `apiKey` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Web app `authDomain` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Web app `projectId` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | The **entire** service-account JSON, as one line |
| `FIREBASE_STORAGE_BUCKET` | Bucket name, e.g. `your-project.firebasestorage.app` |

### 5. Seed demo data

```bash
node scripts/seed.mjs
```

Creates two organizations, departments, categories, and demo users.

### 6. Run locally

```bash
npm run dev
```

Open http://localhost:3000.

### 7. Production build

```bash
npm run build && npm start
```

## Deployment (Vercel)

1. Push this repo to GitHub.
2. Import it in Vercel and set the five environment variables above
   (paste the service-account JSON as a single line).
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
direct URL (the server's org check returns "not found").

**Workflow demo:** as Bob, create a memo with workflow Carol → Dave → Erin,
submit it, then log in as each participant in turn and approve / reject /
request changes. The timeline, notifications, and audit log update at every step.

## Known Limitations

- Email notifications not implemented (in-app notification center only).
- Delegation is supported by the workflow engine (a delegate can act on behalf
  of an assignee and both identities are recorded) but has no management UI.
- Version history shows metadata; side-by-side content diff not implemented.
- Reports are tabular counts; no charts or CSV export.
- Search is server-side substring matching over org-scoped data (fine at demo
  scale; a dedicated search index would be needed for large datasets).
