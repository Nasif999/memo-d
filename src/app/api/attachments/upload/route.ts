import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { db, bucket } from "@/lib/firebase/admin";
import { getSessionProfile } from "@/lib/auth";
import { logAudit } from "@/lib/data";

export const runtime = "nodejs";

const MAX_SIZE = 10 * 1024 * 1024;
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
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 400 });
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

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  const path = `attachments/${memo.orgId}/${memoId}/${crypto.randomUUID()}-${safeName}`;

  try {
    const store = bucket();
    const [bucketExists] = await store.exists();
    if (!bucketExists) {
      return NextResponse.json(
        {
          error:
            "File storage is not configured for this deployment. Enable Firebase Storage and set FIREBASE_STORAGE_BUCKET.",
        },
        { status: 503 }
      );
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    await store.file(path).save(buffer, {
      contentType: file.type,
      resumable: false,
    });
  } catch {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  await db().collection("memos").doc(memoId).collection("attachments").add({
    storagePath: path,
    filename: file.name,
    sizeBytes: file.size,
    mimeType: file.type,
    uploadedBy: profile.id,
    createdAt: FieldValue.serverTimestamp(),
  });

  await logAudit(profile.orgId, profile.id, "attachment_upload", "memo", memoId, file.name);
  return NextResponse.json({ ok: true });
}
