# Memo'd — Submission Documentation

CSE226, Foundations of Vibe Coding — Inter-Office Memo Management System

- **Deployed application:** https://memo-d-tan.vercel.app
- **Source code:** https://github.com/Nasif999/memo-d
- **Source code ZIP:** https://github.com/Nasif999/memo-d/archive/refs/heads/master.zip
- **AI prompt/response history:** https://github.com/Nasif999/memo-d/tree/master/docs/ai-history (all secrets scrubbed — see note below)
- **Demo credentials:**
  - `mhnasifkhan@gmail.com` — organization founder/admin — password `12345678`
  - `sajid@gmail.com`, `sakib@gmail.com`, `aditto@gmail.com`, `yearid@gmail.com` — org members, various roles/departments — password `12345678`
  - Also seeded: `admin@acme.example` / `Passw0rd!` (org admin, "Acme Corporation"), plus `bob@acme.example`, `carol@acme.example`, `dave@acme.example`, `erin@acme.example` — same password, a second demo org.

## What was implemented

A multi-tenant inter-office memo system: organizations sign up independently, define their own departments, designations, and workflow templates, and route memos through a sequential, org-defined approval chain.

- **Auth & org onboarding** — email/password signup, either creating a brand-new organization (with at least one department, one designation, and one workflow template required up front) or requesting to join an existing one (admin-approved).
- **Memo lifecycle** — Draft → Submitted → Pending Review/Approval (per workflow step) → Approved / Rejected / Changes Requested → Revised & resubmitted. Every submission is versioned; the full history (who acted, when, and their comment) survives resubmission.
- **Sequential workflow routing** — org admins build reusable workflow templates (an ordered list of designations/roles); submitting a memo instantiates that template as a per-memo step sequence, one active assignee at a time.
- **Delegation** — a user can delegate their turn to a colleague for a date range; the delegate sees the memo in their inbox and can act on it "on behalf of" the delegator, fully audited.
- **Comments & attachments** — threaded comments (general, approval, rejection, change-request), file attachments up to 5MB, stored as chunked base64 in Firestore (no external storage dependency).
- **PDF export** — every submitted memo can be exported as a formatted PDF matching a fixed letterhead (org name/logo, memo number, routing history, approval stamps).
- **Admin console** — users (invite/activate/deactivate/role), departments (each linked to a responsible designation), designations, memo categories, workflow templates, org profile/logo, org-wide audit log (searchable, filterable, sortable), reports.
- **Notifications** — in-app notification panel + a dedicated page, for submissions, approvals, rejections, change requests, join requests, and delegations.
- **Public marketing/landing page** at `/`, separate design system, shown to logged-out visitors (and a lighter version to logged-in users, with dashboard/quick-action shortcuts instead of signup CTAs).
- **Profile management** — name/designation/photo, and password change (re-authentication required).

## How it was implemented

Next.js **App Router** with **Server Components** as the default: nearly every page fetches its data directly in an `async` Server Component via typed functions in `src/lib/data.ts`, which talk to Firestore through the **Admin SDK only** — the browser never has a Firestore SDK instance and never touches the database directly. Mutations are **Server Actions** (`"use server"`) colocated with their pages (`admin/actions.ts`, `memos/actions.ts`, `profile/actions.ts`, …), each starting with a `requireProfile()`/`requireAdmin()` auth check and an org-membership check before touching any data.

Client Components are used only where interactivity is unavoidable — forms, comboboxes, the memo rich-text editor (TipTap), the workflow-action panel, image pickers. State that needs to survive a page load (session) lives in an httpOnly cookie set by a dedicated route handler, not in client state.

## Technology stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router), TypeScript |
| UI | Tailwind CSS, shadcn/ui (Base UI primitives), lucide-react icons |
| Auth | Firebase Authentication (email/password), server-verified session cookies |
| Database | Cloud Firestore (via `firebase-admin`, server-only) |
| Rich text | TipTap |
| PDF generation | `@react-pdf/renderer` |
| Validation | Zod |
| Hosting | Vercel |
| Fonts | next/font (Google): Instrument Serif, Azeret Mono (landing/app-wide restyle), IBM Plex was the original app font |

No ORM — Firestore is accessed directly through typed wrapper functions in `src/lib/data.ts`, which is the single source of truth for the data model (see the header comment there for the full collection map).

## Architecture

