import { Suspense } from "react";
import { AuditTabs } from "./audit-tabs";

export default function AuditLayout({ children }: LayoutProps<"/audit">) {
  return (
    <>
      <Suspense fallback={<div className="skeleton mb-4 h-10 w-full" />}>
        <AuditTabs />
      </Suspense>
      {children}
    </>
  );
}
