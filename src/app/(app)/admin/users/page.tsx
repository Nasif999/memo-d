import { requireAdmin } from "@/lib/auth";
import { listOrgProfiles, listDepartments, getOrg } from "@/lib/data";
import { UsersAdmin } from "@/components/admin/users-admin";

export default async function AdminUsersPage() {
  const admin = await requireAdmin();
  const [users, departments, org] = await Promise.all([
    listOrgProfiles(admin.orgId),
    listDepartments(admin.orgId),
    getOrg(admin.orgId),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Users</h1>
      <UsersAdmin
        users={users.map((u) => ({
          id: u.id,
          full_name: u.fullName,
          email: u.email,
          designation: u.designation,
          role: u.role,
          status: u.status,
          department_id: u.departmentId,
        }))}
        departments={departments.filter((d) => d.isActive !== false)}
        selfId={admin.id}
        joinCode={org?.joinCode ?? null}
      />
    </div>
  );
}
