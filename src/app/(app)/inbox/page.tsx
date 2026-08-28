import { requireProfile } from "@/lib/auth";
import { listInboxMemos, profilesMap, listDepartments } from "@/lib/data";
import { PageHeader } from "@/components/page-header";
import { MemoTable, type MemoRow } from "@/components/memo-table";

export default async function InboxPage() {
  const profile = await requireProfile();
  const [memos, people, departments] = await Promise.all([
    listInboxMemos(profile.id, profile.orgId),
    profilesMap(profile.orgId),
    listDepartments(profile.orgId),
  ]);
  const deptName = new Map(departments.map((d) => [d.id, d.name]));

  const rows: MemoRow[] = memos.map((m) => ({
    id: m.id,
    memo_number: m.memoNumber,
    subject: m.subject,
    status: m.status,
    priority: m.priority,
    created_at: m.createdAt,
    submitted_at: m.submittedAt,
    author_name: people.get(m.authorId)?.fullName,
    department_name: m.departmentId ? deptName.get(m.departmentId) : undefined,
    version: m.currentVersion,
    required_action: "Review / Approve",
  }));

  rows.sort((a, b) => {
    const pa = a.priority === "Urgent" ? 0 : a.priority === "High" ? 1 : 2;
    const pb = b.priority === "Urgent" ? 0 : b.priority === "High" ? 1 : 2;
    if (pa !== pb) return pa - pb;
    return (a.submitted_at ?? "").localeCompare(b.submitted_at ?? "");
  });

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Awaiting your decision"
        title="Inbox"
        description="Memos that have reached your step and cannot move until you act."
      />
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
