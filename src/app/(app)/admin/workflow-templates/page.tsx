import { requireAdmin } from "@/lib/auth";
import { listTemplates } from "@/lib/data";
import { TemplatesAdmin } from "@/components/admin/templates-admin";

export default async function AdminTemplatesPage() {
  const admin = await requireAdmin();
  const templates = await listTemplates(admin.orgId);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Workflow Templates</h1>
      <p className="text-sm text-muted-foreground">
        Reusable ordered approval sequences (e.g. Employee → Dept Head → Finance → Director).
      </p>
      <TemplatesAdmin
        templates={templates.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description ?? null,
          is_active: t.isActive !== false,
          steps: (t.steps ?? [])
            .sort((a, b) => a.order - b.order)
            .map((s) => s.label),
        }))}
      />
    </div>
  );
}
