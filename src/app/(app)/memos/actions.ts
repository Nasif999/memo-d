"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

const memoSchema = z.object({
  subject: z.string().trim().min(1).max(300),
  body: z.string().max(200_000),
  department_id: z.string().uuid().nullable(),
  category_id: z.string().uuid().nullable(),
  priority: z.enum(["Normal", "High", "Urgent"]),
});

export type MemoInput = z.infer<typeof memoSchema>;

export async function saveDraft(input: MemoInput, memoId?: string) {
  const profile = await requireProfile();
  const parsed = memoSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid memo data." };
  const supabase = await createClient();

  if (memoId) {
    const { error } = await supabase
      .from("memos")
      .update(parsed.data)
      .eq("id", memoId)
      .eq("author_id", profile.id);
    if (error) return { error: "Could not update draft." };
    revalidatePath(`/memos/${memoId}`);
    return { id: memoId };
  }

  const { data, error } = await supabase
    .from("memos")
    .insert({
      ...parsed.data,
      org_id: profile.org_id,
      author_id: profile.id,
      status: "Draft",
    })
    .select("id")
    .single();
  if (error || !data) return { error: "Could not save draft." };
  revalidatePath("/memos");
  return { id: data.id };
}

export async function deleteDraft(memoId: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase
    .from("memos")
    .delete()
    .eq("id", memoId)
    .eq("author_id", profile.id)
    .eq("status", "Draft");
  if (error) return { error: "Could not delete draft." };
  revalidatePath("/memos");
  redirect("/memos");
}

export async function submitMemo(memoId: string, participantIds: string[]) {
  await requireProfile();
  const ids = z.array(z.string().uuid()).min(0).parse(participantIds);
  const supabase = await createClient();
  // submit_memo re-validates author, status, org, and participant validity in SQL.
  const { error } = await supabase.rpc("submit_memo", {
    p_memo_id: memoId,
    p_participants: ids.length ? ids : null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/memos/${memoId}`);
  revalidatePath("/memos");
  revalidatePath("/inbox");
  return { ok: true };
}

export async function performAction(
  memoId: string,
  action: "approve" | "reject" | "request_changes" | "comment",
  comment: string
) {
  await requireProfile();
  const supabase = await createClient();
  // perform_workflow_action enforces "is it your turn" atomically in SQL.
  const { error } = await supabase.rpc("perform_workflow_action", {
    p_memo_id: memoId,
    p_action: action,
    p_comment: comment.trim() || null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/memos/${memoId}`);
  revalidatePath("/inbox");
  return { ok: true };
}

export async function addComment(memoId: string, body: string) {
  await requireProfile();
  const text = z.string().trim().min(1).max(10_000).safeParse(body);
  if (!text.success) return { error: "Comment text required." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_memo_comment", {
    p_memo_id: memoId,
    p_body: text.data,
  });
  if (error) return { error: error.message };
  revalidatePath(`/memos/${memoId}`);
  return { ok: true };
}

export async function cancelMemo(memoId: string) {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_memo", { p_memo_id: memoId });
  if (error) return { error: error.message };
  revalidatePath(`/memos/${memoId}`);
  revalidatePath("/memos");
  return { ok: true };
}
