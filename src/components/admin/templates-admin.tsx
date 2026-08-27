"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createTemplate, setTemplateActive } from "@/app/(app)/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Template = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  steps: string[];
};

export function TemplatesAdmin({ templates }: { templates: Template[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState<string[]>(["", ""]);
  const [busy, setBusy] = useState(false);

  async function save() {
    const cleanSteps = steps.map((s) => s.trim()).filter(Boolean);
    if (!name.trim() || cleanSteps.length === 0) {
      return toast.error("Name and at least one step required.");
    }
    setBusy(true);
    const res = await createTemplate({ name, description, steps: cleanSteps });
    setBusy(false);
    if (res.error) return toast.error(res.error);
    toast.success("Template created");
    setName(""); setDescription(""); setSteps(["", ""]);
    router.refresh();
  }

  async function toggle(t: Template) {
    const res = await setTemplateActive(t.id, !t.is_active);
    if (res.error) return toast.error(res.error);
    router.refresh();
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card>
        <CardHeader><CardTitle>New template</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Purchase Request" />
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Steps (in order)</Label>
            {steps.map((s, i) => (
              <div key={i} className="flex gap-2">
                <Input value={s}
                  placeholder={`Step ${i + 1} position, e.g. Dept Head`}
                  onChange={(e) => {
                    const next = [...steps];
                    next[i] = e.target.value;
                    setSteps(next);
                  }} />
                <Button variant="ghost" size="sm"
                  onClick={() => setSteps(steps.filter((_, j) => j !== i))}>
                  ✕
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setSteps([...steps, ""])}>
              + Add step
            </Button>
          </div>
          <Button onClick={save} disabled={busy} className="w-full">Create template</Button>
        </CardContent>
      </Card>

      <div className="space-y-4 md:col-span-2">
        {templates.map((t) => (
          <Card key={t.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                {t.name}{" "}
                <Badge variant={t.is_active ? "default" : "secondary"} className="ml-2">
                  {t.is_active ? "Active" : "Inactive"}
                </Badge>
              </CardTitle>
              <Button size="sm" variant="ghost" onClick={() => toggle(t)}>
                {t.is_active ? "Deactivate" : "Activate"}
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{t.steps.join(" → ")}</p>
              {t.description && (
                <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
              )}
            </CardContent>
          </Card>
        ))}
        {templates.length === 0 && (
          <p className="text-sm text-muted-foreground">No templates yet.</p>
        )}
      </div>
    </div>
  );
}
