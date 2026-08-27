import { requireAdmin } from "@/lib/auth";
import { listDepartments } from "@/lib/data";
import { SimpleCrud } from "@/components/admin/simple-crud";
import { upsertDepartment, setDepartmentActive } from "../actions";

export default async function AdminDepartmentsPage() {
  const admin = await requireAdmin();
  const departments = await listDepartments(admin.orgId);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Departments</h1>
      <p className="text-sm text-muted-foreground">
        Deactivating a department keeps all historical memo data.
      </p>
      <SimpleCrud
        title="Department"
        items={departments.map((d) => ({
          id: d.id,
          name: d.name,
          description: d.description ?? null,
          is_active: d.isActive !== false,
        }))}
        onSave={upsertDepartment}
        onToggle={setDepartmentActive}
      />
    </div>
  );
}
