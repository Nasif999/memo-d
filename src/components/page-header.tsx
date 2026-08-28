/*
  One header shape for every screen: an eyebrow naming where you are, the
  title, an optional line of orientation, and actions pinned right.
*/
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
      <div className="space-y-1.5">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="text-[1.75rem] font-semibold leading-none tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="pt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/* A labelled section rule — used to break long pages into filed sections. */
export function SectionHeading({
  children,
  count,
  action,
}: {
  children: React.ReactNode;
  count?: number;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="flex items-baseline gap-2 text-sm font-semibold tracking-tight">
        {children}
        {count !== undefined && (
          <span className="font-mono text-xs font-normal text-muted-foreground tabular">
            {count}
          </span>
        )}
      </h2>
      {action}
    </div>
  );
}
