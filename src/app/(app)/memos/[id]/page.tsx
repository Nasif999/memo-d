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
  listEvents,
  profilesMap,
  listDepartments,
  listCategories,
} from "@/lib/data";
import {
  StatusBadge,
  PriorityBadge,
  TerminalStamp,
} from "@/components/status-badge";
import { RoutingRail } from "@/components/routing-rail";
import { WorkflowActionPanel } from "@/components/workflow-action-panel";
import { CommentBox } from "@/components/comment-box";
import { AttachmentPanel } from "@/components/attachment-panel";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export default async function MemoDetailsPage({
  params,
}: {
  params: { id: string };
}) {
  const profile = await requireProfile();
  const memo = await getMemoForUser(params.id, profile);
  if (!memo) notFound();

  const [steps, comments, attachments, versions, events, people, departments, categories] =
    await Promise.all([
      listSteps(memo.id),
      listComments(memo.id),
      listAttachments(memo.id),
      listVersions(memo.id),
      listEvents(memo.id),
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

  // Built from the append-only event log so decisions from earlier submission
  // rounds survive the step reset that a resubmission performs.
  type TimelineEvent = { at: string; who: string; what: string; note?: string };
  const timeline: TimelineEvent[] = [
    {
      at: memo.createdAt,
      who: name(memo.authorId),
      what: "created the memo",
    },
    ...events.map((e) => ({
      at: e.createdAt,
      who:
        name(e.actorId) +
        (e.onBehalfOf ? ` (on behalf of ${name(e.onBehalfOf)})` : ""),
      what:
        e.action === "submitted"
          ? "submitted the memo"
          : e.action === "resubmitted"
            ? `resubmitted the memo (version ${e.versionNumber})`
            : e.action,
      note: e.comment ?? undefined,
    })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <div className="space-y-6">
      {/* The memo's own header block: the fields a paper memo carries. */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="eyebrow">{memo.memoNumber ?? "Unfiled draft"}</p>
              <StatusBadge status={memo.status} />
              <PriorityBadge priority={memo.priority} />
            </div>
            <h1 className="text-2xl font-semibold leading-tight tracking-tight">
              {memo.subject}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <TerminalStamp status={memo.status} />
            <div className="flex gap-2">
              {canEdit && (
                <Link href={`/memos/${memo.id}/edit`}>
                  <Button variant="outline">
                    {memo.status === "Changes Requested"
                      ? "Revise"
                      : "Edit draft"}
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
        </div>
        <dl className="grid gap-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="doc-field">
            <dt>From</dt>
            <dd>{name(memo.authorId)}</dd>
          </div>
          <div className="doc-field">
            <dt>Department</dt>
            <dd>{deptName ?? "—"}</dd>
          </div>
          <div className="doc-field">
            <dt>Category</dt>
            <dd>{catName ?? "—"}</dd>
          </div>
          <div className="doc-field">
            <dt>Raised</dt>
            <dd className="font-mono text-xs tabular">
              {format(new Date(memo.createdAt), "dd MMM yyyy · HH:mm")}
            </dd>
          </div>
        </dl>
      </div>

      {currentStep && (
        <div
          className={cn(
            "flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border px-4 py-3 text-sm",
            isMyTurn
              ? "border-state-pending/40 bg-state-pending-wash"
              : "border-border bg-card"
          )}
        >
          <span className="stamp border-state-pending/35 bg-state-pending-wash text-state-pending">
            Step {currentStep.order}
          </span>
          {isMyTurn ? (
            <span>
              <strong>This memo is on your desk.</strong> Approve it, reject it,
              or send it back for changes below.
            </span>
          ) : (
            <span className="text-muted-foreground">
              Waiting on{" "}
              <strong className="text-foreground">
                {name(currentStep.assignedUserId)}
              </strong>
              .
            </span>
          )}
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
              <ol className="space-y-3.5">
                {timeline.map((e, i) => (
                  <li
                    key={i}
                    className="grid gap-1 text-sm sm:grid-cols-[10.5rem_1fr] sm:gap-3"
                  >
                    <span className="font-mono text-xs text-muted-foreground tabular">
                      {format(new Date(e.at), "dd MMM yyyy · HH:mm")}
                    </span>
                    <span>
                      <strong className="font-medium">{e.who}</strong> {e.what}
                      {e.note && (
                        <span className="mt-1.5 block border-l-2 border-border bg-muted/60 px-3 py-2 text-muted-foreground">
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
                <div
                  key={c.id}
                  className="rounded-md border border-border bg-muted/30 p-3 text-sm"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <strong>{name(c.authorId)}</strong>
                    <span className="text-xs text-muted-foreground">
                      {c.type !== "general" && (
                        <span
                          className={cn(
                            "stamp mr-2",
                            c.type === "approval" &&
                              "border-state-approved/30 bg-state-approved-wash text-state-approved",
                            c.type === "rejection" &&
                              "border-state-rejected/30 bg-state-rejected-wash text-state-rejected",
                            c.type === "change_request" &&
                              "border-state-changes/30 bg-state-changes-wash text-state-changes"
                          )}
                        >
                          {c.type.replace("_", " ")}
                        </span>
                      )}
                      <span className="font-mono tabular">
                        {format(new Date(c.createdAt), "dd MMM yyyy · HH:mm")}
                      </span>
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
            <CardHeader>
              <CardTitle>Route</CardTitle>
              <CardDescription>
                Approvals happen in this order, one desk at a time.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RoutingRail
                viewerId={profile.id}
                currentAssigneeId={currentStep?.assignedUserId ?? null}
                steps={steps.map((s) => ({
                  id: s.id,
                  order: s.order,
                  name: name(s.assignedUserId),
                  designation: designation(s.assignedUserId),
                  positionLabel: s.positionLabel ?? null,
                  status: s.status,
                  actedAt: s.actedAt ?? null,
                  onBehalfOf: s.actedOnBehalfOf ? name(s.actedOnBehalfOf) : null,
                }))}
              />
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
