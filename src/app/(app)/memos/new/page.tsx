import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MemoForm } from "@/components/memo-form";

export default async function NewMemoPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: departments }, { data: categories }, { data: users }, { data: templates }] =
    await Promise.all([
      supabase.from("departments").select("id, name").eq("is_active", true).order("name"),
      supabase.from("memo_categories").select("id, name").eq("is_active", true).order("name"),
      supabase.from("profiles").select("id, full_name, designation").eq("status", "active").order("full_name"),
      supabase
        .from("workflow_templates")
        .select("id, name, workflow_template_steps(step_order, position_label)")
        .eq("is_active", true)
        .order("name"),
    ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">New Memo</h1>
      <MemoForm
        departments={departments ?? []}
        categories={categories ?? []}
        users={users ?? []}
        templates={(templates ?? []).map((t) => ({
          id: t.id,
          name: t.name,
          steps: (t.workflow_template_steps ?? []).sort(
            (a, b) => a.step_order - b.step_order
          ),
        }))}
        currentUserId={profile.id}
      />
    </div>
  );
}
