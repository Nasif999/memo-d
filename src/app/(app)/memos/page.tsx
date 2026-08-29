import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { listMemosByAuthor, listInboxMemos, profilesMap, listDepartments } from "@/lib/data";
import { PageHeader } from "@/components/page-header";
import { MemoTable, type MemoRow } from "@/components/memo-table";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function MyMemosPage() {
  const profile = await requireProfile();
  const [memos, inbox, people, departments] = await Promise.all([
    listMemosByAuthor(profile.id, profile.orgId),
    listInboxMemos(profile.id, profile.orgId),
    profilesMap(profile.orgId),
    listDepartments(profile.orgId),
  ]);
  const deptName = new Map(departments.map((d) => [d.id, d.name]));

  const toRow = (m: (typeof memos)[number]): MemoRow => ({
    id: m.id,
    memo_number: m.memoNumber,
    subject: m.subject,
    status: m.status,
    priority: m.priority,
    created_at: m.createdAt,
    submitted_at: m.submittedAt,
    author_name: people.get(m.authorId)?.fullName,
    department_name: m.departmentId ? deptName.get(m.departmentId) : undefined,
    current_participant: m.currentAssigneeId
      ? people.get(m.currentAssigneeId)?.fullName
      : undefined,
    version: m.currentVersion,
  });

  const rows = memos.map(toRow);
  // Assigned to someone else, but on your desk because they delegated their
  // turn to you (listInboxMemos already folds delegated-to-you items in).
  const delegated = inbox
    .filter((m) => m.currentAssigneeId !== profile.id)
    .map(toRow);

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
        <PageHeader
          eyebrow="Authored by you"
          title="My memos"
          description="Everything you have written, from draft to final decision."
        />
        <Link href="/memos/new">
          <Button>+ New Memo</Button>
        </Link>
      </div>
      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">In Progress ({active.length})</TabsTrigger>
          <TabsTrigger value="drafts">Drafts ({drafts.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
          {delegated.length > 0 && (
            <TabsTrigger value="delegated">Delegated to you ({delegated.length})</TabsTrigger>
          )}
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
        {delegated.length > 0 && (
          <TabsContent value="delegated">
            <MemoTable memos={delegated} showAuthor emptyText="Nothing delegated to you." />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
