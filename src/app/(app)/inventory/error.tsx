"use client";

import { useEffect } from "react";

/** Keeps the Inventory tabs usable when one view fails to load. */
export default function InventoryError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <div role="alert" className="rounded-box border border-error/40 bg-error/5 p-6 text-center">
      <p className="font-semibold">This inventory view could not be loaded</p>
      <p className="mt-1 text-sm text-base-content/70">{error.message || "Something went wrong."}</p>
      <button type="button" className="btn btn-sm mt-4" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
