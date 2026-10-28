"use client";

import { useEffect, useRef } from "react";
import { XIcon } from "./icons";

/**
 * Bottom sheet on phones, centred dialog on larger screens. Uses the native
 * <dialog> (focus trap, Esc to close) styled by daisyUI's modal.
 */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className="modal modal-bottom sm:modal-middle" onClose={onClose} onCancel={onClose}>
      <div className={`modal-box flex max-h-[88dvh] flex-col p-0 ${wide ? "sm:max-w-2xl" : ""}`}>
        <div className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-base-300 sm:hidden" aria-hidden />
        <header className="flex items-start gap-2 border-b border-base-200 px-4 pt-3 pb-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold">{title}</h2>
            {subtitle && <div className="text-sm text-base-content/70">{subtitle}</div>}
          </div>
          <button type="button" className="btn btn-ghost btn-circle btn-sm" onClick={onClose} aria-label="Close">
            <XIcon className="size-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3">{open && children}</div>
        {footer && <footer className="border-t border-base-200 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</footer>}
      </div>
      <form method="dialog" className="modal-backdrop">
        <button aria-label="Close">close</button>
      </form>
    </dialog>
  );
}
