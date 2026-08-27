import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MemoForm } from "@/components/memo-form";

export default async function EditMemoPage({
  params,
}: {
  params: { id: string };
}) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: memo } = await supabase
    .from("memos")
    .select("*")
    .eq("id", params.id)
    .single();
  if (!memo) notFound();
  // Only the author may edit, and only in editable states.
  if (memo.author_id !== profile.id) redirect(`/memos/${params.id}`);
  if (!["Draft", "Changes Requested"].includes(memo.status))
    redirect(`/memos/${params.id}`);

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
      <h1 className="text-2xl font-bold">
        {memo.status === "Changes Requested" ? "Revise Memo" : "Edit Draft"}
      </h1>
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
        existing={{
          id: memo.id,
          subject: memo.subject,
          body: memo.body,
          department_id: memo.department_id,
          category_id: memo.category_id,
          priority: memo.priority,
          status: memo.status,
        }}
      />
    </div>
  );
}
