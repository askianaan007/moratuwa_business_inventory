/** Shapes returned by the LabLedger API (moratuwa_backend). Money is a decimal string. */

export type Role = "ADMIN" | "HOD" | "TECHNICAL_OFFICER" | "VIEWER";
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
  entryDate: string;
  refNo: string | null;
  description: string;
  brand: string | null;
  modelNo: string | null;
  quantity: number;
  unitPrice: string;
  value: string;
  remark: string | null;
  category: string | null;
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
    "id" | "departmentId" | "entryDate" | "refNo" | "description" | "brand" | "modelNo" | "unitPrice" | "approvalStatus"
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
  recent: Pick<LedgerEntry, "id" | "entryDate" | "description" | "brand" | "quantity" | "value" | "bookStatus">[];
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: { path: string; message: string }[]; requestId?: string };
}
