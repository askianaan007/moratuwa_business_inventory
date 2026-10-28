# Inventory Ledger & Audit System — Project Plan

> Working name: **LabLedger**
> Owner: Technical Officer, University of Moratuwa
> Status: Phase 1 in progress · Last updated: 2026-10-27

---

## 1. Background

The department keeps its inventory in a **handwritten ledger book**. Each row has:

| # | Ledger column | Notes |
|---|---|---|
| 1 | Date | Date the item was received or entered |
| 2 | Ref. No | GRN, PO, or invoice reference |
| 3 | Description | What the item is |
| 4 | Brand | |
| 5 | Model No | |
| 6 | Serial No | Often missing for furniture and consumables |
| 7 | Quantity | |
| 8 | Unit Price | LKR |
| 9 | Value | Quantity × Unit Price |
| 10 | Remark | Free text |
| 11 | Signature of HOD | Wet signature confirming the entry |

### Problems with the manual ledger
- Audits are slow. You walk the labs with the book and tick items by hand.
- It is hard to find an item by serial number, location, or brand.
- Getting a report into Excel or PDF means typing everything again.
- There is no record of where an item is now, what condition it is in, or whether it moved.
- Handwriting fades, pages get damaged, and there is only one copy.

### Approach: run both side by side, no forced migration
The department will **not** drop the book suddenly, and it should not be asked to. The plan is:

1. **Phase 1 (personal tool):** I record entries and audits on my phone first, then copy them into the book. The app is my working copy and the book stays the official record.
2. **Phase 2 (show it works):** Use the app for a full audit cycle and hand the HOD printed reports from it.
3. **Phase 3 (proposal):** Propose it to the campus as the main system, with the book becoming a printed archive generated from the system.

Everything below is designed so that Phase 1 code grows into Phase 3 without a rewrite.

---

## 2. Goals

| Goal | Measure of success |
|---|---|
| Fast data entry on a phone | Add a new ledger entry in under 30 seconds |
| Fast physical audit | Verify an item by scanning its QR tag in under 3 seconds |
| Works with weak or no Wi-Fi inside labs | Full audit possible offline, syncs later |
| One-tap reports | Excel and PDF in the **same column layout as the book** |
| Easy to copy into the book | "Pending book entries" printout matches the ledger columns |
| Ready for the campus later | Multiple departments, roles, HOD approval, audit trail, backups |

### Out of scope (for now)
- Procurement and purchase-order workflow
- Integration with the university finance or ERP system
- Depreciation accounting (the database will allow it to be added later)

---

## 3. Tech stack

Priorities: **free to start, mobile-first, secure, one language end to end, easy to move onto campus servers later.**

Two projects, side by side:

| Project | Folder | Role |
|---|---|---|
| **Frontend** | `moratuwa_frontend/` | Mobile-first web app (installable PWA) |
| **Backend** | `moratuwa_backend/` | REST API, business rules, security, database |

| Layer | Choice | Why |
|---|---|---|
| Frontend framework | **Next.js 16 (App Router) + TypeScript** | Server rendering plus a same-origin proxy to the API, so auth cookies stay first-party |
| UI | **Tailwind CSS 4 + daisyUI 5** | Touch-friendly components with no extra JS. Custom **bumblebee** (yellow/white/black) and **hive** (dark: yellow on black) themes. |
| Backend framework | **Express 5 + TypeScript** | Simple, well known, layered modules (routes → controller → service) |
| Database | **PostgreSQL** | Reliable and free. Every host supports it, including campus servers. |
| ORM | **Prisma 7** (`@prisma/adapter-pg`) | Type-safe client, readable schema, SQL migrations committed to git |
| Auth | Own implementation: scrypt passwords, JWT access + rotating refresh tokens in httpOnly cookies | No third-party dependency. Campus SSO can be added later. |
| Validation | **Zod** | Every request body, query and param, plus env config |
| Security | helmet, CORS allow-list, CSRF guard, express-rate-limit, account lockout, activity log | See `moratuwa_backend/README.md` |
| Logging | **pino** (request IDs, secrets redacted) | Structured logs, easy to ship later |
| App install | PWA (web manifest, service worker later) | Installs to the phone home screen. No Play Store needed. |
| Offline storage *(planned)* | **Dexie.js (IndexedDB)** | Saves entries and audit scans offline, syncs later |
| QR scanning *(planned)* | **@zxing/browser** | Scans with the phone camera from inside the browser |
| QR generation *(planned)* | **qrcode** npm | Prints asset tag stickers |
| Excel export *(planned)* | **ExcelJS** | Styled sheets with headers, borders, totals, and frozen header rows |
| PDF export *(planned)* | **pdfmake** or **@react-pdf/renderer** | Fixed A4 layouts for ledger pages, audit reports, and QR labels |
| File storage *(planned)* | S3-compatible (Cloudflare R2 → **MinIO** on campus) | Same API in both places |

