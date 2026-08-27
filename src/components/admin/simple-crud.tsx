"use client";

// Shared CRUD list UI for departments and categories.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

type Item = { id: string; name: string; description: string | null; is_active: boolean };

export function SimpleCrud({
  title,
  items,
  onSave,
  onToggle,
}: {
  title: string;
  items: Item[];
  onSave: (input: { name: string; description: string }, id?: string) => Promise<{ error?: string }>;
  onToggle: (id: string, active: boolean) => Promise<{ error?: string }>;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name.trim()) return toast.error("Name is required.");
    setBusy(true);
    const res = await onSave({ name, description }, editingId);
    setBusy(false);
    if (res.error) return toast.error(res.error);
    toast.success("Saved");
    setName("");
    setDescription("");
    setEditingId(undefined);
    router.refresh();
  }

  async function toggle(item: Item) {
    const res = await onToggle(item.id, !item.is_active);
    if (res.error) return toast.error(res.error);
    router.refresh();
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>{editingId ? `Edit ${title}` : `New ${title}`}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button onClick={save} disabled={busy}>
              {editingId ? "Update" : "Create"}
            </Button>
            {editingId && (
              <Button variant="ghost" onClick={() => {
                setEditingId(undefined); setName(""); setDescription("");
              }}>
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader><CardTitle>{title} list</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.description ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={item.is_active ? "default" : "secondary"}>
                      {item.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="space-x-1 whitespace-nowrap">
                    <Button size="sm" variant="outline" onClick={() => {
                      setEditingId(item.id);
                      setName(item.name);
                      setDescription(item.description ?? "");
                    }}>
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => toggle(item)}>
                      {item.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
