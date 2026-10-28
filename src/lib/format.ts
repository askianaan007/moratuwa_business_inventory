import type { ApprovalStatus, BookStatus, ItemCondition, ItemStatus, LedgerEntryType, Role } from "./types";

const lkr = new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", minimumFractionDigits: 2 });

export function formatLKR(value: string | number | null | undefined) {
  return lkr.format(Number(value ?? 0));
}

/** Ledger dates are calendar dates (no time), so always format in UTC. */
export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" });
}

export function todayISO() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export const roleLabel: Record<Role, string> = {
  ADMIN: "Admin",
  HOD: "Head of Department",
  TECHNICAL_OFFICER: "Technical Officer",
  VIEWER: "Viewer",
};

export const entryTypeBadge: Record<LedgerEntryType, { label: string; className: string }> = {
  RECEIPT: { label: "Receipt", className: "badge-primary" },
  TRANSFER: { label: "Transfer", className: "badge-info" },
  DISPOSAL: { label: "Disposal", className: "badge-error" },
  RETURN: { label: "Return", className: "badge-warning" },
};

export const ENTRY_TYPES = Object.keys(entryTypeBadge) as LedgerEntryType[];

export const bookStatusBadge: Record<BookStatus, { label: string; className: string }> = {
  PENDING_BOOK: { label: "Not in book", className: "badge-warning" },
  WRITTEN_IN_BOOK: { label: "In book", className: "badge-success" },
  SYSTEM_ONLY: { label: "System only", className: "badge-ghost" },
};

export const approvalBadge: Record<ApprovalStatus, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "badge-ghost" },
  SUBMITTED: { label: "Awaiting HOD", className: "badge-info" },
  APPROVED: { label: "Approved", className: "badge-success" },
  REJECTED: { label: "Rejected", className: "badge-error" },
};

export const conditionBadge: Record<ItemCondition, { label: string; className: string }> = {
  GOOD: { label: "Good", className: "badge-success" },
  NEEDS_REPAIR: { label: "Needs repair", className: "badge-warning" },
  DAMAGED: { label: "Damaged", className: "badge-error" },
  UNSERVICEABLE: { label: "Unserviceable", className: "badge-neutral" },
};

export const itemStatusLabel: Record<ItemStatus, string> = {
  IN_USE: "In use",
  IN_STORE: "In store",
  ON_LOAN: "On loan",
  MISSING: "Missing",
  DISPOSED: "Disposed",
};
