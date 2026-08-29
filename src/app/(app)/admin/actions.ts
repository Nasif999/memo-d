"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, db } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/auth";
import {
  logAudit, transferOwnership as transferOwnershipData, ensureDesignation,
} from "@/lib/data";

// Every action here re-verifies the caller is an org admin and scopes all
// reads/writes to the admin's own orgId.

async function assertSameOrg(collection: string, id: string, orgId: string) {
  const snap = await db().collection(collection).doc(id).get();
  return snap.exists && snap.data()!.orgId === orgId;
}

async function isOwner(orgId: string, userId: string) {
  const org = await db().collection("orgs").doc(orgId).get();
  return org.exists && org.data()!.ownerId === userId;
}

// An ordinary admin can change anything about a regular user, but nothing
// about another admin — only the org's Owner can touch a peer admin's
// account. Acting on yourself is handled separately by each action.
async function assertMayModify(admin: { id: string; orgId: string }, targetUserId: string) {
  const targetSnap = await db().collection("profiles").doc(targetUserId).get();
  if (!targetSnap.exists || targetSnap.data()!.orgId !== admin.orgId) {
    return "User not found.";
  }
  if (targetSnap.data()!.role === "org_admin" && targetUserId !== admin.id) {
    if (!(await isOwner(admin.orgId, admin.id))) {
      return "Only the organization owner can modify another admin's account.";
    }
  }
  return null;
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
  if (parsed.data.designation) await ensureDesignation(admin.orgId, parsed.data.designation);

  await logAudit(admin.orgId, admin.id, "user_created", "user", uid, parsed.data.email);
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function setUserStatus(userId: string, status: "active" | "inactive") {
  const admin = await requireAdmin();
  if (userId === admin.id) return { error: "You cannot deactivate yourself." };
  const denied = await assertMayModify(admin, userId);
  if (denied) return { error: denied };
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
  const denied = await assertMayModify(admin, userId);
  if (denied) return { error: denied };
  if (role === "user" && (await isOwner(admin.orgId, userId))) {
    return { error: "The owner cannot be demoted — transfer ownership first." };
  }
  await db().collection("profiles").doc(userId).update({ role });
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function setUserDepartment(userId: string, departmentId: string | null) {
  const admin = await requireAdmin();
  const denied = await assertMayModify(admin, userId);
  if (denied) return { error: denied };
  if (departmentId && !(await assertSameOrg("departments", departmentId, admin.orgId))) {
    return { error: "Department not found." };
  }
  await db().collection("profiles").doc(userId).update({ departmentId });
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function setUserDesignation(userId: string, designation: string) {
  const admin = await requireAdmin();
  const denied = await assertMayModify(admin, userId);
  if (denied) return { error: denied };
  const trimmed = designation.trim().slice(0, 120);
  await db().collection("profiles").doc(userId).update({ designation: trimmed || null });
  if (trimmed) await ensureDesignation(admin.orgId, trimmed);
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function removeUser(userId: string) {
  const admin = await requireAdmin();
  if (userId === admin.id) return { error: "You cannot remove yourself." };
  const denied = await assertMayModify(admin, userId);
  if (denied) return { error: denied };
  if (await isOwner(admin.orgId, userId)) {
    return { error: "The owner cannot be removed — transfer ownership first." };
  }
  const snap = await db().collection("profiles").doc(userId).get();
  const profile = snap.data();
  if (!snap.exists || profile!.orgId !== admin.orgId) return { error: "User not found." };

  await db().collection("profiles").doc(userId).delete();
  await adminAuth().deleteUser(userId).catch(() => {});
  await logAudit(admin.orgId, admin.id, "user_removed", "user", userId, profile!.email ?? null);
  revalidatePath("/admin/users");
  return { ok: true };
}

// ---------- ownership ----------

export async function transferOwnership(newOwnerId: string) {
  const admin = await requireAdmin();
  if (!(await isOwner(admin.orgId, admin.id))) {
    return { error: "Only the current owner can transfer ownership." };
  }
  if (newOwnerId === admin.id) return { error: "You already own this organization." };
  try {
    await transferOwnershipData(admin.orgId, newOwnerId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not transfer ownership." };
  }
  revalidatePath("/admin/users");
  return { ok: true };
}

// ---------- departments & categories ----------

const namedSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500),
});

async function upsertNamed(
  collection: "departments" | "categories" | "designations",
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
    revalidatePath(`/admin/${collection}`);
    return { ok: true, id };
  }
  const ref = await db().collection(collection).add({
    orgId: admin.orgId,
    name: parsed.data.name,
    description: parsed.data.description || null,
    isActive: true,
    createdAt: FieldValue.serverTimestamp(),
  });
  revalidatePath(`/admin/${collection}`);
  return { ok: true, id: ref.id };
}

async function toggleNamed(
  collection: "departments" | "categories" | "templates" | "designations",
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

const departmentSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500),
  // Optional here so the quick "+ Create" shortcut in the department picker
  // (used while assigning a user) can still create a bare department — the
  // dedicated Departments admin page is what actually requires picking one.
  designation_id: z.string().trim().optional(),
});

// A department's designation is the position responsible for it (e.g.
// Finance Department -> Finance Manager) — distinct from `departments &
// categories` above, this needs its own function since it writes a real
// reference field the generic upsertNamed doesn't know about.
export async function upsertDepartment(input: z.infer<typeof departmentSchema>, id?: string) {
  const admin = await requireAdmin();
  const parsed = departmentSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid data." };
  if (parsed.data.designation_id &&
      !(await assertSameOrg("designations", parsed.data.designation_id, admin.orgId))) {
    return { error: "Designation not found." };
  }
  const designationId = parsed.data.designation_id || null;
  if (id) {
    if (!(await assertSameOrg("departments", id, admin.orgId))) {
      return { error: "Not found." };
    }
    await db().collection("departments").doc(id).update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      designationId,
    });
    revalidatePath("/admin/departments");
    return { ok: true, id };
  }
  const ref = await db().collection("departments").add({
    orgId: admin.orgId,
    name: parsed.data.name,
    description: parsed.data.description || null,
    designationId,
    isActive: true,
    createdAt: FieldValue.serverTimestamp(),
  });
  revalidatePath("/admin/departments");
  return { ok: true, id: ref.id };
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
export async function upsertDesignationEntry(input: z.infer<typeof namedSchema>, id?: string) {
  return upsertNamed("designations", input, id);
}
export async function setDesignationEntryActive(id: string, isActive: boolean) {
  return toggleNamed("designations", id, isActive);
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

export async function updateTemplate(id: string, input: z.infer<typeof templateSchema>) {
  const admin = await requireAdmin();
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return { error: "Template needs a name and at least one step." };
  if (!(await assertSameOrg("templates", id, admin.orgId))) {
    return { error: "Template not found." };
  }
  await db().collection("templates").doc(id).update({
    name: parsed.data.name,
    description: parsed.data.description || null,
    steps: parsed.data.steps.map((label, i) => ({ order: i + 1, label })),
  });
  revalidatePath("/admin/workflow-templates");
  return { ok: true };
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

  const finalDesignation = designation || profile.designation || null;
  await ref.update({
    status: "active",
    role,
    departmentId: parsed.data.department_id || null,
    designation: finalDesignation,
    approvedBy: admin.id,
    approvedAt: FieldValue.serverTimestamp(),
  });
  if (finalDesignation) await ensureDesignation(admin.orgId, finalDesignation);
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
