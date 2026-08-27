import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
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
  if (memos.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">{emptyText}</p>;
  }
  return (
    <div className="overflow-x-auto rounded-md border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Number</TableHead>
            <TableHead>Subject</TableHead>
            {showAuthor && <TableHead>From</TableHead>}
            <TableHead>Dept</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Submitted</TableHead>
            {showAge && <TableHead>Pending for</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {memos.map((m) => (
            <TableRow key={m.id}>
              <TableCell className="whitespace-nowrap font-mono text-xs">
                {m.memo_number ?? "—"}
              </TableCell>
              <TableCell>
                <Link href={`/memos/${m.id}`} className="font-medium underline">
                  {m.subject}
                </Link>
                {m.current_participant && (
                  <p className="text-xs text-muted-foreground">
                    with {m.current_participant}
                  </p>
                )}
              </TableCell>
              {showAuthor && <TableCell>{m.author_name}</TableCell>}
              <TableCell>{m.department_name ?? "—"}</TableCell>
              <TableCell><PriorityBadge priority={m.priority} /></TableCell>
              <TableCell><StatusBadge status={m.status} /></TableCell>
              <TableCell className="whitespace-nowrap text-sm">
                {m.submitted_at ? format(new Date(m.submitted_at), "PP") : "—"}
              </TableCell>
              {showAge && (
                <TableCell className="whitespace-nowrap text-sm">
                  {m.submitted_at
                    ? formatDistanceToNow(new Date(m.submitted_at))
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