```
Browser
  │  (no direct DB access — Firestore rules deny all client reads/writes)
  ▼
Next.js middleware  — edge-safe redirect based on cookie *presence* only
  ▼
Server Components (pages)  ──calls──▶  src/lib/data.ts  ──Admin SDK──▶  Firestore
  │
Server Actions (mutations)  ──calls──▶  src/lib/data.ts  ──Admin SDK──▶  Firestore
  │
Route Handlers (/api/*)  — session cookie issuance, PDF export, file up/download
```

- `src/lib/auth.ts` — `getSessionProfile()` verifies the Firebase session cookie server-side and loads the caller's Firestore profile; `requireProfile()`/`requireAdmin()` are the two guard functions every protected page/action calls first.
- `src/lib/firebase/admin.ts` — Admin SDK singleton, initialized once from `FIREBASE_SERVICE_ACCOUNT_JSON`.
- `src/lib/firebase/client.ts` — the *only* client-side Firebase usage: sign-in and password change against Firebase Auth. Never touches Firestore.
- `src/app/api/auth/session/route.ts` — issues the session cookie on login (`POST`), clears it on logout (`DELETE`), and clears-then-redirects on an invalid/stale cookie (`GET`) — this last path exists specifically to break a redirect loop a stale cookie would otherwise cause, since Server Components can't mutate cookies themselves.
- Multi-tenancy: every org-scoped document carries an `orgId` field; every read path filters or double-checks it; every write path re-derives `orgId` from the authenticated caller's profile, never from client input.

## Database design (Firestore)

```
orgs/{orgId}                        organization record (name, identifier/short-code, logo, contact)
counters/{orgId}                    atomic per-org memo-number counter
profiles/{uid}                      user profile — orgId, role, status, designation, departmentId, photoUrl
departments/{id}                    orgId-scoped; designationId (the role responsible for this department)
designations/{id}                   orgId-scoped; independent, reusable job titles
categories/{id}                     orgId-scoped memo categories
templates/{id}                      orgId-scoped workflow templates (ordered step definitions)
memos/{id}                          the memo document + denormalized currentAssigneeId/currentStepOrder
  memos/{id}/steps/{id}             per-memo workflow instance: order, assignedUserId, status, actedAt
  memos/{id}/comments/{id}          immutable; type = general | approval | rejection | change_request
  memos/{id}/attachments/{id}       chunked-base64 file storage (≤5MB, ~700KB chunks)
  memos/{id}/versions/{n}           content snapshot taken on every (re)submission
notifications/{id}                  per-user, orgId-scoped
audit/{id}                          immutable org-wide event log (actor, event type, entity, description)
delegations/{id}                    delegatorId → delegateId, active date range
```

