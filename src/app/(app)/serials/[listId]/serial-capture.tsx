"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent } from "react";
import { BarcodeIcon, CameraIcon, DownloadIcon, FileIcon, PlusIcon, SearchIcon, SettingsIcon, XIcon } from "@/components/icons";
import { beep } from "@/components/camera/detector";
import { hasCamera } from "@/components/camera/use-camera";
import { Sheet } from "@/components/sheet";
import { PageHeader } from "@/components/ui";
import { api } from "@/lib/api-client";
import type { SerialListDetail, SerialUnit } from "@/lib/types";
import { newId, useAction } from "@/lib/use-action";
import { CameraScanner } from "./camera-scanner";

const KINDS = ["Monitor", "CPU", "Keyboard", "Mouse", "UPS", "Laptop", "Printer", "Projector"];
const BRANDS = ["Dell", "HP", "Lenovo", "Acer", "Asus", "Samsung", "LG", "ViewSonic", "AOC", "Philips", "APC", "Logitech", "Epson", "Canon"];
const PRESETS = [
  { label: "PC set", kinds: ["Monitor", "CPU"] },
  { label: "PC + keyboard & mouse", kinds: ["Monitor", "CPU", "Keyboard", "Mouse"] },
  { label: "Single item", kinds: ["Monitor"] },
];

type Part = { key: string; kind: string; serialNo: string; brand: string; model: string; productCode: string };

const blankPart = (kind: string, brand = "", model = "", productCode = ""): Part => ({ key: newId(), kind, serialNo: "", brand, model, productCode });

/** Next unit takes the last one's parts (type, brand, model, product code) with empty serials. */
const templateFrom = (unit: SerialUnit | undefined): Part[] =>
  unit ? unit.components.map((c) => blankPart(c.kind, c.brand ?? "", c.model ?? "", c.productCode ?? "")) : PRESETS[0]!.kinds.map((k) => blankPart(k));

/** "PC 07" → "PC 08", keeping the zero padding. */
function nextLabel(label: string | null | undefined) {
  if (!label) return "PC 01";
  const m = /^(.*?)(\d+)$/.exec(label);
  if (!m) return "";
  const n = String(Number(m[2]) + 1).padStart(m[2]!.length, "0");
  return `${m[1]}${n}`;
}

const noopSubscribe = () => () => {};

