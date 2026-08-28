import { PageHeader } from "@/components/page-header";
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
      <PageHeader
        eyebrow="Your account"
        title="Profile"
        description="How your name and title appear on every memo you touch."
      />
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