Firestore has no server-side joins or foreign keys, so referential integrity is enforced at the application layer: every write path that references another document (a department's `designationId`, a memo's `departmentId`, a step's `assignedUserId`) validates that the referenced document exists **and belongs to the same org** before writing. Queries deliberately use a single equality filter (usually `orgId`) plus in-memory JS filtering/sorting, to avoid requiring composite Firestore indexes.

Firestore Security Rules deny all direct client reads and writes — every access goes through the Admin SDK behind a server-side auth check, so the rules themselves are a deny-all backstop, not the primary access-control layer.

## Workflow design

1. An org admin authors a **workflow template**: an ordered list of steps, each naming a designation (e.g. "Finance Manager") or department.
2. Submitting a memo resolves that template against real people (one active user per named role) and writes a `steps` subcollection — this is the memo's own routing instance, independent of the template from then on.
3. Exactly one step is `"Active"` at a time; the memo document denormalizes `currentAssigneeId`/`currentStepOrder` so "what's on my desk" is a single indexed query, not a join.
4. The active assignee approves, rejects, or requests changes:
   - **Approve** → next step becomes active, or the memo is marked `Approved` if it was the last step.
   - **Reject** → memo status becomes `Rejected`, terminal.
   - **Request changes** → memo status becomes `Changes Requested`, `currentAssigneeId` clears, and control returns to the author.
5. The author edits and **resubmits**: a new version snapshot is taken, the step sequence resets to step 1, and every prior round's decisions/comments remain visible in the append-only event log — nothing is overwritten.
6. **Delegation**: at every turn-check (approve/reject/comment, and the inbox listing), the actor is accepted if they *are* the assignee **or** hold an active delegation from the assignee for today's date — enforced identically in the mutation's transaction and in the inbox query, so a delegate's inbox and their ability to act always agree.

## Security considerations

- **No client-side database access.** The Firebase client SDK is used only for authentication; every read and write goes through Server Components/Actions using the Admin SDK, which Firestore rules back up by denying all direct client access.
- **Session handling.** Firebase ID tokens are exchanged server-side for an httpOnly, secure session cookie (`/api/auth/session`); the cookie is verified (not just decoded) on every protected request via `requireProfile()`.
- **Tenant isolation.** Every query and mutation is scoped to the caller's own `orgId`, taken from their verified profile — never from a client-supplied value. Cross-org document IDs (e.g. a memo ID from another org) resolve to "not found," not a permissions error, to avoid confirming existence.
- **Authorization checks are server-side and per-action**, not just route-level: e.g. only a memo's author can edit/resubmit it, only the org admin role can manage users/departments/designations, only the active step's assignee (or their active delegate) can act on a memo.
- **Secrets never reach the client or the repo.** `FIREBASE_SERVICE_ACCOUNT_JSON` and the Admin SDK live server-only; `.env.local` is gitignored and was never committed (verified via `git log --all -- .env.local` and a full-history secret grep before this submission). Only `NEXT_PUBLIC_*` values (Firebase's public web config, meant to be exposed) ship to the browser.
- **Password changes require re-authentication** (current password) before Firebase allows the change, rather than trusting an already-open session alone.
- **Immutable audit trail.** Comments, versions, and audit-log entries are append-only; nothing overwrites a prior decision.

## Vibe-coding / AI-assisted development process

Built end-to-end in Claude Code (Sonnet 5) sessions, in tight iterative loops: implement a feature or fix → verify it live in a real browser session (login, click through, screenshot) → fix what's actually broken, not what's assumed broken. Notable examples of that loop from the AI history:
- A PDF font bug (`Times-Bold` + `fontStyle: italic` isn't a real react-pdf font variant) was only caught by fetching and reading the rendered PDF bytes, not by inspecting the code.
- A stale-session redirect loop was root-caused by tracing exactly why a Server Component can't clear a cookie, then fixed with a dedicated route handler — not papered over with a client-side workaround.
- A production-only build failure (`jose` ESM/CJS clash from a `firebase-admin` transitive dependency) only appeared during a real Vercel deploy, not in local `tsc`/dev — caught and fixed by reproducing the production build locally before redeploying.
- A Vercel env var (`NEXT_PUBLIC_FIREBASE_API_KEY`) silently failed to save because Vercel requires an explicit `--type` flag for a `NEXT_PUBLIC_` var that looks like a credential; diagnosed by reading the actual CLI JSON response rather than assuming the first "looks done" output meant success, then verified by a real login test against the deployed site.
- Data-model changes (e.g. linking departments to designations) were scoped deliberately: required in the primary admin UI, optional/nullable for a quick-create shortcut and pre-existing records, to avoid breaking already-shipped flows under deadline pressure — a judgment call flagged back to the user rather than made silently.

Throughout, destructive actions (wiping all organizations/users from Firebase, twice) were only executed after explicit user confirmation.

## A note on the AI history export

`docs/ai-history/` is a rendered (not raw) export of the Claude Code session `.jsonl` transcripts for this project, generated by `scripts/_export-ai-history.mjs`. During one debugging exchange the assistant accidentally printed the full `.env.local` contents (including the Firebase service-account private key) into the live conversation while checking demo credentials. That value was never committed to source control at any point (verified via `git log --all -- .env.local` and a full-history secret grep before every push), but it did exist in the raw session transcript — so the export script line-redacts any line matching a private-key/API-key/token pattern before writing the markdown, rather than shipping the raw `.jsonl`. Verified zero matches for the leaked key material, the Firebase API key, and any GitHub token across every exported file before this was pushed.

## Known limitations

- **No automated test suite.** Verification was manual/live (browser sessions) rather than unit/integration tests — a real gap for a production system, acceptable here given course scope and deadline.
- **Attachments are stored as base64 chunks in Firestore**, not a dedicated object store (Firebase Storage / S3). Works within the 5MB cap but isn't how a larger system should store files.
- **No automated Firestore backups/migrations tooling** — schema evolution so far has been additive and backward-compatible by convention (e.g. `department.designationId` is nullable for pre-existing records), not enforced by a migration system.
- **Landing page and in-app design were restyled twice this session** (once for the marketing page, once app-wide to match) — some deeper app screens may have residual visual inconsistencies not caught by spot-checking.
- **Single Vercel region / no load testing** — fine for course evaluation traffic, not validated at scale.
- **Delegation is date-range based only** — no delegation "chains" (a delegate re-delegating), and no notification digest for a delegate's inbox separate from their own.
