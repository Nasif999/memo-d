"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateOrg } from "@/app/(app)/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function OrgForm({
  org,
}: {
  org: { name: string; identifier: string; contact_email: string; contact_phone: string; logo_url: string };
}) {
  const [name, setName] = useState(org.name);
  const [email, setEmail] = useState(org.contact_email);
  const [phone, setPhone] = useState(org.contact_phone);
  const [logoUrl, setLogoUrl] = useState(org.logo_url);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function save() {
    setBusy(true);
    const res = await updateOrg({ name, contact_email: email, contact_phone: phone });
    setBusy(false);
    if (res.error) return toast.error(res.error);
    toast.success("Organization updated");
  }

  async function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/org/logo", { method: "POST", body: form });
    const json = await res.json().catch(() => ({}));
    setUploading(false);
    if (!res.ok) return toast.error(json.error ?? "Upload failed");
    setLogoUrl(json.logoUrl);
    toast.success("Logo updated");
    router.refresh();
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
        <Label>Logo</Label>
        <div className="flex items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-20 w-20 rounded-full object-cover" />
          ) : (
            <div className="h-20 w-20 rounded-full border border-dashed border-border" />
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
            className="hidden"
            onChange={handleFileChosen}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? "Uploading…" : "Add attachment"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">PNG, JPEG, GIF, WebP, or SVG — up to 500 KB.</p>
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
