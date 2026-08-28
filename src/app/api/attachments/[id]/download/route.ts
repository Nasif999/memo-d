import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { getMemoForUser, readAttachment } from "@/lib/data";

export const runtime = "nodejs";

// Streams the file bytes back only after a server-side access check. There is
// no public URL and no shareable link — the bytes never leave this route
// without an authorized session, so guessing an id gains nothing.
// URL shape: /api/attachments/{attachmentId}/download?memo={memoId}
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const memoId = new URL(request.url).searchParams.get("memo");
  if (!memoId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Tenant + visibility check: only memos this caller is allowed to see.
  const memo = await getMemoForUser(memoId, profile);
  if (!memo) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const file = await readAttachment(memoId, params.id);
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Quote-strip the filename so it cannot break out of the header.
  const safeName = file.filename.replace(/["\\\r\n]/g, "_");

  return new NextResponse(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.mimeType || "application/octet-stream",
      "Content-Length": String(file.bytes.length),
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
