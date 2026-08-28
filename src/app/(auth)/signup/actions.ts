"use server";

import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, db } from "@/lib/firebase/admin";
import { logAudit, listJoinableOrgs, listActiveAdmins, notifyUser } from "@/lib/data";

// Public, unauthenticated endpoint: registers a new tenant and its first
// administrator. It can only ever create a brand-new organization — it never
// touches an existing one, and the new user is always scoped to the org it
// creates here.

const schema = z.object({
  orgName: z.string().trim().min(2).max(200),
  identifier: z
    .string()
    .trim()
    .min(2)
    .max(10)
    .regex(/^[A-Za-z0-9]+$/, "Identifier must be letters and numbers only"),
  fullName: z.string().trim().min(1).max(120),
  email: z.string().trim().email(),
  password: z.string().min(8).max(72),
  designation: z.string().trim().max(120),
});

export type SignupInput = z.infer<typeof schema>;

const DEFAULT_DEPARTMENTS = [
  { name: "Administration", description: "Administrative office" },
  { name: "Finance", description: "Finance and accounts" },
];

const DEFAULT_CATEGORIES = [
  "Administrative", "Financial", "Procurement", "HR", "Academic", "Technical", "General",
];

export async function registerOrganization(input: SignupInput) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid registration details." };
  }
  const { orgName, fullName, email, password, designation } = parsed.data;
  const identifier = parsed.data.identifier.toUpperCase();

  // Organization identifiers must be unique — they prefix every memo number.
  const clash = await db()
    .collection("orgs")
    .where("identifier", "==", identifier)
    .limit(1)
    .get();
  if (!clash.empty) {
    return { error: `The identifier "${identifier}" is already taken.` };
  }

  let uid: string;
  try {
    const created = await adminAuth().createUser({
      email,
      password,
      displayName: fullName,
      emailVerified: true,
    });
    uid = created.uid;
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "auth/email-already-exists") {
      return { error: "An account with that email already exists." };
    }
    return { error: "Could not create the administrator account." };
  }

  try {
    const orgRef = await db().collection("orgs").add({
      name: orgName,
      identifier,
      logoUrl: null,
      contactEmail: email,
      contactPhone: null,
      isActive: true,
      createdAt: FieldValue.serverTimestamp(),
    });

    const batch = db().batch();
    let firstDeptRef: FirebaseFirestore.DocumentReference | null = null;
    for (const dept of DEFAULT_DEPARTMENTS) {
      const ref = db().collection("departments").doc();
      firstDeptRef ??= ref;
      batch.set(ref, {
        orgId: orgRef.id,
        name: dept.name,
        description: dept.description,
        isActive: true,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    for (const name of DEFAULT_CATEGORIES) {
      batch.set(db().collection("categories").doc(), {
        orgId: orgRef.id,
        name,
        description: null,
        isActive: true,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    batch.set(db().collection("profiles").doc(uid), {
      orgId: orgRef.id,
      fullName,
      email,
      designation: designation || "Administrator",
      departmentId: firstDeptRef?.id ?? null,
      role: "org_admin",
      status: "active",
      createdAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();

    await logAudit(orgRef.id, uid, "organization_created", "org", orgRef.id, orgName);
    await logAudit(orgRef.id, uid, "user_created", "user", uid, email);
    return { ok: true };
  } catch {
    // Roll back the auth user so a failed registration can be retried.
    await adminAuth().deleteUser(uid).catch(() => {});
    return { error: "Could not create the organization. Please try again." };
  }
}


// ---------------------------------------------------------------------------
// Joining an existing organization
//
// Neither path below lets a caller choose their own org membership freely:
//   - "join with code" requires a secret held by that org's administrator;
//   - "request to join" creates a profile with status "pending", which grants
//     no access at all until an administrator of that same org approves it.
// Both always create a plain "user" — never an administrator — and the orgId
// is derived server-side, never taken from client input.
// ---------------------------------------------------------------------------

const accountSchema = {
  fullName: z.string().trim().min(1).max(120),
  email: z.string().trim().email(),
  password: z.string().min(8).max(72),
  designation: z.string().trim().max(120),
};

const joinRequestSchema = z.object({
  ...accountSchema,
  orgId: z.string().trim().min(1),
});

type JoinResult =
  | { error: string; orgName?: undefined }
  | { ok: true; orgName: string; error?: undefined };

export type JoinRequestInput = z.infer<typeof joinRequestSchema>;

// Org names shown in the "request to join" picker. Public by necessity: you
// cannot ask to join something you cannot name. Exposes nothing else.
export async function joinableOrganizations() {
  return listJoinableOrgs();
}

async function createMember(
  orgId: string,
  input: { fullName: string; email: string; password: string; designation: string },
  status: "active" | "pending"
): Promise<{ error?: string }> {
  let uid: string;
  try {
    const created = await adminAuth().createUser({
      email: input.email,
      password: input.password,
      displayName: input.fullName,
      emailVerified: true,
    });
    uid = created.uid;
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "auth/email-already-exists") {
      return { error: "An account with that email already exists." };
    }
    return { error: "Could not create the account." };
  }

  try {
    await db().collection("profiles").doc(uid).set({
      orgId,
      fullName: input.fullName,
      email: input.email,
      designation: input.designation || null,
      departmentId: null,
      role: "user", // never an administrator by self-service
      status,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch {
    await adminAuth().deleteUser(uid).catch(() => {});
    return { error: "Could not complete the request. Please try again." };
  }

  await logAudit(orgId, uid, "join_requested", "user", uid, input.email);

  // Pending applicants can't sign in to see anything, so the only people who
  // can act on this are the org's admins — notify every one of them.
  if (status === "pending") {
    const adminIds = await listActiveAdmins(orgId);
    await Promise.all(
      adminIds.map((adminId) =>
        notifyUser(
          orgId,
          adminId,
          "join_requested",
          null,
          `${input.fullName} requested to join your organization`,
          "/admin/users"
        )
      )
    );
  }

  return {};
}

export async function requestToJoin(input: JoinRequestInput): Promise<JoinResult> {
  const parsed = joinRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid details." };
  }
  const snap = await db().collection("orgs").doc(parsed.data.orgId).get();
  if (!snap.exists || snap.data()?.isActive === false) {
    return { error: "That organization is not available." };
  }

  const res = await createMember(snap.id, parsed.data, "pending");
  if (res.error) return { error: res.error };
  return { ok: true, orgName: snap.data()!.name as string };
}
