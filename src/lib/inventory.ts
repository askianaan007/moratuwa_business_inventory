import type { BookStatus, ItemCondition, ItemStatus, LabCheckStatus, RoomType } from "./types";

// ─── API shapes (/inventory/*) ──────────────────────────────────────────

export interface RoomRef {
  id: string;
  code: string;
  name: string;
  building?: string | null;
  floor?: string | null;
  roomType?: RoomType;
}

export interface InventoryAsset {
  id: string;
  tagCode: string;
  serialNo: string | null;
  custodian: string | null;
  condition: ItemCondition;
  status: ItemStatus;
  isBulk: boolean;
  bulkQty: number | null;
  updatedAt: string;
  location: (RoomRef & { building: string | null; floor: string | null; roomType: RoomType }) | null;
  ledgerEntry: {
    id: string;
    departmentId: string;
    description: string;
    brand: string | null;
    modelNo: string | null;
    itemCode: string | null;
    entryDate: string;
    bookVolume: string | null;
    bookPage: number | null;
    bookStatus: BookStatus;
    category: { id: string; code: string; name: string } | null;
  };
  equipment: { id: string; code: string; locationId: string; workstation: { number: number } | null }[];
}

export interface Movement {
  id: string;
  movedAt: string;
  reason: string | null;
  fromLocation: RoomRef | null;
  toLocation: RoomRef;
  movedBy: { name: string } | null;
  assetItem?: { id: string; tagCode: string; ledgerEntry: { description: string } };
}

export interface InventoryAssetDetail extends Omit<InventoryAsset, "ledgerEntry" | "equipment"> {
  createdAt: string;
  ledgerEntry: InventoryAsset["ledgerEntry"] & {
    entryType: string;
    receiptNo: string | null;
    sinNo: string | null;
    refNo: string | null;
    serialNo: string | null;
    quantity: number;
    unitPrice: string;
    remark: string | null;
    hodSigned: boolean;
    approvalStatus: string;
    department: { id: string; code: string; name: string };
    _count: { items: number };
  };
  movements: Movement[];
  auditRecords: {
    id: string;
    result: "FOUND" | "MISSING" | "FOUND_ELSEWHERE" | "UNREGISTERED";
    condition: ItemCondition | null;
    note: string | null;
    scannedAt: string;
    scannedBy: { name: string };
    observedLocation: RoomRef | null;
    session: { title: string };
  }[];
  disposal: { reason: string; boardRef: string | null; disposedAt: string; approvedBy: { name: string } } | null;
  equipment: {
    id: string;
    code: string;
    state: "IN_SERVICE" | "AT_REPAIR" | "RETIRED";
    installedAt: string;
    retiredAt: string | null;
    type: { name: string };
    location: RoomRef;
    workstation: { number: number } | null;
  }[];
  labChecks: {
    id: string;
    status: LabCheckStatus;
    reasonText: string | null;
    checkedAt: string | null;
    faultReason: { label: string } | null;
    audit: { id: string; period: string; reference: string };
  }[];
  log: { id: string; action: string; at: string; after: unknown; actor: { name: string } | null }[];
  duplicates: { id: string; tagCode: string }[];
  lastSeen: string | null;
  warnings: string[];
}

export interface InventoryRoom extends RoomRef {
  building: string | null;
  floor: string | null;
  roomType: RoomType;
  departmentId: string;
  updatedAt: string;
  department: { code: string; name: string };
  assets: number;
  needsAttention: number;
  workstations: number;
  labEquipment: number;
}

export interface CategoryCount {
  id: string | null;
  code: string;
  name: string;
  records: number;
  units: number;
  attention: number;
}

export interface InventoryRoomDetail extends Omit<InventoryRoom, "assets" | "needsAttention" | "department"> {
  createdAt: string;
  department: { id: string; code: string; name: string };
  hasLayout: boolean;
  totals: { records: number; units: number; attention: number };
  categories: CategoryCount[];
  movements: Movement[];
  foundHereElsewhere: number;
  openAudit: { id: string; reference: string; status: string } | null;
}

export interface Finding {
  id: string;
  note: string | null;
  scannedAt: string;
  scannedBy: { name: string };
  observedLocation: RoomRef | null;
  asset: { id: string; tagCode: string; description: string; status: ItemStatus; location: RoomRef | null };
  resolved: boolean;
}

export interface InventorySummary {
  rooms: number;
  buildings: number;
  records: number;
  individual: number;
  bulkRecords: number;
  bulkUnits: number;
  byStatus: Partial<Record<ItemStatus, number>>;
  byCondition: Partial<Record<ItemCondition, number>>;
  unlocated: number;
  unverified: number;
  verifyWindowDays: number;
  movesLast30Days: number;
  openFindings: number;
  pendingBook: number;
  byCategory: CategoryCount[];
  byRoom: CategoryCount[];
}

// ─── Labels ─────────────────────────────────────────────────────────────

export const itemStatusBadge: Record<ItemStatus, { label: string; className: string }> = {
  IN_USE: { label: "In use", className: "badge-ghost" },
  IN_STORE: { label: "In store", className: "badge-info badge-outline" },
  ON_LOAN: { label: "On loan", className: "badge-secondary badge-outline" },
  MISSING: { label: "Missing", className: "badge-error" },
  DISPOSED: { label: "Disposed", className: "badge-neutral" },
};

export const TRANSFER_TYPES = {
  ROOM_TO_ROOM: "Room to room",
  TO_STORE: "To store",
  FROM_STORE: "From store",
  TO_REPAIR: "Send for repair",
  RETURN_FROM_REPAIR: "Back from repair",
  LOAN: "Temporary loan",
  RETURN_FROM_LOAN: "Back from loan",
} as const;
export type TransferType = keyof typeof TRANSFER_TYPES;

export const ROOM_TYPES: RoomType[] = ["LAB", "CLASSROOM", "OFFICE", "STORE", "OTHER"];

/** "?a=1&b=2" from the non-empty values. */
export function toQuery(params: Record<string, string | number | undefined | null>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  const s = qs.toString();
  return s ? `?${s}` : "";
}

/** Reads string search params into a plain record. */
export function pickParams<K extends string>(search: Record<string, string | string[] | undefined>, keys: readonly K[]) {
  const out = {} as Record<K, string | undefined>;
  for (const k of keys) out[k] = typeof search[k] === "string" && search[k] ? (search[k] as string) : undefined;
  return out;
}

export const bookRef = (e: { bookVolume: string | null; bookPage: number | null }) =>
  e.bookVolume || e.bookPage ? [e.bookVolume && `Vol ${e.bookVolume}`, e.bookPage && `p. ${e.bookPage}`].filter(Boolean).join(", ") : null;

export const qty = (a: { isBulk: boolean; bulkQty: number | null }) => (a.isBulk ? (a.bulkQty ?? 1) : 1);
