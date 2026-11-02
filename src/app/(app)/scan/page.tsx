import type { Metadata } from "next";
import Link from "next/link";
import { BarcodeIcon, ChevronRightIcon } from "@/components/icons";
import { PageHeader } from "@/components/ui";
import { QrScanButton } from "./qr-scanner";
import { ScanForm } from "./scan-form";

export const metadata: Metadata = { title: "Scan" };

export default function ScanPage() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <PageHeader title="Find an item" subtitle="Scan the QR label, or type the tag code or a serial number" />
      <div className="flex flex-col gap-3">
        <QrScanButton />
        <div className="divider my-0 text-xs text-base-content/50">or type it</div>
        <ScanForm />
      </div>
      <Link
        href="/serials"
        className="mt-4 flex items-center gap-3 rounded-box border border-base-300 bg-base-100 p-4 hover:bg-base-200/50 active:bg-base-200"
      >
        <BarcodeIcon className="size-7 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Serial capture</span>
          <span className="block text-sm text-base-content/60">Scan product and serial numbers with a barcode reader and download a PDF list</span>
        </span>
        <ChevronRightIcon className="size-5 opacity-50" />
      </Link>
    </div>
  );
}
