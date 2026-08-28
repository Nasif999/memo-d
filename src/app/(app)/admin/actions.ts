"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, db } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/data";

// Every action here re-verifies the caller is an org admin and scopes all
// reads/writes to the admin's own orgId.

async function assertSameOrg(collection: string, id: string, orgId: string) {
  const snap = await db().collection(collection).doc(id).get();
  return snap.exists && snap.data()!.orgId === orgId;
}

// ---------- users ----------

const newUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  full_name: z.string().trim().min(1).max(120),
  designation: z.string().trim().max(120),
  department_id: z.string().nullable(),
  role: z.enum(["org_admin", "user"]),
});

export async function createUser(input: z.infer<typeof newUserSchema>) {
  const admin = await requireAdmin();
  const parsed = newUserSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid user data." };

  let uid: string;
  try {
    const created = await adminAuth().createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      displayName: parsed.data.full_name,
      emailVerified: true,
    });
    uid = created.uid;
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Could not create user.",
    };
  }

  await db().collection("profiles").doc(uid).set({
    orgId: admin.orgId, // forced to the admin's own org
    fullName: parsed.data.full_name,
    email: parsed.data.email,
    designation: parsed.data.designation || null,
    departmentId: parsed.data.department_id || null,
    role: parsed.data.role,
    status: "active",
    createdAt: FieldValue.serverTimestamp(),
  });

  await logAudit(admin.orgId, admin.id, "user_created", "user", uid, parsed.data.email);
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function setUserStatus(userId: string, status: "active" | "inactive") {
  const admin = await requireAdmin();
  if (userId === admin.id) return { error: "You cannot deactivate yourself." };
  if (!(await assertSameOrg("profiles", userId, admin.orgId))) {
    return { error: "User not found." };
  }
  // Pending join requests go through approveJoinRequest, which also assigns a
  // role and department — they must not be activated by the plain toggle.
  const current = await db().collection("profiles").doc(userId).get();
  if (current.data()?.status === "pending") {
    return { error: "Approve or reject this join request instead." };
  }
  await db().collection("profiles").doc(userId).update({ status });
  // Deactivation also revokes existing sessions immediately.
  if (status === "inactive") {
    await adminAuth().revokeRefreshTokens(userId);
  }
  await logAudit(admin.orgId, admin.id,
    status === "active" ? "user_activated" : "user_deactivated", "user", userId, null);
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function setUserRole(userId: string, role: "org_admin" | "user") {
  const admin = await requireAdmin();
  if (userId === admin.id) return { error: "You cannot change your own role." };
  if (!(await assertSameOrg("profiles", userId, admin.orgId))) {
    return { error: "User not found." };
  }
  await db().collection("profiles").doc(userId).update({ role });
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function setUserDepartment(userId: string, departmentId: string | null) {
  const admin = await requireAdmin();
  if (!(await assertSameOrg("profiles", userId, admin.orgId))) {
    return { error: "User not found." };
  }
  if (departmentId && !(await assertSameOrg("departments", departmentId, admin.orgId))) {
    return { error: "Department not found." };
  }
  await db().collection("profiles").doc(userId).update({ departmentId });
  revalidatePath("/admin/users");
  return { ok: true };
}

// ---------- departments & categories ----------

const namedSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500),
});

async function upsertNamed(
  collection: "departments" | "categories",
  input: z.infer<typeof namedSchema>,
  id?: string
) {
  const admin = await requireAdmin();
  const parsed = namedSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid data." };
  if (id) {
    if (!(await assertSameOrg(collection, id, admin.orgId))) {
      return { error: "Not found." };
    }
    await db().collection(collection).doc(id).update({
      name: parsed.data.name,
      description: parsed.data.description || null,
    });
  } else {
    await db().collection(collection).add({
      orgId: admin.orgId,
      name: parsed.data.name,
      description: parsed.data.description || null,
      isActive: true,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
  revalidatePath(`/admin/${collection}`);
  return { ok: true };
}

async function toggleNamed(
  collection: "departments" | "categories" | "templates",
  id: string,
  isActive: boolean
) {
  const admin = await requireAdmin();
  if (!(await assertSameOrg(collection, id, admin.orgId))) {
    return { error: "Not found." };
  }
  // Soft-deactivate only — historical memo data keeps its references.
  await db().collection(collection).doc(id).update({ isActive });
  revalidatePath(`/admin/${collection === "templates" ? "workflow-templates" : collection}`);
  return { ok: true };
}

export async function upsertDepartment(input: z.infer<typeof namedSchema>, id?: string) {
  return upsertNamed("departments", input, id);
}
export async function setDepartmentActive(id: string, isActive: boolean) {
  return toggleNamed("departments", id, isActive);
}
export async function upsertCategory(input: z.infer<typeof namedSchema>, id?: string) {
  return upsertNamed("categories", input, id);
}
export async function setCategoryActive(id: string, isActive: boolean) {
  return toggleNamed("categories", id, isActive);
}

// ---------- workflow templates ----------

const templateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500),
  steps: z.array(z.string().trim().min(1).max(120)).min(1).max(10),
});

