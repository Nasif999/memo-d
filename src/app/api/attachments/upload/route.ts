import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  // RLS-scoped fetch: only returns the memo if the caller may see it.
  const { data: memo } = await supabase
    .from("memos")
    .select("id, org_id, author_id, status")
    .eq("id", memoId)
    .single();
  if (!memo) return NextResponse.json({ error: "Memo not found" }, { status: 404 });
  if (memo.author_id !== user.id) {
    return NextResponse.json({ error: "Only the author can attach files" }, { status: 403 });
  }
  if (!["Draft", "Changes Requested"].includes(memo.status)) {
    return NextResponse.json(
      { error: "Attachments can only be added while the memo is editable" },
      { status: 400 }
    );
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  const path = `${memo.org_id}/${memo.id}/${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("attachments")
    .upload(path, file, { contentType: file.type });
  if (uploadError) {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  const { error: insertError } = await supabase.from("attachments").insert({
    memo_id: memo.id,
    org_id: memo.org_id,
    storage_path: path,
    filename: file.name,
    size_bytes: file.size,
    mime_type: file.type,
    uploaded_by: user.id,
  });
  if (insertError) {
    await supabase.storage.from("attachments").remove([path]);
    return NextResponse.json({ error: "Could not record attachment" }, { status: 500 });
  }

  await supabase.rpc("log_auth_event", { p_event: "attachment_upload" });
  return NextResponse.json({ ok: true });
}
