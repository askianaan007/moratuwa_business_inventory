import type { EquipmentState, LabAuditStatus, LabCheckStatus, RoomType, SeatKind } from "./types";

/**
 * Every status has a colour AND a symbol, so it reads for colour-blind users
 * and on black-and-white printouts.
 */
export const checkStatus: Record<
  LabCheckStatus,
  { label: string; short: string; symbol: string; badge: string; button: string; plan: string; needsReason: boolean }
> = {
  WORKING: { label: "Working", short: "OK", symbol: "✓", badge: "badge-success", button: "btn-success", plan: "fill-success/25 stroke-success", needsReason: false },
  NOT_WORKING: { label: "Not working", short: "NW", symbol: "✗", badge: "badge-error", button: "btn-error", plan: "fill-error/30 stroke-error", needsReason: true },
  NEEDS_REPAIR: { label: "Needs repair", short: "NR", symbol: "⚠", badge: "badge-warning", button: "btn-warning", plan: "fill-warning/30 stroke-warning", needsReason: true },
  MISSING: { label: "Missing", short: "MS", symbol: "?", badge: "badge-error badge-outline", button: "btn-error btn-outline", plan: "fill-error/10 stroke-error", needsReason: true },
  REMOVED: { label: "Removed", short: "RM", symbol: "⊘", badge: "badge-neutral", button: "btn-neutral", plan: "fill-base-300 stroke-base-content/50", needsReason: true },
  NOT_CHECKED: { label: "Not checked", short: "NC", symbol: "○", badge: "badge-ghost", button: "btn-ghost", plan: "fill-base-100 stroke-base-content/40", needsReason: false },
};

/** Order of the big buttons in the inspection sheet. */
export const CHECK_ACTIONS: LabCheckStatus[] = ["WORKING", "NOT_WORKING", "NEEDS_REPAIR", "MISSING", "REMOVED", "NOT_CHECKED"];

const SEVERITY: Record<LabCheckStatus, number> = { WORKING: 1, NOT_CHECKED: 2, REMOVED: 3, NEEDS_REPAIR: 4, NOT_WORKING: 5, MISSING: 6 };

/** The status a desk shows when it has several items. Unchecked beats working. */
export function worstStatus(statuses: LabCheckStatus[]): LabCheckStatus | null {
  let worst: LabCheckStatus | null = null;
  for (const s of statuses) {
    if (!worst || SEVERITY[s] > SEVERITY[worst] || (worst === "WORKING" && s === "NOT_CHECKED")) worst = s;
  }
  return worst;
}

export const auditStatusBadge: Record<LabAuditStatus, { label: string; className: string }> = {
  DRAFT: { label: "In progress", className: "badge-info" },
  SUBMITTED: { label: "Awaiting HOD", className: "badge-warning" },
  RETURNED: { label: "Returned", className: "badge-error" },
  APPROVED: { label: "Approved", className: "badge-success" },
};

export const seatKind: Record<SeatKind, { label: string; short: string; className: string }> = {
  PC: { label: "PC", short: "PC", className: "btn-primary" },
  EMPTY_TABLE: { label: "Empty table", short: "Empty", className: "btn-outline border-dashed" },
  NO_TABLE: { label: "No table (gap)", short: "Gap", className: "btn-ghost opacity-50" },
  INSTRUCTOR: { label: "Instructor desk", short: "Instr.", className: "btn-secondary" },
};

/** Tap order when cycling a seat in the layout editor. */
export const SEAT_CYCLE: SeatKind[] = ["PC", "EMPTY_TABLE", "NO_TABLE", "INSTRUCTOR"];

export const equipmentState: Record<EquipmentState, { label: string; className: string }> = {
  IN_SERVICE: { label: "In service", className: "badge-success badge-outline" },
  AT_REPAIR: { label: "At repair", className: "badge-warning" },
  RETIRED: { label: "Retired", className: "badge-ghost" },
};

export const roomTypeLabel: Record<RoomType, string> = {
  LAB: "Computer lab",
  CLASSROOM: "Classroom",
  STORE: "Store",
  OFFICE: "Office",
  OTHER: "Other",
};

export const WALL_LABEL = { FRONT: "Front wall", BACK: "Back wall", LEFT: "Left wall", RIGHT: "Right wall", CEILING: "Ceiling" } as const;

/** "2026-10" for the current month in local time. */
export function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** "2026-10-01" or "2026-10" → "October 2026". */
export function formatPeriod(period: string) {
  return new Date(`${period.slice(0, 7)}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}
