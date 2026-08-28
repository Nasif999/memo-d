"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { removeAttachment } from "@/app/(app)/memos/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MAX_MB = 5;

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function AttachmentPanel({
  memoId,
  attachments,
  canUpload,
}: {
  memoId: string;
  attachments: {
    id: string;
    filename: string;
    size_bytes: number;
    created_at: string;
    uploader: string;
  }[];
  canUpload: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    if (file.size > MAX_MB * 1024 * 1024) {
      return toast.error(`File too large (max ${MAX_MB} MB).`);
    }
    setBusy(true);
    const form = new FormData();
    form.set("file", file);
    form.set("memo_id", memoId);
    const res = await fetch("/api/attachments/upload", {
      method: "POST",
      body: form,
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      return toast.error(j?.error ?? "Upload failed.");
    }
    toast.success("Attachment uploaded");
    router.refresh();
  }

  async function remove(attachmentId: string) {
    const res = await removeAttachment(memoId, attachmentId);
    if (res.error) return toast.error(res.error);
    toast.success("Attachment removed");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader><CardTitle>Attachments</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {attachments.length === 0 && (
          <p className="text-sm text-muted-foreground">No attachments.</p>
        )}
        <ul className="space-y-2 text-sm">
          {attachments.map((a) => (
            <li key={a.id} className="rounded-md border p-2">
              <div className="flex items-start justify-between gap-2">
                <a
                  href={`/api/attachments/${a.id}/download?memo=${memoId}`}
                  className="font-medium underline"
                >
                  {a.filename}
                </a>
                {canUpload && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 shrink-0 px-1 text-xs"
                    onClick={() => remove(a.id)}
                  >
                    ✕
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatBytes(a.size_bytes)} · {a.uploader} ·{" "}
                {format(new Date(a.created_at), "PP p")}
              </p>
            </li>
          ))}
        </ul>
        {canUpload && (
          <>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.gif,.doc,.docx,.xls,.xlsx,.txt,.csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              {busy ? "Uploading…" : "+ Add attachment"}
            </Button>
            <p className="text-xs text-muted-foreground">
              PDF, image, Office, or text files up to {MAX_MB} MB.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
