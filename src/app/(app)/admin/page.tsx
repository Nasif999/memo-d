import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrgForm } from "@/components/admin/org-form";

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-3xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

export default async function AdminPage() {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const [
    { count: users },
    { count: activeUsers },
    { count: departments },
    { count: memos },
    { count: pending },
    { count: approved },
    { count: rejected },
    { data: org },
    { data: recentAudit },
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("departments").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("memos").select("id", { count: "exact", head: true }),
    supabase.from("memos").select("id", { count: "exact", head: true })
      .in("status", ["Submitted", "Pending Review", "Pending Approval"]),
    supabase.from("memos").select("id", { count: "exact", head: true }).eq("status", "Approved"),
    supabase.from("memos").select("id", { count: "exact", head: true }).eq("status", "Rejected"),
    supabase.from("orgs").select("*").eq("id", admin.org_id).single(),
    supabase.from("audit_log")
      .select("id, event_type, description, created_at, actor:profiles!audit_log_actor_id_fkey(full_name)")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const sections = [
    { href: "/admin/users", label: "Users", desc: "Add, activate, and assign roles" },
    { href: "/admin/departments", label: "Departments", desc: "Manage org departments" },
    { href: "/admin/categories", label: "Memo Categories", desc: "Manage memo categories" },
    { href: "/admin/workflow-templates", label: "Workflow Templates", desc: "Reusable approval sequences" },
    { href: "/admin/reports", label: "Reports", desc: "Memo statistics" },
    { href: "/admin/audit-log", label: "Audit Log", desc: "System event history" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Administration</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-7">
        <Stat label="Users" value={users ?? 0} />
        <Stat label="Active users" value={activeUsers ?? 0} />
        <Stat label="Departments" value={departments ?? 0} />
        <Stat label="Memos" value={memos ?? 0} />
        <Stat label="Pending" value={pending ?? 0} />
        <Stat label="Approved" value={approved ?? 0} />
        <Stat label="Rejected" value={rejected ?? 0} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {sections.map((s) => (
          <Link key={s.href} href={s.href}>
            <Card className="transition hover:shadow-md">
              <CardHeader>
                <CardTitle className="text-base">{s.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Organization</CardTitle></CardHeader>
          <CardContent>
            <OrgForm
              org={{
                name: org?.name ?? "",
                identifier: org?.identifier ?? "",
                contact_email: org?.contact_email ?? "",
                contact_phone: org?.contact_phone ?? "",
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent system activity</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {(recentAudit ?? []).map((a) => (
                <li key={a.id}>
                  <strong>{(a.actor as unknown as { full_name: string } | null)?.full_name ?? "System"}</strong>{" "}
                  — {a.event_type}
                  {a.description ? `: ${a.description.slice(0, 60)}` : ""}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