### Hosting path
| Phase | Hosting | Cost |
|---|---|---|
| 1 — Personal | Laptop (local Postgres), or Vercel/Render (free) + Neon/Supabase Postgres (free tier) | **LKR 0** |
| 2 — Pilot | Same, plus daily automated backups | ~LKR 0 |
| 3 — Campus | **Docker Compose** on a university server/VM: `frontend` + `api` + `postgres` + `minio` + `caddy` (HTTPS) | Existing campus infrastructure |

> Data is in plain PostgreSQL from day one. Moving to campus means one `pg_dump` and one restore.

### Why not Google Sheets / Excel only?
Both are fine for a quick start. They break down once you need offline QR audits, per-item tracking, roles, approvals, and an audit trail. The planned app **exports** to Excel instead of **living** in Excel.

---

## 4. Data model

### Key design idea: entry vs. item
A ledger row can have **Quantity = 20** (for example, 20 chairs on one GRN). An audit, though, has to check **each physical unit**. So the app keeps two levels:

- **Ledger Entry**: one row, exactly as in the book.
- **Asset Item**: one row per physical unit, each with its own QR tag, serial no, location, and condition.

Items without serial numbers (chairs, tables) still get individual tags. Bulk consumables can be flagged `is_bulk = true` and counted by quantity instead.

### Entities

```
Department ─┬─< Location (lab / room / store)
            ├─< User (role per department)
            └─< LedgerEntry ──< AssetItem ──< AuditRecord >── AuditSession
                     │               ├─< Movement (transfers)
                     │               ├─< Photo
                     │               └─< Disposal
                     └─< Approval (HOD)
ActivityLog (every create/update/delete — immutable)
```

### Tables (main fields)

**departments**: `id, code, name`

**locations**: `id, department_id, code (e.g. "ELEC-LAB-02"), name, building, floor`

**users**: `id, name, email, role, department_id`
- Roles: `admin`, `hod`, `technical_officer`, `viewer`

**ledger_entries**: mirrors the book
| Field | Type | Note |
|---|---|---|
| id | uuid | |
| department_id | fk | |
| entry_date | date | **Date** |
| ref_no | text | **Ref. No** |
| description | text | **Description** |
| brand | text | **Brand** |
| model_no | text | **Model No** |
| quantity | int | **Quantity** |
| unit_price | numeric(14,2) | **Unit Price** (LKR) |
| value | numeric(14,2) | **Value**, computed as quantity × unit_price and stored for reports |
| remark | text | **Remark** |
| category | text | e.g. Computer, Lab Equipment, Furniture, Tool |
| book_volume / book_page | text / int | **Where this row is in the physical book** (for cross-checking) |
| book_status | enum | `pending_book`, `written_in_book`, `system_only` |
| approval_status | enum | `draft`, `submitted`, `approved`, `rejected` |
| created_by, created_at, updated_at, deleted_at | | Soft delete only |

**asset_items**: one per physical unit
| Field | Note |
|---|---|
| id, ledger_entry_id | |
| tag_code | Unique, printed as QR, e.g. `UOM-ELEC-2026-00123` |
| serial_no | **Serial No** (per unit) |
| location_id | Where it is now |
| custodian | Person responsible (optional) |
| condition | `good`, `needs_repair`, `damaged`, `unserviceable` |
| status | `in_use`, `in_store`, `on_loan`, `missing`, `disposed` |
| is_bulk, bulk_qty | For consumables |

