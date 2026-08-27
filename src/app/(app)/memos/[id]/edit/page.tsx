import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import {
  getMemoForUser,
  listDepartments,
  listCategories,
  listOrgProfiles,
  listTemplates,
} from "@/lib/data";
import { MemoForm } from "@/components/memo-form";

export default async function EditMemoPage({
  params,
}: {
  params: { id: string };
}) {
  const profile = await requireProfile();
  const memo = await getMemoForUser(params.id, profile);
  if (!memo) notFound();
  // Only the author may edit, and only in editable states.
  if (memo.authorId !== profile.id) redirect(`/memos/${params.id}`);
  if (!["Draft", "Changes Requested"].includes(memo.status))
    redirect(`/memos/${params.id}`);

  const [departments, categories, users, templates] = await Promise.all([
    listDepartments(profile.orgId),
    listCategories(profile.orgId),
    listOrgProfiles(profile.orgId),
    listTemplates(profile.orgId),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">
        {memo.status === "Changes Requested" ? "Revise Memo" : "Edit Draft"}
      </h1>
      <MemoForm
        departments={departments.filter((d) => d.isActive !== false)}
        categories={categories.filter((c) => c.isActive !== false)}
        users={users
          .filter((u) => u.status === "active")
          .map((u) => ({
            id: u.id,
            full_name: u.fullName,
            designation: u.designation,
          }))}
        templates={templates
          .filter((t) => t.isActive !== false)
          .map((t) => ({
            id: t.id,
            name: t.name,
            steps: (t.steps ?? [])
              .sort((a, b) => a.order - b.order)
              .map((s) => ({ step_order: s.order, position_label: s.label })),
          }))}
        currentUserId={profile.id}
        existing={{
          id: memo.id,
          subject: memo.subject,
          body: memo.body,
          department_id: memo.departmentId,
          category_id: memo.categoryId,
          priority: memo.priority,
          status: memo.status,
        }}
      />
    </div>
  );
}
