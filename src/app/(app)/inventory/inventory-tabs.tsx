"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/inventory", label: "Overview" },
  { href: "/inventory/assets", label: "Assets" },
  { href: "/inventory/rooms", label: "Rooms" },
  { href: "/inventory/transfers", label: "Transfers" },
  { href: "/inventory/findings", label: "Findings" },
];

/** Sub-tabs of Inventory. Hidden on a single asset or room, which have a back button. */
export function InventoryTabs() {
  const pathname = usePathname();
  if (!TABS.some((t) => t.href === pathname)) return null;
  return (
    <div className="-mx-4 mb-4 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:px-0">
      <div role="tablist" className="tabs tabs-box w-max min-w-full sm:min-w-0">
        {TABS.map((t) => (
          <Link
            key={t.href}
            role="tab"
            href={t.href}
            aria-selected={pathname === t.href}
            className={`tab flex-1 whitespace-nowrap sm:flex-none sm:px-5 ${pathname === t.href ? "tab-active" : ""}`}
          >
            {t.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
