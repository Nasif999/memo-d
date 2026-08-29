import "server-only";
import { FieldValue, Timestamp, type Transaction } from "firebase-admin/firestore";
import { db } from "@/lib/firebase/admin";

// ============ Firestore data model ============
// orgs/{orgId}                       organization
// counters/{orgId}                   per-org memo number counter
// profiles/{uid}                     user profile (orgId, role, status, …)
// departments/{id}, categories/{id}, templates/{id}   org-scoped (orgId field)
// memos/{id}                        memo + denormalized currentAssigneeId
//   steps/{id}      workflow instance steps (order, assignedUserId, status …)
//   comments/{id}   immutable comments (type: general/approval/rejection/change_request)
//   attachments/{id}
//   versions/{id}   content snapshots per submission
// notifications/{id}, audit/{id}, delegations/{id}
//
// SECURITY MODEL: the browser never touches Firestore. All reads/writes run
// here under the Admin SDK after session verification, and every tenant-scoped
// read/write filters or checks orgId. Firestore rules deny all client access.

export type Profile = {
  id: string;
  orgId: string;
  fullName: string;
  email: string;
  designation: string | null;
  departmentId: string | null;
  photoUrl: string | null;
  role: "org_admin" | "user";
  // "pending" = joined by request, awaiting an administrator's approval.
  // Pending profiles are never treated as members: they cannot establish a
  // session and are filtered out of every participant picker.
  status: "active" | "inactive" | "pending";
};

export const MEMO_STATUSES = [
  "Draft", "Submitted", "Pending Review", "Pending Approval",
  "Changes Requested", "Rejected", "Approved", "Cancelled",
] as const;
export type MemoStatus = (typeof MEMO_STATUSES)[number];

export function tsToIso(v: unknown): string {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === "string") return v;
  return new Date(0).toISOString();
}

// ---------- shared helpers ----------

export async function logAudit(
  orgId: string,
  actorId: string | null,
  eventType: string,
  entityType: string | null,
  entityId: string | null,
  description: string | null
) {
  await db().collection("audit").add({
    orgId, actorId, eventType, entityType, entityId, description,
    createdAt: FieldValue.serverTimestamp(),
  });
}

export async function notifyUser(
  orgId: string,
  userId: string,
  type: string,
  memoId: string | null,
  message: string,
  link: string | null = null
) {
  await db().collection("notifications").add({
    orgId, userId, type, memoId, message, link,
    isRead: false,
    createdAt: FieldValue.serverTimestamp(),
  });
}

// Every active admin of an org — used to notify all of them about
// organization-level events (join requests) rather than a single person.
export async function listActiveAdmins(orgId: string) {
  const docs = await docsByOrg("profiles", orgId);
  return docs
    .filter((d) => d.data().role === "org_admin" && d.data().status === "active")
    .map((d) => d.id);
}

export async function getProfile(uid: string): Promise<Profile | null> {
  const snap = await db().collection("profiles").doc(uid).get();
  if (!snap.exists) return null;
  const d = snap.data()!;
  return {
    id: snap.id,
    orgId: d.orgId,
    fullName: d.fullName,
    email: d.email,
    designation: d.designation ?? null,
    departmentId: d.departmentId ?? null,
    photoUrl: d.photoUrl ?? null,
    role: d.role,
    status: d.status,
  };
}

export type Org = {
  id: string;
  name: string;
  identifier: string;
  logoUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  // The org's creator, or whoever they've since handed the role to. The
  // owner is the only member who can modify another admin's account — an
  // ordinary admin can do anything to a regular user, but nothing to a peer
  // admin. Ownership is transferable but always singular.
  ownerId: string | null;
};

export async function getOrg(orgId: string): Promise<Org | null> {
  const snap = await db().collection("orgs").doc(orgId).get();
  if (!snap.exists) return null;
  const o = snap.data()!;
  return {
    id: snap.id,
    name: o.name,
    identifier: o.identifier,
    logoUrl: o.logoUrl ?? null,
    contactEmail: o.contactEmail ?? null,
    contactPhone: o.contactPhone ?? null,
    ownerId: o.ownerId ?? null,
  };
}

// Transfers the "Owner" role to another active admin of the same org. Only
// callable by the current owner (enforced by the caller); the outgoing owner
// keeps their org_admin role, they just lose the power to edit other admins.
export async function transferOwnership(orgId: string, newOwnerId: string) {
  const target = await getProfile(newOwnerId);
  if (!target || target.orgId !== orgId || target.status !== "active") {
    throw new Error("Target must be an active member of your organization.");
  }
  const batch = db().batch();
  if (target.role !== "org_admin") {
    batch.update(db().collection("profiles").doc(newOwnerId), { role: "org_admin" });
  }
  batch.update(db().collection("orgs").doc(orgId), { ownerId: newOwnerId });
  await batch.commit();
  await logAudit(orgId, newOwnerId, "ownership_transferred", "org", orgId, target.fullName);
}

