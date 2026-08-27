import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type Profile = {
  id: string;
  org_id: string;
  full_name: string;
  email: string;
  designation: string | null;
  department_id: string | null;
  role: "org_admin" | "user";
  status: "active" | "inactive";
};

// Fetches the authenticated user's profile or redirects to /login.
// Every page/action calls this — the session + RLS are the security boundary.
export async function requireProfile(): Promise<Profile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!profile || profile.status !== "active") redirect("/login?inactive=1");
  return profile as Profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== "org_admin") redirect("/dashboard");
  return profile;
}
