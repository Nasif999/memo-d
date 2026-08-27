import Link from "next/link";
import { format } from "date-fns";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

async function markAllRead() {
  "use server";
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", user.id)
    .eq("is_read", false);
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}

export default async function NotificationsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(100);

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
      {(notifications ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">No notifications.</p>
      ) : (
        <ul className="space-y-2">
          {(notifications ?? []).map((n) => (
            <li
              key={n.id}
              className={cn(
                "rounded-md border bg-white p-3 text-sm",
                !n.is_read && "border-blue-300 bg-blue-50"
              )}
            >
              <div className="flex items-center justify-between">
                <span>
                  {!n.is_read && <span className="mr-2 text-blue-600">●</span>}
                  {n.memo_id ? (
                    <Link href={`/memos/${n.memo_id}`} className="underline">
                      {n.message}
                    </Link>
                  ) : (
                    n.message
                  )}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {format(new Date(n.created_at), "PP p")}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