// Public directory for the "request to join" flow. Deliberately returns only
// id and name — no member counts, no contact details, nothing about memos.
export async function listJoinableOrgs() {
  const snap = await db().collection("orgs").get();
  return snap.docs
    .filter((d) => d.data().isActive !== false)
    .map((d) => ({ id: d.id, name: d.data().name as string }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// One-equality-filter queries only (no composite indexes needed);
// sorting/extra filtering happens in JS — fine at demo scale.
// Every helper maps to plain objects: raw Firestore Timestamps cannot cross
// the server/client component boundary.
async function docsByOrg(collection: string, orgId: string) {
  const snap = await db().collection(collection).where("orgId", "==", orgId).get();
  return snap.docs;
}

export type NamedItem = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
};

async function listNamed(collection: string, orgId: string): Promise<NamedItem[]> {
  const docs = await docsByOrg(collection, orgId);
  return docs
    .map((d) => {
      const x = d.data();
      return {
        id: d.id,
        name: x.name as string,
        description: (x.description ?? null) as string | null,
        isActive: x.isActive !== false,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type Department = NamedItem & { designationId: string | null };

// Departments carry a designationId — the position responsible for that
// department (e.g. Finance Department -> Finance Manager). Unlike the other
// NamedItem collections, this field is a real reference into `designations`,
// so it gets its own mapper instead of the generic listNamed().
export async function listDepartments(orgId: string): Promise<Department[]> {
  const docs = await docsByOrg("departments", orgId);
  return docs
    .map((d) => {
      const x = d.data();
      return {
        id: d.id,
        name: x.name as string,
        description: (x.description ?? null) as string | null,
        isActive: x.isActive !== false,
        designationId: (x.designationId ?? null) as string | null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function listCategories(orgId: string) {
  return listNamed("categories", orgId);
}

// ---------- designations ----------
// Designations are org-scoped, like departments and categories: a title
// anyone picks (at signup, on approval, or from the admin panel) becomes an
// "approved" designation for that org and shows up in every designation
// dropdown from then on — nobody has to hand-maintain the list.

export async function listDesignations(orgId: string) {
  return listNamed("designations", orgId);
}

export async function listActiveDesignationNames(orgId: string) {
  const rows = await listDesignations(orgId);
  return rows.filter((r) => r.isActive).map((r) => r.name);
}

export async function ensureDesignation(orgId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  const docs = await docsByOrg("designations", orgId);
  const exists = docs.some(
    (d) => (d.data().name as string).toLowerCase() === trimmed.toLowerCase()
  );
  if (exists) return;
  await db().collection("designations").add({
    orgId,
    name: trimmed,
    description: null,
    isActive: true,
    createdAt: FieldValue.serverTimestamp(),
  });
}

export async function listTemplates(orgId: string) {
  const docs = await docsByOrg("templates", orgId);
  return docs
    .map((d) => {
      const t = d.data();
      return {
        id: d.id,
        name: t.name as string,
        description: (t.description ?? null) as string | null,
        isActive: t.isActive !== false,
        steps: ((t.steps ?? []) as { order: number; label: string }[]).map((s) => ({
          order: s.order,
          label: s.label,
        })),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function listOrgProfiles(orgId: string): Promise<Profile[]> {
  const docs = await docsByOrg("profiles", orgId);
  return docs
    .map((d) => {
      const p = d.data();
      return {
        id: d.id,
        orgId: p.orgId as string,
        fullName: p.fullName as string,
        email: p.email as string,
        designation: (p.designation ?? null) as string | null,
        departmentId: (p.departmentId ?? null) as string | null,
        photoUrl: (p.photoUrl ?? null) as string | null,
        role: p.role as Profile["role"],
        status: p.status as Profile["status"],
      };
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export async function profilesMap(orgId: string) {
  const rows = await listOrgProfiles(orgId);
  return new Map(rows.map((p) => [p.id, p]));
}

// ---------- delegations ----------
// A delegation lets `delegateId` act on `delegatorId`'s behalf on whatever
// memo step is currently assigned to the delegator, for a date range. The
// turn-check in submitMemoTx honors this; here is just the CRUD for it.

export type Delegation = {
  id: string;
  orgId: string;
  delegatorId: string;
  delegateId: string;
  startDate: string; // "YYYY-MM-DD"
  endDate: string;
  reason: string | null;
  isActive: boolean;
  createdAt: string;
};

function delegationFromDoc(d: FirebaseFirestore.QueryDocumentSnapshot): Delegation {
  const v = d.data();
  return {
    id: d.id,
    orgId: v.orgId,
    delegatorId: v.delegatorId,
    delegateId: v.delegateId,
    startDate: v.startDate,
    endDate: v.endDate,
    reason: (v.reason ?? null) as string | null,
    isActive: v.isActive,
    createdAt: tsToIso(v.createdAt),
  };
}

// Is `delegateId` currently an active stand-in for `delegatorId`? Mirrors the
// turn-check in submitMemoTx / listInboxMemos.
export async function isActiveDelegate(
  orgId: string,
  delegateId: string,
  delegatorId: string
) {
  if (delegateId === delegatorId) return false;
  const today = new Date().toISOString().slice(0, 10);
  const snap = await db()
    .collection("delegations")
    .where("delegateId", "==", delegateId)
    .where("delegatorId", "==", delegatorId)
    .get();
  return snap.docs.some((d) => {
    const v = d.data();
    return (
      v.orgId === orgId &&
      v.isActive &&
      v.startDate <= today &&
      v.endDate >= today
    );
  });
}

// Delegations this user set up (as delegator) or was granted (as delegate).
export async function listDelegationsFor(orgId: string, userId: string) {
  const docs = await docsByOrg("delegations", orgId);
  const mine = docs.filter(
    (d) => d.data().delegatorId === userId || d.data().delegateId === userId
  );
  return mine
    .map(delegationFromDoc)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createDelegation(
  orgId: string,
  delegatorId: string,
  delegateId: string,
  startDate: string,
  endDate: string,
  reason: string | null
) {
  if (delegateId === delegatorId) throw new Error("Cannot delegate to yourself.");
  if (endDate < startDate) throw new Error("End date must be on or after the start date.");
  const delegate = await getProfile(delegateId);
  if (!delegate || delegate.orgId !== orgId || delegate.status !== "active") {
    throw new Error("Delegate must be an active member of your organization.");
  }
  const delegator = await getProfile(delegatorId);
  const ref = await db().collection("delegations").add({
    orgId, delegatorId, delegateId, startDate, endDate,
    reason: reason || null,
    isActive: true,
    createdAt: FieldValue.serverTimestamp(),
  });
  await logAudit(orgId, delegatorId, "delegation_created", "delegation", ref.id,
    `Delegated to ${delegate.fullName} (${startDate} to ${endDate})`);
  await notifyUser(orgId, delegateId, "delegation_created", null,
    `You were granted authority to act on ${delegator?.fullName ?? "a colleague"}'s behalf`,
    "/profile");
}

// Only the delegator (or an org admin) may revoke — a delegate cannot grant
// or strip their own authority.
export async function revokeDelegation(orgId: string, actor: Profile, delegationId: string) {
  const ref = db().collection("delegations").doc(delegationId);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.orgId !== orgId) throw new Error("Delegation not found.");
  const d = snap.data()!;
  if (d.delegatorId !== actor.id && actor.role !== "org_admin") {
    throw new Error("Only the delegator or an administrator can revoke this.");
  }
  await ref.update({ isActive: false });
  await logAudit(orgId, actor.id, "delegation_revoked", "delegation", delegationId, null);
}

// ---------- memos ----------

export type MemoDoc = {
  id: string;
  orgId: string;
  memoNumber: string | null;
  subject: string;
  body: string;
  authorId: string;
  departmentId: string | null;
  categoryId: string | null;
  priority: string;
  status: MemoStatus;
  currentStepOrder: number | null;
  currentAssigneeId: string | null;
  participantIds: string[];
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  completedAt: string | null;
};

function memoFromSnap(snap: FirebaseFirestore.DocumentSnapshot): MemoDoc {
  const d = snap.data()!;
  return {
    id: snap.id,
    orgId: d.orgId,
    memoNumber: d.memoNumber ?? null,
    subject: d.subject,
    body: d.body ?? "",
    authorId: d.authorId,
    departmentId: d.departmentId ?? null,
    categoryId: d.categoryId ?? null,
    priority: d.priority ?? "Normal",
    status: d.status,
    currentStepOrder: d.currentStepOrder ?? null,
    currentAssigneeId: d.currentAssigneeId ?? null,
    participantIds: d.participantIds ?? [],
    currentVersion: d.currentVersion ?? 1,
    createdAt: tsToIso(d.createdAt),
    updatedAt: tsToIso(d.updatedAt),
    submittedAt: d.submittedAt ? tsToIso(d.submittedAt) : null,
    completedAt: d.completedAt ? tsToIso(d.completedAt) : null,
  };
}

// Tenant boundary: returns null unless the memo belongs to the caller's org
// AND the caller may see it (drafts are author-only).
export async function getMemoForUser(memoId: string, viewer: Profile) {
  const snap = await db().collection("memos").doc(memoId).get();
  if (!snap.exists) return null;
  const memo = memoFromSnap(snap);
  if (memo.orgId !== viewer.orgId) return null;
  if (memo.status === "Draft" && memo.authorId !== viewer.id) return null;
  return memo;
}

export async function listMemosByAuthor(authorId: string, orgId: string) {
  const snap = await db()
    .collection("memos")
    .where("authorId", "==", authorId)
    .get();
  return snap.docs
    .map(memoFromSnap)
    .filter((m) => m.orgId === orgId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// A memo is "on your desk" if it's assigned to you directly, or to someone
// who has actively delegated their turn to you (see the turn-check in
// submitMemoTx — this mirrors it for the inbox listing).
export async function listInboxMemos(uid: string, orgId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const delSnap = await db()
    .collection("delegations")
    .where("delegateId", "==", uid)
    .get();
  const delegatedFor = delSnap.docs
    .map((d) => d.data())
    .filter(
      (d) =>
        d.orgId === orgId &&
        d.isActive &&
        d.startDate <= today &&
        d.endDate >= today
    )
    .map((d) => d.delegatorId as string);

  const assigneeIds = Array.from(new Set([uid, ...delegatedFor]));
  const results = await Promise.all(
    assigneeIds.map((id) =>
      db().collection("memos").where("currentAssigneeId", "==", id).get()
    )
  );
  const byId = new Map<string, MemoDoc>();
  for (const snap of results) {
    for (const doc of snap.docs) {
      byId.set(doc.id, memoFromSnap(doc));
    }
  }
  return Array.from(byId.values()).filter(
    (m) =>
      m.orgId === orgId &&
      ["Pending Approval", "Pending Review", "Submitted"].includes(m.status)
  );
}

export async function listOrgMemos(orgId: string, viewer: Profile) {
  const snap = await db().collection("memos").where("orgId", "==", orgId).get();
  return snap.docs
    .map(memoFromSnap)
    .filter((m) => m.status !== "Draft" || m.authorId === viewer.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export type StepDoc = {
  id: string;
  order: number;
  assignedUserId: string;
  positionLabel: string | null;
  status: "Pending" | "Active" | "Approved" | "Rejected" | "ChangesRequested" | "Skipped";
  actedAt: string | null;
  comment: string | null;
  actedOnBehalfOf: string | null;
};

export async function listSteps(memoId: string): Promise<StepDoc[]> {
  const snap = await db().collection("memos").doc(memoId).collection("steps").get();
  return snap.docs
    .map((d) => {
      const s = d.data();
      return {
        id: d.id,
        order: s.order,
        assignedUserId: s.assignedUserId,
        positionLabel: s.positionLabel ?? null,
        status: s.status,
        actedAt: s.actedAt ? tsToIso(s.actedAt) : null,
        comment: s.comment ?? null,
        actedOnBehalfOf: s.actedOnBehalfOf ?? null,
      } as StepDoc;
    })
    .sort((a, b) => a.order - b.order);
}

export type MemoEvent = {
  id: string;
  actorId: string;
  action: string;
  comment: string | null;
  onBehalfOf: string | null;
  stepOrder: number | null;
  versionNumber: number | null;
  createdAt: string;
};

// Append-only history. Step documents are reset when a memo is returned for
// changes and resubmitted, so the timeline is built from this log instead —
// it preserves every decision across every submission round.
export async function listEvents(memoId: string): Promise<MemoEvent[]> {
  const snap = await db().collection("memos").doc(memoId).collection("events").get();
  return snap.docs
    .map((d) => {
      const e = d.data();
      return {
        id: d.id,
        actorId: e.actorId as string,
        action: e.action as string,
        comment: (e.comment ?? null) as string | null,
        onBehalfOf: (e.onBehalfOf ?? null) as string | null,
        stepOrder: (e.stepOrder ?? null) as number | null,
        versionNumber: (e.versionNumber ?? null) as number | null,
        createdAt: tsToIso(e.createdAt),
      };
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function listComments(memoId: string) {
  const snap = await db().collection("memos").doc(memoId).collection("comments").get();
  return snap.docs
    .map((d) => {
      const c = d.data();
      return {
        id: d.id,
        authorId: c.authorId as string,
        body: c.body as string,
        type: c.type as string,
        createdAt: tsToIso(c.createdAt),
      };
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// ---------- attachments ----------
// File bytes live in Firestore: base64 split across `chunks` documents, each
// kept under the 1 MiB per-document limit. Nothing is ever public — downloads
// are streamed back through an authorization-checked route.

export const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
const CHUNK_CHARS = 700_000;

export async function listAttachments(memoId: string) {
  const snap = await db().collection("memos").doc(memoId).collection("attachments").get();
  return snap.docs
    .map((d) => {
      const a = d.data();
      return {
        id: d.id,
        filename: a.filename as string,
        sizeBytes: a.sizeBytes as number,
        mimeType: a.mimeType as string,
        uploadedBy: a.uploadedBy as string,
        chunkCount: (a.chunkCount ?? 0) as number,
        createdAt: tsToIso(a.createdAt),
      };
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function saveAttachment(
  memoId: string,
  actor: Profile,
  file: { filename: string; mimeType: string; bytes: Buffer }
) {
  const base64 = file.bytes.toString("base64");
  const chunks: string[] = [];
  for (let i = 0; i < base64.length; i += CHUNK_CHARS) {
    chunks.push(base64.slice(i, i + CHUNK_CHARS));
  }

  const attachmentRef = db()
    .collection("memos").doc(memoId)
    .collection("attachments").doc();

  // Write chunks first, a couple per commit to stay well under the request
  // size limit; the metadata document lands last so a partial upload is
  // never visible to readers.
  for (let i = 0; i < chunks.length; i += 2) {
    const batch = db().batch();
    for (let j = i; j < Math.min(i + 2, chunks.length); j++) {
      batch.set(
        attachmentRef.collection("chunks").doc(String(j).padStart(4, "0")),
        { index: j, data: chunks[j] }
      );
    }
    await batch.commit();
  }

  await attachmentRef.set({
    filename: file.filename,
    sizeBytes: file.bytes.length,
    mimeType: file.mimeType,
    uploadedBy: actor.id,
    chunkCount: chunks.length,
    createdAt: FieldValue.serverTimestamp(),
  });

  return attachmentRef.id;
}

export async function readAttachment(memoId: string, attachmentId: string) {
  const ref = db()
    .collection("memos").doc(memoId)
    .collection("attachments").doc(attachmentId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const meta = snap.data()!;

  const chunkSnap = await ref.collection("chunks").orderBy("index").get();
  if (chunkSnap.empty) return null;
  const base64 = chunkSnap.docs.map((d) => d.data().data as string).join("");

  return {
    filename: meta.filename as string,
    mimeType: meta.mimeType as string,
    bytes: Buffer.from(base64, "base64"),
  };
}

export async function deleteAttachment(memoId: string, attachmentId: string) {
  const ref = db()
    .collection("memos").doc(memoId)
    .collection("attachments").doc(attachmentId);
  await db().recursiveDelete(ref);
}

export async function listVersions(memoId: string) {
  const snap = await db().collection("memos").doc(memoId).collection("versions").get();
  return snap.docs
    .map((d) => {
      const v = d.data();
      return {
        versionNumber: v.versionNumber as number,
        subject: v.subject as string,
        body: v.body as string,
        editedBy: v.editedBy as string,
        changeReason: (v.changeReason ?? null) as string | null,
        createdAt: tsToIso(v.createdAt),
      };
    })
    .sort((a, b) => a.versionNumber - b.versionNumber);
}

// ---------- workflow engine ----------

async function nextMemoNumber(tx: Transaction, orgId: string): Promise<string> {
  const counterRef = db().collection("counters").doc(orgId);
  const orgRef = db().collection("orgs").doc(orgId);
  const [counterSnap, orgSnap] = await Promise.all([
    tx.get(counterRef),
    tx.get(orgRef),
  ]);
  const n = (counterSnap.data()?.nextNumber as number | undefined) ?? 1;
  tx.set(counterRef, { nextNumber: n + 1 }, { merge: true });
  const ident = (orgSnap.data()?.identifier as string | undefined) ?? "ORG";
  return `${ident.toUpperCase()}-${new Date().getFullYear()}-${String(n).padStart(5, "0")}`;
}

export async function submitMemoTx(
  memoId: string,
  actor: Profile,
  templateId: string | null,
  participantIds: string[]
): Promise<{ error?: string }> {
  const memoRef = db().collection("memos").doc(memoId);

  // A workflow's shape (order and roles) comes only from an admin-authored
  // template — resolved and validated here, before the transaction, so a
  // fresh submission can never invent its own routing. Resubmission passes no
  // template because it reuses the workflow the memo already has.
  let templateSteps: { order: number; label: string }[] | null = null;
  if (templateId) {
    const tSnap = await db().collection("templates").doc(templateId).get();
    const t = tSnap.data();
    if (!tSnap.exists || t!.orgId !== actor.orgId || t!.isActive === false) {
      return { error: "That workflow template is not available." };
    }
    templateSteps = ((t!.steps ?? []) as { order: number; label: string }[])
      .slice()
      .sort((a, b) => a.order - b.order);
    if (templateSteps.length !== participantIds.length) {
      return { error: "Assign someone to every step of the workflow." };
    }
  }

  // Validate participants outside the transaction (reads only).
  const validated: { userId: string; positionLabel: string | null }[] = [];
  for (let i = 0; i < participantIds.length; i++) {
    const pid = participantIds[i];
    const p = await getProfile(pid);
    if (!p || p.orgId !== actor.orgId || p.status !== "active") {
      return { error: "Invalid workflow participant." };
    }
    validated.push({ userId: pid, positionLabel: templateSteps?.[i]?.label ?? null });
  }

  let notifyTarget: string | null = null;
  let isResubmit = false;
  let subject = "";

  try {
    await db().runTransaction(async (tx) => {
      const snap = await tx.get(memoRef);
      if (!snap.exists) throw new Error("Memo not found.");
      const memo = memoFromSnap(snap);
      subject = memo.subject;
      if (memo.orgId !== actor.orgId) throw new Error("Access denied.");
      if (memo.authorId !== actor.id) throw new Error("Only the author can submit.");
      if (!["Draft", "Changes Requested"].includes(memo.status)) {
        throw new Error(`Cannot submit from status ${memo.status}.`);
      }
      isResubmit = memo.status === "Changes Requested";

      const stepsSnap = await tx.get(memoRef.collection("steps"));

      const recordEvent = (action: string, versionNumber: number) => {
        tx.set(memoRef.collection("events").doc(), {
          actorId: actor.id,
          action,
          comment: null,
          onBehalfOf: null,
          stepOrder: null,
          versionNumber,
          createdAt: FieldValue.serverTimestamp(),
        });
      };

      let memoNumber = memo.memoNumber;
      if (!memoNumber) {
        memoNumber = await nextMemoNumber(tx, actor.orgId);
      }

      let firstAssignee: string;
      if (isResubmit) {
        // Reset the existing sequence and restart from step 1.
        const steps = stepsSnap.docs
          .map((d) => ({ ref: d.ref, order: d.data().order as number, assignedUserId: d.data().assignedUserId as string }))
          .sort((a, b) => a.order - b.order);
        if (steps.length === 0) throw new Error("No workflow to resume.");
        for (const s of steps) {
          tx.update(s.ref, { status: "Pending", actedAt: null, comment: null });
        }
        tx.update(steps[0].ref, { status: "Active" });
        firstAssignee = steps[0].assignedUserId;

        const version = memo.currentVersion + 1;
        tx.set(memoRef.collection("versions").doc(String(version)), {
          versionNumber: version,
          subject: memo.subject,
          body: memo.body,
          editedBy: actor.id,
          changeReason: "Resubmission after changes requested",
          createdAt: FieldValue.serverTimestamp(),
        });
        tx.update(memoRef, {
          status: "Pending Approval",
          currentStepOrder: 1,
          currentAssigneeId: firstAssignee,
          currentVersion: version,
          memoNumber,
          completedAt: null,
          updatedAt: FieldValue.serverTimestamp(),
        });
        recordEvent("resubmitted", version);
      } else {
        if (!templateId) throw new Error("Choose a workflow template.");
        if (validated.length === 0) throw new Error("Workflow requires at least one participant.");
        if (stepsSnap.size > 0) throw new Error("Workflow already exists.");
        validated.forEach((v, i) => {
          tx.set(memoRef.collection("steps").doc(), {
            order: i + 1,
            assignedUserId: v.userId,
            positionLabel: v.positionLabel,
            status: i === 0 ? "Active" : "Pending",
            actedAt: null,
            comment: null,
            actedOnBehalfOf: null,
          });
        });
        firstAssignee = validated[0].userId;
        tx.set(memoRef.collection("versions").doc("1"), {
          versionNumber: 1,
          subject: memo.subject,
          body: memo.body,
          editedBy: actor.id,
          changeReason: "Initial submission",
          createdAt: FieldValue.serverTimestamp(),
        });
        tx.update(memoRef, {
          status: "Pending Approval",
          currentStepOrder: 1,
          currentAssigneeId: firstAssignee,
          participantIds: validated.map((v) => v.userId),
          currentVersion: 1,
          memoNumber,
          submittedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        recordEvent("submitted", 1);
      }
      notifyTarget = firstAssignee;
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Submission failed." };
  }

  if (notifyTarget) {
    await notifyUser(actor.orgId, notifyTarget, "action_required", memoId,
      `Memo requires your action: ${subject}`);
  }
  await logAudit(actor.orgId, actor.id,
    isResubmit ? "memo_resubmitted" : "memo_submitted", "memo", memoId, subject);
  return {};
}

export type WorkflowAction = "approve" | "reject" | "request_changes" | "comment";

export async function performWorkflowActionTx(
  memoId: string,
  actor: Profile,
  action: WorkflowAction,
  comment: string | null
): Promise<{ error?: string }> {
  if (["reject", "request_changes", "comment"].includes(action) && !comment?.trim()) {
    return {
      error:
        action === "reject"
          ? "A rejection reason is required."
          : action === "request_changes"
            ? "A comment explaining the requested changes is required."
            : "Comment text required.",
    };
  }

  const memoRef = db().collection("memos").doc(memoId);
  const notifications: { userId: string; type: string; message: string }[] = [];
  let auditEvent = "";
  let subject = "";

  try {
    await db().runTransaction(async (tx) => {
      const snap = await tx.get(memoRef);
      if (!snap.exists) throw new Error("Memo not found.");
      const memo = memoFromSnap(snap);
      subject = memo.subject;
      if (memo.orgId !== actor.orgId) throw new Error("Access denied.");
      if (!["Pending Approval", "Pending Review", "Submitted"].includes(memo.status)) {
        throw new Error(`Memo is not awaiting workflow action (status: ${memo.status}).`);
      }
      if (memo.currentStepOrder == null) throw new Error("No active workflow step.");

      const stepsSnap = await tx.get(memoRef.collection("steps"));
      const steps = stepsSnap.docs
        .map((d) => ({ ref: d.ref, id: d.id, ...(d.data() as {
          order: number; assignedUserId: string; status: string;
        }) }))
        .sort((a, b) => a.order - b.order);
      const current = steps.find(
        (s) => s.order === memo.currentStepOrder && s.status === "Active"
      );
      if (!current) throw new Error("No active workflow step.");

      // Turn check: assignee, or an active delegate of the assignee.
      let onBehalfOf: string | null = null;
      if (current.assignedUserId !== actor.id) {
        const delSnap = await tx.get(
          db().collection("delegations")
            .where("delegateId", "==", actor.id)
        );
        const today = new Date().toISOString().slice(0, 10);
        const valid = delSnap.docs.some((d) => {
          const del = d.data();
          return (
            del.delegatorId === current.assignedUserId &&
            del.orgId === actor.orgId &&
            del.isActive &&
            del.startDate <= today &&
            del.endDate >= today
          );
        });
        if (!valid) throw new Error("It is not your turn to act on this memo.");
        onBehalfOf = current.assignedUserId;
      }

      const commentDoc = (type: string, locked: boolean) => {
        tx.set(memoRef.collection("comments").doc(), {
          authorId: actor.id,
          body: comment!.trim(),
          type,
          locked,
          stepOrder: current.order,
          createdAt: FieldValue.serverTimestamp(),
        });
      };

      // Append-only: survives the step reset that a resubmission performs.
      const recordEvent = (act: string) => {
        tx.set(memoRef.collection("events").doc(), {
          actorId: actor.id,
          action: act,
          comment: comment?.trim() || null,
          onBehalfOf,
          stepOrder: current.order,
          versionNumber: memo.currentVersion,
          createdAt: FieldValue.serverTimestamp(),
        });
      };

      if (action === "comment") {
        commentDoc("general", false);
        recordEvent("commented");
        notifications.push({
          userId: memo.authorId,
          type: "comment_added",
          message: `New comment on memo: ${memo.subject}`,
        });
        auditEvent = "comment";
        return;
      }

      if (action === "approve") {
        tx.update(current.ref, {
          status: "Approved",
          actedAt: FieldValue.serverTimestamp(),
          comment: comment?.trim() || null,
          actedOnBehalfOf: onBehalfOf,
        });
        if (comment?.trim()) commentDoc("approval", true);
        recordEvent("approved");
        const next = steps.find((s) => s.order > current.order && s.status === "Pending");
        if (next) {
          tx.update(next.ref, { status: "Active" });
          tx.update(memoRef, {
            currentStepOrder: next.order,
            currentAssigneeId: next.assignedUserId,
            updatedAt: FieldValue.serverTimestamp(),
          });
          notifications.push({
            userId: next.assignedUserId,
            type: "action_required",
            message: `Memo requires your action: ${memo.subject}`,
          });
        } else {
          tx.update(memoRef, {
            status: "Approved",
            currentStepOrder: null,
            currentAssigneeId: null,
            completedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
          notifications.push({
            userId: memo.authorId,
            type: "memo_approved",
            message: `Your memo was approved: ${memo.subject}`,
          });
        }
        auditEvent = "approval";
        return;
      }

      if (action === "reject") {
        tx.update(current.ref, {
          status: "Rejected",
          actedAt: FieldValue.serverTimestamp(),
          comment: comment!.trim(),
          actedOnBehalfOf: onBehalfOf,
        });
        commentDoc("rejection", true);
        recordEvent("rejected");
        tx.update(memoRef, {
          status: "Rejected",
          currentStepOrder: null,
          currentAssigneeId: null,
          completedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        notifications.push({
          userId: memo.authorId,
          type: "memo_rejected",
          message: `Your memo was rejected: ${memo.subject}`,
        });
        auditEvent = "rejection";
        return;
      }

      // request_changes
      tx.update(current.ref, {
        status: "ChangesRequested",
        actedAt: FieldValue.serverTimestamp(),
        comment: comment!.trim(),
        actedOnBehalfOf: onBehalfOf,
      });
      commentDoc("change_request", true);
      recordEvent("requested changes");
      tx.update(memoRef, {
        status: "Changes Requested",
        currentStepOrder: null,
        currentAssigneeId: null,
        updatedAt: FieldValue.serverTimestamp(),
      });
      notifications.push({
        userId: memo.authorId,
        type: "changes_requested",
        message: `Changes requested on your memo: ${memo.subject}`,
      });
      auditEvent = "change_request";
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Action failed." };
  }

  for (const n of notifications) {
    if (n.userId !== actor.id) {
      await notifyUser(actor.orgId, n.userId, n.type, memoId, n.message);
    }
  }
  await logAudit(actor.orgId, actor.id, auditEvent, "memo", memoId,
    comment?.trim() || subject);
  if (auditEvent === "approval") {
    const after = await memoRef.get();
    if (after.data()?.status === "Approved") {
      await logAudit(actor.orgId, actor.id, "workflow_completed", "memo", memoId, subject);
    }
  }
  return {};
}

export async function addGeneralComment(
  memoId: string,
  actor: Profile,
  body: string
): Promise<{ error?: string }> {
  const memo = await getMemoForUser(memoId, actor);
  if (!memo) return { error: "Memo not found." };
  if (memo.authorId !== actor.id && !memo.participantIds.includes(actor.id)) {
    return { error: "Only workflow participants can comment." };
  }
  await db().collection("memos").doc(memoId).collection("comments").add({
    authorId: actor.id,
    body: body.trim(),
    type: "general",
    locked: false,
    createdAt: FieldValue.serverTimestamp(),
  });
  if (memo.authorId !== actor.id) {
    await notifyUser(actor.orgId, memo.authorId, "comment_added", memoId,
      `New comment on memo: ${memo.subject}`);
  }
  await logAudit(actor.orgId, actor.id, "comment", "memo", memoId, body.trim());
  return {};
}

export async function cancelMemoTx(
  memoId: string,
  actor: Profile
): Promise<{ error?: string }> {
  const memoRef = db().collection("memos").doc(memoId);
  try {
    await db().runTransaction(async (tx) => {
      const snap = await tx.get(memoRef);
      if (!snap.exists) throw new Error("Memo not found.");
      const memo = memoFromSnap(snap);
      if (memo.orgId !== actor.orgId) throw new Error("Access denied.");
      if (memo.authorId !== actor.id) throw new Error("Only the author can cancel.");
      if (["Approved", "Rejected", "Cancelled"].includes(memo.status)) {
        throw new Error("Memo already finalized.");
      }
      const stepsSnap = await tx.get(memoRef.collection("steps"));
      for (const d of stepsSnap.docs) {
        if (["Pending", "Active"].includes(d.data().status)) {
          tx.update(d.ref, { status: "Skipped" });
        }
      }
      tx.update(memoRef, {
        status: "Cancelled",
        currentStepOrder: null,
        currentAssigneeId: null,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Cancel failed." };
  }
  await logAudit(actor.orgId, actor.id, "memo_cancelled", "memo", memoId, null);
  return {};
}

// ---------- notifications ----------

export async function listNotifications(uid: string) {
  const snap = await db()
    .collection("notifications")
    .where("userId", "==", uid)
    .get();
  return snap.docs
    .map((d) => {
      const n = d.data();
      return {
        id: d.id,
        type: n.type as string,
        memoId: (n.memoId ?? null) as string | null,
        link: (n.link ?? null) as string | null,
        message: n.message as string,
        isRead: n.isRead as boolean,
        createdAt: tsToIso(n.createdAt),
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 100);
}

export async function countUnread(uid: string) {
  const snap = await db()
    .collection("notifications")
    .where("userId", "==", uid)
    .get();
  return snap.docs.filter((d) => !d.data().isRead).length;
}

export async function markAllNotificationsRead(uid: string) {
  const snap = await db()
    .collection("notifications")
    .where("userId", "==", uid)
    .get();
  const batch = db().batch();
  for (const d of snap.docs) {
    if (!d.data().isRead) batch.update(d.ref, { isRead: true });
  }
  await batch.commit();
}

// ---------- audit ----------

export async function listAudit(orgId: string, limit = 200) {
  const snap = await db().collection("audit").where("orgId", "==", orgId).get();
  return snap.docs
    .map((d) => {
      const a = d.data();
      return {
        id: d.id,
        actorId: (a.actorId ?? null) as string | null,
        eventType: a.eventType as string,
        entityType: (a.entityType ?? null) as string | null,
        description: (a.description ?? null) as string | null,
        createdAt: tsToIso(a.createdAt),
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}
