import { format } from "date-fns";
import { PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/auth";
import { listAudit, profilesMap } from "@/lib/data";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export default async function AuditLogPage() {
  const admin = await requireAdmin();
  const [entries, people] = await Promise.all([
    listAudit(admin.orgId, 200),
    profilesMap(admin.orgId),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Administration"
        title="Audit log"
        description="Every recorded action, in the order it happened."
      />
      <p className="text-sm text-muted-foreground">
        Immutable record of significant system events (latest 200).
      </p>
      <div className="overflow-x-auto rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="whitespace-nowrap text-sm">
                  {format(new Date(e.createdAt), "PP p")}
                </TableCell>
                <TableCell>
                  {e.actorId ? (people.get(e.actorId)?.fullName ?? "Unknown") : "System"}
                </TableCell>
                <TableCell className="font-mono text-xs">{e.eventType}</TableCell>
                <TableCell>{e.entityType ?? "—"}</TableCell>
                <TableCell className="max-w-md truncate text-sm">
                  {e.description ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
