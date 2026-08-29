import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/admin";
import { getSessionProfile } from "@/lib/auth";

export const runtime = "nodejs";

// Logos are small and single-per-org, so — unlike memo attachments — they're
// stored as one base64 data: URI directly on the org doc, no chunking needed.
const MAX_BYTES = 500 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"]);

export async function POST(request: Request) {
  const profile = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "org_admin") {
    return NextResponse.json({ error: "Only an administrator can change the org logo" }, { status: 403 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "File is empty" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `Image too large (max ${MAX_BYTES / 1024} KB)` },
      { status: 400 }
    );
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const dataUrl = `data:${file.type};base64,${bytes.toString("base64")}`;

  await db().collection("orgs").doc(profile.orgId).update({ logoUrl: dataUrl });
  return NextResponse.json({ ok: true, logoUrl: dataUrl });
}
