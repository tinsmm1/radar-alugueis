import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/auth/crypto";

/**
 * Optimistic route protection: visitors without a session cookie go to /login. The cookie's
 * signature is verified on the server by requireAuth(), by API routes and by every action.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (!request.cookies.get(SESSION_COOKIE)?.value && pathname !== "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Everything except API routes (own auth), Next internals and static files.
  matcher: ["/((?!api/|_next/|favicon.ico|icon.svg|manifest.webmanifest|robots.txt).*)"],
};
