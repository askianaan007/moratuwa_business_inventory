import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic auth gate for pages. The backend is the real authority; this
 * only avoids rendering a page that would immediately fail.
 *
 * The access cookie expires with the token (15 min). When it is gone, send the
 * user through /api/v1/auth/session, which silently renews it using the
 * refresh cookie, or falls back to the login page.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has("ll_at")) return NextResponse.next();

  const next = request.nextUrl.pathname + request.nextUrl.search;
  const url = new URL("/api/v1/auth/session", request.url);
  url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

export const config = {
  // Every page except login, API calls, Next internals and static files.
  matcher: ["/((?!login|api/|_next/|manifest.webmanifest|icon|apple-icon|favicon).*)"],
};
