"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createUser, setUserStatus, setUserRole, setUserDepartment,
} from "@/app/(app)/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

type User = {
  id: string;
  full_name: string;
  email: string;
  designation: string | null;
  role: string;
  status: string;
  department_id: string | null;
};

export function UsersAdmin({
  users,
  departments,
  selfId,
}: {
  users: User[];
  departments: { id: string; name: string }[];
  selfId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    email: "", password: "", full_name: "", designation: "",
    department_id: "", role: "user" as "user" | "org_admin",
  });

  async function handleCreate() {
    if (!form.email || form.password.length < 8 || !form.full_name) {
      return toast.error("Email, name, and a password of 8+ characters are required.");
    }
    setBusy(true);
    const res = await createUser({
      ...form,
      department_id: form.department_id || null,
    });
    setBusy(false);
    if (res.error) return toast.error(res.error);
    toast.success("User created");
    setOpen(false);
    setForm({ email: "", password: "", full_name: "", designation: "", department_id: "", role: "user" });
    router.refresh();
  }

  async function toggleStatus(u: User) {
    const res = await setUserStatus(u.id, u.status === "active" ? "inactive" : "active");
    if (res.error) return toast.error(res.error);
    router.refresh();
  }

  async function toggleRole(u: User) {
    const res = await setUserRole(u.id, u.role === "org_admin" ? "user" : "org_admin");
    if (res.error) return toast.error(res.error);
    router.refresh();
  }

  async function changeDept(u: User, deptId: string) {
    const res = await setUserDepartment(u.id, deptId || null);
    if (res.error) return toast.error(res.error);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Button onClick={() => setOpen(true)}>+ Add user</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add user</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Full name</Label>
              <Input value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Initial password (8+ chars)</Label>
              <Input type="password" value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Designation</Label>
              <Input value={form.designation}
                onChange={(e) => setForm({ ...form, designation: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Department</Label>
                <select
                  className="h-9 w-full rounded-md border bg-white px-2 text-sm"
                  value={form.department_id}
                  onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
                  <option value="">None</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Role</Label>
                <select
                  className="h-9 w-full rounded-md border bg-white px-2 text-sm"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as "user" | "org_admin" })}>
                  <option value="user">User</option>
                  <option value="org_admin">Organization Admin</option>
                </select>
              </div>
            </div>
            <Button onClick={handleCreate} disabled={busy} className="w-full">
              {busy ? "Creating…" : "Create user"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader><CardTitle>Organization users</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.designation ?? "—"}</TableCell>
                    <TableCell>
                      <select
                        className="h-8 rounded-md border bg-white px-1 text-sm"
                        value={u.department_id ?? ""}
                        onChange={(e) => changeDept(u, e.target.value)}>
                        <option value="">None</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.role === "org_admin" ? "default" : "secondary"}>
                        {u.role === "org_admin" ? "Admin" : "User"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.status === "active" ? "default" : "destructive"}>
                        {u.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="space-x-1 whitespace-nowrap">
                      {u.id !== selfId && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => toggleStatus(u)}>
                            {u.status === "active" ? "Deactivate" : "Activate"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => toggleRole(u)}>
                            {u.role === "org_admin" ? "Make user" : "Make admin"}
                          </Button>
                        </>
                      )}
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
