import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Issues a short-lived signed URL after an RLS-scoped access check.
// The bucket is private — this route is the only way to reach a file.
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // RLS on attachments + memos guarantees this only returns rows the
  // caller's org/authorization permits.
  const { data: attachment } = await supabase
    .from("attachments")
    .select("storage_path, filename, memo_id")
    .eq("id", params.id)
    .single();
  if (!attachment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // Confirm the memo itself is visible to this caller (drafts stay author-only).
  const { data: memo } = await supabase
    .from("memos")
    .select("id")
    .eq("id", attachment.memo_id)
    .single();
  if (!memo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: signed, error } = await supabase.storage
    .from("attachments")
    .createSignedUrl(attachment.storage_path, 60, {
      download: attachment.filename,
    });
  if (error || !signed) {
    return NextResponse.json({ error: "Could not sign URL" }, { status: 500 });
  }
  return NextResponse.redirect(signed.signedUrl);
}
