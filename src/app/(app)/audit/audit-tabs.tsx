"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/audit", label: "This month" },
  { href: "/audit/rooms", label: "Rooms" },
  { href: "/audit/stock", label: "Stock check" },
];

/** Top tabs of the Audit hub. Hidden inside a room or an audit, which have their own back button. */
export function AuditTabs() {
  const pathname = usePathname();
  if (!TABS.some((t) => t.href === pathname)) return null;
  return (
    <div role="tablist" className="tabs tabs-box mb-4 w-full">
      {TABS.map((t) => (
        <Link key={t.href} role="tab" href={t.href} aria-selected={pathname === t.href} className={`tab flex-1 ${pathname === t.href ? "tab-active" : ""}`}>
          {t.label}
        </Link>
      ))}
    </div>
  );
}
