"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addComment } from "@/app/(app)/memos/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function CommentBox({ memoId }: { memoId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!body.trim()) return;
    setBusy(true);
    const res = await addComment(memoId, body);
    setBusy(false);
    if (res.error) return toast.error(res.error);
    setBody("");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <Textarea
        placeholder="Add a comment…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
      />
      <Button size="sm" onClick={submit} disabled={busy || !body.trim()}>
        Post comment
      </Button>
    </div>
  );
}