**approvals**: replaces the HOD signature column
- `ledger_entry_id, approver_id, status, comment, approved_at`
- During the side-by-side period the **printed PDF still has a signature line for the HOD's wet signature**. In-app approval is added alongside it, not instead of it, until the campus formally accepts digital approval.

**audit_sessions**: `id, department_id, title (e.g. "Board of Survey 2026"), location_ids[], started_by, started_at, closed_at, status`

**audit_records**: `id, session_id, asset_item_id (nullable for unregistered finds), result (found / missing / found_elsewhere / unregistered), condition, observed_location_id, photo_id, note, scanned_at, scanned_by, device_id`

**movements**: `asset_item_id, from_location, to_location, moved_at, reason, approved_by`

**disposals**: `asset_item_id, reason, board_ref, disposed_at, approved_by`

**photos**: `id, owner_type, owner_id, storage_key, taken_at`

**activity_log**: `actor_id, action, table, row_id, before (json), after (json), at`. Cannot be edited.

---

## 5. Key features and screens (mobile-first)

### Design rules
- One hand, thumb reachable: main actions sit in a **bottom bar** and a **floating "+" button**.
- Large touch targets (at least 48 px), large text, high contrast (labs can be dim).
- Every screen works offline. A small badge shows **"3 changes waiting to sync"**.
- Numeric keypad for quantity and price, date picker defaulting to today.
- Light and dark mode.
- Optional later: Sinhala / Tamil labels.

### Bottom navigation
`Home` · `Ledger` · `Scan` (center, large) · `Audit` · `Reports`

### Screens

1. **Home / Dashboard**
   - Totals: items, total value (LKR), items needing repair, missing items
   - "Pending book entries" count, with one tap to print them
   - Continue last audit

2. **Ledger list**
   - Search by description, serial, ref no, brand, model
   - Filters: date range, category, location, book status, approval status
   - Cards on phone, table on desktop

3. **Add / edit entry** (form in the same order as the book)
   - Date → Ref No → Description → Brand → Model No → Quantity → Unit Price → *(Value computed automatically)* → Remark
   - **"Duplicate last entry"** for similar items in a row
   - **Autocomplete** for brand, model, and description from past entries
   - After saving: "Generate N item tags?" asks for serial numbers per unit (or scan the barcode on the device label)
   - Optional photo

4. **Scan** (camera opens immediately)
   - Scan QR tag → item card: description, serial, location, condition, last audit
   - Quick actions: **Mark verified**, **Change condition**, **Move location**, **Add photo**
   - Fallback: type the tag code or serial number by hand

5. **Audit mode** (the main daily-use feature)
   - Start session → choose location(s)
   - App shows the **expected items** for that location
   - Scan each item, and it ticks green ✅
   - Items scanned that belong elsewhere → flagged 🟡 "found elsewhere"
   - Items not tagged → "Add unregistered item" 🔵
   - Finish → summary: **Found / Missing / Elsewhere / Unregistered / Damaged**
   - Works fully offline. Syncs when you are back on Wi-Fi.

6. **Reports**: see section 6

7. **Approvals (HOD)**: list of submitted entries, approve or reject with comment

8. **Settings**: departments, locations, users, categories, tag prefix, backup and export

---

## 6. Reports and exports

All reports are available as **Excel (.xlsx)** and **PDF (A4)**, with the university or department header, date range, page numbers, "Generated on", and totals.

| Report | Contents | Use |
|---|---|---|
| **Ledger report** | Exact book columns: Date, Ref No, Description, Brand, Model No, Serial No, Qty, Unit Price, Value, Remark, HOD Signature (blank line) | Official copy, filing |
| **Pending book entries** | Same layout, only `pending_book` rows | **Copy straight into the book.** Then tap "Mark as written" and record the book page number. |
| **Audit / verification report** | Per location: found, missing, elsewhere, unregistered, condition, auditor, date | Annual verification / **Board of Survey** |
| **Missing & damaged items** | Item, last seen, last location, condition, photo | Follow-up and write-off |
| **Location inventory** | Everything in a given lab, with total value | Lab handover |
| **Category summary** | Count and value per category | Management |
| **QR tag sheet** | Printable QR labels on A4 sticker sheets (e.g. 3×8 or 4×10) | Tagging items |
| **Full backup** | Excel workbook with every table | Safety copy |

