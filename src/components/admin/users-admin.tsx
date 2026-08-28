"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createUser, setUserStatus, setUserRole, setUserDepartment,
  approveJoinRequest, rejectJoinRequest, regenerateJoinCode,
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
  joinCode,
}: {
  users: User[];
  departments: { id: string; name: string }[];
  selfId: string;
  joinCode: string | null;
}) {
  const router = useRouter();
  // Pending profiles are join requests, not members — they are listed and
  // acted on separately so an admin never confuses the two.
  const pending = users.filter((u) => u.status === "pending");
  const members = users.filter((u) => u.status !== "pending");
  const [decisions, setDecisions] = useState<
    Record<string, { role: "user" | "org_admin"; department_id: string }>
  >({});

  function decisionFor(id: string) {
    return decisions[id] ?? { role: "user" as const, department_id: "" };
  }

  async function approve(u: User) {
    const d = decisionFor(u.id);
    const res = await approveJoinRequest({
      userId: u.id,
      role: d.role,
      department_id: d.department_id || null,
      designation: u.designation ?? "",
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

  // Built in the browser so the link always matches the host actually in use
  // (localhost in development, the deployed domain in production).
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const inviteLink = joinCode ? `${origin}/signup?code=${joinCode}` : "";

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast.success("Invite link copied");
    } catch {
      toast.error("Could not copy — select the link and copy it manually.");
    }
  }

  async function rotateCode() {
    const res = await regenerateJoinCode();
    if (res.error) return toast.error(res.error);
    toast.success("New join code generated. The previous code no longer works.");
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
        <CardHeader><CardTitle>Invite people</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Invite link</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                readOnly
                value={inviteLink}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 rounded-md border bg-slate-50 px-3 py-2 font-mono text-sm"
              />
              <Button size="sm" onClick={copyInvite} disabled={!joinCode}>
                Copy link
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Send this to colleagues. It opens the signup page with the code
              already filled in.
            </p>
          </div>

          <div className="space-y-2 border-t pt-4">
            <p className="text-sm font-medium">Or share the code</p>
            <div className="flex flex-wrap items-center gap-3">
              <code className="rounded-md border bg-slate-50 px-3 py-2 font-mono text-lg tracking-wider">
                {joinCode ?? "—"}
              </code>
              <Button size="sm" variant="outline" onClick={rotateCode}>
                Regenerate
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Anyone with this code or link can join as a regular user without
              approval. Share it only with people who should have access, and
              regenerate it if it spreads — regenerating invalidates both the
              old code and any link containing it, immediately.
            </p>
          </div>
        </CardContent>
      </Card>

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
                      <TableCell>{u.designation ?? "—"}</TableCell>
                      <TableCell>
                        <select
                          className="h-8 rounded-md border bg-white px-1 text-sm"
                          value={decisionFor(u.id).department_id}
                          onChange={(e) =>
                            setDecisions((prev) => ({
                              ...prev,
                              [u.id]: { ...decisionFor(u.id), department_id: e.target.value },
                            }))
                          }>
                          <option value="">None</option>
                          {departments.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell>
                        <select
                          className="h-8 rounded-md border bg-white px-1 text-sm"
                          value={decisionFor(u.id).role}
                          onChange={(e) =>
                            setDecisions((prev) => ({
                              ...prev,
                              [u.id]: {
                                ...decisionFor(u.id),
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
                {members.map((u) => (
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
