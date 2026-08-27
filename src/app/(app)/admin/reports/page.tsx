import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  await requireAdmin();
  const supabase = await createClient();

  const from = searchParams.from ?? "";
  const to = searchParams.to ?? "";

  let query = supabase
    .from("memos")
    .select("id, status, priority, submitted_at, completed_at, department:departments(name), category:memo_categories(name)");
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to + "T23:59:59");
  const { data: memos } = await query;

  const all = memos ?? [];
  const byStatus = new Map<string, number>();
  const byDept = new Map<string, number>();
  const byCategory = new Map<string, number>();
  let urgent = 0;
  let completionMs = 0;
  let completedCount = 0;

  for (const m of all) {
    byStatus.set(m.status, (byStatus.get(m.status) ?? 0) + 1);
    const dept = (m.department as unknown as { name: string } | null)?.name ?? "Unassigned";
    byDept.set(dept, (byDept.get(dept) ?? 0) + 1);
    const cat = (m.category as unknown as { name: string } | null)?.name ?? "Uncategorized";
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + 1);
    if (m.priority === "Urgent") urgent++;
    if (m.completed_at && m.submitted_at) {
      completionMs += new Date(m.completed_at).getTime() - new Date(m.submitted_at).getTime();
      completedCount++;
    }
  }

  const avgHours = completedCount
    ? (completionMs / completedCount / 3_600_000).toFixed(1)
    : "—";

  function CountTable({ title, map }: { title: string; map: Map<string, number> }) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow><TableHead>Name</TableHead><TableHead>Count</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {Array.from(map.entries()).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                <TableRow key={k}>
                  <TableCell>{k}</TableCell>
                  <TableCell>{v}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Reports</h1>

      <form className="flex flex-wrap items-end gap-3 rounded-md border bg-white p-4">
        <div className="space-y-1">
          <Label htmlFor="from">From</Label>
          <Input id="from" name="from" type="date" defaultValue={from} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="to">To</Label>
          <Input id="to" name="to" type="date" defaultValue={to} />
        </div>
        <Button type="submit">Apply</Button>
      </form>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardContent className="pt-6">
          <p className="text-3xl font-bold">{all.length}</p>
          <p className="text-sm text-muted-foreground">Total memos</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-3xl font-bold">{urgent}</p>
          <p className="text-sm text-muted-foreground">Urgent memos</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-3xl font-bold">{completedCount}</p>
          <p className="text-sm text-muted-foreground">Completed workflows</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-3xl font-bold">{avgHours}</p>
          <p className="text-sm text-muted-foreground">Avg completion (hours)</p>
        </CardContent></Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <CountTable title="Memos by status" map={byStatus} />
        <CountTable title="Memos by department" map={byDept} />
        <CountTable title="Memos by category" map={byCategory} />
      </div>
    </div>
  );
}
