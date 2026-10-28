/** Shapes returned by the LabLedger API (moratuwa_backend). Money is a decimal string. */

export type Role = "ADMIN" | "HOD" | "TECHNICAL_OFFICER" | "VIEWER";
export type LedgerEntryType = "RECEIPT" | "TRANSFER" | "DISPOSAL" | "RETURN";
export type BookStatus = "PENDING_BOOK" | "WRITTEN_IN_BOOK" | "SYSTEM_ONLY";
export type ApprovalStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
export type ItemCondition = "GOOD" | "NEEDS_REPAIR" | "DAMAGED" | "UNSERVICEABLE";
export type ItemStatus = "IN_USE" | "IN_STORE" | "ON_LOAN" | "MISSING" | "DISPOSED";

export interface Department {
  id: string;
  code: string;
  name: string;
}

export interface Location {
  id: string;
  code: string;
  name: string;
  building?: string | null;
  floor?: string | null;
  departmentId?: string;
}

/** Item variety (Monitors, Chairs …). Managed by admins. */
export interface Category {
  id: string;
  code: string;
  name: string;
}

/** GET /categories row: the category plus its ledger summary. */
export interface CategorySummary extends Category {
  description: string | null;
  isActive: boolean;
  entries: number;
  receivedQuantity: number;
  receivedValue: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  departmentId: string | null;
  department: Department | null;
}

export interface LedgerEntry {
  id: string;
  departmentId: string;
  entryType: LedgerEntryType;
  entryDate: string;
  /** Receipts only: "No", SIN No and SIN date. */
  receiptNo: string | null;
  sinNo: string | null;
  sinDate: string | null;
  /** Transfers, disposals and returns. */
  refNo: string | null;
  description: string;
  brand: string | null;
  modelNo: string | null;
  serialNo: string | null;
  itemCode: string | null;
  quantity: number;
  unitPrice: string;
  value: string;
  remark: string | null;
  hodSigned: boolean;
  categoryId: string | null;
  category: Category | null;
  bookVolume: string | null;
  bookPage: number | null;
  bookStatus: BookStatus;
  approvalStatus: ApprovalStatus;
  createdById: string | null;
  createdAt: string;
  _count?: { items: number };
}

export interface AssetItemSummary {
  id: string;
  tagCode: string;
  serialNo: string | null;
  condition: ItemCondition;
  status: ItemStatus;
  isBulk: boolean;
  bulkQty: number | null;
  location: Pick<Location, "id" | "code" | "name"> | null;
}

export interface LedgerEntryDetail extends LedgerEntry {
  department: Department;
  createdBy: { id: string; name: string } | null;
  items: AssetItemSummary[];
  approvals: {
    id: string;
    status: ApprovalStatus;
    comment: string | null;
    decidedAt: string;
    approver: { id: string; name: string };
  }[];
}

export interface AssetItemDetail extends Omit<AssetItemSummary, "location"> {
  custodian: string | null;
  location: Pick<Location, "id" | "code" | "name"> | null;
  ledgerEntry: Pick<
    LedgerEntry,
    | "id"
    | "departmentId"
    | "entryDate"
    | "receiptNo"
    | "refNo"
    | "description"
    | "brand"
    | "modelNo"
    | "itemCode"
    | "unitPrice"
    | "approvalStatus"
    | "category"
  >;
  auditRecords: { id: string; result: string; condition: ItemCondition | null; scannedAt: string; scannedBy: { name: string } }[];
  movements: {
    id: string;
    movedAt: string;
    reason: string | null;
    fromLocation: { code: string; name: string } | null;
    toLocation: { code: string; name: string };
  }[];
}

export interface DashboardSummary {
  entries: number;
  items: number;
  totalValue: string;
  pendingBook: number;
  awaitingApproval: number;
  needsAttention: number;
  missing: number;
  recent: Pick<LedgerEntry, "id" | "entryType" | "entryDate" | "description" | "brand" | "quantity" | "value" | "bookStatus">[];
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: { path: string; message: string; current?: unknown }[]; requestId?: string };
}

// ─── Lab rooms & monthly lab audit ──────────────────────────────────────

export type RoomType = "LAB" | "CLASSROOM" | "STORE" | "OFFICE" | "OTHER";
export type SeatKind = "PC" | "EMPTY_TABLE" | "NO_TABLE" | "INSTRUCTOR";
export type EquipmentScope = "WORKSTATION" | "ROOM" | "BOTH";
export type EquipmentState = "IN_SERVICE" | "AT_REPAIR" | "RETIRED";
export type LabCheckStatus = "WORKING" | "NOT_WORKING" | "NEEDS_REPAIR" | "MISSING" | "REMOVED" | "NOT_CHECKED";
export type LabAuditStatus = "DRAFT" | "SUBMITTED" | "RETURNED" | "APPROVED";
export type Wall = "FRONT" | "BACK" | "LEFT" | "RIGHT" | "CEILING";

/** Top-view coordinates computed by the API (same source as the printed report). */
export interface PlanGeometry {
  width: number;
  height: number;
  board: { x: number; y: number; w: number; h: number };
  blocks: { id: string; code: string; name: string; x: number; y: number; w: number; h: number }[];
  rows: { id: string; blockId: string; label: string; x: number; y: number }[];
  desks: {
    seatId: string;
    kind: SeatKind;
    x: number;
    y: number;
    w: number;
    h: number;
    positionCode: string;
    blockCode: string;
    rowLabel: string;
    seatNumber: number;
    workstationId: string | null;
    label: string | null;
  }[];
  fixtures: { equipmentId: string; code: string; typeCode: string; typeName: string; x: number; y: number; wall: Wall }[];
}

