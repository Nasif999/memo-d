import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { UsersAdmin } from "@/components/admin/users-admin";

export default async function AdminUsersPage() {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const [{ data: users }, { data: departments }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, designation, role, status, department_id")
      .order("full_name"),
    supabase.from("departments").select("id, name").eq("is_active", true).order("name"),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Users</h1>
      <UsersAdmin
        users={users ?? []}
        departments={departments ?? []}
        selfId={admin.id}
      />
    </div>
  );
}
