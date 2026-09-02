import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, isAuthenticatedRequest } from "@/lib/session";

// Proxy (renamed from "middleware" in Next.js 16) runs before every matched
// route. It only reads the session cookie here (optimistic check, no DB) —
// that's enough since our session has no per-user data, just a signed flag.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/login") {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const authed = await isAuthenticatedRequest(token);

  if (authed) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Belum login." }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    // Semua path kecuali asset statis Next.js dan favicon.
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
