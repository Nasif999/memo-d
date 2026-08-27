"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updatePassword } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";
import { updateOwnProfile } from "@/app/(app)/profile/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ProfileForm({
  profile,
}: {
  profile: {
    full_name: string;
    email: string;
    designation: string;
    role: string;
    status: string;
    department: string;
    org: string;
  };
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState(profile.full_name);
  const [designation, setDesignation] = useState(profile.designation);
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function saveProfile() {
    setBusy(true);
    const res = await updateOwnProfile({
      full_name: fullName,
      designation,
    });
    setBusy(false);
    if (res.error) return toast.error(res.error);
    toast.success("Profile updated");
    router.refresh();
  }

  async function changePassword() {
    if (newPassword.length < 8)
      return toast.error("Password must be at least 8 characters.");
    const user = firebaseAuth().currentUser;
    if (!user) {
      return toast.error(
        "Please sign out and sign back in, then change your password."
      );
    }
    setBusy(true);
    try {
      await updatePassword(user, newPassword);
      toast.success("Password changed");
      setNewPassword("");
    } catch (e) {
      toast.error(
        e instanceof Error && e.message.includes("requires-recent-login")
          ? "Please sign out and sign back in, then change your password."
          : "Could not change password."
      );
    }
    setBusy(false);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Account</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Organization</Label>
              <Input value={profile.org} disabled />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input value={profile.email} disabled />
            </div>
            <div className="space-y-1">
              <Label>Department</Label>
              <Input value={profile.department} disabled />
            </div>
            <div className="space-y-1">
              <Label>Role</Label>
              <Input value={profile.role === "org_admin" ? "Organization Admin" : "User"} disabled />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" value={fullName}
                onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="designation">Designation</Label>
              <Input id="designation" value={designation}
                onChange={(e) => setDesignation(e.target.value)} />
            </div>
          </div>
          <Button onClick={saveProfile} disabled={busy}>Save profile</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Change password</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="newpw">New password</Label>
            <Input id="newpw" type="password" value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters" />
          </div>
          <Button onClick={changePassword} disabled={busy || !newPassword}>
            Change password
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
