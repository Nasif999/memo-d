import { requireProfile } from "@/lib/auth";
import { getOrg, listDepartments } from "@/lib/data";
import { ProfileForm } from "@/components/profile-form";

export default async function ProfilePage() {
  const profile = await requireProfile();
  const [org, departments] = await Promise.all([
    getOrg(profile.orgId),
    listDepartments(profile.orgId),
  ]);
  const deptName =
    departments.find((d) => d.id === profile.departmentId)?.name ?? "—";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">My Profile</h1>
      <ProfileForm
        profile={{
          full_name: profile.fullName,
          email: profile.email,
          designation: profile.designation ?? "",
          role: profile.role,
          status: profile.status,
          department: deptName,
          org: org?.name ?? "",
        }}
      />
    </div>
  );
}
