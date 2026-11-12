import { Suspense } from "react";
import { InventoryTabs } from "./inventory-tabs";

export default function InventoryLayout({ children }: LayoutProps<"/inventory">) {
  return (
    <>
      <Suspense fallback={<div className="skeleton mb-4 h-10 w-full" />}>
        <InventoryTabs />
      </Suspense>
      {children}
    </>
  );
}
