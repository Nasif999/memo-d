import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MemoTable, type MemoRow } from "@/components/memo-table";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function MyMemosPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: memos } = await supabase
    .from("memos")
    .select(
      `id, memo_number, subject, status, priority, created_at, submitted_at,
       department:departments(name),
       current_step:workflow_instance_steps!memos_current_step_fk(
         assignee:profiles!workflow_instance_steps_assigned_user_id_fkey(full_name)
       )`
    )
    .eq("author_id", profile.id)
    .order("created_at", { ascending: false });

  const rows: MemoRow[] = (memos ?? []).map((m) => ({
    id: m.id,
    memo_number: m.memo_number,
    subject: m.subject,
    status: m.status,
    priority: m.priority,
    created_at: m.created_at,
    submitted_at: m.submitted_at,
    department_name: (m.department as unknown as { name: string } | null)?.name,
    current_participant: (
      m.current_step as unknown as { assignee: { full_name: string } | null } | null
    )?.assignee?.full_name,
  }));

  const drafts = rows.filter((r) => r.status === "Draft");
  const active = rows.filter((r) =>
    ["Submitted", "Pending Review", "Pending Approval", "Changes Requested"].includes(r.status)
  );
  const completed = rows.filter((r) =>
    ["Approved", "Rejected", "Cancelled"].includes(r.status)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Memos</h1>
        <Link href="/memos/new">
          <Button>+ New Memo</Button>
        </Link>
      </div>
      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">In Progress ({active.length})</TabsTrigger>
          <TabsTrigger value="drafts">Drafts ({drafts.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="active">
          <MemoTable memos={active} emptyText="No memos in progress." />
        </TabsContent>
        <TabsContent value="drafts">
          <MemoTable memos={drafts} emptyText="No drafts." />
        </TabsContent>
        <TabsContent value="completed">
          <MemoTable memos={completed} emptyText="No completed memos." />
        </TabsContent>
      </Tabs>
    </div>
  );
}
