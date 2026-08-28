"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/lib/firebase/admin";
import { requireProfile } from "@/lib/auth";
import {
  submitMemoTx,
  performWorkflowActionTx,
  addGeneralComment,
  cancelMemoTx,
  deleteAttachment,
  logAudit,
  type WorkflowAction,
} from "@/lib/data";

const memoSchema = z.object({
  subject: z.string().trim().min(1).max(300),
  body: z.string().max(200_000),
  department_id: z.string().nullable(),
  category_id: z.string().nullable(),
  priority: z.enum(["Normal", "High", "Urgent"]),
});

export type MemoInput = z.infer<typeof memoSchema>;

export async function saveDraft(input: MemoInput, memoId?: string) {
  const profile = await requireProfile();
  const parsed = memoSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid memo data." };
  const data = {
    subject: parsed.data.subject,
    body: parsed.data.body,
    departmentId: parsed.data.department_id || null,
    categoryId: parsed.data.category_id || null,
    priority: parsed.data.priority,
  };

  if (memoId) {
    const ref = db().collection("memos").doc(memoId);
    const snap = await ref.get();
    const memo = snap.data();
    // Server-side ownership + state check — only the author edits, only in editable states.
    if (
      !memo ||
      memo.orgId !== profile.orgId ||
      memo.authorId !== profile.id ||
      !["Draft", "Changes Requested"].includes(memo.status)
    ) {
      return { error: "Could not update draft." };
    }
    await ref.update({ ...data, updatedAt: FieldValue.serverTimestamp() });
    revalidatePath(`/memos/${memoId}`);
    return { id: memoId };
  }

  const ref = await db().collection("memos").add({
    ...data,
    orgId: profile.orgId,
    authorId: profile.id,
    status: "Draft",
    memoNumber: null,
    currentStepOrder: null,
    currentAssigneeId: null,
    participantIds: [],
    currentVersion: 1,
    submittedAt: null,
    completedAt: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  await logAudit(profile.orgId, profile.id, "memo_created", "memo", ref.id, data.subject);
  revalidatePath("/memos");
  return { id: ref.id };
}

export async function deleteDraft(memoId: string) {
  const profile = await requireProfile();
  const ref = db().collection("memos").doc(memoId);
  const snap = await ref.get();
  const memo = snap.data();
  if (
    !memo ||
    memo.orgId !== profile.orgId ||
    memo.authorId !== profile.id ||
    memo.status !== "Draft"
  ) {
    return { error: "Could not delete draft." };
  }
  await db().recursiveDelete(ref);
  revalidatePath("/memos");
  redirect("/memos");
}

export async function submitMemo(memoId: string, participantIds: string[]) {
  const profile = await requireProfile();
  const ids = z.array(z.string().min(1)).parse(participantIds);
  const res = await submitMemoTx(memoId, profile, ids);
  if (res.error) return { error: res.error };
  revalidatePath(`/memos/${memoId}`);
  revalidatePath("/memos");
  revalidatePath("/inbox");
  return { ok: true };
}

export async function performAction(
  memoId: string,
  action: WorkflowAction,
  comment: string
) {
  const profile = await requireProfile();
  const res = await performWorkflowActionTx(
    memoId,
    profile,
    action,
    comment.trim() || null
  );
  if (res.error) return { error: res.error };
  revalidatePath(`/memos/${memoId}`);
  revalidatePath("/inbox");
  return { ok: true };
}

export async function addComment(memoId: string, body: string) {
  const profile = await requireProfile();
  const text = z.string().trim().min(1).max(10_000).safeParse(body);
  if (!text.success) return { error: "Comment text required." };
  const res = await addGeneralComment(memoId, profile, text.data);
  if (res.error) return { error: res.error };
  revalidatePath(`/memos/${memoId}`);
  return { ok: true };
}

export async function removeAttachment(memoId: string, attachmentId: string) {
  const profile = await requireProfile();
  const snap = await db().collection("memos").doc(memoId).get();
  const memo = snap.data();
  // Only the author may remove an attachment, and only while editable.
  if (
    !memo ||
    memo.orgId !== profile.orgId ||
    memo.authorId !== profile.id ||
    !["Draft", "Changes Requested"].includes(memo.status)
  ) {
    return { error: "Could not remove attachment." };
  }
  await deleteAttachment(memoId, attachmentId);
  await logAudit(profile.orgId, profile.id, "attachment_deleted", "memo", memoId, attachmentId);
  revalidatePath(`/memos/${memoId}`);
  return { ok: true };
}

export async function cancelMemo(memoId: string) {
  const profile = await requireProfile();
  const res = await cancelMemoTx(memoId, profile);
  if (res.error) return { error: res.error };
  revalidatePath(`/memos/${memoId}`);
  revalidatePath("/memos");
  return { ok: true };
}
