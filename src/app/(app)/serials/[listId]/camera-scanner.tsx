"use client";

import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent } from "react";
import type Tesseract from "tesseract.js";
import { CameraIcon } from "@/components/icons";
import { api, ApiError } from "@/lib/api-client";

interface Detector {
  detect(source: ImageBitmapSource): Promise<{ rawValue: string }[]>;
}

// Camera controls Chrome on Android exposes; not in TypeScript's DOM types.
interface CameraCaps {
  zoom?: { min: number; max: number; step: number };
  torch?: boolean;
  focusMode?: string[];
}

export type ReadField = "serial" | "product";
type Mode = "barcode" | "text";
type Engine = "ai" | "offline";
type Candidate = { value: string; note?: string };

const FORMATS = ["code_128", "code_39", "code_93", "codabar", "ean_13", "ean_8", "upc_a", "upc_e", "itf", "qr_code", "data_matrix", "pdf417"] as const;

/** The camera works on any phone; barcodes use the browser's reader or a WebAssembly fallback (iPhone). */
export function hasCamera() {
  return Boolean(navigator.mediaDevices?.getUserMedia);
}

let detectorPromise: Promise<Detector> | null = null;
function loadDetector(): Promise<Detector> {
  detectorPromise ??= (async () => {
    const Native = (window as unknown as { BarcodeDetector?: new (o: { formats: readonly string[] }) => Detector }).BarcodeDetector;
    if (Native) return new Native({ formats: FORMATS });
    const { BarcodeDetector } = await import("barcode-detector/ponyfill");
    return new BarcodeDetector({ formats: [...FORMATS] });
  })();
  detectorPromise.catch(() => (detectorPromise = null));
  return detectorPromise;
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

  for (const m of text.matchAll(/(?:S\s*\/?\s*N|SERIAL(?:\s*(?:NO|NUMBER|#))?|P\s*\/?\s*N|PRODUCT(?:\s*(?:NO|NUMBER|#))?)\s*[:.#-]?\s*([A-Z0-9][A-Z0-9/-]{3,})/gi)) {
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

/** Draws part of an image onto a canvas, scaled so its long edge is at most maxEdge (and at least minEdge). */
function toCanvas(
  source: CanvasImageSource,
  [sx, sy, sw, sh]: [number, number, number, number],
  { maxEdge, minEdge = 0, filter = "none" }: { maxEdge: number; minEdge?: number; filter?: string },
) {
  const long = Math.max(sw, sh);
  const scale = Math.min(maxEdge / long, Math.max(1, minEdge / long));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.filter = filter;
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** The guide-box area of the video frame, in video pixels (the video is drawn with object-cover). */
function guideRect(video: HTMLVideoElement, guide: HTMLElement): [number, number, number, number] {
  const v = video.getBoundingClientRect();
  const g = guide.getBoundingClientRect();
  const scale = Math.max(v.width / video.videoWidth, v.height / video.videoHeight);
  const offsetX = (video.videoWidth * scale - v.width) / 2;
  const offsetY = (video.videoHeight * scale - v.height) / 2;
  // A little margin around the box gives the AI the "S/N" label next to the code.
  const pad = 0.15;
  const x = (g.left - v.left + offsetX - g.width * pad) / scale;
  const y = (g.top - v.top + offsetY - g.height * pad) / scale;
  const w = (g.width * (1 + 2 * pad)) / scale;
  const h = (g.height * (1 + 2 * pad)) / scale;
  const cx = Math.max(0, x);
  const cy = Math.max(0, y);
  return [cx, cy, Math.min(video.videoWidth - cx, w - (cx - x)), Math.min(video.videoHeight - cy, h - (cy - y))];
}

let ocrPromise: Promise<Tesseract.Worker> | null = null;
function loadOcr() {
  ocrPromise ??= (async () => {
    const { createWorker, PSM } = await import("tesseract.js");
    const worker = await createWorker("eng");
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-/:.# ",
    });
    return worker;
  })();
  ocrPromise.catch(() => (ocrPromise = null));
  return ocrPromise;
}

async function readOffline(canvas: HTMLCanvasElement): Promise<Candidate[]> {
  const worker = await loadOcr();
  const { data } = await worker.recognize(canvas);
  return serialCandidates(data.text).map((value) => ({ value, note: "offline" }));
}

async function readWithAi(canvas: HTMLCanvasElement, field: ReadField, kind?: string): Promise<Candidate[]> {
  const image = canvas.toDataURL("image/jpeg", 0.88).split(",")[1]!;
  const { data } = await api<{ data: { candidates: { value: string; printedLabel: string | null; confidence: number | null }[] } }>("/label-reader", {
    method: "POST",
    body: { image, mimeType: "image/jpeg", field, kind },
  });
  return data.candidates.map((c) => ({
    value: c.value,
    note: ["AI", c.printedLabel, c.confidence !== null && `${Math.round(c.confidence * 100)}%`].filter(Boolean).join(" · "),
  }));
}

/**
 * Camera fallback for when no USB barcode reader is at hand: live barcode
 * scanning, reading the printed text (offline or with AI), or a photo from the
 * phone's own camera app, which focuses far better than a live web view.
 * Calls onCode once with the chosen value.
 */
export function CameraScanner({ onCode, ai, field, kind }: { onCode: (code: string) => void; ai: boolean; field: ReadField; kind?: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const guide = useRef<HTMLDivElement>(null);
  const track = useRef<MediaStreamTrack | null>(null);
  const done = useRef(onCode);

  const [mode, setMode] = useState<Mode>("barcode");
  const [ready, setReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [caps, setCaps] = useState<CameraCaps>({});
  const [zoom, setZoom] = useState<number | null>(null);
  const [torch, setTorch] = useState(false);
  const [focusAt, setFocusAt] = useState<{ x: number; y: number; n: number } | null>(null);
  const [slow, setSlow] = useState(false);

  const [photo, setPhoto] = useState<{ url: string; canvas: HTMLCanvasElement } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    done.current = onCode;
  }, [onCode]);

  // Camera stream for the lifetime of the sheet, with autofocus, zoom and torch where the phone allows.
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
        const t = stream.getVideoTracks()[0]!;
        track.current = t;
        const c = (t.getCapabilities?.() ?? {}) as CameraCaps;
        setCaps(c);
        if (c.focusMode?.includes("continuous")) await t.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] }).catch(() => {});
        if (c.zoom) setZoom((t.getSettings() as { zoom?: number }).zoom ?? c.zoom.min);
        video.current.srcObject = stream;
        await video.current.play();
        setReady(true);
      } catch (err) {
        setCameraError(
          err instanceof DOMException && err.name === "NotAllowedError"
            ? "Camera permission was denied. You can still use Take photo."
            : "Could not start the live camera. You can still use Take photo.",
        );
      }
    })();
    return () => {
      stopped = true;
      track.current = null;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Barcode mode: look for a code a few times a second.
  useEffect(() => {
    if (!ready || mode !== "barcode" || photo) return;
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
  }, [ready, mode, photo]);

  useEffect(() => () => void (photo && URL.revokeObjectURL(photo.url)), [photo]);

  function applyCamera(set: Record<string, unknown>) {
    void track.current?.applyConstraints({ advanced: [set as MediaTrackConstraintSet] }).catch(() => {});
  }

  // Tap the picture to focus there (Android Chrome); elsewhere it just shows where you tapped.
  function onTapFocus(e: PointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    setFocusAt((f) => ({ x, y, n: (f?.n ?? 0) + 1 }));
    const modes = caps.focusMode ?? [];
    if (modes.includes("single-shot")) {
      applyCamera({ focusMode: "single-shot", pointsOfInterest: [{ x, y }] });
      if (modes.includes("continuous")) setTimeout(() => applyCamera({ focusMode: "continuous" }), 1500);
    } else if (modes.includes("continuous")) applyCamera({ focusMode: "continuous", pointsOfInterest: [{ x, y }] });
  }

  async function run(engine: Engine, canvas: HTMLCanvasElement) {
    setReadError(null);
    setCandidates(null);
    setBusy(engine === "ai" ? "Reading with AI…" : ocrPromise ? "Reading text…" : "Loading text reader (first time only)…");
    try {
      const found = engine === "ai" ? await readWithAi(canvas, field, kind) : await readOffline(canvas);
      setCandidates(found);
      setValue(found[0]?.value ?? "");
    } catch (err) {
      setReadError(
        err instanceof ApiError ? err.message : engine === "ai" ? "Could not reach the AI reader." : "Could not load the text reader. Check the internet connection.",
      );
    } finally {
      setBusy(null);
    }
  }

  /** The live picture inside the yellow box: upscaled greyscale for offline OCR, plain for AI. */
  function liveCanvas(engine: Engine) {
    const rect = guideRect(video.current!, guide.current!);
    return engine === "ai" ? toCanvas(video.current!, rect, { maxEdge: 1600 }) : toCanvas(video.current!, rect, { maxEdge: 2000, minEdge: 1200, filter: "grayscale(1) contrast(1.4)" });
  }

  function photoCanvas(engine: Engine) {
    const src = photo!.canvas;
    return engine === "ai" ? src : toCanvas(src, [0, 0, src.width, src.height], { maxEdge: 2000, filter: "grayscale(1) contrast(1.4)" });
  }

  async function onPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setReadError(null);
    setCandidates(null);
    setBusy("Opening photo…");
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      const canvas = toCanvas(bitmap, [0, 0, bitmap.width, bitmap.height], { maxEdge: 1600 });
      setPhoto({ url: URL.createObjectURL(file), canvas });

      // A sharp photo often has a readable barcode even when the live view could not focus.
      const codes = await loadDetector()
        .then((d) => d.detect(bitmap))
        .catch(() => []);
      bitmap.close();
      const barcodes = [...new Set(codes.map((c) => c.rawValue.trim()).filter(Boolean))].map((v) => ({ value: v, note: "barcode" }));
      if (barcodes.length) {
        setCandidates(barcodes);
        setValue(barcodes[0]!.value);
        setBusy(null);
        return;
      }
      setBusy(null);
      await run(ai ? "ai" : "offline", ai ? canvas : toCanvas(canvas, [0, 0, canvas.width, canvas.height], { maxEdge: 2000, filter: "grayscale(1) contrast(1.4)" }));
    } catch {
      setBusy(null);
      setReadError("Could not open the photo.");
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setSlow(false);
    setCandidates(null);
    setReadError(null);
    setPhoto(null);
  }

  const photoButton = (
    <label className="btn btn-outline flex-1 border-base-300">
      <CameraIcon className="size-5" />
      {photo ? "Retake photo" : "Take photo"}
      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhoto} />
    </label>
  );

  return (
    <div className="flex flex-col gap-3">
      {!photo && (
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
      )}

      {photo ? (
        <div className="flex flex-col gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
          <img src={photo.url} alt="Label photo" className="max-h-72 w-full rounded-box bg-black object-contain" />
          <button type="button" className="btn btn-ghost btn-sm self-start" onClick={() => switchMode(mode)}>
            ← Back to live camera
          </button>
        </div>
      ) : cameraError ? (
        <div role="alert" className="alert alert-warning alert-soft text-sm">
          {cameraError}
        </div>
      ) : (
        <>
          <div className="relative touch-manipulation overflow-hidden rounded-box bg-black" onPointerDown={onTapFocus}>
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
            {focusAt && (
              <span
                key={focusAt.n}
                className="animate-in pointer-events-none absolute size-14 -translate-1/2 rounded-full border-2 border-white/90"
                style={{ left: `${focusAt.x * 100}%`, top: `${focusAt.y * 100}%` }}
                aria-hidden
              />
            )}
            {!ready && <span className="loading loading-spinner absolute top-1/2 left-1/2 -translate-1/2 text-white" />}
          </div>

          {(caps.zoom || caps.torch) && (
            <div className="flex items-center gap-3">
              {caps.zoom && zoom !== null && (
                <label className="flex flex-1 items-center gap-2 text-xs text-base-content/70">
                  Zoom
                  <input
                    type="range"
                    className="range range-xs flex-1"
                    min={caps.zoom.min}
                    max={caps.zoom.max}
                    step={caps.zoom.step || 0.1}
                    value={zoom}
                    onChange={(e) => {
                      const z = Number(e.target.value);
                      setZoom(z);
                      applyCamera({ zoom: z });
                    }}
                  />
                  <span className="w-8 tabular-nums">{zoom.toFixed(1)}×</span>
                </label>
              )}
              {caps.torch && (
                <button
                  type="button"
                  aria-pressed={torch}
                  className={`btn btn-sm ${torch ? "btn-warning" : "btn-outline border-base-300"}`}
                  onClick={() => {
                    applyCamera({ torch: !torch });
                    setTorch(!torch);
                  }}
                >
                  Light
                </button>
              )}
            </div>
          )}
          <p className="text-xs text-base-content/60">
            Blurry? Hold the phone a little further away{caps.zoom ? " and zoom in" : ""}, tap the picture to focus, or use Take photo for the sharpest image.
          </p>
        </>
      )}

      {!photo && mode === "barcode" && (
        <div className="flex flex-col gap-2 text-sm text-base-content/70">
          <p>Hold the barcode flat across the red line. It scans automatically.</p>
          <div className="flex gap-2">
            {photoButton}
            {slow && (
              <button type="button" className="btn btn-outline btn-primary flex-1" onClick={() => switchMode("text")}>
                Read the printed text
              </button>
            )}
          </div>
        </div>
      )}

      {!photo && mode === "text" && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-base-content/70">Fit the printed {field === "serial" ? "serial" : "product"} number inside the yellow box, hold steady, then read it.</p>
          <div className="flex flex-wrap gap-2">
            {ai && (
              <button type="button" className="btn btn-primary flex-1" disabled={!ready || busy !== null} onClick={() => run("ai", liveCanvas("ai"))}>
                AI read
              </button>
            )}
            <button
              type="button"
              className={`btn flex-1 ${ai ? "btn-outline border-base-300" : "btn-primary"}`}
              disabled={!ready || busy !== null}
              onClick={() => run("offline", liveCanvas("offline"))}
            >
              {ai ? "Read offline" : "Read text"}
            </button>
            {photoButton}
          </div>
        </div>
      )}

      {photo && (
        <div className="flex flex-wrap gap-2">
          {ai && (
            <button type="button" className="btn btn-primary flex-1" disabled={busy !== null} onClick={() => run("ai", photoCanvas("ai"))}>
              AI read
            </button>
          )}
          <button type="button" className="btn btn-outline flex-1 border-base-300" disabled={busy !== null} onClick={() => run("offline", photoCanvas("offline"))}>
            Read offline
          </button>
          {photoButton}
        </div>
      )}

      {busy && (
        <p className="flex items-center gap-2 text-sm text-base-content/70" role="status">
          <span className="loading loading-spinner loading-sm" /> {busy}
        </p>
      )}
      {readError && (
        <div role="alert" className="alert alert-error alert-soft py-2 text-sm">
          {readError}
        </div>
      )}

      {candidates &&
        (candidates.length === 0 ? (
          <p className="text-sm text-warning">
            Nothing found. Move closer, avoid glare{ai ? ", or try AI read" : ""}, and try again.
          </p>
        ) : (
          <div className="flex flex-col gap-2 rounded-box border border-base-300 p-3">
            <p className="text-xs font-semibold text-base-content/60">Tap the right one, check it against the label, then use it</p>
            <div className="flex flex-wrap gap-1">
              {candidates.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className={`btn btn-sm h-auto py-1 ${value === c.value ? "btn-secondary" : "btn-outline border-base-300"}`}
                  onClick={() => setValue(c.value)}
                >
                  <span className="flex flex-col items-start">
                    <span className="font-mono">{c.value}</span>
                    {c.note && <span className="text-[10px] font-normal opacity-70">{c.note}</span>}
                  </span>
                </button>
              ))}
            </div>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value.toUpperCase())}
              className="input w-full font-mono"
              aria-label="Value to use"
              spellCheck={false}
              autoCapitalize="characters"
            />
            <p className="text-xs text-base-content/60">Reading can mix up O/0, I/1 and S/5. Compare with the label.</p>
            <button type="button" className="btn btn-success" disabled={!value.trim()} onClick={() => done.current(value.trim())}>
              Use {value.trim() || "this"}
            </button>
          </div>
        ))}
    </div>
  );
}
