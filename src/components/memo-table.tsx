import Link from "next/link";
import { format, formatDistanceToNowStrict } from "date-fns";
import { StatusBadge, PriorityBadge } from "@/components/status-badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export type MemoRow = {
  id: string;
  memo_number: string | null;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
  submitted_at: string | null;
  author_name?: string;
  department_name?: string;
  current_participant?: string;
  required_action?: string;
  // > 1 once a memo has been sent back and resubmitted at least once — the
  // person acting on it should know this isn't a first pass.
  version?: number;
};

export function MemoTable({
  memos,
  showAuthor = false,
  showAge = false,
  emptyText = "No memos.",
}: {
  memos: MemoRow[];
  showAuthor?: boolean;
  showAge?: boolean;
  emptyText?: string;
}) {
  // An empty screen is an invitation, so it gets the same ruled frame as a
  // full one rather than a bare line of grey text.
  if (memos.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card px-4 py-10 text-center">
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Reference</TableHead>
            <TableHead>Subject</TableHead>
            {showAuthor && <TableHead>From</TableHead>}
            <TableHead>Department</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Submitted</TableHead>
            {showAge && <TableHead>Waiting</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {memos.map((m) => (
            // "relative" on the row (not the cell) makes the row itself the
            // positioning context, so a single absolutely-positioned link
            // inside the first cell can stretch to cover the whole row —
            // click anywhere, not just the subject text.
            <TableRow key={m.id} className="group relative cursor-pointer">
              <TableCell className="whitespace-nowrap px-3 font-mono text-xs text-muted-foreground tabular">
                <Link
                  href={`/memos/${m.id}`}
                  className="absolute inset-0"
                  aria-label={`Open memo: ${m.subject}`}
                />
                {m.memo_number ?? "—"}
              </TableCell>
              <TableCell className="px-3">
                <span className="font-medium underline-offset-4 group-hover:underline">
                  {m.subject}
                </span>
                {m.version !== undefined && m.version > 1 && (
                  <span
                    className="stamp ml-2 border-state-changes/30 bg-state-changes-wash text-state-changes"
                    title={`Sent back and revised — this is version ${m.version}`}
                  >
                    Revised · v{m.version}
                  </span>
                )}
                {m.current_participant && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    on {m.current_participant}&apos;s desk
                  </p>
                )}
              </TableCell>
              {showAuthor && (
                <TableCell className="px-3 text-sm">{m.author_name}</TableCell>
              )}
              <TableCell className="px-3 text-sm text-muted-foreground">
                {m.department_name ?? "—"}
              </TableCell>
              <TableCell className="px-3">
                <PriorityBadge priority={m.priority} />
              </TableCell>
              <TableCell className="px-3">
                <StatusBadge status={m.status} />
              </TableCell>
              <TableCell className="whitespace-nowrap px-3 font-mono text-xs text-muted-foreground tabular">
                {m.submitted_at
                  ? format(new Date(m.submitted_at), "dd MMM yyyy")
                  : "—"}
              </TableCell>
              {showAge && (
                <TableCell className="whitespace-nowrap px-3 font-mono text-xs text-muted-foreground tabular">
                  {m.submitted_at
                    ? formatDistanceToNowStrict(new Date(m.submitted_at))
                    : "—"}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
