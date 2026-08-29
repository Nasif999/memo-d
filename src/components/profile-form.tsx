"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";
import { updateOwnProfile, updateOwnPhoto } from "@/app/(app)/profile/actions";
import { DesignationCombobox } from "@/components/designation-combobox";
import { ImagePicker } from "@/components/image-picker";
import { mainInitial } from "@/lib/name";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ProfileForm({
  profile,
  designationOptions,
}: {
  profile: {
    full_name: string;
    email: string;
    designation: string;
    role: string;
    status: string;
    department: string;
    org: string;
    photo_url: string | null;
  };
  designationOptions: string[];
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState(profile.full_name);
  const [designation, setDesignation] = useState(profile.designation);
  const [photoUrl, setPhotoUrl] = useState(profile.photo_url);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);

  async function changePassword() {
    if (newPassword.length < 8) {
      return toast.error("New password must be at least 8 characters.");
    }
    if (newPassword !== confirmPassword) {
      return toast.error("New passwords don't match.");
    }
    const user = firebaseAuth().currentUser;
    if (!user?.email) return toast.error("Not signed in.");
    setPasswordBusy(true);
    try {
      await reauthenticateWithCredential(
        user,
        EmailAuthProvider.credential(user.email, currentPassword)
      );
      await updatePassword(user, newPassword);
      toast.success("Password changed");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      toast.error("Current password is incorrect.");
    } finally {
      setPasswordBusy(false);
    }
  }

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

  async function savePhoto(dataUrl: string | null) {
    setPhotoBusy(true);
    const res = await updateOwnPhoto(dataUrl);
    setPhotoBusy(false);
    if (res.error) return toast.error(res.error);
    setPhotoUrl(dataUrl);
    toast.success(dataUrl ? "Photo updated" : "Photo removed");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Account</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Profile photo</Label>
            <ImagePicker
              value={photoUrl}
              onChange={savePhoto}
              fallback={mainInitial(fullName || "?")}
              size={64}
            />
            {photoBusy && <p className="text-xs text-muted-foreground">Saving…</p>}
          </div>
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
              <DesignationCombobox
                id="designation"
                className="h-8 rounded-lg"
                value={designation}
                onChange={setDesignation}
                options={designationOptions}
              />
            </div>
          </div>
          <Button onClick={saveProfile} disabled={busy}>Save profile</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Change password</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="current-password">Current password</Label>
              <PasswordInput
                id="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-password">New password</Label>
              <PasswordInput
                id="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <PasswordInput
                id="confirm-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={changePassword} disabled={passwordBusy}>
            {passwordBusy ? "Changing…" : "Change password"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
