"use client";

import { useRef, useState, type PointerEvent } from "react";
import type { Camera } from "./use-camera";

/**
 * Live camera preview with pinch-to-zoom, tap-to-focus, a zoom slider and a
 * light button. `overlay` draws the aiming guide on top of the picture.
 */
export function CameraView({ cam, overlay, aspect = "aspect-video" }: { cam: Camera; overlay?: React.ReactNode; aspect?: string }) {
  const { videoRef, containerRef, ready, error, zoom, zoomRange, setZoom, digitalScale, torchSupported, torch, setTorch, focusAt } = cam;
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);
  const tap = useRef<{ x: number; y: number } | null>(null);
  const [focusRing, setFocusRing] = useState<{ x: number; y: number; n: number } | null>(null);

  const distance = () => {
    const [a, b] = [...pointers.current.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };

  function onDown(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      pinch.current = { distance: distance(), zoom: zoom };
      tap.current = null;
    } else tap.current = { x: e.clientX, y: e.clientY };
  }

  function onMove(e: PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size === 2 && pinch.current.distance > 0) {
      setZoom(pinch.current.zoom * (distance() / pinch.current.distance));
    }
  }

  function onUp(e: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    // A tap (not a drag or pinch) focuses there.
    const start = tap.current;
    tap.current = null;
    if (!start || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    setFocusRing((f) => ({ x, y, n: (f?.n ?? 0) + 1 }));
    focusAt(x, y);
  }

  const { min, max, step } = zoomRange;
  const nudge = (dir: 1 | -1) => setZoom(Math.round((zoom + dir * Math.max(step, (max - min) / 10)) * 10) / 10);

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={containerRef}
        className={`relative touch-none overflow-hidden rounded-box bg-black select-none ${aspect}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <video
          ref={videoRef}
          className="size-full object-cover transition-transform duration-75"
          style={{ transform: `scale(${digitalScale})` }}
          muted
          playsInline
        />
        {overlay}
        {focusRing && (
          <span
            key={focusRing.n}
            className="animate-in pointer-events-none absolute size-14 -translate-1/2 rounded-full border-2 border-white/90"
            style={{ left: `${focusRing.x * 100}%`, top: `${focusRing.y * 100}%` }}
            aria-hidden
          />
        )}
        {zoom > min + 0.05 && (
          <span className="pointer-events-none absolute top-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white tabular-nums">
            {zoom.toFixed(1)}×
          </span>
        )}
        {!ready && !error && <span className="loading loading-spinner absolute top-1/2 left-1/2 -translate-1/2 text-white" />}
      </div>

      {error ? (
        <div role="alert" className="alert alert-warning alert-soft py-2 text-sm">
          {error}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-circle btn-sm btn-ghost text-lg" onClick={() => nudge(-1)} disabled={zoom <= min} aria-label="Zoom out">
            −
          </button>
          <input
            type="range"
            className="range range-xs range-primary flex-1"
            min={min}
            max={max}
            step={step}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label="Zoom"
          />
          <button type="button" className="btn btn-circle btn-sm btn-ghost text-lg" onClick={() => nudge(1)} disabled={zoom >= max} aria-label="Zoom in">
            +
          </button>
          {torchSupported && (
            <button
              type="button"
              aria-pressed={torch}
              className={`btn btn-sm ${torch ? "btn-warning" : "btn-outline border-base-300"}`}
              onClick={() => setTorch(!torch)}
            >
              Light
            </button>
          )}
        </div>
      )}
    </div>
  );
}
