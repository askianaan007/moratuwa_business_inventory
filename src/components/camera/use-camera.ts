"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Camera controls Chrome on Android exposes; not in TypeScript's DOM types.
interface CameraCaps {
  zoom?: { min: number; max: number; step: number };
  torch?: boolean;
  focusMode?: string[];
}

/** Zoom used when the camera has no zoom of its own (iPhone, most laptops). */
const DIGITAL = { min: 1, max: 5, step: 0.1 };

export type Rect = [x: number, y: number, w: number, h: number];

/** The camera works on any device with a camera and a secure (https) page. */
export function hasCamera() {
  return Boolean(navigator.mediaDevices?.getUserMedia);
}

/**
 * The part of the video frame that is visible inside `el`, in video pixels,
 * with an optional margin (as a fraction of the element's size). Accounts for
 * object-cover cropping and the CSS scale used for digital zoom.
 */
export function visibleRect(video: HTMLVideoElement, el: HTMLElement, pad = 0): Rect {
  const v = video.getBoundingClientRect();
  const g = el.getBoundingClientRect();
  const scale = Math.max(v.width / video.videoWidth, v.height / video.videoHeight);
  const offsetX = (video.videoWidth * scale - v.width) / 2;
  const offsetY = (video.videoHeight * scale - v.height) / 2;
  const x = (g.left - v.left + offsetX - g.width * pad) / scale;
  const y = (g.top - v.top + offsetY - g.height * pad) / scale;
  const w = (g.width * (1 + 2 * pad)) / scale;
  const h = (g.height * (1 + 2 * pad)) / scale;
  const cx = Math.max(0, x);
  const cy = Math.max(0, y);
  return [cx, cy, Math.max(1, Math.min(video.videoWidth - cx, w - (cx - x))), Math.max(1, Math.min(video.videoHeight - cy, h - (cy - y)))];
}

/** Draws part of an image onto a canvas, scaled so its long edge is at most maxEdge (and at least minEdge). */
export function toCanvas(
  source: CanvasImageSource,
  [sx, sy, sw, sh]: Rect,
  { maxEdge, minEdge = 0, filter = "none" }: { maxEdge: number; minEdge?: number; filter?: string },
) {
  const long = Math.max(sw, sh);
  const scale = Math.min(maxEdge / long, Math.max(1, minEdge / long));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.filter = filter;
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * Back camera stream with autofocus, zoom (the camera's own, or digital when
 * it has none) and torch. Stops the camera on unmount.
 */
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const track = useRef<MediaStreamTrack | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [caps, setCaps] = useState<CameraCaps>({});
  const [zoom, setZoomState] = useState(1);
  const [torch, setTorchState] = useState(false);

  useEffect(() => {
    let stream: MediaStream | undefined;
    let stopped = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (stopped || !videoRef.current) return;
        const t = stream.getVideoTracks()[0]!;
        track.current = t;
        const c = (t.getCapabilities?.() ?? {}) as CameraCaps;
        setCaps(c);
        if (c.focusMode?.includes("continuous")) await t.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] }).catch(() => {});
        if (c.zoom && c.zoom.max > c.zoom.min) setZoomState((t.getSettings() as { zoom?: number }).zoom ?? c.zoom.min);
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setReady(true);
      } catch (err) {
        setError(err instanceof DOMException && err.name === "NotAllowedError" ? "Camera permission was denied." : "Could not start the camera.");
      }
    })();
    return () => {
      stopped = true;
      track.current = null;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const apply = useCallback((set: Record<string, unknown>) => {
    void track.current?.applyConstraints({ advanced: [set as MediaTrackConstraintSet] }).catch(() => {});
  }, []);

  const hardwareZoom = Boolean(caps.zoom && caps.zoom.max > caps.zoom.min);
  const zoomRange = hardwareZoom ? { ...caps.zoom!, step: caps.zoom!.step || 0.1 } : DIGITAL;

  const setZoom = useCallback(
    (value: number) => {
      const z = Math.min(zoomRange.max, Math.max(zoomRange.min, value));
      setZoomState(z);
      if (hardwareZoom) apply({ zoom: z });
    },
    [apply, hardwareZoom, zoomRange.max, zoomRange.min],
  );

  const setTorch = useCallback(
    (on: boolean) => {
      apply({ torch: on });
      setTorchState(on);
    },
    [apply],
  );

  /** Focus at a point (0–1 in each direction). Android Chrome only; a no-op elsewhere. */
  const focusAt = useCallback(
    (x: number, y: number) => {
      const modes = caps.focusMode ?? [];
      if (modes.includes("single-shot")) {
        apply({ focusMode: "single-shot", pointsOfInterest: [{ x, y }] });
        if (modes.includes("continuous")) setTimeout(() => apply({ focusMode: "continuous" }), 1500);
      } else if (modes.includes("continuous")) apply({ focusMode: "continuous", pointsOfInterest: [{ x, y }] });
    },
    [apply, caps.focusMode],
  );

  /** What is visible on screen right now (digital zoom included), for barcode/QR detection. */
  const frame = useCallback((maxEdge = 1280) => {
    const video = videoRef.current;
    const box = containerRef.current;
    if (!video || !box || !video.videoWidth) return null;
    return toCanvas(video, visibleRect(video, box), { maxEdge, minEdge: 720 });
  }, []);

  return {
    videoRef,
    containerRef,
    ready,
    error,
    zoom,
    zoomRange,
    setZoom,
    /** CSS scale for the preview when zooming digitally. */
    digitalScale: hardwareZoom ? 1 : zoom,
    torchSupported: Boolean(caps.torch),
    torch,
    setTorch,
    focusAt,
    frame,
  };
}

export type Camera = ReturnType<typeof useCamera>;
