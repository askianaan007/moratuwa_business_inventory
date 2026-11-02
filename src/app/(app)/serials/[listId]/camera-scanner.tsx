"use client";

import { useEffect, useRef, useState } from "react";
import type Tesseract from "tesseract.js";

interface Detector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}

const FORMATS = ["code_128", "code_39", "code_93", "codabar", "ean_13", "ean_8", "upc_a", "upc_e", "itf", "qr_code", "data_matrix", "pdf417"] as const;

/** The camera works on any phone; barcodes use the browser's reader or a WebAssembly fallback (iPhone). */
export function hasCamera() {
  return Boolean(navigator.mediaDevices?.getUserMedia);
}

async function loadDetector(): Promise<Detector> {
  const Native = (window as unknown as { BarcodeDetector?: new (o: { formats: readonly string[] }) => Detector }).BarcodeDetector;
  if (Native) return new Native({ formats: FORMATS });
  const { BarcodeDetector } = await import("barcode-detector/ponyfill");
  return new BarcodeDetector({ formats: [...FORMATS] });
}

/**
 * Likely serial numbers in OCR text, best first: text after an "S/N" or
 * "Serial No" label, then codes mixing letters and digits, longest first.
 */
export function serialCandidates(text: string): string[] {
  const labelled: string[] = [];
  const others: string[] = [];
  const clean = (t: string) => t.toUpperCase().replace(/^[^A-Z0-9]+|[^A-Z0-9]+$/g, "");
  const ok = (v: string) => v.length >= 4 && v.length <= 40 && /\d/.test(v);

  for (const m of text.matchAll(/(?:S\s*\/?\s*N|SERIAL(?:\s*(?:NO|NUMBER|#))?)\s*[:.#-]?\s*([A-Z0-9][A-Z0-9/-]{3,})/gi)) {
    const v = clean(m[1]!);
    if (ok(v) && !labelled.includes(v)) labelled.push(v);
  }
  for (const line of text.split(/\n/)) {
    const tokens = line.split(/\s+/).map(clean).filter(Boolean);
    // A serial printed with spaces ("CN 0F3 ABC 123") reads as several tokens: offer it joined too.
    // Not when the line has words ("SERIAL", "MADE", "S/N"), which would end up glued to the code.
    const joined = tokens.join("");
    const joinable = tokens.length > 1 && joined.length <= 30 && !tokens.some((t) => /^[A-Z]{4,}$/.test(t) || /^(S\/?N|NO|PN)$/.test(t));
    for (const v of [...tokens, ...(joinable ? [joined] : [])]) {
      if (ok(v) && !labelled.includes(v) && !others.includes(v)) others.push(v);
    }
  }
  const mixed = (v: string) => (/[A-Z]/.test(v) && /\d/.test(v) ? 1 : 0);
  others.sort((a, b) => mixed(b) - mixed(a) || b.length - a.length);
  return [...labelled, ...others].slice(0, 8);
}

/** Copies the guide-box part of the video frame, upscaled and in greyscale, for OCR. */
function captureGuide(video: HTMLVideoElement, guide: HTMLElement): HTMLCanvasElement {
  const v = video.getBoundingClientRect();
  const g = guide.getBoundingClientRect();
  // The video is drawn with object-cover: map screen pixels back to video pixels.
  const scale = Math.max(v.width / video.videoWidth, v.height / video.videoHeight);
  const offsetX = (video.videoWidth * scale - v.width) / 2;
  const offsetY = (video.videoHeight * scale - v.height) / 2;
  const sx = (g.left - v.left + offsetX) / scale;
  const sy = (g.top - v.top + offsetY) / scale;
  const sw = g.width / scale;
  const sh = g.height / scale;

  const up = Math.max(1, Math.min(3, 1200 / sw));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw * up);
  canvas.height = Math.round(sh * up);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.filter = "grayscale(1) contrast(1.4)";
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas;
}

type Mode = "barcode" | "text";

/** Camera fallback for when no USB barcode reader is at hand. Calls onCode once with the chosen value. */
export function CameraScanner({ onCode }: { onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const guide = useRef<HTMLDivElement>(null);
  const done = useRef(onCode);
  const ocr = useRef<Promise<Tesseract.Worker> | null>(null);

  const [mode, setMode] = useState<Mode>("barcode");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slow, setSlow] = useState(false); // no barcode found for a while
  const [reading, setReading] = useState<string | null>(null); // OCR status text
  const [candidates, setCandidates] = useState<string[] | null>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    done.current = onCode;
  }, [onCode]);

  // Camera stream for the lifetime of the sheet.
  useEffect(() => {
    let stream: MediaStream | undefined;
    let stopped = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (stopped || !video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        setReady(true);
      } catch (err) {
        setError(err instanceof DOMException && err.name === "NotAllowedError" ? "Camera permission was denied." : "Could not start the camera.");
      }
    })();
    return () => {
      stopped = true;
      stream?.getTracks().forEach((t) => t.stop());
      void ocr.current?.then((w) => w.terminate());
    };
  }, []);

  // Barcode mode: look for a code a few times a second.
  useEffect(() => {
    if (!ready || mode !== "barcode") return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const hint = setTimeout(() => setSlow(true), 6000);
    (async () => {
      try {
        const detector = await loadDetector();
        const tick = async () => {
          if (stopped || !video.current) return;
          const codes = await detector.detect(video.current).catch(() => []);
          const code = codes[0]?.rawValue.trim();
          if (code) done.current(code);
          else timer = setTimeout(tick, 200);
        };
        void tick();
      } catch {
        if (!stopped) setMode("text"); // barcode reader could not load: text still works
      }
    })();
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearTimeout(hint);
    };
  }, [ready, mode]);

  async function readText() {
    if (!video.current || !guide.current) return;
    const image = captureGuide(video.current, guide.current);
    setCandidates(null);
    try {
      if (!ocr.current) {
        setReading("Loading text reader (first time only)…");
        ocr.current = (async () => {
          const { createWorker, PSM } = await import("tesseract.js");
          const worker = await createWorker("eng");
          await worker.setParameters({
            tessedit_pageseg_mode: PSM.SPARSE_TEXT,
            tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-/:.# ",
          });
          return worker;
        })();
      }
      const worker = await ocr.current;
      setReading("Reading text…");
      const { data } = await worker.recognize(image);
      const found = serialCandidates(data.text);
      setCandidates(found);
      setValue(found[0] ?? "");
    } catch {
      ocr.current = null;
      setError("Could not load the text reader. Check the internet connection and try again.");
    } finally {
      setReading(null);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setSlow(false);
    setCandidates(null);
  }

  if (error) {
    return (
      <div role="alert" className="alert alert-error alert-soft text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" className="tabs tabs-box tabs-sm">
        {(
          [
            ["barcode", "Barcode"],
            ["text", "Read text"],
          ] as const
        ).map(([m, label]) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} className={`tab flex-1 ${mode === m ? "tab-active" : ""}`} onClick={() => switchMode(m)}>
            {label}
          </button>
        ))}
      </div>

      <div className="relative overflow-hidden rounded-box bg-black">
        <video ref={video} className="aspect-video w-full object-cover" muted playsInline />
        {mode === "barcode" ? (
          <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-error shadow-[0_0_8px] shadow-error" aria-hidden />
        ) : (
          <div
            ref={guide}
            className="pointer-events-none absolute inset-x-[8%] top-1/2 h-[30%] -translate-y-1/2 rounded-lg border-2 border-primary shadow-[0_0_0_100vmax_rgba(0,0,0,0.45)]"
            aria-hidden
          />
        )}
        {!ready && <span className="loading loading-spinner absolute top-1/2 left-1/2 -translate-1/2 text-white" />}
      </div>

      {mode === "barcode" ? (
        <div className="flex flex-col gap-2 text-sm text-base-content/70">
          <p>Hold the barcode flat across the red line. It scans automatically.</p>
          {slow && (
            <button type="button" className="btn btn-outline btn-sm" onClick={() => switchMode("text")}>
              Not reading? Read the printed serial instead
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-base-content/70">Fit the printed serial number inside the yellow box, hold steady, then tap Read.</p>
          <button type="button" className="btn btn-primary" disabled={!ready || reading !== null} onClick={readText}>
            {reading ? (
              <>
                <span className="loading loading-spinner" /> {reading}
              </>
            ) : candidates ? (
              "Read again"
            ) : (
              "Read text"
            )}
          </button>

          {candidates &&
            (candidates.length === 0 ? (
              <p className="text-sm text-warning">No serial found. Move closer, avoid glare and try again.</p>
            ) : (
              <div className="flex flex-col gap-2 rounded-box border border-base-300 p-3">
                <p className="text-xs font-semibold text-base-content/60">Tap the right one, check it, then use it</p>
                <div className="flex flex-wrap gap-1">
                  {candidates.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`btn btn-sm font-mono ${value === c ? "btn-secondary" : "btn-outline border-base-300"}`}
                      onClick={() => setValue(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <input
                  value={value}
                  onChange={(e) => setValue(e.target.value.toUpperCase())}
                  className="input w-full font-mono"
                  aria-label="Serial number read from text"
                  spellCheck={false}
                  autoCapitalize="characters"
                />
                <p className="text-xs text-base-content/60">Text reading can mix up O/0, I/1 and S/5. Compare with the label.</p>
                <button type="button" className="btn btn-success" disabled={!value.trim()} onClick={() => done.current(value.trim())}>
                  Use {value.trim() || "serial"}
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
