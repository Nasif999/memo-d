"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveDraft, submitMemo, type MemoInput } from "@/app/(app)/memos/actions";
import { RichTextEditor } from "@/components/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
const selectClass =
  "h-9 w-full rounded-md border bg-white px-2 text-sm";

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

  const selectedTemplate = templates.find((t) => t.id === templateId);
  const workflowSlots = selectedTemplate
    ? selectedTemplate.steps.map((s) => s.position_label)
    : participants.map((_, i) => `Step ${i + 1}`);

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
    setBusy(false);
    if ("error" in res && res.error) return toast.error(res.error);
    toast.success("Draft saved");
    router.push(`/memos/${res.id}`);
  }

  async function handleSubmit() {
    if (!subject.trim()) return toast.error("Subject is required");
    if (!isResubmit && participants.filter(Boolean).length === 0)
      return toast.error("Add at least one workflow participant");
    setBusy(true);
    const res = await saveDraft(input(), existing?.id);
    if ("error" in res && res.error) {
      setBusy(false);
      return toast.error(res.error);
    }
    const submitRes = await submitMemo(res.id!, isResubmit ? [] : participants.filter(Boolean));
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
              <select className={selectClass} value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}>
                <option value="">Select department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
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

      {!isResubmit && (
        <Card>
          <CardHeader><CardTitle>Approval Workflow</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {templates.length > 0 && (
              <div className="space-y-2">
                <Label>Workflow template (optional)</Label>
                <select className={selectClass} value={templateId}
                  onChange={(e) => applyTemplate(e.target.value)}>
                  <option value="">Custom workflow</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              The memo passes through these participants in order. Each may
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
                {!selectedTemplate && (
                  <Button type="button" variant="ghost" size="sm"
                    onClick={() => setParticipants((p) => p.filter((_, j) => j !== i))}>
                    ✕
                  </Button>
                )}
              </div>
            ))}
            {!selectedTemplate && (
              <Button type="button" variant="outline" size="sm"
                onClick={() => setParticipants((p) => [...p, ""])}>
                + Add participant
              </Button>
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
        <Button onClick={handleSubmit} disabled={busy}>
          {busy ? "Working…" : isResubmit ? "Resubmit memo" : "Submit for approval"}
        </Button>
      </div>
    </div>
  );
}
