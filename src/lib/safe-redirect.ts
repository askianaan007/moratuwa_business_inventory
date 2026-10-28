/** Only allow same-site relative paths, to prevent open redirects via ?next=. */
export function safeNext(value: string | null | undefined, fallback = "/") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (value.startsWith("/api/") || value.startsWith("/login")) return fallback;
  return value;
}
