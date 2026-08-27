import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MemoTable, type MemoRow } from "@/components/memo-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-3xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [
    { data: myActiveSteps },
    { data: myMemos },
    { count: urgentCount },
    { data: recentActivity },
  ] = await Promise.all([
    supabase
      .from("workflow_instance_steps")
      .select(
        `memo:memos!workflow_instance_steps_memo_id_fkey(
          id, memo_number, subject, status, priority, created_at, submitted_at,
          author:profiles!memos_author_id_fkey(full_name),
          department:departments(name))`
      )
      .eq("assigned_user_id", profile.id)
      .eq("status", "Active"),
    supabase
      .from("memos")
      .select("id, status")
      .eq("author_id", profile.id),
    supabase
      .from("memos")
      .select("id", { count: "exact", head: true })
      .eq("priority", "Urgent")
      .in("status", ["Pending Approval", "Pending Review", "Submitted"]),
    supabase
      .from("comments")
      .select("id, body, created_at, comment_type, author:profiles!comments_author_id_fkey(full_name), memo:memos!comments_memo_id_fkey(id, subject)")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const awaiting: MemoRow[] = (myActiveSteps ?? [])
    .map((s) => s.memo as unknown as {
      id: string; memo_number: string | null; subject: string; status: string;
      priority: string; created_at: string; submitted_at: string | null;
      author: { full_name: string } | null; department: { name: string } | null;
    } | null)
    .filter((m): m is NonNullable<typeof m> => !!m)
    .map((m) => ({
      id: m.id, memo_number: m.memo_number, subject: m.subject,
      status: m.status, priority: m.priority, created_at: m.created_at,
      submitted_at: m.submitted_at, author_name: m.author?.full_name,
      department_name: m.department?.name,
    }));

  const mine = myMemos ?? [];
  const counts = {
    submitted: mine.filter((m) =>
      ["Submitted", "Pending Review", "Pending Approval"].includes(m.status)).length,
    changes: mine.filter((m) => m.status === "Changes Requested").length,
    approved: mine.filter((m) => m.status === "Approved").length,
    rejected: mine.filter((m) => m.status === "Rejected").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          Welcome, {profile.full_name.split(" ")[0]}
        </h1>
        <Link href="/memos/new"><Button>+ New Memo</Button></Link>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Stat label="Awaiting my action" value={awaiting.length} />
        <Stat label="My memos in progress" value={counts.submitted} />
        <Stat label="Changes requested" value={counts.changes} />
        <Stat label="Approved" value={counts.approved} />
        <Stat label="Urgent (org-wide)" value={urgentCount ?? 0} />
      </div>

      <div>
        <h2 className="mb-2 text-lg font-semibold">Awaiting your action</h2>
        <MemoTable memos={awaiting} showAuthor showAge
          emptyText="Nothing needs your action." />
      </div>

      <Card>
        <CardHeader><CardTitle>Recent activity</CardTitle></CardHeader>
        <CardContent>
          {(recentActivity ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent activity.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {(recentActivity ?? []).map((c) => {
                const memo = c.memo as unknown as { id: string; subject: string } | null;
                const author = c.author as unknown as { full_name: string } | null;
                return (
                  <li key={c.id}>
                    <strong>{author?.full_name}</strong>{" "}
                    {c.comment_type === "general" ? "commented on" : `${c.comment_type.replace("_", " ")} —`}{" "}
                    {memo ? (
                      <Link href={`/memos/${memo.id}`} className="underline">
                        {memo.subject}
                      </Link>
                    ) : "a memo"}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
