import Link from "next/link";
import { ChevronLeftIcon } from "./icons";

export function PageHeader({
  title,
  subtitle,
  backHref,
  action,
}: {
  title: string;
  subtitle?: React.ReactNode;
  backHref?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center gap-2">
      {backHref && (
        <Link href={backHref} className="btn btn-ghost btn-circle -ml-2" aria-label="Back">
          <ChevronLeftIcon />
        </Link>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-base-content/70">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`badge badge-sm whitespace-nowrap ${className}`}>{children}</span>;
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton h-20 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-box border border-dashed border-base-300 bg-base-100 p-8 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-2 text-sm text-base-content/70">{children}</div>}
    </div>
  );
}

/** Label/value row for detail pages. */
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-base-200 py-2 last:border-0">
      <dt className="text-sm text-base-content/60">{label}</dt>
      <dd className="text-right font-medium break-words">{children ?? "—"}</dd>
    </div>
  );
}
