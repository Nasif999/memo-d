import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { requireProfile } from "@/lib/auth";
import {
  getMemoForUser,
  listSteps,
  listComments,
  listAttachments,
  listVersions,
  profilesMap,
  listDepartments,
  listCategories,
} from "@/lib/data";
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
  const memo = await getMemoForUser(params.id, profile);
  if (!memo) notFound();

  const [steps, comments, attachments, versions, people, departments, categories] =
    await Promise.all([
      listSteps(memo.id),
      listComments(memo.id),
      listAttachments(memo.id),
      listVersions(memo.id),
      profilesMap(profile.orgId),
      listDepartments(profile.orgId),
      listCategories(profile.orgId),
    ]);

  const name = (uid: string | null | undefined) =>
    uid ? (people.get(uid)?.fullName ?? "Unknown") : "Unknown";
  const designation = (uid: string) => people.get(uid)?.designation ?? null;
  const deptName = memo.departmentId
    ? departments.find((d) => d.id === memo.departmentId)?.name
    : null;
  const catName = memo.categoryId
    ? categories.find((c) => c.id === memo.categoryId)?.name
    : null;

  const currentStep = steps.find((s) => s.status === "Active");
  const isMyTurn = currentStep?.assignedUserId === profile.id;
  const isAuthor = memo.authorId === profile.id;
  const canEdit =
    isAuthor && ["Draft", "Changes Requested"].includes(memo.status);

  type TimelineEvent = { at: string; who: string; what: string; note?: string };
  const timeline: TimelineEvent[] = [];
  timeline.push({
    at: memo.createdAt,
    who: name(memo.authorId),
    what: "created the memo",
  });
  if (memo.submittedAt)
    timeline.push({
      at: memo.submittedAt,
      who: name(memo.authorId),
      what: "submitted the memo",
    });
  for (const v of versions) {
    if (v.versionNumber > 1)
      timeline.push({
        at: v.createdAt,
        who: name(v.editedBy),
        what: `resubmitted (version ${v.versionNumber})`,
      });
  }
  for (const s of steps) {
    if (s.actedAt)
      timeline.push({
        at: s.actedAt,
        who: name(s.assignedUserId),
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
  for (const c of comments) {
    if (c.type === "general")
      timeline.push({
        at: c.createdAt,
        who: name(c.authorId),
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
            {memo.memoNumber ?? "Draft (no number yet)"} · by{" "}
            {name(memo.authorId)}
            {deptName ? ` · ${deptName}` : ""}
            {catName ? ` · ${catName}` : ""} ·{" "}
            {format(new Date(memo.createdAt), "PPp")}
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
          {memo.memoNumber && (
            <a href={`/api/memos/${memo.id}/pdf`} target="_blank">
              <Button variant="outline">Export PDF</Button>
            </a>
          )}
        </div>
      </div>

      {currentStep && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
          <strong>
            Awaiting action from {name(currentStep.assignedUserId)}
          </strong>
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

          {isMyTurn && <WorkflowActionPanel memoId={memo.id} />}

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
              {comments.length === 0 && (
                <p className="text-sm text-muted-foreground">No comments yet.</p>
              )}
              {comments.map((c) => (
                <div key={c.id} className="rounded-md border p-3 text-sm">
                  <div className="mb-1 flex items-center justify-between">
                    <strong>{name(c.authorId)}</strong>
                    <span className="text-xs text-muted-foreground">
                      {c.type !== "general" && (
                        <span className={cn(
                          "mr-2 rounded px-1.5 py-0.5 text-xs",
                          c.type === "approval" && "bg-green-100 text-green-800",
                          c.type === "rejection" && "bg-red-100 text-red-800",
                          c.type === "change_request" && "bg-orange-100 text-orange-800",
                        )}>
                          {c.type.replace("_", " ")}
                        </span>
                      )}
                      {format(new Date(c.createdAt), "PP p")}
                    </span>
                  </div>
                  <p>{c.body}</p>
                </div>
              ))}
              {(isAuthor || memo.participantIds.includes(profile.id)) &&
                memo.status !== "Draft" && <CommentBox memoId={memo.id} />}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Workflow</CardTitle></CardHeader>
            <CardContent>
              {steps.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Not submitted yet — no workflow.
                </p>
              ) : (
                <ol className="space-y-3">
                  {steps.map((s) => (
                    <li key={s.id}
                      className={cn(
                        "rounded-md border p-3 text-sm",
                        s.status === "Active" && "border-amber-300 bg-amber-50"
                      )}>
                      <div className="flex items-center gap-2">
                        <span>{stepIcon[s.status]}</span>
                        <strong>{s.order}. {name(s.assignedUserId)}</strong>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {designation(s.assignedUserId)}
                        {s.positionLabel ? ` · ${s.positionLabel}` : ""}
                      </p>
                      <p className="text-xs">
                        {s.status === "Active" ? "Current step" : s.status}
                        {s.actedAt && ` · ${format(new Date(s.actedAt), "PP p")}`}
                        {s.actedOnBehalfOf &&
                          ` (on behalf of ${name(s.actedOnBehalfOf)})`}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          <AttachmentPanel
            memoId={memo.id}
            attachments={attachments.map((a) => ({
              id: a.id,
              filename: a.filename,
              size_bytes: a.sizeBytes,
              created_at: a.createdAt,
              uploader: name(a.uploadedBy),
            }))}
            canUpload={canEdit}
          />

          {versions.length > 1 && (
            <Card>
              <CardHeader><CardTitle>Versions</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {versions.map((v) => (
                    <li key={v.versionNumber}>
                      <strong>v{v.versionNumber}</strong> — {name(v.editedBy)} ·{" "}
                      {format(new Date(v.createdAt), "PP p")}
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
