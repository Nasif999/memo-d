import { requireProfile } from "@/lib/auth";
import { getOrg, countUnread } from "@/lib/data";
import { AppNav } from "@/components/app-nav";
import { Toaster } from "@/components/ui/sonner";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();
  const [org, unread] = await Promise.all([
    getOrg(profile.orgId),
    countUnread(profile.id),
  ]);

  return (
    <div className="min-h-screen bg-slate-50">
      <AppNav
        profile={{
          full_name: profile.fullName,
          role: profile.role,
          designation: profile.designation,
        }}
        orgName={(org as { name?: string } | null)?.name ?? ""}
        unreadCount={unread}
      />
      <main className="mx-auto max-w-7xl p-4 md:p-6">{children}</main>
      <Toaster />
    </div>
  );
}
