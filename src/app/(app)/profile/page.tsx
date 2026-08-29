import { PageHeader } from "@/components/page-header";
import { requireProfile } from "@/lib/auth";
import {
  getOrg, listDepartments, listOrgProfiles, listDelegationsFor,
  listActiveDesignationNames,
} from "@/lib/data";
import { ProfileForm } from "@/components/profile-form";
import { DelegationPanel, type DelegationRow } from "@/components/delegation-panel";

export default async function ProfilePage() {
  const profile = await requireProfile();
  const [org, departments, members, delegations, designationOptions] = await Promise.all([
    getOrg(profile.orgId),
    listDepartments(profile.orgId),
    listOrgProfiles(profile.orgId),
    listDelegationsFor(profile.orgId, profile.id),
    listActiveDesignationNames(profile.orgId),
  ]);
  const deptName =
    departments.find((d) => d.id === profile.departmentId)?.name ?? "—";
  const nameById = new Map(members.map((m) => [m.id, m.fullName]));

  const delegationRows: DelegationRow[] = delegations.map((d) => ({
    id: d.id,
    delegatorId: d.delegatorId,
    delegateId: d.delegateId,
    delegatorName: nameById.get(d.delegatorId) ?? "—",
    delegateName: nameById.get(d.delegateId) ?? "—",
    startDate: d.startDate,
    endDate: d.endDate,
    reason: d.reason,
    isActive: d.isActive,
    direction: d.delegatorId === profile.id ? "outgoing" : "incoming",
  }));

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
          photo_url: profile.photoUrl,
        }}
        designationOptions={designationOptions}
      />
      <DelegationPanel
        currentUserId={profile.id}
        members={members
          .filter((m) => m.status === "active")
          .map((m) => ({ id: m.id, full_name: m.fullName, designation: m.designation }))}
        delegations={delegationRows}
      />
    </div>
  );
}
