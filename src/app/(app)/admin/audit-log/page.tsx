import { format } from "date-fns";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export default async function AuditLogPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: entries } = await supabase
    .from("audit_log")
    .select("id, event_type, entity_type, description, created_at, actor:profiles!audit_log_actor_id_fkey(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Audit Log</h1>
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
            {(entries ?? []).map((e) => {
              const actor = e.actor as unknown as { full_name: string; email: string } | null;
              return (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {format(new Date(e.created_at), "PP p")}
                  </TableCell>
                  <TableCell>{actor?.full_name ?? "System"}</TableCell>
                  <TableCell className="font-mono text-xs">{e.event_type}</TableCell>
                  <TableCell>{e.entity_type ?? "—"}</TableCell>
                  <TableCell className="max-w-md truncate text-sm">
                    {e.description ?? "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
