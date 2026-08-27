import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge, PriorityBadge } from "@/components/status-badge";
import { WorkflowActionPanel } from "@/components/workflow-action-panel";
import { CommentBox } from "@/components/comment-box";
import { AttachmentPanel } from "@/components/attachment-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const stepIcon: Record<string, string> = {
  Approved: "✅",
  Rejected: "❌",
  ChangesRequested: "↩️",
  Active: "🟡",
  Pending: "⚪",
  Skipped: "⏭️",
};

export default async function MemoDetailsPage({
  params,
}: {
  params: { id: string };
}) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: memo } = await supabase
    .from("memos")
    .select(
      `*,
       author:profiles!memos_author_id_fkey(id, full_name, designation),
       department:departments(name),
       category:memo_categories(name)`
    )
    .eq("id", params.id)
    .single();
  if (!memo) notFound();

  const [{ data: steps }, { data: comments }, { data: attachments }, { data: versions }] =
    await Promise.all([
      supabase
        .from("workflow_instance_steps")
        .select("*, assignee:profiles!workflow_instance_steps_assigned_user_id_fkey(full_name, designation), behalf:profiles!workflow_instance_steps_acted_on_behalf_of_fkey(full_name)")
        .eq("memo_id", params.id)
        .order("step_order"),
      supabase
        .from("comments")
        .select("*, author:profiles!comments_author_id_fkey(full_name)")
        .eq("memo_id", params.id)
        .order("created_at"),
      supabase
        .from("attachments")
        .select("*, uploader:profiles!attachments_uploaded_by_fkey(full_name)")
        .eq("memo_id", params.id)
        .order("created_at"),
      supabase
        .from("memo_versions")
        .select("version_number, change_reason, created_at, editor:profiles!memo_versions_edited_by_fkey(full_name)")
        .eq("memo_id", params.id)
        .order("version_number"),
    ]);

  const currentStep = (steps ?? []).find((s) => s.status === "Active");
  const isMyTurn = currentStep?.assigned_user_id === profile.id;
  const isAuthor = memo.author_id === profile.id;
  const canEdit =
    isAuthor && ["Draft", "Changes Requested"].includes(memo.status);

  // Timeline: merge step actions + comments chronologically
  type TimelineEvent = { at: string; who: string; what: string; note?: string };
  const timeline: TimelineEvent[] = [];
  timeline.push({
    at: memo.created_at,
    who: memo.author?.full_name ?? "Author",
    what: "created the memo",
  });
  if (memo.submitted_at)
    timeline.push({
      at: memo.submitted_at,
      who: memo.author?.full_name ?? "Author",
      what: "submitted the memo",
    });
  for (const v of versions ?? []) {
    if (v.version_number > 1)
      timeline.push({
        at: v.created_at,
        who: (v.editor as { full_name?: string } | null)?.full_name ?? "Author",
        what: `resubmitted (version ${v.version_number})`,
      });
  }
  for (const s of steps ?? []) {
    if (s.acted_at)
      timeline.push({
        at: s.acted_at,
        who: s.assignee?.full_name ?? "Participant",
        what:
          s.status === "Approved"
            ? "approved"
            : s.status === "Rejected"
              ? "rejected"
              : s.status === "ChangesRequested"
                ? "requested changes"
                : "acted",
        note: s.comment ?? undefined,
      });
  }
  for (const c of comments ?? []) {
    if (c.comment_type === "general")
      timeline.push({
        at: c.created_at,
        who: c.author?.full_name ?? "User",
        what: "commented",
        note: c.body,
      });
  }
  timeline.sort((a, b) => a.at.localeCompare(b.at));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{memo.subject}</h1>
            <StatusBadge status={memo.status} />
            <PriorityBadge priority={memo.priority} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {memo.memo_number ?? "Draft (no number yet)"} · by{" "}
            {memo.author?.full_name}
            {memo.department?.name ? ` · ${memo.department.name}` : ""}
            {memo.category?.name ? ` · ${memo.category.name}` : ""} ·{" "}
            {format(new Date(memo.created_at), "PPp")}
          </p>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Link href={`/memos/${memo.id}/edit`}>
              <Button variant="outline">
                {memo.status === "Changes Requested" ? "Revise" : "Edit draft"}
              </Button>
            </Link>
          )}
          {memo.memo_number && (
            <a href={`/api/memos/${memo.id}/pdf`} target="_blank">
              <Button variant="outline">Export PDF</Button>
            </a>
          )}
        </div>
      </div>

      {currentStep && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
          <strong>Awaiting action from {currentStep.assignee?.full_name}</strong>
          {isMyTurn && " — it's your turn to act on this memo."}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Memo</CardTitle></CardHeader>
            <CardContent>
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: memo.body }}
              />
            </CardContent>
          </Card>

          {isMyTurn && (
            <WorkflowActionPanel memoId={memo.id} />
          )}

          <Card>
            <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {timeline.map((e, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="w-40 shrink-0 text-muted-foreground">
                      {format(new Date(e.at), "PP p")}
                    </span>
                    <span>
                      <strong>{e.who}</strong> {e.what}
                      {e.note && (
                        <span className="mt-1 block rounded bg-slate-100 p-2 text-slate-700">
                          {e.note}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Comments</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {(comments ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">No comments yet.</p>
              )}
              {(comments ?? []).map((c) => (
                <div key={c.id} className="rounded-md border p-3 text-sm">
                  <div className="mb-1 flex items-center justify-between">
                    <strong>{c.author?.full_name}</strong>
                    <span className="text-xs text-muted-foreground">
                      {c.comment_type !== "general" && (
                        <span className={cn(
                          "mr-2 rounded px-1.5 py-0.5 text-xs",
                          c.comment_type === "approval" && "bg-green-100 text-green-800",
                          c.comment_type === "rejection" && "bg-red-100 text-red-800",
                          c.comment_type === "change_request" && "bg-orange-100 text-orange-800",
                        )}>
                          {c.comment_type.replace("_", " ")}
                        </span>
                      )}
                      {format(new Date(c.created_at), "PP p")}
                    </span>
                  </div>
                  <p>{c.body}</p>
                </div>
              ))}
              {(isAuthor ||
                (steps ?? []).some((s) => s.assigned_user_id === profile.id)) &&
                !["Draft"].includes(memo.status) && (
                  <CommentBox memoId={memo.id} />
                )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Workflow</CardTitle></CardHeader>
            <CardContent>
              {(steps ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Not submitted yet — no workflow.
                </p>
              ) : (
                <ol className="space-y-3">
                  {(steps ?? []).map((s) => (
                    <li key={s.id}
                      className={cn(
                        "rounded-md border p-3 text-sm",
                        s.status === "Active" && "border-amber-300 bg-amber-50"
                      )}>
                      <div className="flex items-center gap-2">
                        <span>{stepIcon[s.status]}</span>
                        <strong>{s.step_order}. {s.assignee?.full_name}</strong>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {s.assignee?.designation}
                        {s.position_label ? ` · ${s.position_label}` : ""}
                      </p>
                      <p className="text-xs">
                        {s.status === "Active" ? "Current step" : s.status}
                        {s.acted_at && ` · ${format(new Date(s.acted_at), "PP p")}`}
                        {s.behalf && ` (on behalf of ${s.behalf.full_name})`}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          <AttachmentPanel
            memoId={memo.id}
            attachments={(attachments ?? []).map((a) => ({
              id: a.id,
              filename: a.filename,
              size_bytes: a.size_bytes,
              created_at: a.created_at,
              uploader: a.uploader?.full_name ?? "",
            }))}
            canUpload={isAuthor && ["Draft", "Changes Requested"].includes(memo.status)}
          />

          {(versions ?? []).length > 1 && (
            <Card>
              <CardHeader><CardTitle>Versions</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {(versions ?? []).map((v) => (
                    <li key={v.version_number}>
                      <strong>v{v.version_number}</strong> —{" "}
                      {(v.editor as { full_name?: string } | null)?.full_name} ·{" "}
                      {format(new Date(v.created_at), "PP p")}
                      <Separator className="mt-2" />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
