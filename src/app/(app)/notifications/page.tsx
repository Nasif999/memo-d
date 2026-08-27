import Link from "next/link";
import { format } from "date-fns";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { listNotifications } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

async function markAllRead() {
  "use server";
  const { requireProfile } = await import("@/lib/auth");
  const { markAllNotificationsRead } = await import("@/lib/data");
  const profile = await requireProfile();
  await markAllNotificationsRead(profile.id);
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}

export default async function NotificationsPage() {
  const profile = await requireProfile();
  const notifications = await listNotifications(profile.id);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <form action={markAllRead}>
          <Button variant="outline" size="sm" type="submit">
            Mark all read
          </Button>
        </form>
      </div>
      {notifications.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notifications.</p>
      ) : (
        <ul className="space-y-2">
          {notifications.map((n) => (
            <li
              key={n.id}
              className={cn(
                "rounded-md border bg-white p-3 text-sm",
                !n.isRead && "border-blue-300 bg-blue-50"
              )}
            >
              <div className="flex items-center justify-between">
                <span>
                  {!n.isRead && <span className="mr-2 text-blue-600">●</span>}
                  {n.memoId ? (
                    <Link href={`/memos/${n.memoId}`} className="underline">
                      {n.message}
                    </Link>
                  ) : (
                    n.message
                  )}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {format(new Date(n.createdAt), "PP p")}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
