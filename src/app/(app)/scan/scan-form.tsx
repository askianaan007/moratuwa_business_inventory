"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { SearchIcon } from "@/components/icons";

const TAG_PATTERN = /^[A-Z0-9]+-[A-Z0-9]+-\d{4}-\d+$/;

export function ScanForm() {
  const router = useRouter();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") ?? "")
      .trim()
      .toUpperCase();
    if (!code) return;
    // Tag codes open the item directly; anything else is searched in the ledger (serial no etc.).
    router.push(TAG_PATTERN.test(code) ? `/items/${encodeURIComponent(code)}` : `/ledger?q=${encodeURIComponent(code)}`);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <input
        name="code"
        autoFocus
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        placeholder="UOM-DEMO-2026-00001"
        className="input input-lg w-full font-mono"
        aria-label="Tag code or serial number"
      />
      <button className="btn btn-primary btn-lg">
        <SearchIcon className="size-5" />
        Find
      </button>
    </form>
  );
}
