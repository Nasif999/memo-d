import { PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/auth";
import { listAudit, profilesMap } from "@/lib/data";
import { AuditLogTable } from "@/components/admin/audit-log-table";

export default async function AuditLogPage() {
  const admin = await requireAdmin();
  const [entries, people] = await Promise.all([
    listAudit(admin.orgId, 5000),
    profilesMap(admin.orgId),
  ]);

  const rows = entries.map((e) => ({
    id: e.id,
    actorId: e.actorId,
    actorName: e.actorId ? (people.get(e.actorId)?.fullName ?? "Unknown") : "System",
    eventType: e.eventType,
    entityType: e.entityType,
    description: e.description,
    createdAt: e.createdAt,
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Administration"
        title="Audit log"
        description="Every recorded action, in the order it happened."
      />
      <p className="text-sm text-muted-foreground">
        Complete, immutable history of significant system events for this organization.
      </p>
      <AuditLogTable entries={rows} />
    </div>
  );
}