export interface EquipmentTypeRef {
  id: string;
  code: string;
  name: string;
  isPrimary: boolean;
  isAuditable: boolean;
  sortOrder: number;
  scope: EquipmentScope;
  codePrefix: string;
}

export interface EquipmentType extends EquipmentTypeRef {
  isDefault: boolean;
  maxPerWorkstation: number;
  categoryId: string | null;
  isActive: boolean;
  category: Category | null;
}

export interface FaultReason {
  id: string;
  typeId: string | null;
  label: string;
  group: string;
  sortOrder: number;
  isActive: boolean;
}

export interface EquipmentItem {
  id: string;
  code: string;
  number: number;
  slot: number;
  state: EquipmentState;
  brand: string | null;
  modelNo: string | null;
  serialNo: string | null;
  workstationId: string | null;
  wall: Wall | null;
  x: number | null;
  y: number | null;
  notes: string | null;
  version: number;
  installedAt: string;
  replacesId: string | null;
  assetItem: { id: string; tagCode: string } | null;
  type: EquipmentTypeRef;
}

export interface RoomSeat {
  id: string;
  order: number;
  kind: SeatKind;
  note: string | null;
  positionCode: string;
  workstationId: string | null;
}

export interface RoomRow {
  id: string;
  label: string;
  order: number;
  seats: RoomSeat[];
}

export interface RoomBlock {
  id: string;
  code: string;
  name: string;
  order: number;
  rows: RoomRow[];
}

export interface RoomWorkstation {
  id: string;
  number: number;
  label: string;
  labelOverride: string | null;
  seatId: string | null;
  positionCode: string | null;
  version: number;
  equipment: EquipmentItem[];
}

export interface RoomInfo {
  id: string;
  departmentId: string;
  department: Department;
  code: string;
  name: string;
  building: string | null;
  floor: string | null;
  roomType: RoomType;
  layoutVersion: number;
}

export interface RoomDetail {
  room: RoomInfo;
  blocks: RoomBlock[];
  workstations: RoomWorkstation[];
  fixtures: EquipmentItem[];
  unassigned: EquipmentItem[];
  equipment: EquipmentItem[];
  openAudit: { id: string; status: LabAuditStatus; period: string; reference: string } | null;
  plan: PlanGeometry;
}

export interface RoomSummary {
  id: string;
  code: string;
  name: string;
  building: string | null;
  floor: string | null;
  roomType: RoomType;
  departmentId: string;
  workstationCount: number;
  equipmentCount: number;
  hasLayout: boolean;
  lastAudit: { id: string; period: string; status: LabAuditStatus; reference: string } | null;
}

export interface AuditProgress {
  total: number;
  checked: number;
  completion: number;
  byStatus: Record<LabCheckStatus, number>;
}

export interface AuditOverview {
  period: string;
  rooms: {
    id: string;
    code: string;
    name: string;
    roomType: RoomType;
    workstationCount: number;
    hasLayout: boolean;
    audit: { id: string; status: LabAuditStatus; reference: string; auditorName: string; updatedAt: string; progress: AuditProgress } | null;
  }[];
}

export interface LabCheck {
  id: string;
  auditId: string;
  targetKind: "EQUIPMENT" | "SEAT";
  equipmentId: string | null;
  seatId: string | null;
  targetKey: string;
  sortKey: string;
  positionCode: string | null;
  workstationId: string | null;
  stationLabel: string | null;
  typeCode: string;
  typeName: string;
  itemCode: string;
  serialNo: string | null;
  assetTag: string | null;
  status: LabCheckStatus;
  faultReasonId: string | null;
  reasonText: string | null;
  notes: string | null;
  actionTaken: string | null;
  followUp: string | null;
  suggestedStatus: LabCheckStatus | null;
  suggestedReason: string | null;
  addedAfterStart: boolean;
  targetRetiredAfterStart: boolean;
  checkedAt: string | null;
  lastMutationId: string | null;
  version: number;
  faultReason: { id: string; label: string } | null;
  checkedBy: { id: string; name: string } | null;
}

export interface LabAuditSummaryRow {
  id: string;
  reference: string;
  period: string;
  status: LabAuditStatus;
  auditorName: string;
  startedOn: string;
  completedOn: string | null;
  location: { id: string; code: string; name: string };
  progress: AuditProgress;
  latestSnapshot: { revision: number; kind: string; createdAt: string } | null;
}

export interface LabAuditDetail {
  id: string;
  departmentId: string;
  locationId: string;
  reference: string;
  period: string;
  auditorName: string;
  auditorDesignation: string | null;
  startedOn: string;
  completedOn: string | null;
  status: LabAuditStatus;
  generalRemarks: string | null;
  recommendations: string | null;
  version: number;
  createdById: string;
  location: { id: string; code: string; name: string; building: string | null; floor: string | null; roomType: RoomType };
  createdBy: { id: string; name: string };
  checks: LabCheck[];
  transitions: { id: string; from: LabAuditStatus | null; to: LabAuditStatus; comment: string | null; at: string; actor: { id: string; name: string } }[];
  snapshots: { id: string; revision: number; kind: string; sha256: string; createdAt: string }[];
  summary: AuditProgress;
  plan: PlanGeometry;
  blocks: RoomBlock[];
  canDecide: boolean;
}

export interface ReportSettings {
  departmentId: string;
  institution: string;
  faculty: string | null;
  departmentTitle: string;
  hodName: string | null;
  hodDesignation: string | null;
  checkedByLabel: string | null;
  footerNote: string | null;
  version: number | null;
}
