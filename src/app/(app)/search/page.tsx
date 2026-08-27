import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MemoTable, type MemoRow } from "@/components/memo-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STATUSES = [
  "Draft", "Submitted", "Pending Review", "Pending Approval",
  "Changes Requested", "Rejected", "Approved", "Cancelled",
];
const PRIORITIES = ["Normal", "High", "Urgent"];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  await requireProfile();
  const supabase = await createClient();

  const q = searchParams.q?.trim() ?? "";
  const status = searchParams.status ?? "";
  const priority = searchParams.priority ?? "";
  const category = searchParams.category ?? "";
  const department = searchParams.department ?? "";
  const from = searchParams.from ?? "";
  const to = searchParams.to ?? "";

  const [{ data: categories }, { data: departments }] = await Promise.all([
    supabase.from("memo_categories").select("id, name").order("name"),
    supabase.from("departments").select("id, name").order("name"),
  ]);

  // RLS scopes everything to the caller's org + authorized memos.
  let query = supabase
    .from("memos")
    .select(
      `id, memo_number, subject, status, priority, created_at, submitted_at,
       author:profiles!memos_author_id_fkey(full_name),
       department:departments(name)`
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (q) {
    const escaped = q.replace(/[%_,()]/g, " ");
    query = query.or(
      `subject.ilike.%${escaped}%,body.ilike.%${escaped}%,memo_number.ilike.%${escaped}%`
    );
  }
  if (status) query = query.eq("status", status);
  if (priority) query = query.eq("priority", priority);
  if (category) query = query.eq("category_id", category);
  if (department) query = query.eq("department_id", department);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to + "T23:59:59");

  const hasFilters = q || status || priority || category || department || from || to;
  const { data: memos } = hasFilters ? await query : { data: [] };

  const rows: MemoRow[] = (memos ?? []).map((m) => ({
    id: m.id,
    memo_number: m.memo_number,
    subject: m.subject,
    status: m.status,
    priority: m.priority,
    created_at: m.created_at,
    submitted_at: m.submitted_at,
    author_name: (m.author as unknown as { full_name: string } | null)?.full_name,
    department_name: (m.department as unknown as { name: string } | null)?.name,
  }));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Search Memos</h1>
      <form className="grid gap-3 rounded-md border bg-white p-4 md:grid-cols-4">
        <div className="space-y-1 md:col-span-2">
          <Label htmlFor="q">Search text</Label>
          <Input id="q" name="q" defaultValue={q}
            placeholder="Memo number, subject, or body…" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="status">Status</Label>
          <select id="status" name="status" defaultValue={status}
            className="h-9 w-full rounded-md border bg-white px-2 text-sm">
            <option value="">Any</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="priority">Priority</Label>
          <select id="priority" name="priority" defaultValue={priority}
            className="h-9 w-full rounded-md border bg-white px-2 text-sm">
            <option value="">Any</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="department">Department</Label>
          <select id="department" name="department" defaultValue={department}
            className="h-9 w-full rounded-md border bg-white px-2 text-sm">
            <option value="">Any</option>
            {(departments ?? []).map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="category">Category</Label>
          <select id="category" name="category" defaultValue={category}
            className="h-9 w-full rounded-md border bg-white px-2 text-sm">
            <option value="">Any</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="from">From date</Label>
          <Input id="from" name="from" type="date" defaultValue={from} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="to">To date</Label>
          <Input id="to" name="to" type="date" defaultValue={to} />
        </div>
        <div className="flex items-end">
          <Button type="submit" className="w-full">Search</Button>
        </div>
      </form>
      {hasFilters ? (
        <MemoTable memos={rows} showAuthor emptyText="No matching memos." />
      ) : (
        <p className="text-sm text-muted-foreground">
          Enter search terms or filters above.
        </p>
      )}
    </div>
  );
}
