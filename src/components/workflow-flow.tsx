import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

// A left-to-right chip chain showing who a memo passes through, in order —
// e.g. Employee → Department Head → Finance → Director. Used wherever a
// workflow template or step sequence needs to read as a route, not a list.
export function WorkflowFlow({
  steps,
  className,
}: {
  steps: string[];
  className?: string;
}) {
  const nodes = ["Author", ...steps];
  return (
    <div className={cn("flex flex-wrap items-center gap-x-1.5 gap-y-2", className)}>
      {nodes.map((label, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium leading-none",
              i === 0
                ? "border-border bg-muted text-muted-foreground"
                : "border-primary/30 bg-primary/10 text-primary"
            )}
          >
            {label}
          </span>
          {i < nodes.length - 1 && (
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
        </div>
      ))}
    </div>
  );
}
