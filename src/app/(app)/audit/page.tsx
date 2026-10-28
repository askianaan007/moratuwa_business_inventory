import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Audit" };

export default function AuditPage() {
  return (
    <ComingSoon
      title="Audit"
      phase="Phase 2"
      features={[
        "Start an audit session for one or more labs",
        "See the items expected at each location",
        "Scan QR tags to tick items off — works offline",
        "Flag missing, misplaced, damaged and unregistered items",
        "Board of Survey report when the session is closed",
      ]}
    />
  );
}
