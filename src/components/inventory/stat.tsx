import Link from "next/link";

/** Number tile. With `href` it links to the filtered list. */
export function Stat({ label, value, hint, href, tone = "" }: { label: string; value: number | string; hint?: string; href?: string; tone?: string }) {
  const body = (
    <>
      <p className="text-sm text-base-content/60">{label}</p>
      <p className={`text-2xl font-bold tabular-nums lg:text-3xl ${tone}`}>{value}</p>
      {hint && <p className="text-xs text-base-content/50">{hint}</p>}
    </>
  );
  const cls = "flex flex-col rounded-box border border-base-300 bg-base-100 p-4";
  return href ? (
    <Link href={href} className={`${cls} transition-colors hover:bg-base-200/50 active:bg-base-200`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Horizontal share bar for a breakdown list. */
export function ShareBar({ value, max, tone = "bg-primary" }: { value: number; max: number; tone?: string }) {
  const pct = max ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-base-200" aria-hidden>
      <div className={`h-full rounded-full ${tone} transition-[width] duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}
