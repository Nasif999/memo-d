import { NextResponse } from "next/server";
import { db, bucket } from "@/lib/firebase/admin";
import { getSessionProfile } from "@/lib/auth";
import { getMemoForUser } from "@/lib/data";

export const runtime = "nodejs";

// Issues a short-lived signed URL after a server-side access check.
// The bucket is private — this route is the only way to reach a file.
// URL shape: /api/attachments/{attachmentId}/download?memo={memoId}
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const memoId = new URL(request.url).searchParams.get("memo");
  if (!memoId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Tenant + visibility check: only memos the caller may see.
  const memo = await getMemoForUser(memoId, profile);
  if (!memo) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const attSnap = await db()
    .collection("memos").doc(memoId)
    .collection("attachments").doc(params.id)
    .get();
  const attachment = attSnap.data();
  if (!attachment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const [signedUrl] = await bucket()
      .file(attachment.storagePath)
      .getSignedUrl({
        action: "read",
        expires: Date.now() + 60_000,
        responseDisposition: `attachment; filename="${attachment.filename}"`,
      });
    return NextResponse.redirect(signedUrl);
  } catch {
    return NextResponse.json({ error: "Could not sign URL" }, { status: 500 });
  }
}
