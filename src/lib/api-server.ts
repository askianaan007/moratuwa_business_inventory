import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { ApiErrorBody } from "./types";

const API_URL = process.env.API_URL ?? "http://localhost:4000";

/**
 * GET from the backend during server rendering, forwarding the user's auth
 * cookies. Reading cookies makes the caller dynamic, so render it inside
 * <Suspense>.
 */
export async function apiGet<T>(path: string): Promise<T> {
  const cookieStore = await cookies();
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    headers: { cookie: cookieStore.toString(), accept: "application/json" },
    cache: "no-store",
  });

  if (res.status === 401) redirect("/login");
  if (res.status === 404) notFound();
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new Error(body?.error.message ?? `API request failed (${res.status})`);
  }
  return (await res.json()) as T;
}
