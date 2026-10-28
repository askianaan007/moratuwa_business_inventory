"use client";

import type { ApiErrorBody } from "./types";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: Record<string, string>;

  constructor(status: number, body: ApiErrorBody | null) {
    super(body?.error.message ?? "Something went wrong. Please try again.");
    this.status = status;
    this.code = body?.error.code ?? "UNKNOWN";
    this.fieldErrors = Object.fromEntries((body?.error.details ?? []).map((d) => [d.path, d.message]));
  }
}

interface Options {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
}

function send(path: string, { method = "GET", body }: Options) {
  return fetch(`/api/v1${path}`, {
    method,
    credentials: "same-origin",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/**
 * Calls the backend from the browser (same origin, proxied by Next).
 * An expired access token is refreshed once automatically.
 */
export async function api<T = unknown>(path: string, options: Options = {}): Promise<T> {
  let res = await send(path, options);

  if (res.status === 401 && !path.startsWith("/auth/")) {
    const refreshed = await fetch("/api/v1/auth/refresh", { method: "POST", credentials: "same-origin" });
    if (!refreshed.ok) {
      // Full reload on purpose: drops all client state from the expired session.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      throw new ApiError(401, null);
    }
    res = await send(path, options);
  }

  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, json as ApiErrorBody | null);
  return json as T;
}
