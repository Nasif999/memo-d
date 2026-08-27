import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MemoTable, type MemoRow } from "@/components/memo-table";

export default async function InboxPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  // Memos whose Active step is assigned to me.
  const { data: steps } = await supabase
    .from("workflow_instance_steps")
    .select(
      `id,
       memo:memos!workflow_instance_steps_memo_id_fkey(
         id, memo_number, subject, status, priority, created_at, submitted_at,
         author:profiles!memos_author_id_fkey(full_name),
         department:departments(name)
       )`
    )
    .eq("assigned_user_id", profile.id)
    .eq("status", "Active");

  const rows: MemoRow[] = (steps ?? [])
    .map((s) => s.memo as unknown as {
      id: string; memo_number: string | null; subject: string; status: string;
      priority: string; created_at: string; submitted_at: string | null;
      author: { full_name: string } | null;
      department: { name: string } | null;
    } | null)
    .filter((m): m is NonNullable<typeof m> => !!m)
    .map((m) => ({
      id: m.id,
      memo_number: m.memo_number,
      subject: m.subject,
      status: m.status,
      priority: m.priority,
      created_at: m.created_at,
      submitted_at: m.submitted_at,
      author_name: m.author?.full_name,
      department_name: m.department?.name,
      required_action: "Review / Approve",
    }));

  // Urgent first, then oldest pending
  rows.sort((a, b) => {
    const pa = a.priority === "Urgent" ? 0 : a.priority === "High" ? 1 : 2;
    const pb = b.priority === "Urgent" ? 0 : b.priority === "High" ? 1 : 2;
    if (pa !== pb) return pa - pb;
    return (a.submitted_at ?? "").localeCompare(b.submitted_at ?? "");
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Inbox</h1>
      <p className="text-sm text-muted-foreground">
        Memos awaiting your action.
      </p>
      <MemoTable
        memos={rows}
        showAuthor
        showAge
        emptyText="Nothing needs your action. 🎉"
      />
    </div>
  );
}