export function SerialCapture({ list, canEdit, aiReader }: { list: SerialListDetail; canEdit: boolean; aiReader: boolean }) {
  const router = useRouter();
  const pdf = `/api/v1/serial-lists/${list.id}/report.pdf`;

  const [units, setUnits] = useState(list.units);
  const [editing, setEditing] = useState<string | null>(null);
  const [productNumber, setProductNumber] = useState("");
  const [label, setLabel] = useState(() => nextLabel(list.units.at(-1)?.label));
  const [parts, setParts] = useState<Part[]>(() => templateFrom(list.units.at(-1)));
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const [flash, setFlash] = useState<string | null>(null);
  const [sound, setSound] = useState(true);
  const [query, setQuery] = useState("");
  const [camera, setCamera] = useState<string | null>(null); // "product" or a part key
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { pending, error, fieldErrors, run, setError } = useAction();
  const cameraSupported = useSyncExternalStore(noopSubscribe, hasCamera, () => false);

  const productRef = useRef<HTMLInputElement>(null);
  const serialRefs = useRef(new Map<string, HTMLInputElement>());

  useEffect(() => {
    if (canEdit) productRef.current?.focus();
  }, [canEdit]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 2500);
    return () => clearTimeout(t);
  }, [flash]);

  const brandOptions = [...new Set([...units.flatMap((u) => u.components.map((c) => c.brand).filter((b): b is string => Boolean(b))), ...BRANDS])];
  const partCount = units.reduce((n, u) => n + u.components.length, 0);

  // Serial numbers already saved in this list (except the unit being edited).
  const taken = new Map<string, string>();
  for (const u of units) {
    if (u.id === editing) continue;
    for (const c of u.components) taken.set(c.serialNo.toUpperCase(), `${c.kind} of ${u.label ?? u.productNumber}`);
  }

  const errorFor = (path: string) => localErrors[path] ?? fieldErrors[path];

  function checkSerial(index: number, value: string) {
    const path = `components.${index}.serialNo`;
    const key = value.trim().toUpperCase();
    const other = parts.findIndex((p, i) => i !== index && p.serialNo.trim().toUpperCase() === key);
    const message = !key ? null : taken.has(key) ? `Already in this list: ${taken.get(key)}` : other >= 0 ? `Same serial as part ${other + 1}` : null;
    setLocalErrors((e) => {
      const rest = { ...e };
      delete rest[path];
      return message ? { ...rest, [path]: message } : rest;
    });
    if (message && sound) beep(false);
    return !message;
  }

  function updatePart(key: string, patch: Partial<Part>) {
    setParts((ps) => ps.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }

  function focusSerial(index: number) {
    const part = parts[index];
    const el = part && serialRefs.current.get(part.key);
    if (el) {
      el.focus();
      el.select();
    }
  }

  // Barcode readers "type" the code and press Enter: move to the next field, save after the last one.
  function onProductKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (productNumber.trim()) focusSerial(0);
  }

  // Optional field, so it is not part of the scan chain; Enter in it moves on to the next serial, or saves.
  function onCodeKey(e: KeyboardEvent<HTMLInputElement>, index: number) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (index < parts.length - 1) focusSerial(index + 1);
    else void save();
  }

  function onSerialKey(e: KeyboardEvent<HTMLInputElement>, index: number) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const value = parts[index]!.serialNo;
    if (!value.trim() || !checkSerial(index, value)) return;
    if (index < parts.length - 1) focusSerial(index + 1);
    else void save();
  }

  function reset(template: Part[], nextLbl: string) {
    setEditing(null);
    setProductNumber("");
    setLabel(nextLbl);
    setParts(template);
    setLocalErrors({});
    setError(null);
    requestAnimationFrame(() => productRef.current?.focus());
  }

  async function save(event?: FormEvent) {
    event?.preventDefault();
    // Re-check every serial now: the state from the last blur may be stale.
    if (!parts.map((p, i) => !p.serialNo.trim() || checkSerial(i, p.serialNo)).every(Boolean)) return;
    const body = {
      productNumber,
      label,
      // The first part's product number is the unit's own; only the other parts keep an optional code.
      components: parts.map(({ kind, serialNo, brand, model, productCode }, i) => ({ kind, serialNo, brand, model, productCode: i === 0 ? null : productCode })),
    };
    const saved = await run(() =>
      editing
        ? api<{ data: SerialUnit }>(`/serial-lists/${list.id}/units/${editing}`, { method: "PATCH", body })
        : api<{ data: SerialUnit }>(`/serial-lists/${list.id}/units`, { method: "POST", body }),
    );
    if (!saved) {
      if (sound) beep(false);
      return;
    }
    const unit = saved.data;
    const next = editing ? units.map((u) => (u.id === unit.id ? unit : u)) : [...units, unit];
    setUnits(next);
    if (sound) beep(true);
    setFlash(`${editing ? "Updated" : "Saved"} ${unit.label ?? unit.productNumber} · ${unit.components.length} serial${unit.components.length === 1 ? "" : "s"}`);
    const last = next.at(-1);
    reset(templateFrom(editing ? last : unit), nextLabel(last?.label));
  }

  function startEdit(unit: SerialUnit) {
    setEditing(unit.id);
    setProductNumber(unit.productNumber);
    setLabel(unit.label ?? "");
    setParts(
      unit.components.map((c) => ({ key: newId(), kind: c.kind, serialNo: c.serialNo, brand: c.brand ?? "", model: c.model ?? "", productCode: c.productCode ?? "" })),
    );
    setLocalErrors({});
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
    requestAnimationFrame(() => productRef.current?.focus());
  }

  async function removeUnit(unit: SerialUnit) {
    const done = await run(async () => {
      await api(`/serial-lists/${list.id}/units/${unit.id}`, { method: "DELETE" });
      return true;
    });
    if (!done) return;
    const next = units.filter((u) => u.id !== unit.id);
    setUnits(next);
    if (editing === unit.id) reset(templateFrom(next.at(-1)), nextLabel(next.at(-1)?.label));
    setFlash(`Removed ${unit.label ?? unit.productNumber}`);
  }

  function onCameraCode(code: string) {
    const target = camera;
    setCamera(null);
    if (sound) beep(true);
    if (target === "product") {
      setProductNumber(code);
      requestAnimationFrame(() => focusSerial(0));
      return;
    }
    if (target?.startsWith("code:")) {
      const index = parts.findIndex((p) => `code:${p.key}` === target);
      if (index < 0) return;
      updatePart(parts[index]!.key, { productCode: code });
      if (index < parts.length - 1) requestAnimationFrame(() => focusSerial(index + 1));
      return;
    }
    const index = parts.findIndex((p) => p.key === target);
    if (index < 0) return;
    updatePart(parts[index]!.key, { serialNo: code });
    if (checkSerial(index, code) && index < parts.length - 1) requestAnimationFrame(() => focusSerial(index + 1));
  }

  const q = query.trim().toUpperCase();
  const visible = q
    ? units.filter((u) =>
        [u.productNumber, u.label ?? "", ...u.components.flatMap((c) => [c.serialNo, c.brand ?? "", c.model ?? "", c.productCode ?? "", c.kind])].some((v) => v.toUpperCase().includes(q)),
      )
    : units;

  return (
    <>
      <PageHeader
        title={list.title}
        subtitle={[list.location, `${units.length} unit${units.length === 1 ? "" : "s"} · ${partCount} serial${partCount === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
        backHref="/serials"
        action={
          <div className="flex gap-2">
            {canEdit && (
              <button type="button" className="btn btn-ghost btn-circle" onClick={() => setDetailsOpen(true)} aria-label="List details">
                <SettingsIcon className="size-5" />
              </button>
            )}
            <a href={`${pdf}?inline=1`} target="_blank" rel="noopener" className="btn btn-outline hidden sm:inline-flex">
              <FileIcon className="size-4" /> View PDF
            </a>
            <a href={pdf} download className="btn btn-primary">
              <DownloadIcon className="size-4" /> PDF
            </a>
          </div>
        }
      />

      <div className={`grid gap-4 lg:items-start lg:gap-6 ${canEdit ? "lg:grid-cols-[26rem_minmax(0,1fr)]" : ""}`}>
        {canEdit && (
          <form onSubmit={save} className="flex flex-col gap-3 rounded-box border-2 border-primary bg-base-100 p-4 lg:sticky lg:top-8" noValidate>
            <div className="flex items-center gap-2">
              <BarcodeIcon className="size-5" />
              <p className="flex-1 font-semibold">{editing ? "Edit unit" : "Scan next unit"}</p>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-base-content/70">
                <input type="checkbox" className="toggle toggle-xs" checked={sound} onChange={(e) => setSound(e.target.checked)} />
                Sound
              </label>
            </div>

            {flash && (
              <div role="status" className="alert alert-success alert-soft py-2 text-sm">
                {flash}
              </div>
            )}
            {error && (
              <div role="alert" className="alert alert-error alert-soft py-2 text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
              <ScanField
                label="Product number"
                inputRef={productRef}
                value={productNumber}
                onChange={setProductNumber}
                onKeyDown={onProductKey}
                error={errorFor("productNumber")}
                onCamera={cameraSupported ? () => setCamera("product") : undefined}
                placeholder="Scan or type"
                hint={`From the ${parts[0]?.kind || "first part"}'s label; identifies the whole set`}
              />
              <label className="flex min-w-0 flex-col gap-1">
                <span className="text-sm font-medium">Label</span>
                <input value={label} onChange={(e) => setLabel(e.target.value)} className="input w-full" placeholder="PC 01" />
              </label>
            </div>

            <div className="flex flex-col gap-2">
              {parts.map((part, i) => (
                <fieldset key={part.key} className="rounded-box border border-base-300 p-3">
                  <legend className="px-1 text-xs font-semibold text-base-content/60">Part {i + 1}</legend>
                  <div className="mb-2 flex items-center gap-2">
                    <input
                      list="serial-kinds"
                      value={part.kind}
                      onChange={(e) => updatePart(part.key, { kind: e.target.value })}
                      aria-label={`Part ${i + 1} type`}
                      className="input input-sm w-full font-semibold"
                      placeholder="Monitor, CPU…"
                    />
                    {parts.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm btn-square"
                        onClick={() => setParts((ps) => ps.filter((p) => p.key !== part.key))}
                        aria-label={`Remove part ${i + 1}`}
                      >
                        <XIcon className="size-4" />
                      </button>
                    )}
                  </div>
                  <ScanField
                    label="Serial number"
                    inputRef={(el) => {
                      if (el) serialRefs.current.set(part.key, el);
                      else serialRefs.current.delete(part.key);
                    }}
                    value={part.serialNo}
                    onChange={(v) => updatePart(part.key, { serialNo: v })}
                    onKeyDown={(e) => onSerialKey(e, i)}
                    onBlur={() => part.serialNo && checkSerial(i, part.serialNo)}
                    error={errorFor(`components.${i}.serialNo`)}
                    onCamera={cameraSupported ? () => setCamera(part.key) : undefined}
                    placeholder={`Scan ${part.kind || "part"} serial`}
                  />
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <input
                      list="serial-brands"
                      value={part.brand}
                      onChange={(e) => updatePart(part.key, { brand: e.target.value })}
                      aria-label={`Part ${i + 1} brand`}
                      placeholder="Brand"
                      className="input input-sm w-full"
                    />
                    <input
                      value={part.model}
                      onChange={(e) => updatePart(part.key, { model: e.target.value })}
                      aria-label={`Part ${i + 1} model`}
                      placeholder="Model (optional)"
                      className="input input-sm w-full"
                    />
                  </div>
                  {i > 0 && (
                    <div className="mt-2">
                      <ScanField
                        label={`${part.kind || "Part"} product code`}
                        optional
                        size="sm"
                        value={part.productCode}
                        onChange={(v) => updatePart(part.key, { productCode: v })}
                        onKeyDown={(e) => onCodeKey(e, i)}
                        error={errorFor(`components.${i}.productCode`)}
                        onCamera={cameraSupported ? () => setCamera(`code:${part.key}`) : undefined}
                        placeholder="Scan or type (optional)"
                      />
                    </div>
                  )}
                </fieldset>
              ))}
            </div>

            <div className="flex flex-wrap gap-1">
              {KINDS.map((kind) => (
                <button key={kind} type="button" className="btn btn-xs btn-outline border-base-300" onClick={() => setParts((ps) => [...ps, blankPart(kind)])}>
                  <PlusIcon className="size-3" />
                  {kind}
                </button>
              ))}
            </div>
            {!editing && (
              <div className="flex flex-wrap items-center gap-1 text-xs text-base-content/60">
                Preset:
                {PRESETS.map((p) => (
                  <button key={p.label} type="button" className="btn btn-ghost btn-xs" onClick={() => setParts(p.kinds.map((k) => blankPart(k)))}>
                    {p.label}
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              {editing && (
                <button type="button" className="btn btn-ghost" onClick={() => reset(templateFrom(units.at(-1)), nextLabel(units.at(-1)?.label))}>
                  Cancel
                </button>
              )}
              <button type="submit" className="btn btn-primary flex-1" disabled={pending}>
                {pending && <span className="loading loading-spinner" />}
                {editing ? "Save changes" : "Save unit"}
                <kbd className="kbd kbd-sm hidden border-primary-content/20 bg-primary-content/10 sm:inline">Enter</kbd>
              </button>
            </div>
            <p className="text-xs text-base-content/60">
              Scan the product number, then each serial. The reader’s Enter moves to the next field and saves after the last one. Type, brand and model carry over
              to the next unit.
            </p>

            <datalist id="serial-kinds">
              {KINDS.map((k) => (
                <option key={k} value={k} />
              ))}
            </datalist>
            <datalist id="serial-brands">
              {brandOptions.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </form>
        )}

        <section className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2 className="flex-1 font-semibold">
              Captured units <span className="font-normal text-base-content/60">({units.length})</span>
            </h2>
            {units.length > 0 && (
              <label className="input input-sm w-48 sm:w-64">
                <SearchIcon className="size-4 opacity-50" />
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find serial, brand…" className="grow" />
              </label>
            )}
          </div>

          {units.length === 0 ? (
            <div className="rounded-box border border-dashed border-base-300 bg-base-100 p-8 text-center text-sm text-base-content/70">
              {canEdit ? "Nothing scanned yet. Scan the first product number to begin." : "Nothing has been captured in this list yet."}
            </div>
          ) : visible.length === 0 ? (
            <p className="text-sm text-base-content/60">No unit matches “{query}”.</p>
          ) : (
            <>
              <ul className="flex flex-col gap-2 lg:hidden">
                {visible.map((unit) => (
                  <li key={unit.id} className={`rounded-box border bg-base-100 p-3 ${editing === unit.id ? "border-primary" : "border-base-300"}`}>
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{unit.label ?? "—"}</p>
                        <p className="font-mono text-sm break-all">{unit.productNumber}</p>
                      </div>
                      {canEdit && <UnitActions unit={unit} onEdit={() => startEdit(unit)} onRemove={() => removeUnit(unit)} />}
                    </div>
                    <ul className="mt-2 flex flex-col gap-1 border-t border-base-200 pt-2 text-sm">
                      {unit.components.map((c) => (
                        <li key={c.id} className="flex gap-2">
                          <span className="w-20 shrink-0 text-base-content/60">{c.kind}</span>
                          <span className="min-w-0 flex-1 font-mono font-semibold break-all">{c.serialNo}</span>
                          <span className="text-right text-base-content/70">
                            {[c.brand, c.model].filter(Boolean).join(" ")}
                            {c.productCode && <span className="block font-mono text-xs">Code {c.productCode}</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>

              <div className="hidden overflow-x-auto rounded-box border border-base-300 bg-base-100 lg:block">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Label</th>
                      <th>Product number</th>
                      <th>Part</th>
                      <th>Serial number</th>
                      <th>Brand / model</th>
                      {canEdit && <th className="w-0" />}
                    </tr>
                  </thead>
                  {visible.map((unit) => (
                    <tbody key={unit.id} className={`border-b border-base-300 last:border-0 ${editing === unit.id ? "bg-primary/10" : ""}`}>
                      {unit.components.map((c, j) => (
                        <tr key={c.id} className="border-0">
                          {j === 0 && (
                            <>
                              <td rowSpan={unit.components.length} className="align-top font-semibold">
                                {unit.label ?? "—"}
                              </td>
                              <td rowSpan={unit.components.length} className="align-top font-mono">
                                {unit.productNumber}
                              </td>
                            </>
                          )}
                          <td className="text-base-content/70">{c.kind}</td>
                          <td className="font-mono font-semibold">{c.serialNo}</td>
                          <td>
                            {[c.brand, c.model].filter(Boolean).join(" · ") || "—"}
                            {c.productCode && <span className="block font-mono text-xs text-base-content/60">Product code {c.productCode}</span>}
                          </td>
                          {canEdit && j === 0 && (
                            <td rowSpan={unit.components.length} className="align-top">
                              <UnitActions unit={unit} onEdit={() => startEdit(unit)} onRemove={() => removeUnit(unit)} />
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  ))}
                </table>
              </div>
            </>
          )}
        </section>
      </div>

      {canEdit && (
        <ListDetails
          list={list}
          open={detailsOpen}
          onClose={() => setDetailsOpen(false)}
          onSaved={() => {
            setDetailsOpen(false);
            router.refresh();
          }}
          onDeleted={() => router.replace("/serials")}
        />
      )}

      <Sheet open={camera !== null} onClose={() => setCamera(null)} title="Scan with camera" subtitle="Barcode, or read the printed serial">
        <CameraScanner
          onCode={onCameraCode}
          ai={aiReader}
          field={camera === "product" || camera?.startsWith("code:") ? "product" : "serial"}
          kind={parts.find((p) => p.key === camera || `code:${p.key}` === camera)?.kind || undefined}
        />
      </Sheet>
    </>
  );
}

function ScanField({
  label,
  value,
  onChange,
  onKeyDown,
  onBlur,
  onCamera,
  error,
  hint,
  placeholder,
  inputRef,
  optional = false,
  size = "md",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  onCamera?: () => void;
  error?: string;
  hint?: string;
  placeholder?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  optional?: boolean;
  size?: "sm" | "md";
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className={size === "sm" ? "text-xs font-medium text-base-content/70" : "text-sm font-medium"}>
        {label} {optional ? <span className="font-normal text-base-content/50">(optional)</span> : <span className="text-error">*</span>}
      </span>
      <span className="flex gap-1">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
          onFocus={(e) => e.target.select()}
          placeholder={placeholder}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-invalid={Boolean(error)}
          className={`input w-full font-mono ${size === "sm" ? "input-sm" : ""} ${error ? "input-error" : ""}`}
        />
        {onCamera && (
          <button type="button" className={`btn btn-square btn-outline border-base-300 ${size === "sm" ? "btn-sm" : ""}`} onClick={onCamera} aria-label={`Scan ${label.toLowerCase()} with camera`}>
            <CameraIcon className="size-5" />
          </button>
        )}
      </span>
      {error ? <span className="text-sm text-error">{error}</span> : hint && <span className="text-xs text-base-content/60">{hint}</span>}
    </label>
  );
}

/** Edit, and a two-tap delete (the first tap arms it for 3 seconds). */
function UnitActions({ unit, onEdit, onRemove }: { unit: SerialUnit; onEdit: () => void; onRemove: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <span className="flex gap-1">
      <button type="button" className="btn btn-ghost btn-xs" onClick={onEdit} aria-label={`Edit ${unit.label ?? unit.productNumber}`}>
        Edit
      </button>
      <button
        type="button"
        className={`btn btn-xs ${armed ? "btn-error" : "btn-ghost text-error"}`}
        onClick={() => {
          if (armed) {
            setArmed(false);
            onRemove();
          } else setArmed(true);
        }}
      >
        {armed ? "Confirm" : "Delete"}
      </button>
    </span>
  );
}

function ListDetails({
  list,
  open,
  onClose,
  onSaved,
  onDeleted,
}: {
  list: SerialListDetail;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const { pending, error, fieldErrors, run } = useAction();
  const [confirmDelete, setConfirmDelete] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const saved = await run(() =>
      api(`/serial-lists/${list.id}`, { method: "PATCH", body: {
          title: form.get("title"),
          location: form.get("location"),
          notes: form.get("notes"),
          checkedByName: form.get("checkedByName"),
          checkedByDesignation: form.get("checkedByDesignation"),
        },
      }),
    );
    if (saved) onSaved();
  }

  async function onDelete() {
    const done = await run(async () => {
      await api(`/serial-lists/${list.id}`, { method: "DELETE" });
      return true;
    });
    if (done) onDeleted();
  }

  return (
    <Sheet open={open} onClose={onClose} title="List details">
      <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
        {error && (
          <div role="alert" className="alert alert-error alert-soft text-sm">
            {error}
          </div>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Name</span>
          <input name="title" defaultValue={list.title} className={`input w-full ${fieldErrors.title ? "input-error" : ""}`} />
          {fieldErrors.title && <span className="text-sm text-error">{fieldErrors.title}</span>}
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Location</span>
          <input name="location" defaultValue={list.location ?? ""} className="input w-full" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Notes</span>
          <textarea name="notes" defaultValue={list.notes ?? ""} rows={3} className="textarea w-full" />
        </label>
          <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-2">
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-sm font-medium">Checked by</span>
              <input name="checkedByName" defaultValue={list.checkedByName ?? ""} placeholder="Name" className="input w-full" />
            </label>
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-sm font-medium">Designation</span>
              <input name="checkedByDesignation" defaultValue={list.checkedByDesignation ?? ""} placeholder="e.g. Technical Officer" className="input w-full" />
            </label>
          </div>

        <p className="-mt-1 text-xs text-base-content/60">Printed on the PDF’s “Checked by” signature line.</p>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending && <span className="loading loading-spinner" />}
          Save
        </button>
      </form>

      <div className="mt-6 flex flex-col gap-2 rounded-box border border-error/40 p-3">
        <p className="text-sm font-semibold text-error">Delete this list</p>
        <p className="text-xs text-base-content/70">
          Type <b>{list.title}</b> to confirm. Only this serial list is removed; the ledger and audits are not affected.
        </p>
        <input value={confirmDelete} onChange={(e) => setConfirmDelete(e.target.value)} className="input input-sm w-full" aria-label="Type the list name to confirm" />
        <button type="button" className="btn btn-error btn-sm" disabled={pending || confirmDelete.trim() !== list.title} onClick={onDelete}>
          Delete list
        </button>
      </div>
    </Sheet>
  );
}
