"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CameraView } from "@/components/camera/camera-view";
import { ALL_FORMATS, beep, loadDetector } from "@/components/camera/detector";
import { hasCamera, useCamera } from "@/components/camera/use-camera";
import { ScanIcon } from "@/components/icons";
import { Sheet } from "@/components/sheet";
import { destinationFor } from "./scan-form";

/** QR codes may hold a plain tag code or a link that ends with one (…/items/UOM-ELEC-2026-00001). */
export function codeFromQr(raw: string) {
  let value = raw.trim();
  try {
    const url = new URL(value);
    const last = url.searchParams.get("tag") ?? url.pathname.split("/").filter(Boolean).at(-1);
    if (last) value = decodeURIComponent(last);
  } catch {
    // Not a link: the QR holds the code itself.
  }
  return value.toUpperCase();
}

const noopSubscribe = () => () => {};

/** "Scan QR code" button and the camera sheet it opens. A scanned tag opens its item. */
export function QrScanButton() {
  const [open, setOpen] = useState(false);
  const supported = useSyncExternalStore(noopSubscribe, hasCamera, () => true);

  return (
    <>
      <button type="button" className="btn btn-secondary btn-lg w-full" onClick={() => setOpen(true)} disabled={!supported}>
        <ScanIcon className="size-6" />
        Scan QR code
      </button>
      {!supported && <p className="text-sm text-base-content/60">The camera needs a secure (https) connection. Type the code below instead.</p>}
      <Sheet open={open} onClose={() => setOpen(false)} title="Scan QR code" subtitle="Point the camera at the asset tag">
        <QrScanner onDone={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

function QrScanner({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const cam = useCamera();
  const [found, setFound] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const finished = useRef(false);
  const { ready, frame } = cam;

  useEffect(() => {
    if (!ready) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const hint = setTimeout(() => setSlow(true), 5000);
    (async () => {
      const detector = await loadDetector(ALL_FORMATS);
      const tick = async () => {
        if (stopped || finished.current) return;
        // Detect on what is visible, so digital zoom also enlarges small or distant codes.
        const image = frame();
        const codes = image ? await detector.detect(image).catch(() => []) : [];
        const raw = codes[0]?.rawValue;
        if (raw?.trim()) {
          finished.current = true;
          const code = codeFromQr(raw);
          beep(true);
          setFound(code);
          router.push(destinationFor(code));
          setTimeout(onDone, 400);
        } else timer = setTimeout(tick, 150);
      };
      void tick();
    })().catch(() => undefined);
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearTimeout(hint);
    };
  }, [ready, frame, router, onDone]);

  return (
    <div className="flex flex-col gap-3">
      <CameraView
        cam={cam}
        aspect="aspect-square sm:aspect-[4/3]"
        overlay={
          <div
            className={`pointer-events-none absolute top-1/2 left-1/2 aspect-square w-[62%] max-w-72 -translate-1/2 rounded-2xl border-4 transition-colors ${
              found ? "border-success" : "border-primary"
            } shadow-[0_0_0_100vmax_rgba(0,0,0,0.4)]`}
            aria-hidden
          />
        }
      />
      {found ? (
        <p className="flex items-center gap-2 font-semibold text-success" role="status">
          <span className="loading loading-spinner loading-sm" /> Found <span className="font-mono">{found}</span> — opening…
        </p>
      ) : (
        <p className="text-sm text-base-content/70">
          Fit the QR code inside the square. It scans automatically.
          {slow && " Too small or blurry? Hold the phone a little further away and zoom in (pinch or the slider), or tap the picture to focus."}
        </p>
      )}
    </div>
  );
}
