import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SimpleCrud } from "@/components/admin/simple-crud";
import { upsertDepartment, setDepartmentActive } from "../actions";

export default async function AdminDepartmentsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: departments } = await supabase
    .from("departments")
    .select("id, name, description, is_active")
    .order("name");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Departments</h1>
      <p className="text-sm text-muted-foreground">
        Deactivating a department keeps all historical memo data.
      </p>
      <SimpleCrud
        title="Department"
        items={departments ?? []}
        onSave={upsertDepartment}
        onToggle={setDepartmentActive}
      />
    </div>
  );
}
