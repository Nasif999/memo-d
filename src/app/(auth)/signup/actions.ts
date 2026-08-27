"use server";

import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, db } from "@/lib/firebase/admin";
import { logAudit } from "@/lib/data";

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
