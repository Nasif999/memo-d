"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/inbox", label: "Inbox" },
  { href: "/memos", label: "My Memos" },
  { href: "/search", label: "Search" },
];

const adminLinks = [{ href: "/admin", label: "Admin" }];

export function AppNav({
  profile,
  orgName,
  unreadCount,
}: {
  profile: { full_name: string; role: string; designation: string | null };
  orgName: string;
  unreadCount: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.rpc("log_auth_event", { p_event: "user_logout" });
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const allLinks =
    profile.role === "org_admin" ? [...links, ...adminLinks] : links;

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="font-bold">
            Memo&apos;d
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {orgName}
            </span>
          </Link>
          <nav className="hidden gap-1 md:flex">
            {allLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm hover:bg-slate-100",
                  pathname.startsWith(l.href) && "bg-slate-100 font-medium"
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/notifications" className="relative">
            <Button variant="ghost" size="sm">
              🔔
              {unreadCount > 0 && (
                <Badge className="absolute -right-1 -top-1 h-5 min-w-5 rounded-full px-1 text-xs">
                  {unreadCount}
                </Badge>
              )}
            </Button>
          </Link>
          <Link href="/profile" className="hidden text-sm md:block">
            {profile.full_name}
          </Link>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Log out
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            onClick={() => setMenuOpen((o) => !o)}
          >
            ☰
          </Button>
        </div>
      </div>
      {menuOpen && (
        <nav className="flex flex-col gap-1 border-t px-4 py-2 md:hidden">
          {allLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              className="rounded-md px-3 py-2 text-sm hover:bg-slate-100"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
