import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, db } from "@/lib/firebase/admin";
import { logAudit } from "@/lib/data";

const SESSION_COOKIE = "session";
const EXPIRES_IN_MS = 5 * 24 * 60 * 60 * 1000; // 5 days

// Exchanges a Firebase ID token (from client-side sign-in) for an httpOnly
// session cookie. Every server request verifies this cookie via the Admin SDK.
export async function POST(request: Request) {
  const { idToken } = await request.json().catch(() => ({}));
  if (typeof idToken !== "string") {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }
  let decoded;
  try {
    decoded = await adminAuth().verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // Deactivated users cannot establish a session.
  const profileSnap = await db().collection("profiles").doc(decoded.uid).get();
  const profile = profileSnap.data();
  if (!profile || profile.status !== "active") {
    return NextResponse.json({ error: "Account inactive" }, { status: 403 });
  }

  const sessionCookie = await adminAuth().createSessionCookie(idToken, {
    expiresIn: EXPIRES_IN_MS,
  });
  cookies().set(SESSION_COOKIE, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: EXPIRES_IN_MS / 1000,
    path: "/",
  });

  await logAudit(profile.orgId, decoded.uid, "user_login", "user", decoded.uid, null);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const store = cookies();
  const cookie = store.get(SESSION_COOKIE)?.value;
  if (cookie) {
    try {
      const decoded = await adminAuth().verifySessionCookie(cookie);
      const profileSnap = await db().collection("profiles").doc(decoded.uid).get();
      const orgId = profileSnap.data()?.orgId;
      if (orgId) {
        await logAudit(orgId, decoded.uid, "user_logout", "user", decoded.uid, null);
      }
    } catch {
      // expired/invalid cookie — just clear it
    }
  }
  store.delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
