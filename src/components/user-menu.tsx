"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { roleLabel } from "@/lib/format";
import type { User } from "@/lib/types";
import { BookIcon, LogoutIcon, SettingsIcon } from "./icons";

/** Account menu. `expanded` is the sidebar variant: name and role beside the avatar, opening upwards. */
export function UserMenu({ user, expanded = false }: { user: User; expanded?: boolean }) {
  const router = useRouter();
  const initials = user.name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function signOut() {
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className={expanded ? "dropdown dropdown-top w-full" : "dropdown dropdown-end"}>
      {expanded ? (
        <button type="button" className="btn btn-ghost h-auto w-full justify-start gap-3 px-2 py-2 text-left font-normal" aria-label="Account menu">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-content">
            {initials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{user.name}</span>
            <span className="block truncate text-xs text-base-content/60">{roleLabel[user.role]}</span>
          </span>
        </button>
      ) : (
        <button type="button" className="btn btn-circle btn-secondary" aria-label="Account menu">
          {initials}
        </button>
      )}
      <div className="dropdown-content z-50 my-2 w-64 rounded-box border border-base-300 bg-base-100 p-2 shadow-lg">
        <div className="px-3 py-2">
          <p className="font-semibold">{user.name}</p>
          <p className="truncate text-sm text-base-content/70">{user.email}</p>
          <p className="mt-1 text-xs text-base-content/60">
            {roleLabel[user.role]}
            {user.department && ` · ${user.department.name}`}
          </p>
        </div>
        <ul className="menu w-full p-0">
          <li>
            <Link href="/categories">
              <BookIcon className="size-5" />
              {user.role === "ADMIN" ? "Manage categories" : "Categories"}
            </Link>
          </li>
          <li>
            <Link href="/departments">
              <SettingsIcon className="size-5" />
              {user.role === "ADMIN" ? "Manage departments" : "Departments"}
            </Link>
          </li>
          <li>
            <button type="button" onClick={signOut}>
              <LogoutIcon className="size-5" />
              Sign out
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
}
