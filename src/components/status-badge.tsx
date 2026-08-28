import { cn } from "@/lib/utils";

// Colour here is meaning, not decoration: each workflow state gets exactly one
// ink, used consistently everywhere the state appears.
const statusStyles: Record<string, string> = {
  Draft: "border-state-draft/25 bg-state-draft-wash text-state-draft",
  Submitted: "border-state-pending/30 bg-state-pending-wash text-state-pending",
  "Pending Review":
    "border-state-pending/30 bg-state-pending-wash text-state-pending",
  "Pending Approval":
    "border-state-pending/30 bg-state-pending-wash text-state-pending",
  "Changes Requested":
    "border-state-changes/30 bg-state-changes-wash text-state-changes",
  Rejected:
    "border-state-rejected/30 bg-state-rejected-wash text-state-rejected",
  Approved:
    "border-state-approved/30 bg-state-approved-wash text-state-approved",
  Cancelled: "border-border bg-muted text-muted-foreground line-through",
};

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <span className={cn("stamp", statusStyles[status] ?? "", className)}>
      {status}
    </span>
  );
}

// Only the terminal outcomes are struck across a memo header. An in-progress
// memo has nothing to stamp yet.
export function TerminalStamp({ status }: { status: string }) {
  if (status !== "Approved" && status !== "Rejected") return null;
  return (
    <span
      className={cn(
        "stamp-terminal",
        status === "Approved"
          ? "border-state-approved/50 text-state-approved"
          : "border-state-rejected/50 text-state-rejected"
      )}
    >
      {status}
    </span>
  );
}

const priorityStyles: Record<string, string> = {
  Normal: "border-border bg-muted text-muted-foreground",
  High: "border-state-pending/30 bg-state-pending-wash text-state-pending",
  Urgent: "border-state-rejected/40 bg-state-rejected-wash text-state-rejected",
};

export function PriorityBadge({ priority }: { priority: string }) {
  // Normal is the default state of every memo — saying so on each row is noise.
  if (priority === "Normal") {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <span className={cn("stamp", priorityStyles[priority] ?? "")}>
      {priority}
    </span>
  );
}
