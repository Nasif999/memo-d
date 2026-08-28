import { format } from "date-fns";
import { cn } from "@/lib/utils";

/*
  The routing slip: the paper stapled to a memo that gets initialled desk to
  desk. Order is the whole point of this workflow, so it is drawn as a rail —
  a single line running top to bottom, each stop marked with where the memo
  sits, who holds it, and what they did with it. The one live step is the only
  thing on the page allowed to look urgent.
*/

export type RailStep = {
  id: string;
  order: number;
  name: string;
  designation: string | null;
  positionLabel: string | null;
  status: string;
  actedAt: string | null;
  onBehalfOf: string | null;
};

const stateStamp: Record<string, string> = {
  Approved: "border-state-approved/30 bg-state-approved-wash text-state-approved",
  Rejected: "border-state-rejected/30 bg-state-rejected-wash text-state-rejected",
  ChangesRequested:
    "border-state-changes/30 bg-state-changes-wash text-state-changes",
  Active: "border-state-pending/35 bg-state-pending-wash text-state-pending",
  Pending: "border-border bg-muted text-muted-foreground",
  Skipped: "border-border bg-muted text-muted-foreground",
};

const stateLabel: Record<string, string> = {
  Approved: "Approved",
  Rejected: "Rejected",
  ChangesRequested: "Changes requested",
  Active: "With them now",
  Pending: "Not yet reached",
  Skipped: "Skipped",
};

export function RoutingRail({
  steps,
  viewerId,
  currentAssigneeId,
}: {
  steps: RailStep[];
  viewerId: string;
  currentAssigneeId?: string | null;
}) {
  if (steps.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        This memo has not been submitted, so it has no route yet.
      </p>
    );
  }

  return (
    <ol className="relative space-y-0">
      {/* The rail itself, stopping at the last marker rather than running on. */}
      <span
        aria-hidden
        className="absolute left-[11px] top-3 bottom-3 w-px bg-border"
      />
      {steps.map((s) => {
        const active = s.status === "Active";
        const done = ["Approved", "Rejected", "ChangesRequested"].includes(
          s.status
        );
        const isViewer = s.id && currentAssigneeId === viewerId && active;
        return (
          <li key={s.id} className="relative flex gap-3 py-2.5 pl-0">
            <span
              aria-hidden
              className={cn(
                "relative z-10 mt-0.5 flex h-[23px] w-[23px] shrink-0 items-center justify-center rounded-[4px] border font-mono text-[0.6875rem] font-semibold tabular",
                active && "border-foreground bg-foreground text-background",
                done && !active && "border-border bg-card text-muted-foreground",
                !done && !active && "border-dashed border-border bg-card text-muted-foreground"
              )}
            >
              {s.order}
            </span>
            <div className="min-w-0 flex-1 pb-0.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p
                  className={cn(
                    "text-sm leading-tight",
                    active ? "font-semibold" : "font-medium"
                  )}
                >
                  {s.name}
                </p>
                {isViewer && (
                  <span className="stamp border-foreground/25 bg-foreground text-background">
                    You
                  </span>
                )}
              </div>
              {(s.designation || s.positionLabel) && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {[s.designation, s.positionLabel].filter(Boolean).join(" · ")}
                </p>
              )}
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className={cn("stamp", stateStamp[s.status] ?? "")}>
                  {stateLabel[s.status] ?? s.status}
                </span>
                {s.actedAt && (
                  <span className="font-mono text-[0.6875rem] text-muted-foreground tabular">
                    {format(new Date(s.actedAt), "dd MMM yyyy · HH:mm")}
                  </span>
                )}
              </div>
              {s.onBehalfOf && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Acted on behalf of {s.onBehalfOf}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
