"use client";

import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { roleLabel } from "@/lib/format";
import type { User } from "@/lib/types";
import { LogoutIcon } from "./icons";

export function UserMenu({ user }: { user: User }) {
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
    <div className="dropdown dropdown-end">
      <button type="button" className="btn btn-circle btn-secondary" aria-label="Account menu">
        {initials}
      </button>
      <div className="dropdown-content z-50 mt-2 w-64 rounded-box border border-base-300 bg-base-100 p-2 shadow-lg">
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
