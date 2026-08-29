"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveDraft, submitMemo, type MemoInput } from "@/app/(app)/memos/actions";
import { RichTextEditor } from "@/components/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkflowFlow } from "@/components/workflow-flow";
import { AttachmentPanel } from "@/components/attachment-panel";
import { DepartmentCombobox } from "@/components/department-combobox";
const selectClass =
  "h-9 w-full rounded-md border bg-background px-2 text-sm";
const MAX_ATTACHMENT_MB = 5;

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

type Option = { id: string; name: string };
type UserOption = { id: string; full_name: string; designation: string | null };
type Template = { id: string; name: string; steps: { step_order: number; position_label: string }[] };

export function MemoForm({
  departments,
  categories,
  users,
  templates,
  currentUserId,
  existing,
}: {
  departments: Option[];
  categories: Option[];
  users: UserOption[];
  templates: Template[];
  currentUserId: string;
  existing?: {
    id: string;
    subject: string;
    body: string;
    department_id: string | null;
    category_id: string | null;
    priority: string;
    status: string;
    attachments: {
      id: string;
      filename: string;
      size_bytes: number;
      created_at: string;
      uploader: string;
    }[];
  };
}) {
  const router = useRouter();
  const isResubmit = existing?.status === "Changes Requested";
  const [subject, setSubject] = useState(existing?.subject ?? "");
  const [body, setBody] = useState(existing?.body ?? "");
  const [departmentId, setDepartmentId] = useState(existing?.department_id ?? "");
  const [categoryId, setCategoryId] = useState(existing?.category_id ?? "");
  const [priority, setPriority] = useState(existing?.priority ?? "Normal");
  const [participants, setParticipants] = useState<string[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addPendingFiles(files: FileList | null) {
    if (!files) return;
    const picked = Array.from(files);
    const tooBig = picked.find((f) => f.size > MAX_ATTACHMENT_MB * 1024 * 1024);
    if (tooBig) return toast.error(`"${tooBig.name}" is over ${MAX_ATTACHMENT_MB} MB.`);
    setPendingFiles((prev) => [...prev, ...picked]);
  }

  async function uploadPending(memoId: string) {
    for (const file of pendingFiles) {
      const form = new FormData();
      form.set("file", file);
      form.set("memo_id", memoId);
      const res = await fetch("/api/attachments/upload", { method: "POST", body: form });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        toast.error(j?.error ?? `Could not attach "${file.name}".`);
      }
    }
  }

  // Templates are the only source of an approval sequence — who fills a slot
  // is chosen here, but the slots themselves (their order and roles) are
  // fixed by whichever administrator built the template.
  const selectedTemplate = templates.find((t) => t.id === templateId);
  const workflowSlots = selectedTemplate?.steps.map((s) => s.position_label) ?? [];

  function input(): MemoInput {
    return {
      subject,
      body,
      department_id: departmentId || null,
      category_id: categoryId || null,
      priority: priority as MemoInput["priority"],
    };
  }

  async function handleSaveDraft() {
    setBusy(true);
    const res = await saveDraft(input(), existing?.id);
    if ("error" in res && res.error) {
      setBusy(false);
      return toast.error(res.error);
    }
    if (!existing && pendingFiles.length) await uploadPending(res.id!);
    setBusy(false);
    toast.success("Draft saved");
    router.push(`/memos/${res.id}`);
  }

  async function handleSubmit() {
    if (!subject.trim()) return toast.error("Subject is required");
    if (!isResubmit && !selectedTemplate)
      return toast.error("Choose a workflow template");
    if (!isResubmit && participants.filter(Boolean).length < workflowSlots.length)
      return toast.error("Assign someone to every step");
    setBusy(true);
    const res = await saveDraft(input(), existing?.id);
    if ("error" in res && res.error) {
      setBusy(false);
      return toast.error(res.error);
    }
    if (!existing && pendingFiles.length) await uploadPending(res.id!);
    const submitRes = await submitMemo(
      res.id!,
      isResubmit ? null : templateId,
      isResubmit ? [] : participants
    );
    setBusy(false);
    if (submitRes.error) return toast.error(submitRes.error);
    toast.success(isResubmit ? "Memo resubmitted" : "Memo submitted");
    router.push(`/memos/${res.id}`);
  }

  function setParticipant(index: number, userId: string) {
    setParticipants((prev) => {
      const next = [...prev];
      next[index] = userId;
      return next;
    });
  }

  function applyTemplate(id: string) {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (t) setParticipants(new Array(t.steps.length).fill(""));
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>{isResubmit ? "Revise Memo" : "Memo Details"}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Subject *</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)}
              placeholder="Memo subject" maxLength={300} />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Department</Label>
              <DepartmentCombobox
                className="h-9"
                value={departmentId}
                onChange={setDepartmentId}
                options={departments}
                placeholder="Select department"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <select className={selectClass} value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <select className={selectClass} value={priority}
                onChange={(e) => setPriority(e.target.value)}>
                <option value="Normal">Normal</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Body</Label>
            <RichTextEditor value={body} onChange={setBody} />
          </div>
        </CardContent>
      </Card>

      {existing ? (
        <AttachmentPanel
          memoId={existing.id}
          attachments={existing.attachments}
          canUpload={["Draft", "Changes Requested"].includes(existing.status)}
        />
      ) : (
        <Card>
          <CardHeader><CardTitle>Attachments</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {pendingFiles.length === 0 && (
              <p className="text-sm text-muted-foreground">No attachments.</p>
            )}
            <ul className="space-y-2 text-sm">
              {pendingFiles.map((f, i) => (
                <li key={i} className="flex items-center justify-between gap-2 rounded-md border p-2">
                  <span>{f.name} <span className="text-xs text-muted-foreground">({formatBytes(f.size)})</span></span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 shrink-0 px-1 text-xs"
                    onClick={() => setPendingFiles((prev) => prev.filter((_, j) => j !== i))}
                  >
                    ✕
                  </Button>
                </li>
              ))}
            </ul>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.gif,.doc,.docx,.xls,.xlsx,.txt,.csv"
              onChange={(e) => {
                addPendingFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              + Add attachment
            </Button>
            <p className="text-xs text-muted-foreground">
              PDF, image, Office, or text files up to {MAX_ATTACHMENT_MB} MB each —
              uploaded once you save or submit.
            </p>
          </CardContent>
        </Card>
      )}

      {!isResubmit && (
        <Card>
          <CardHeader>
            <CardTitle>Approval Workflow</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Your organization has no workflow templates yet. Ask an
                administrator to create one under Admin → Workflow Templates
                before this memo can be submitted for approval — you can still
                save it as a draft.
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Workflow template *</Label>
                  <select className={selectClass} value={templateId}
                    onChange={(e) => applyTemplate(e.target.value)}>
                    <option value="">Select a workflow…</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Your administrator defines who approves and in what order.
                    Pick the workflow that matches this memo, then assign the
                    current person for each role below.
                  </p>
                </div>
                {selectedTemplate && (
                  <div className="space-y-3 border-t pt-4">
                    <WorkflowFlow steps={workflowSlots} />
                    <p className="text-sm text-muted-foreground">
                      The memo passes through these people in order. Each may
                      approve, reject, comment, or request changes.
                    </p>
                    {workflowSlots.map((label, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-32 shrink-0 text-sm font-medium">
                          {i + 1}. {label}
                        </span>
                        <select className={selectClass} value={participants[i] ?? ""}
                          onChange={(e) => setParticipant(i, e.target.value)}>
                          <option value="">Select user</option>
                          {users.filter((u) => u.id !== currentUserId).map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.full_name}{u.designation ? ` — ${u.designation}` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3">
        {!isResubmit && (
          <Button variant="outline" onClick={handleSaveDraft} disabled={busy}>
            Save as draft
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          disabled={busy || (!isResubmit && templates.length === 0)}
        >
          {busy ? "Working…" : isResubmit ? "Resubmit memo" : "Submit for approval"}
        </Button>
      </div>
    </div>
  );
}
