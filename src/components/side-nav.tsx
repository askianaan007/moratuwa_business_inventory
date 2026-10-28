"use client";

import Form from "next/form";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { navTabs } from "./bottom-dock";
import { GridIcon, PlusIcon, SearchIcon } from "./icons";

type NavTab = { href: string; label: string; Icon: (p: { className?: string }) => React.ReactNode };

const groups: { label: string; tabs: readonly NavTab[] }[] = [
  { label: "Workspace", tabs: navTabs },
  { label: "Manage", tabs: [{ href: "/categories", label: "Categories", Icon: GridIcon }] },
];

/** Desktop sidebar navigation. The bottom dock takes its place on phones and tablets. */
export function SideNav() {
  return <SideNavLinks pathname={usePathname()} />;
}

/** Rendered with `pathname={null}` as the prerendered fallback, like DockLinks. */
export function SideNavLinks({ pathname }: { pathname: string | null }) {
  const isActive = (href: string) =>
    pathname !== null && (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <nav aria-label="Main" className="flex flex-col gap-4">
      <Link href="/ledger/new" className="btn btn-primary w-full justify-start">
        <PlusIcon className="size-5" />
        New entry
        <kbd className="kbd kbd-sm ml-auto border-primary-content/20 bg-primary-content/10">N</kbd>
      </Link>

      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-1 px-3 text-xs font-semibold tracking-wide text-base-content/50 uppercase">{group.label}</p>
          <ul className="menu w-full gap-0.5 p-0">
            {group.tabs.map(({ href, label, Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={isActive(href) ? "page" : undefined}
                  className={`gap-3 py-2.5 font-medium ${isActive(href) ? "menu-active" : ""}`}
                >
                  <Icon className="size-5" />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Ledger search that lives in the sidebar. Press "/" anywhere to focus it, "N" for a new entry. */
export function SideSearch() {
  const input = useRef<HTMLInputElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (document.querySelector("dialog[open]")) return;
      if (e.key === "/") {
        e.preventDefault();
        input.current?.focus();
      } else if ((e.key === "n" || e.key === "N") && pathname !== "/ledger/new") {
        e.preventDefault();
        document.querySelector<HTMLAnchorElement>('a[href="/ledger/new"]')?.click();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pathname]);

  return (
    <Form action="/ledger" role="search">
      <label className="input input-sm w-full">
        <SearchIcon className="size-4 opacity-50" />
        <input ref={input} type="search" name="q" placeholder="Search ledger" className="grow" aria-label="Search ledger" />
        <kbd className="kbd kbd-xs">/</kbd>
      </label>
    </Form>
  );
}
