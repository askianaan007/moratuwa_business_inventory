"use client";

import type { BarcodeFormat } from "barcode-detector/ponyfill";

export interface Detector {
  detect(source: ImageBitmapSource): Promise<{ rawValue: string }[]>;
}

/** Linear barcodes and 2-D codes found on equipment labels and asset tags. */
export const ALL_FORMATS = ["qr_code", "code_128", "code_39", "code_93", "codabar", "ean_13", "ean_8", "upc_a", "upc_e", "itf", "data_matrix", "pdf417"] as const;

const cache = new Map<string, Promise<Detector>>();

/** The browser's own barcode reader where it has one, otherwise a WebAssembly one (iPhone, Firefox). */
export function loadDetector(formats: readonly string[] = ALL_FORMATS): Promise<Detector> {
  const key = formats.join(",");
  let promise = cache.get(key);
  if (!promise) {
    promise = (async () => {
      const Native = (window as unknown as { BarcodeDetector?: new (o: { formats: readonly string[] }) => Detector }).BarcodeDetector;
      if (Native) return new Native({ formats });
      const { BarcodeDetector } = await import("barcode-detector/ponyfill");
      return new BarcodeDetector({ formats: [...formats] as BarcodeFormat[] });
    })();
    promise.catch(() => cache.delete(key));
    cache.set(key, promise);
  }
  return promise;
}

/** Short confirmation tones (and a buzz on phones), so the user can keep their eyes on the equipment. */
export function beep(ok: boolean) {
  try {
    navigator.vibrate?.(ok ? 60 : [80, 60, 80]);
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = ok ? "sine" : "square";
    osc.frequency.value = ok ? 880 : 220;
    gain.gain.value = 0.06;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (ok ? 0.08 : 0.3));
    osc.onended = () => void ctx.close();
  } catch {
    // No audio available: the on-screen message is enough.
  }
}
