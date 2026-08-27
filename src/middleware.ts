import { NextResponse, type NextRequest } from "next/server";

// UX-only redirect based on session cookie presence. Real verification happens
// server-side in requireProfile() (firebase-admin cannot run at the edge).
export function middleware(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get("session")?.value);
  const isAuthPage =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/reset-password");

  if (!hasSession && !isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (hasSession && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
