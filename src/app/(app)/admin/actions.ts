"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";

// ---------- users ----------

const newUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  full_name: z.string().trim().min(1).max(120),
  designation: z.string().trim().max(120),
  department_id: z.string().uuid().nullable(),
  role: z.enum(["org_admin", "user"]),
});

export async function createUser(input: z.infer<typeof newUserSchema>) {
  const admin = await requireAdmin();
  const parsed = newUserSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid user data." };

  // Service role required to create auth users; org is forced to the admin's own org.
  const adminClient = createAdminClient();
  const { data: created, error: authError } =
    await adminClient.auth.admin.createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      email_confirm: true,
    });
  if (authError || !created.user) {
    return { error: authError?.message ?? "Could not create user." };
  }

  const { error: profileError } = await adminClient.from("profiles").insert({
    id: created.user.id,
    org_id: admin.org_id,
    full_name: parsed.data.full_name,
    email: parsed.data.email,
    designation: parsed.data.designation || null,
    department_id: parsed.data.department_id,
    role: parsed.data.role,
  });
  if (profileError) {
    await adminClient.auth.admin.deleteUser(created.user.id);
    return { error: "Could not create profile." };
  }

  const supabase = await createClient();
  await supabase.rpc("log_auth_event", { p_event: "user_created" });
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function setUserStatus(userId: string, status: "active" | "inactive") {
  const admin = await requireAdmin();
  const supabase = await createClient();
  // RLS admin policy scopes this to the admin's own org.
  const { error } = await supabase
    .from("profiles")
    .update({ status })
    .eq("id", userId)
    .eq("org_id", admin.org_id);
  if (error) return { error: "Could not update user." };
  await supabase.rpc("log_auth_event", {
    p_event: status === "active" ? "user_activated" : "user_deactivated",
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function setUserRole(userId: string, role: "org_admin" | "user") {
  const admin = await requireAdmin();
  if (userId === admin.id) return { error: "You cannot change your own role." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId)
    .eq("org_id", admin.org_id);
  if (error) return { error: "Could not update role." };
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function setUserDepartment(userId: string, departmentId: string | null) {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ department_id: departmentId })
    .eq("id", userId)
    .eq("org_id", admin.org_id);
  if (error) return { error: "Could not update department." };
  revalidatePath("/admin/users");
  return { ok: true };
}

// ---------- departments ----------

const deptSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500),
});

export async function upsertDepartment(
  input: z.infer<typeof deptSchema>,
  id?: string
) {
  const admin = await requireAdmin();
  const parsed = deptSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid department data." };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("departments").update(parsed.data).eq("id", id)
    : await supabase.from("departments").insert({ ...parsed.data, org_id: admin.org_id });
  if (error) return { error: "Could not save department." };
  revalidatePath("/admin/departments");
  return { ok: true };
}

export async function setDepartmentActive(id: string, isActive: boolean) {
  await requireAdmin();
  const supabase = await createClient();
  // Soft-deactivate only — historical memos keep their department reference.
  const { error } = await supabase
    .from("departments")
    .update({ is_active: isActive })
    .eq("id", id);
  if (error) return { error: "Could not update department." };
  revalidatePath("/admin/departments");
  return { ok: true };
}

// ---------- categories ----------

export async function upsertCategory(
  input: z.infer<typeof deptSchema>,
  id?: string
) {
  const admin = await requireAdmin();
  const parsed = deptSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid category data." };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("memo_categories").update(parsed.data).eq("id", id)
    : await supabase.from("memo_categories").insert({ ...parsed.data, org_id: admin.org_id });
  if (error) return { error: "Could not save category." };
  revalidatePath("/admin/categories");
  return { ok: true };
}

export async function setCategoryActive(id: string, isActive: boolean) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("memo_categories")
    .update({ is_active: isActive })
    .eq("id", id);
  if (error) return { error: "Could not update category." };
  revalidatePath("/admin/categories");
  return { ok: true };
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
  const supabase = await createClient();
  const { data: template, error } = await supabase
    .from("workflow_templates")
    .insert({
      name: parsed.data.name,
      description: parsed.data.description || null,
      org_id: admin.org_id,
      created_by: admin.id,
    })
    .select("id")
    .single();
  if (error || !template) return { error: "Could not create template." };
  const { error: stepsError } = await supabase
    .from("workflow_template_steps")
    .insert(
      parsed.data.steps.map((label, i) => ({
        template_id: template.id,
        step_order: i + 1,
        position_label: label,
      }))
    );
  if (stepsError) return { error: "Could not save template steps." };
  revalidatePath("/admin/workflow-templates");
  return { ok: true };
}

export async function setTemplateActive(id: string, isActive: boolean) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("workflow_templates")
    .update({ is_active: isActive })
    .eq("id", id);
  if (error) return { error: "Could not update template." };
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
  const supabase = await createClient();
  const { error } = await supabase
    .from("orgs")
    .update({
      name: parsed.data.name,
      contact_email: parsed.data.contact_email || null,
      contact_phone: parsed.data.contact_phone || null,
    })
    .eq("id", admin.org_id);
  if (error) return { error: "Could not update organization." };
  revalidatePath("/admin");
  return { ok: true };
}
