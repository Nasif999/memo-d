import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TemplatesAdmin } from "@/components/admin/templates-admin";

export default async function AdminTemplatesPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: templates } = await supabase
    .from("workflow_templates")
    .select("id, name, description, is_active, workflow_template_steps(step_order, position_label)")
    .order("name");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Workflow Templates</h1>
      <p className="text-sm text-muted-foreground">
        Reusable ordered approval sequences (e.g. Employee → Dept Head → Finance → Director).
      </p>
      <TemplatesAdmin
        templates={(templates ?? []).map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          is_active: t.is_active,
          steps: (t.workflow_template_steps ?? [])
            .sort((a, b) => a.step_order - b.step_order)
            .map((s) => s.position_label),
        }))}
      />
    </div>
  );
}
