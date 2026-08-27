import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/app-nav";
import { Toaster } from "@/components/ui/sonner";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: org }, { count: unread }] = await Promise.all([
    supabase.from("orgs").select("name, identifier").eq("id", profile.org_id).single(),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .eq("is_read", false),
  ]);

  return (
    <div className="min-h-screen bg-slate-50">
      <AppNav
        profile={{
          full_name: profile.full_name,
          role: profile.role,
          designation: profile.designation,
        }}
        orgName={org?.name ?? ""}
        unreadCount={unread ?? 0}
      />
      <main className="mx-auto max-w-7xl p-4 md:p-6">{children}</main>
      <Toaster />
    </div>
  );
}
