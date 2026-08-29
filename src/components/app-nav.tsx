"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";
import { NotificationPanel } from "@/components/notification-panel";
import { Avatar } from "@/components/avatar";
import { mainInitial } from "@/lib/name";
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
  orgIdentifier,
  orgLogoUrl,
  unreadCount,
}: {
  profile: { full_name: string; role: string; designation: string | null; photo_url: string | null };
  orgName: string;
  orgIdentifier: string;
  orgLogoUrl: string | null;
  unreadCount: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [localUnread, setLocalUnread] = useState(unreadCount);
  useEffect(() => setLocalUnread(unreadCount), [unreadCount]);

  async function handleLogout() {
    await fetch("/api/auth/session", { method: "DELETE" });
    await signOut(firebaseAuth()).catch(() => {});
    router.push("/login");
    router.refresh();
  }

  const allLinks =
    profile.role === "org_admin" ? [...links, ...adminLinks] : links;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2.5 md:px-6">
        <div className="flex items-center gap-7">
          <Link href="/" className="text-[0.9375rem] tracking-tight" style={{ letterSpacing: "-0.015em" }}>
            Memo<span className="text-accent">&apos;</span>d<span className="text-accent">.</span>
          </Link>
          {/* The org's short code prefixes every memo number, so it belongs
              beside the org name rather than buried in settings. The circle
              itself is not a link — only the name is. */}
          <span className="hidden h-4 w-px bg-border sm:block" />
          <span className="hidden items-center gap-2 sm:flex">
            <Avatar
              src={orgLogoUrl}
              fallback={orgIdentifier ? orgIdentifier.slice(0, 3) : "?"}
              size={26}
            />
            <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">
              {orgName}
            </Link>
            {orgIdentifier && (
              <span className="rounded-[3px] border border-border bg-muted px-1.5 py-0.5 font-mono text-[0.625rem] font-medium tracking-[0.08em] text-muted-foreground">
                {orgIdentifier}
              </span>
            )}
          </span>
          <nav className="hidden gap-0.5 md:flex">
            {allLinks.map((l) => {
              const active = pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative rounded-md px-2.5 py-1.5 text-sm transition-colors",
                    active
                      ? "font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {l.label}
                  {active && (
                    <span className="absolute inset-x-2.5 -bottom-[11px] h-[2px] bg-foreground" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setNotifOpen(true)}
            aria-label={
              localUnread > 0
                ? `Notifications, ${localUnread} unread`
                : "Notifications"
            }
            className="relative rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Notifications
            {localUnread > 0 && (
              <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 font-mono text-[0.625rem] font-medium text-background">
                {localUnread}
              </span>
            )}
          </button>
          <NotificationPanel
            open={notifOpen}
            onClose={() => setNotifOpen(false)}
            onCleared={() => setLocalUnread(0)}
          />
          <span className="hidden h-4 w-px bg-border md:block" />
          <span className="hidden items-center gap-2 md:flex">
            <Avatar
              src={profile.photo_url}
              fallback={mainInitial(profile.full_name || "?")}
              size={26}
            />
            <Link
              href="/profile"
              className="rounded-md px-1 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {profile.full_name}
            </Link>
          </span>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Log out
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            className="md:hidden"
            onClick={() => setMenuOpen((o) => !o)}
          >
            Menu
          </Button>
        </div>
      </div>

      {menuOpen && (
        <nav className="flex flex-col border-t border-border px-4 py-2 md:hidden">
          {allLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              className="rounded-md px-2 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
