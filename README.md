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
| File storage | Cloud Firestore (chunked binary, served through an authorized route) |
| UI | Tailwind CSS + shadcn/ui + Tiptap rich text editor |
| PDF export | @react-pdf/renderer |
| Hosting | Vercel |

## Multi-Tenancy & Security Model

- **The browser never touches Firestore directly.** All data access runs
  server-side through the Firebase Admin SDK after verifying the caller's
  httpOnly session cookie. Firestore security rules **deny all client access**
  (`firestore.rules`) — a leaked web API key gives an attacker nothing.
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
- Attachment bytes are stored in Firestore, base64-split across sub-1 MiB chunk
  documents. There is no public URL at all: downloads are streamed back only
  after a server-side tenant and visibility check, so guessing an id gains
  nothing. Uploads are capped at 5 MB and restricted by MIME type.
- **Joining an organization is always authorized by that organization.** There
  is no open "pick an org and get in" path. Public signup offers two modes:
  create a new (empty) org, or submit a request to join an existing one. A
  request creates a profile with status `pending`, which cannot establish a
  session and is excluded from every participant picker, until an admin of
  that same org approves it and assigns a role and department. Beyond that,
  the manual path is an admin adding the account directly on **Admin → Users**.
  Self-service never yields `org_admin`, and `orgId` is always derived
  server-side — never taken from client input.
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
4. **Project settings → General → Your apps**: add a Web app and note the
   `apiKey`, `authDomain`, `projectId`.
5. **Project settings → Service accounts**: Generate new private key
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
2. Import it in Vercel and set the four environment variables above
   (paste the service-account JSON as a single line).
3. Deploy — no other configuration needed.

## Joining an Organization

| Path | Who authorizes | Result |
|---|---|---|
| Create organization | n/a — new empty tenant | Creator becomes its first `org_admin` |
| Request to join | Admin, per request | `pending` until approved; no access meanwhile |
| Added directly | Admin | Admin creates the account on **Admin → Users**; active immediately |

Pending requests appear on **Admin → Users**, where the admin sets role and
department before approving; rejecting deletes the account so the person can
re-apply. There is no invite code or link — every path into an organization is
either self-service into a brand-new empty tenant, or requires an
administrator of that organization to act.

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

- Email notifications not implemented (in-app notification center only), so a
  pending applicant is not emailed when approved, and admins are not emailed
  when a request arrives — both are visible in-app.
- Creating a new organization is open to anyone, by design: it produces an
  isolated empty tenant and grants no access to existing data. Production would
  add email verification and work-domain checks before allowing it.
- The "request to join" picker lists organization names publicly, which is
  unavoidable — you cannot ask to join something you cannot name. No other
  organization detail is exposed.
- Delegation is supported by the workflow engine (a delegate can act on behalf
  of an assignee and both identities are recorded) but has no management UI.
- Version history shows metadata; side-by-side content diff not implemented.
- Reports are tabular counts; no charts or CSV export.
- Search is server-side substring matching over org-scoped data (fine at demo
  scale; a dedicated search index would be needed for large datasets).
- Attachments are capped at 5 MB each because file bytes are stored in
  Firestore rather than object storage. This keeps the project entirely within
  Firebase's free tier (Cloud Storage now requires a billing account). Moving
  to object storage would only require replacing `saveAttachment` /
  `readAttachment` in `src/lib/data.ts`.
