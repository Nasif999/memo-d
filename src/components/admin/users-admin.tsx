"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createUser, setUserStatus, setUserRole, setUserDepartment, setUserDesignation,
  approveJoinRequest, rejectJoinRequest, transferOwnership, removeUser,
  upsertDepartment,
} from "@/app/(app)/admin/actions";
import { DesignationCombobox } from "@/components/designation-combobox";
import { DepartmentCombobox } from "@/components/department-combobox";
import { PasswordInput } from "@/components/ui/password-input";
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
  ownerId,
  designationOptions,
}: {
  users: User[];
  departments: { id: string; name: string }[];
  selfId: string;
  ownerId: string | null;
  designationOptions: string[];
}) {
  const router = useRouter();
  const [deptOptions, setDeptOptions] = useState(departments);

  async function createDepartment(name: string) {
    const res = await upsertDepartment({ name, description: "" });
    if (res.error || !res.id) {
      toast.error(res.error ?? "Could not create department.");
      return null;
    }
    const created = { id: res.id, name };
    setDeptOptions((prev) => [...prev, created]);
    toast.success(`Department "${name}" created`);
    router.refresh();
    return created;
  }

  const isOwnerViewer = selfId !== null && selfId === ownerId;
  // Pending profiles are join requests, not members — they are listed and
  // acted on separately so an admin never confuses the two.
  const pending = users.filter((u) => u.status === "pending");
  const members = users.filter((u) => u.status !== "pending");
  const [decisions, setDecisions] = useState<
    Record<string, { role: "user" | "org_admin"; department_id: string; designation: string }>
  >({});

  function decisionFor(u: User) {
    return (
      decisions[u.id] ?? {
        role: "user" as const,
        department_id: "",
        designation: u.designation ?? "",
      }
    );
  }

  // Only the owner may hand another admin's account — a non-owner admin can
  // still see it, just not touch it.
  function mayModify(u: User) {
    return u.role !== "org_admin" || u.id === selfId || isOwnerViewer;
  }

  async function approve(u: User) {
    const d = decisionFor(u);
    const res = await approveJoinRequest({
      userId: u.id,
      role: d.role,
      department_id: d.department_id || null,
      designation: d.designation,
    });
    if (res.error) return toast.error(res.error);
    toast.success(`${u.full_name} approved`);
    router.refresh();
  }

  async function reject(u: User) {
    const res = await rejectJoinRequest(u.id);
    if (res.error) return toast.error(res.error);
    toast.success("Request rejected");
    router.refresh();
  }

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

  async function changeDesignation(u: User, designation: string) {
    const res = await setUserDesignation(u.id, designation);
    if (res.error) return toast.error(res.error);
    router.refresh();
  }

  async function remove(u: User) {
    if (!window.confirm(`Remove ${u.full_name} from this organization? This cannot be undone.`)) {
      return;
    }
    const res = await removeUser(u.id);
    if (res.error) return toast.error(res.error);
    toast.success(`${u.full_name} removed`);
    router.refresh();
  }

  const [transferTo, setTransferTo] = useState("");
  const [transferring, setTransferring] = useState(false);

  async function doTransfer() {
    if (!transferTo) return;
    setTransferring(true);
    const res = await transferOwnership(transferTo);
    setTransferring(false);
    if (res.error) return toast.error(res.error);
    toast.success("Ownership transferred");
    setTransferTo("");
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
              <PasswordInput value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Designation</Label>
              <DesignationCombobox
                value={form.designation}
                onChange={(v) => setForm({ ...form, designation: v })}
                options={designationOptions}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Department</Label>
                <DepartmentCombobox
                  className="h-9"
                  value={form.department_id}
                  onChange={(v) => setForm({ ...form, department_id: v })}
                  options={deptOptions}
                  onCreate={createDepartment}
                />
              </div>
              <div className="space-y-1">
                <Label>Role</Label>
                <select
                  className="h-9 w-full rounded-md border bg-card px-2 text-sm"
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

      {pending.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Join requests ({pending.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-muted-foreground">
              These people asked to join. They have no access to any memo until
              approved. Set their role and department before approving.
            </p>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Decision</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.full_name}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        <DesignationCombobox
                          id={`pending-designation-${u.id}`}
                          className="h-8 rounded-md border bg-card px-1 text-sm"
                          value={decisionFor(u).designation}
                          onChange={(v) =>
                            setDecisions((prev) => ({
                              ...prev,
                              [u.id]: { ...decisionFor(u), designation: v },
                            }))
                          }
                          options={designationOptions}
                        />
                      </TableCell>
                      <TableCell>
                        <DepartmentCombobox
                          id={`pending-department-${u.id}`}
                          className="h-8 rounded-md border bg-card px-1 text-sm"
                          value={decisionFor(u).department_id}
                          onChange={(v) =>
                            setDecisions((prev) => ({
                              ...prev,
                              [u.id]: { ...decisionFor(u), department_id: v },
                            }))
                          }
                          options={deptOptions}
                          onCreate={createDepartment}
                        />
                      </TableCell>
                      <TableCell>
                        <select
                          className="h-8 rounded-md border bg-card px-1 text-sm"
                          value={decisionFor(u).role}
                          onChange={(e) =>
                            setDecisions((prev) => ({
                              ...prev,
                              [u.id]: {
                                ...decisionFor(u),
                                role: e.target.value as "user" | "org_admin",
                              },
                            }))
                          }>
                          <option value="user">User</option>
                          <option value="org_admin">Admin</option>
                        </select>
                      </TableCell>
                      <TableCell className="space-x-1 whitespace-nowrap">
                        <Button size="sm" onClick={() => approve(u)}>Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => reject(u)}>
                          Reject
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

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
                {members.map((u) => {
                  const editable = mayModify(u);
                  return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {u.full_name}
                      {u.id === ownerId && (
                        <Badge className="ml-1.5" variant="default">Owner</Badge>
                      )}
                    </TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <DesignationCombobox
                        id={`member-designation-${u.id}`}
                        className="h-8 py-1"
                        disabled={!editable}
                        value={u.designation ?? ""}
                        onChange={(v) => changeDesignation(u, v)}
                        options={designationOptions}
                      />
                    </TableCell>
                    <TableCell>
                      <DepartmentCombobox
                        id={`member-department-${u.id}`}
                        className="h-8 py-1"
                        disabled={!editable}
                        value={u.department_id ?? ""}
                        onChange={(v) => changeDept(u, v)}
                        options={deptOptions}
                        onCreate={createDepartment}
                      />
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
                      {u.id !== selfId && editable && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => toggleStatus(u)}>
                            {u.status === "active" ? "Deactivate" : "Activate"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => toggleRole(u)}>
                            {u.role === "org_admin" ? "Make user" : "Make admin"}
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => remove(u)}>
                            Remove
                          </Button>
                        </>
                      )}
                      {u.id !== selfId && !editable && (
                        <span className="text-xs text-muted-foreground">
                          Only the owner can change admins
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {isOwnerViewer && (
        <Card>
          <CardHeader><CardTitle>Transfer ownership</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              You are the Owner — the only member who can edit another admin&apos;s
              account. Handing this to someone else moves that power to them;
              you remain an admin, just no longer the Owner.
            </p>
            <div className="flex items-center gap-2">
              <select
                className="h-9 flex-1 rounded-md border bg-card px-2 text-sm"
                value={transferTo}
                onChange={(e) => setTransferTo(e.target.value)}>
                <option value="">Select a member…</option>
                {members
                  .filter((u) => u.id !== selfId && u.status === "active")
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name}{u.role === "org_admin" ? " (admin)" : ""}
                    </option>
                  ))}
              </select>
              <Button
                variant="outline"
                disabled={!transferTo || transferring}
                onClick={doTransfer}
              >
                {transferring ? "Transferring…" : "Transfer"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
