import { requireProfile } from "@/lib/auth";
import {
  listOrgMemos,
  listDepartments,
  listCategories,
  profilesMap,
  MEMO_STATUSES,
} from "@/lib/data";
import { PageHeader } from "@/components/page-header";
import { MemoTable, type MemoRow } from "@/components/memo-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PRIORITIES = ["Normal", "High", "Urgent"];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const profile = await requireProfile();

  const q = (searchParams.q ?? "").trim().toLowerCase();
  const status = searchParams.status ?? "";
  const priority = searchParams.priority ?? "";
  const category = searchParams.category ?? "";
  const department = searchParams.department ?? "";
  const from = searchParams.from ?? "";
  const to = searchParams.to ?? "";
  const hasFilters = Boolean(q || status || priority || category || department || from || to);

  const [departments, categories, people] = await Promise.all([
    listDepartments(profile.orgId),
    listCategories(profile.orgId),
    profilesMap(profile.orgId),
  ]);
  const deptName = new Map(departments.map((d) => [d.id, d.name]));

  let rows: MemoRow[] = [];
  if (hasFilters) {
    // listOrgMemos is tenant-scoped (orgId) and hides others' drafts.
    let memos = await listOrgMemos(profile.orgId, profile);
    if (q) {
      memos = memos.filter((m) => {
        const author = people.get(m.authorId)?.fullName.toLowerCase() ?? "";
        return (
          m.subject.toLowerCase().includes(q) ||
          m.body.toLowerCase().includes(q) ||
          (m.memoNumber ?? "").toLowerCase().includes(q) ||
          author.includes(q)
        );
      });
    }
    if (status) memos = memos.filter((m) => m.status === status);
    if (priority) memos = memos.filter((m) => m.priority === priority);
    if (category) memos = memos.filter((m) => m.categoryId === category);
    if (department) memos = memos.filter((m) => m.departmentId === department);
    if (from) memos = memos.filter((m) => m.createdAt >= from);
    if (to) memos = memos.filter((m) => m.createdAt <= to + "T23:59:59");

    rows = memos.slice(0, 100).map((m) => ({
      id: m.id,
      memo_number: m.memoNumber,
      subject: m.subject,
      status: m.status,
      priority: m.priority,
      created_at: m.createdAt,
      submitted_at: m.submittedAt,
      author_name: people.get(m.authorId)?.fullName,
      department_name: m.departmentId ? deptName.get(m.departmentId) : undefined,
      version: m.currentVersion,
    }));
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Organization records"
        title="Search"
        description="Look across every memo your organization has filed."
      />
      <form className="grid gap-3 rounded-md border bg-white p-4 md:grid-cols-4">
        <div className="space-y-1 md:col-span-2">
          <Label htmlFor="q">Search text</Label>
          <Input id="q" name="q" defaultValue={searchParams.q ?? ""}
            placeholder="Memo number, subject, body, or author…" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="status">Status</Label>
          <select id="status" name="status" defaultValue={status}
            className="h-9 w-full rounded-md border bg-white px-2 text-sm">
            <option value="">Any</option>
            {MEMO_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
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
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="category">Category</Label>
          <select id="category" name="category" defaultValue={category}
            className="h-9 w-full rounded-md border bg-white px-2 text-sm">
            <option value="">Any</option>
            {categories.map((c) => (
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
