"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { upsertDepartment, setDepartmentActive } from "@/app/(app)/admin/actions";
import { DepartmentCombobox } from "@/components/department-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

type Department = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  designation_id: string | null;
};

export function DepartmentsAdmin({
  departments,
  designations,
}: {
  departments: Department[];
  designations: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [designationId, setDesignationId] = useState("");
  const [editingId, setEditingId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const designationName = (id: string | null) =>
    designations.find((d) => d.id === id)?.name ?? "—";

  async function save() {
    if (!name.trim()) return toast.error("Name is required.");
    if (!designationId) return toast.error("Every department must be linked to a designation.");
    setBusy(true);
    const res = await upsertDepartment(
      { name, description, designation_id: designationId },
      editingId
    );
    setBusy(false);
    if (res.error) return toast.error(res.error);
    toast.success("Saved");
    setName("");
    setDescription("");
    setDesignationId("");
    setEditingId(undefined);
    router.refresh();
  }

  async function toggle(item: Department) {
    const res = await setDepartmentActive(item.id, !item.is_active);
    if (res.error) return toast.error(res.error);
    router.refresh();
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Edit Department" : "New Department"}</CardTitle>
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
          <div className="space-y-1">
            <Label>Designation *</Label>
            <DepartmentCombobox
              value={designationId}
              onChange={setDesignationId}
              options={designations}
              placeholder="e.g. Finance Manager"
            />
            <p className="text-xs text-muted-foreground">
              The position responsible for this department.{" "}
              {designations.length === 0 && (
                <>No designations yet — <Link href="/admin/designations" className="underline">create one first</Link>.</>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={save} disabled={busy}>
              {editingId ? "Update" : "Create"}
            </Button>
            {editingId && (
              <Button variant="ghost" onClick={() => {
                setEditingId(undefined); setName(""); setDescription(""); setDesignationId("");
              }}>
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader><CardTitle>Department list</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{designationName(item.designation_id)}</TableCell>
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
                        setDesignationId(item.designation_id ?? "");
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
