"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { performAction } from "@/app/(app)/memos/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function WorkflowActionPanel({ memoId }: { memoId: string }) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  async function act(
    action: "approve" | "reject" | "request_changes" | "comment"
  ) {
    if (
      ["reject", "request_changes", "comment"].includes(action) &&
      !comment.trim()
    ) {
      return toast.error(
        action === "reject"
          ? "A rejection reason is required."
          : action === "request_changes"
            ? "Explain what changes are needed."
            : "Comment text required."
      );
    }
    setBusy(true);
    const res = await performAction(memoId, action, comment);
    setBusy(false);
    if (res.error) return toast.error(res.error);
    toast.success("Action recorded");
    setComment("");
    router.refresh();
  }

  return (
    <Card className="border-amber-300">
      <CardHeader>
        <CardTitle>Your Action Required</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          placeholder="Comment (required for reject / request changes, optional for approve)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
        />
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => act("approve")} disabled={busy}
            className="bg-green-600 hover:bg-green-700">
            Approve
          </Button>
          <Button onClick={() => act("reject")} disabled={busy} variant="destructive">
            Reject
          </Button>
          <Button onClick={() => act("request_changes")} disabled={busy} variant="outline">
            Request changes
          </Button>
          <Button onClick={() => act("comment")} disabled={busy} variant="ghost">
            Comment only
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
