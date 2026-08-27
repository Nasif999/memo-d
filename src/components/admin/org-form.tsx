"use client";

import { useState } from "react";
import { toast } from "sonner";
import { updateOrg } from "@/app/(app)/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function OrgForm({
  org,
}: {
  org: { name: string; identifier: string; contact_email: string; contact_phone: string };
}) {
  const [name, setName] = useState(org.name);
  const [email, setEmail] = useState(org.contact_email);
  const [phone, setPhone] = useState(org.contact_phone);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const res = await updateOrg({ name, contact_email: email, contact_phone: phone });
    setBusy(false);
    if (res.error) return toast.error(res.error);
    toast.success("Organization updated");
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Identifier</Label>
        <Input value={org.identifier} disabled />
      </div>
      <div className="space-y-1">
        <Label htmlFor="org-name">Name</Label>
        <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="org-email">Contact email</Label>
        <Input id="org-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="org-phone">Contact phone</Label>
        <Input id="org-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <Button onClick={save} disabled={busy}>Save</Button>
    </div>
  );
}
