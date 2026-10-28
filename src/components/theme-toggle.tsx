"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "theme";
const LIGHT = "bumblebee";
const DARK = "hive";

/**
 * Applies the saved theme before first paint so there is no flash.
 * With no saved choice, daisyUI follows the phone's light/dark setting.
 */
export function ThemeScript() {
  const code = `try{var t=localStorage.getItem("${STORAGE_KEY}");if(t==="${LIGHT}"||t==="${DARK}")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: code }}
    />
  );
}

function currentTheme() {
  const explicit = document.documentElement.getAttribute("data-theme");
  if (explicit) return explicit;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? DARK : LIGHT;
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onChange);
  return () => {
    observer.disconnect();
    media.removeEventListener("change", onChange);
  };
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => LIGHT);
  const isDark = theme === DARK;

  function toggle() {
    const next = isDark ? LIGHT : DARK;
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private mode: the choice just isn't remembered.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="btn btn-ghost btn-circle"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
    >
      {isDark ? (
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}
