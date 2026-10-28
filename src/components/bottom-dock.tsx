"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookIcon, ClipboardIcon, FileIcon, HomeIcon, ScanIcon } from "./icons";

/** Main sections, shared with the desktop sidebar. */
export const navTabs = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/ledger", label: "Ledger", Icon: BookIcon },
  { href: "/scan", label: "Scan", Icon: ScanIcon, primary: true },
  { href: "/audit", label: "Audit", Icon: ClipboardIcon },
  { href: "/reports", label: "Reports", Icon: FileIcon },
];

/** Thumb-reachable main navigation, fixed to the bottom of the screen. Replaced by the sidebar on desktop. */
export function BottomDock() {
  return <DockLinks pathname={usePathname()} />;
}

/**
 * The links themselves. Rendered with `pathname={null}` as the prerendered
 * fallback (the current URL is only known at request time).
 */
export function DockLinks({ pathname }: { pathname: string | null }) {
  const isActive = (href: string) =>
    pathname !== null && (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <nav
      aria-label="Main"
      className="dock dock-lg z-40 lg:hidden border-t border-base-300 bg-base-100 pb-[env(safe-area-inset-bottom)]"
    >
      {navTabs.map(({ href, label, Icon, primary }) =>
        primary ? (
          <Link key={href} href={href} aria-current={isActive(href) ? "page" : undefined}>
            <span className="-mt-7 flex size-14 items-center justify-center rounded-full bg-primary text-primary-content shadow-lg ring-4 ring-base-100">
              <Icon className="size-7" />
            </span>
            <span className="dock-label font-semibold">{label}</span>
          </Link>
        ) : (
          <Link
            key={href}
            href={href}
            className={isActive(href) ? "dock-active text-base-content" : "text-base-content/60"}
            aria-current={isActive(href) ? "page" : undefined}
          >
            <Icon />
            <span className="dock-label">{label}</span>
          </Link>
        ),
      )}
    </nav>
  );
}
