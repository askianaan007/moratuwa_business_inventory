import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/safe-redirect";

const API_URL = process.env.API_URL ?? "http://localhost:4000";

/**
 * Renews an expired session during page navigation, then continues to ?next.
 * Lives under /api/v1/auth because the refresh cookie is scoped to that path.
 * (This file takes precedence over the /api/v1/* rewrite in next.config.ts.)
 */
export async function GET(request: NextRequest) {
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const loginUrl = new URL(`/login?next=${encodeURIComponent(next)}`, request.url);

  const refreshToken = request.cookies.get("ll_rt")?.value;
  if (!refreshToken) return NextResponse.redirect(loginUrl);

  const upstream = await fetch(`${API_URL}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { cookie: `ll_rt=${refreshToken}` },
    cache: "no-store",
  });

  const response = NextResponse.redirect(upstream.ok ? new URL(next, request.url) : loginUrl);
  // Pass the new (or cleared) cookies through to the browser.
  for (const cookie of upstream.headers.getSetCookie()) response.headers.append("set-cookie", cookie);
  return response;
}
