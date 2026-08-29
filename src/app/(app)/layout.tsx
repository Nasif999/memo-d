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
    <div className="min-h-screen bg-background">
      <AppNav
        profile={{
          full_name: profile.fullName,
          role: profile.role,
          designation: profile.designation,
          photo_url: profile.photoUrl,
        }}
        orgName={org?.name ?? ""}
        orgIdentifier={org?.identifier ?? ""}
        orgLogoUrl={org?.logoUrl ?? null}
        unreadCount={unread}
      />
      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        {children}
      </main>
      <Toaster />
    </div>
  );
}
