import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import { getSessionProfile } from "@/lib/auth";
import { logAudit, saveAttachment, ATTACHMENT_MAX_BYTES } from "@/lib/data";

export const runtime = "nodejs";

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
]);

export async function POST(request: Request) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  const memoId = form.get("memo_id");
  if (!(file instanceof File) || typeof memoId !== "string") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "File is empty" }, { status: 400 });
  }
  if (file.size > ATTACHMENT_MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (max ${ATTACHMENT_MAX_BYTES / 1024 / 1024} MB)` },
      { status: 400 }
    );
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
  }

  const memoSnap = await db().collection("memos").doc(memoId).get();
  const memo = memoSnap.data();
  // Tenant + ownership + state checks — server-side only.
  if (!memo || memo.orgId !== profile.orgId) {
    return NextResponse.json({ error: "Memo not found" }, { status: 404 });
  }
  if (memo.authorId !== profile.id) {
    return NextResponse.json({ error: "Only the author can attach files" }, { status: 403 });
  }
  if (!["Draft", "Changes Requested"].includes(memo.status)) {
    return NextResponse.json(
      { error: "Attachments can only be added while the memo is editable" },
      { status: 400 }
    );
  }

  try {
    await saveAttachment(memoId, profile, {
      filename: file.name.slice(0, 200),
      mimeType: file.type,
      bytes: Buffer.from(await file.arrayBuffer()),
    });
  } catch {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  await logAudit(profile.orgId, profile.id, "attachment_upload", "memo", memoId, file.name);
  return NextResponse.json({ ok: true });
}
