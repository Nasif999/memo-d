import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/auth";
import {
  getOrg,
  listOrgProfiles,
  listDepartments,
  listOrgMemos,
  listAudit,
  profilesMap,
} from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrgForm } from "@/components/admin/org-form";

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3.5">
      <p className="font-mono text-2xl font-semibold leading-none tabular">
        {value}
      </p>
      <p className="eyebrow mt-2 block leading-tight">{label}</p>
    </div>
  );
}

export default async function AdminPage() {
  const admin = await requireAdmin();
  const [org, users, departments, memos, audit, people] = await Promise.all([
    getOrg(admin.orgId),
    listOrgProfiles(admin.orgId),
    listDepartments(admin.orgId),
    listOrgMemos(admin.orgId, admin),
    listAudit(admin.orgId, 8),
    profilesMap(admin.orgId),
  ]);

  const pending = memos.filter((m) =>
    ["Submitted", "Pending Review", "Pending Approval"].includes(m.status)
  ).length;
  const approved = memos.filter((m) => m.status === "Approved").length;
  const rejected = memos.filter((m) => m.status === "Rejected").length;

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
      <PageHeader
        eyebrow="Organization settings"
        title="Administration"
        description="Manage who belongs to this organization and how memos are filed."
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-7">
        <Stat label="Users" value={users.length} />
        <Stat label="Active users" value={users.filter((u) => u.status === "active").length} />
        <Stat label="Departments" value={departments.filter((d) => d.isActive !== false).length} />
        <Stat label="Memos" value={memos.length} />
        <Stat label="Pending" value={pending} />
        <Stat label="Approved" value={approved} />
        <Stat label="Rejected" value={rejected} />
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
                contact_email: org?.contactEmail ?? "",
                contact_phone: org?.contactPhone ?? "",
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent system activity</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {audit.map((a) => (
                <li key={a.id}>
                  <strong>
                    {a.actorId ? (people.get(a.actorId)?.fullName ?? "Unknown") : "System"}
                  </strong>{" "}
                  — {a.eventType}
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