**Excel details:** frozen header row, column widths set, LKR number format (`#,##0.00`), a totals row with `SUM` formulas, auto-filter turned on.

**PDF details:** landscape A4 for ledger reports (11 columns), signature blocks at the end (*Prepared by: Technical Officer · Checked by · HOD*).

---

## 7. Offline and sync design

```
Phone (PWA)                                  Server
┌───────────────────────┐                ┌──────────────────┐
│ UI (React)            │                │ Next.js API      │
│   ↕                   │   when online  │   ↕              │
│ Dexie (IndexedDB)     │ ─── sync ────▶ │ PostgreSQL       │
│  - cached ledger      │ ◀── pull ───── │ MinIO/S3 photos  │
│  - outbox (changes)   │                └──────────────────┘
│  - photos (blobs)     │
└───────────────────────┘
```

- Every change is written to the local **outbox** first, then pushed to the server.
- Each record carries `client_id` (uuid made on the phone) and `updated_at`, so sending the same change twice does no harm.
- **Conflicts:** audit scans only add records and never clash. For entry edits, the newest change wins and the overwritten version is kept in `activity_log`, so nothing is lost.
- Before an audit, the app downloads that location's expected items to the phone.

---

## 8. Security and governance

- **Roles:** Technical Officer adds and edits. HOD approves. Viewer only reads. Admin manages users.
- **Nothing is hard-deleted.** Everything is soft-delete plus `activity_log` (who, what, when, before/after).
- Approved entries are **locked**. Changing one needs a new approval.
- HTTPS everywhere. Sessions expire.
- **Backups:** automated daily `pg_dump`, 30 days kept, plus a weekly Excel full export.
- Prices and asset data are internal. Nothing is public and every page needs login.

---

## 9. Moving the existing book into the system

The aim is to digitise the old ledger gradually, not all at once:

1. **Excel import template** with the book's exact columns plus `Book Volume`, `Book Page`, `Location`.
2. Type in old pages (or have student assistants help), then import. The app validates every row and shows errors before saving.
3. Each imported row stores **book volume and page**, so anyone can open the book and check it.
4. Start with **high-value and frequently audited items** (computers, lab equipment). Older and low-value items come later.
5. During the first audit, tag every item found with a QR sticker. That links the physical item to its record.

---

## 10. Project structure

```
development/
├── moratuwa_backend/                 Express 5 + Prisma API  (port 4000)
│   ├── prisma/
│   │   ├── schema.prisma             data model (§4)
│   │   ├── migrations/
│   │   └── seed.ts                   first admin + demo department
│   ├── src/
│   │   ├── server.ts / app.ts        HTTP server, middleware pipeline
│   │   ├── routes.ts                 /api/v1 router
│   │   ├── config/env.ts             validated configuration
│   │   ├── lib/                      prisma client, logger
│   │   ├── middlewares/              authenticate/authorize, security, errors
│   │   ├── modules/                  auth, ledger, items, dashboard, users, organisation
│   │   │   └── <feature>/            *.routes → *.controller → *.service (+ *.schema)
│   │   └── utils/                    passwords, tokens, cookies, scope, activity log
│   └── Dockerfile
│
└── moratuwa_frontend/                Next.js 16 + daisyUI  (port 3000)
    ├── docs/PLAN.md                  this file
    └── src/
        ├── proxy.ts                  page auth gate (silent session renew)
        ├── app/
        │   ├── login/
        │   ├── (app)/                signed-in area with bottom dock
        │   │   ├── page.tsx          dashboard
        │   │   ├── ledger/           list, new, [id] detail + workflow
        │   │   ├── items/[tag]/      item detail (scan target)
        │   │   ├── scan/  audit/  reports/
        │   ├── api/v1/auth/session/  refresh-and-redirect for page loads
        │   └── manifest.ts           PWA manifest
        ├── components/               dock, theme toggle, UI pieces
        └── lib/                      api-server (RSC), api-client (browser), types, format
```

