import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/profile-form";

export default async function ProfilePage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const [{ data: department }, { data: org }] = await Promise.all([
    profile.department_id
      ? supabase.from("departments").select("name").eq("id", profile.department_id).single()
      : Promise.resolve({ data: null }),
    supabase.from("orgs").select("name").eq("id", profile.org_id).single(),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">My Profile</h1>
      <ProfileForm
        profile={{
          full_name: profile.full_name,
          email: profile.email,
          designation: profile.designation ?? "",
          role: profile.role,
          status: profile.status,
          department: department?.name ?? "—",
          org: org?.name ?? "",
        }}
      />
    </div>
  );
}
