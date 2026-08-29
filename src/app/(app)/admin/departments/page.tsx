import { requireAdmin } from "@/lib/auth";
import { listDepartments, listDesignations } from "@/lib/data";
import { DepartmentsAdmin } from "@/components/admin/departments-admin";

export default async function AdminDepartmentsPage() {
  const admin = await requireAdmin();
  const [departments, designations] = await Promise.all([
    listDepartments(admin.orgId),
    listDesignations(admin.orgId),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Departments</h1>
      <p className="text-sm text-muted-foreground">
        Every department is linked to the designation responsible for it — e.g.
        Finance Department → Finance Manager. Deactivating a department keeps
        all historical memo data.
      </p>
      <DepartmentsAdmin
        departments={departments.map((d) => ({
          id: d.id,
          name: d.name,
          description: d.description ?? null,
          is_active: d.isActive !== false,
          designation_id: d.designationId,
        }))}
        designations={designations
          .filter((d) => d.isActive !== false)
          .map((d) => ({ id: d.id, name: d.name }))}
      />
    </div>
  );
}