Browser → `frontend:/api/v1/*` → (Next rewrite) → `backend:/api/v1/*`. The browser never talks to the API directly.

## 11. Roadmap

### Phase 1: MVP for personal use (≈ 4–5 weeks)
- [x] Week 1: Project setup, DB schema, auth, PWA shell, bottom navigation
- [x] Week 2: Ledger entry create/view (mobile form), search and filters, locations, HOD approval, "mark written in book"
- [ ] Week 2 (rest): edit entry screen, locations & users admin screens
- [ ] Week 3: Asset items, QR tag generation, camera scan, item detail
- [ ] Week 4: Excel and PDF exports (Ledger, Pending book entries, QR sheet)
- [ ] Week 5: Offline mode (Dexie + sync), photos, daily backup

**Done when:** I can add entries on my phone in a lab with no Wi-Fi, print a "pending book entries" sheet, and copy it into the book.

### Phase 2: Audit and pilot (≈ 3–4 weeks)
- [ ] Audit sessions and audit mode (expected vs. scanned)
- [ ] Audit / Board of Survey report (PDF and Excel)
- [ ] Movements, condition updates, missing & damaged report
- [ ] Excel import of old book pages
- [ ] Run one **real audit** of 1–2 labs fully through the app

**Done when:** one full lab audit is completed with the app and the printed report is accepted by the HOD.

### Phase 3: Campus proposal and rollout
- [ ] HOD approval workflow in the app
- [ ] Multiple departments, admin panel, role management
- [ ] Campus SSO login
- [ ] Docker deployment on a university server, plus a backup policy
- [ ] User guide (with screenshots) and a 30-minute training session
- [ ] `PROPOSAL.md` / presentation with real pilot numbers

### Later ideas
- OCR: photograph a device label to fill in serial and model automatically
- Warranty and service reminders, repair history
- Depreciation and book-value reports
- Lending / issue-return log for lab equipment
- Sinhala / Tamil interface

---

## 12. Campus proposal: key points (draft)

**Problem:** The manual ledger makes audits slow, has a single copy, is hard to search, and has no location or condition tracking.

**Solution:** A mobile web app that **keeps the familiar ledger format** and adds QR-based audits, instant Excel/PDF reports, and a full change history.

**Why it is low risk**
- **Runs alongside the book.** Nothing changes until the department is ready.
- Reports reproduce the **same ledger columns** staff already know.
- **No licence costs.** Open-source stack on existing campus servers.
- **Data stays on campus** (self-hosted PostgreSQL).
- Proven in a real pilot before the proposal (Phase 2 results).

**Evidence to collect during the pilot**
- Time to audit one lab: manual vs. app
- Number of discrepancies found (missing, misplaced, untagged)
- Time to produce the annual verification report
- Feedback from the HOD and other staff

**Ask:** Approval to pilot in one more department, a small VM on the campus server, and a supply of QR sticker labels.

---

## 13. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Staff prefer the book | Run both side by side. The app prints in book format. No forced change. |
| Poor connectivity in labs | Offline-first PWA |
| Data loss | Daily backups, soft deletes, activity log, Excel full export |
| QR stickers peel or fade | Use laminated / polyester labels. Serial no or tag code can still be typed by hand. |
| Only one developer (bus factor) | Standard stack, documentation, Docker deployment, readable code |
| Legal validity of digital approval | Keep HOD wet signature on printed reports until the campus formally approves |
| Price and asset data sensitivity | Login required, role-based access, campus hosting |

---

## 14. Next steps
1. Confirm the category list and location codes for the department.
2. Choose the tag code format (e.g. `UOM-<DEPT>-<YEAR>-<5-digit>`).
3. Buy a small roll of QR sticker labels for testing.
4. Start Phase 1, Week 1.
