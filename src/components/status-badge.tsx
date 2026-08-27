import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  Draft: "bg-slate-200 text-slate-800 hover:bg-slate-200",
  Submitted: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  "Pending Review": "bg-amber-100 text-amber-800 hover:bg-amber-100",
  "Pending Approval": "bg-amber-100 text-amber-800 hover:bg-amber-100",
  "Changes Requested": "bg-orange-100 text-orange-800 hover:bg-orange-100",
  Rejected: "bg-red-100 text-red-800 hover:bg-red-100",
  Approved: "bg-green-100 text-green-800 hover:bg-green-100",
  Cancelled: "bg-slate-100 text-slate-500 hover:bg-slate-100",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className={cn("font-medium", statusStyles[status] ?? "")}>
      {status}
    </Badge>
  );
}

const priorityStyles: Record<string, string> = {
  Normal: "bg-slate-100 text-slate-700 hover:bg-slate-100",
  High: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  Urgent: "bg-red-100 text-red-800 hover:bg-red-100",
};

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <Badge className={cn("font-medium", priorityStyles[priority] ?? "")}>
      {priority}
    </Badge>
  );
}
