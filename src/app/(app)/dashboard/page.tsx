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
import { PageHeader, SectionHeading } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";

// Counts are readings off a register: the number leads, its label sits under
// it in the same caption voice used for every other field on the site.
function Stat({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: number | string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={
        emphasis && Number(value) > 0
          ? "rounded-lg border border-state-pending/35 bg-state-pending-wash px-4 py-3.5"
          : "rounded-lg border border-border bg-card px-4 py-3.5"
      }
    >
      <p
        className={
          emphasis && Number(value) > 0
            ? "font-mono text-2xl font-semibold leading-none text-state-pending tabular"
            : "font-mono text-2xl font-semibold leading-none tabular"
        }
      >
        {value}
      </p>
      <p className="eyebrow mt-2 block leading-tight">{label}</p>
    </div>
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

  // "On your desk" is everything that needs this person's action right now —
  // not just memos at a workflow step assigned to them. A memo sent back with
  // Changes Requested has no active step (currentAssigneeId is cleared), but
  // the ball is squarely in the author's court to revise and resubmit, so it
  // belongs here too.
  const needsRevision = mine.filter((m) => m.status === "Changes Requested");
  const awaiting: MemoRow[] = [...needsRevision, ...inbox].map((m) => ({
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
      <PageHeader
        eyebrow={`${profile.designation ?? "Member"} · ${profile.role === "org_admin" ? "Administrator" : "User"}`}
        title={`Good to see you, ${profile.fullName.split(" ")[0]}`}
        description={
          awaiting.length > 0
            ? `${awaiting.length} memo${awaiting.length === 1 ? "" : "s"} ${awaiting.length === 1 ? "is" : "are"} on your desk.`
            : "Nothing is waiting on you right now."
        }
        actions={
          <Link href="/memos/new">
            <Button>Write a memo</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="On my desk" value={awaiting.length} emphasis />
        <Stat label="In progress" value={counts.submitted} />
        <Stat label="Changes requested" value={counts.changes} />
        <Stat label="Approved" value={counts.approved} />
        <Stat label="Urgent, org-wide" value={urgentCount} />
      </div>

      <div>
        <SectionHeading count={awaiting.length}>On your desk</SectionHeading>
        <MemoTable memos={awaiting} showAuthor showAge
          emptyText="Nothing needs your action." />
      </div>

      <div>
        <SectionHeading>Recently closed</SectionHeading>
        {recentCompleted.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card px-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              Nothing has finished its approval chain yet.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
            {recentCompleted.map((m) => (
              <li
                key={m.id}
                className="group flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <Link
                    href={`/memos/${m.id}`}
                    className="text-sm font-medium underline-offset-4 group-hover:underline"
                  >
                    {m.subject}
                  </Link>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                    {m.memoNumber ?? "—"} · {people.get(m.authorId)?.fullName}
                  </p>
                </div>
                <StatusBadge status={m.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
