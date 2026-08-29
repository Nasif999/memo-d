"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { fetchNotifications, markAllRead } from "@/app/(app)/notifications/actions";
import { cn } from "@/lib/utils";

type Notification = {
  id: string;
  type: string;
  memoId: string | null;
  link: string | null;
  message: string;
  isRead: boolean;
  createdAt: string;
};

export function NotificationPanel({
  open,
  onClose,
  onCleared,
}: {
  open: boolean;
  onClose: () => void;
  onCleared: () => void;
}) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[] | null>(null);
  const clearedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      clearedRef.current = false;
      return;
    }
    let cancelled = false;
    fetchNotifications().then((rows) => {
      if (!cancelled) setNotifications(rows);
    });
    // Opening the panel is "viewing" the notifications — clear the badge.
    if (!clearedRef.current) {
      clearedRef.current = true;
      markAllRead().then(() => {
        onCleared();
        router.refresh();
      });
    }
    return () => {
      cancelled = true;
    };
  }, [open, onCleared, router]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/20"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-sm flex-col border-l border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close notifications"
            className="rounded-md px-2 py-1 text-sm text-muted-foreground hover:text-foreground"
          >
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {notifications === null ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">Loading…</p>
          ) : notifications.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">No notifications.</p>
          ) : (
            <ul className="divide-y divide-border">
              {notifications.map((n) => {
                const href = n.memoId ? `/memos/${n.memoId}` : n.link ?? undefined;
                const body = (
                  <div className="px-4 py-3">
                    <p className={cn("text-sm", !n.isRead && "font-medium")}>
                      {!n.isRead && <span className="mr-1.5 text-accent">●</span>}
                      {n.message}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                );
                return (
                  <li key={n.id}>
                    {href ? (
                      <Link href={href} onClick={onClose} className="block hover:bg-muted/50">
                        {body}
                      </Link>
                    ) : (
                      body
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </div>,
    document.body
  );
}
