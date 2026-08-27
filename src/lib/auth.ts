import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth } from "@/lib/firebase/admin";
import { getProfile, type Profile } from "@/lib/data";

export type { Profile };

export async function getSessionProfile(): Promise<Profile | null> {
  const cookie = cookies().get("session")?.value;
  if (!cookie) return null;
  try {
    const decoded = await adminAuth().verifySessionCookie(cookie, true);
    const profile = await getProfile(decoded.uid);
    if (!profile || profile.status !== "active") return null;
    return profile;
  } catch {
    return null;
  }
}

// Every page/action calls one of these — the verified session cookie plus the
// org checks in the data layer are the security boundary.
export async function requireProfile(): Promise<Profile> {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== "org_admin") redirect("/dashboard");
  return profile;
}
