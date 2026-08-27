import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import {
  listInboxMemos,
  listMemosByAuthor,
  listOrgMemos,
  profilesMap,
  listDepartments,
} from "@/lib/data";
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
  const [inbox, mine, orgMemos, people, departments] = await Promise.all([
    listInboxMemos(profile.id, profile.orgId),
    listMemosByAuthor(profile.id, profile.orgId),
    listOrgMemos(profile.orgId, profile),
    profilesMap(profile.orgId),
    listDepartments(profile.orgId),
  ]);
  const deptName = new Map(departments.map((d) => [d.id, d.name]));

  const awaiting: MemoRow[] = inbox.map((m) => ({
    id: m.id,
    memo_number: m.memoNumber,
    subject: m.subject,
    status: m.status,
    priority: m.priority,
    created_at: m.createdAt,
    submitted_at: m.submittedAt,
    author_name: people.get(m.authorId)?.fullName,
    department_name: m.departmentId ? deptName.get(m.departmentId) : undefined,
  }));

  const counts = {
    submitted: mine.filter((m) =>
      ["Submitted", "Pending Review", "Pending Approval"].includes(m.status)
    ).length,
    changes: mine.filter((m) => m.status === "Changes Requested").length,
    approved: mine.filter((m) => m.status === "Approved").length,
  };
  const urgentCount = orgMemos.filter(
    (m) =>
      m.priority === "Urgent" &&
      ["Pending Approval", "Pending Review", "Submitted"].includes(m.status)
  ).length;

  const recentCompleted = orgMemos
    .filter((m) => ["Approved", "Rejected"].includes(m.status))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          Welcome, {profile.fullName.split(" ")[0]}
        </h1>
        <Link href="/memos/new"><Button>+ New Memo</Button></Link>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Stat label="Awaiting my action" value={awaiting.length} />
        <Stat label="My memos in progress" value={counts.submitted} />
        <Stat label="Changes requested" value={counts.changes} />
        <Stat label="Approved" value={counts.approved} />
        <Stat label="Urgent (org-wide)" value={urgentCount} />
      </div>

      <div>
        <h2 className="mb-2 text-lg font-semibold">Awaiting your action</h2>
        <MemoTable memos={awaiting} showAuthor showAge
          emptyText="Nothing needs your action." />
      </div>

      <Card>
        <CardHeader><CardTitle>Recently completed</CardTitle></CardHeader>
        <CardContent>
          {recentCompleted.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No completed memos yet.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {recentCompleted.map((m) => (
                <li key={m.id}>
                  <Link href={`/memos/${m.id}`} className="underline">
                    {m.subject}
                  </Link>{" "}
                  — {m.status} · by {people.get(m.authorId)?.fullName}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