export async function createTemplate(input: z.infer<typeof templateSchema>) {
  const admin = await requireAdmin();
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return { error: "Template needs a name and at least one step." };
  await db().collection("templates").add({
    orgId: admin.orgId,
    name: parsed.data.name,
    description: parsed.data.description || null,
    isActive: true,
    createdBy: admin.id,
    steps: parsed.data.steps.map((label, i) => ({ order: i + 1, label })),
    createdAt: FieldValue.serverTimestamp(),
  });
  revalidatePath("/admin/workflow-templates");
  return { ok: true };
}

export async function setTemplateActive(id: string, isActive: boolean) {
  return toggleNamed("templates", id, isActive);
}

// ---------- org ----------

const orgSchema = z.object({
  name: z.string().trim().min(1).max(200),
  contact_email: z.string().email().or(z.literal("")),
  contact_phone: z.string().trim().max(50),
});

export async function updateOrg(input: z.infer<typeof orgSchema>) {
  const admin = await requireAdmin();
  const parsed = orgSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid organization data." };
  await db().collection("orgs").doc(admin.orgId).update({
    name: parsed.data.name,
    contactEmail: parsed.data.contact_email || null,
    contactPhone: parsed.data.contact_phone || null,
  });
  revalidatePath("/admin");
  return { ok: true };
}


// ---------- join requests & invite code ----------

const approveSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["org_admin", "user"]),
  department_id: z.string().nullable(),
  designation: z.string().trim().max(120),
});

// Approving a join request is the only way a "pending" profile becomes a
// member. The admin sets the role and department here, so a self-service
// request can never choose its own privileges.
export async function approveJoinRequest(input: z.infer<typeof approveSchema>) {
  const admin = await requireAdmin();
  const parsed = approveSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid approval data." };
  const { userId, role, designation } = parsed.data;

  const ref = db().collection("profiles").doc(userId);
  const snap = await ref.get();
  const profile = snap.data();
  if (!profile || profile.orgId !== admin.orgId) {
    return { error: "Request not found." };
  }
  if (profile.status !== "pending") {
    return { error: "That request is no longer pending." };
  }
  if (parsed.data.department_id &&
      !(await assertSameOrg("departments", parsed.data.department_id, admin.orgId))) {
    return { error: "Department not found." };
  }

  await ref.update({
    status: "active",
    role,
    departmentId: parsed.data.department_id || null,
    designation: designation || profile.designation || null,
    approvedBy: admin.id,
    approvedAt: FieldValue.serverTimestamp(),
  });
  await logAudit(admin.orgId, admin.id, "join_request_approved", "user", userId, profile.email);
  revalidatePath("/admin/users");
  return { ok: true };
}

// Rejection removes both the profile and the auth user, so the applicant can
// re-apply later with the same email address.
export async function rejectJoinRequest(userId: string) {
  const admin = await requireAdmin();
  const ref = db().collection("profiles").doc(userId);
  const snap = await ref.get();
  const profile = snap.data();
  if (!profile || profile.orgId !== admin.orgId) {
    return { error: "Request not found." };
  }
  if (profile.status !== "pending") {
    return { error: "That request is no longer pending." };
  }
  await ref.delete();
  await adminAuth().deleteUser(userId).catch(() => {});
  await logAudit(admin.orgId, admin.id, "join_request_rejected", "user", userId, profile.email);
  revalidatePath("/admin/users");
  return { ok: true };
}
