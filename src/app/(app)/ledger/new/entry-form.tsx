"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api-client";
import { ENTRY_TYPES, entryTypeBadge, formatLKR, todayISO } from "@/lib/format";
import type { Category, Department, LedgerEntryDetail, LedgerEntryType, Location } from "@/lib/types";

// ─── Remembered values ──────────────────────────────────────────────────

/** Fields carried over from the last saved entry, so a run of similar rows is quick to type. */
interface Remembered {
  departmentId?: string;
  entryType?: LedgerEntryType;
  categoryId?: string;
  entryDate?: string;
  brand?: string;
  unitPrice?: string;
  remark?: string;
  locationId?: string;
}

const STORAGE_KEY = "labledger:last-entry";

function readRemembered(raw: string | null): Remembered {
  try {
    return raw ? (JSON.parse(raw) as Remembered) : {};
  } catch {
    return {};
  }
}

function saveRemembered(values: Remembered) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
  } catch {
    // Storage unavailable (private mode, quota): just don't remember.
  }
}

const noSubscribe = () => () => {};
const getStored = () => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

type EntryFormProps = {
  departments: Department[];
  locations: Location[];
  categories: Category[];
  /** From the URL (opened from a category ledger or type tab); wins over remembered values. */
  initialType?: LedgerEntryType;
  initialCategoryId?: string;
};

/**
 * Reads the remembered values (browser only) and mounts the form with them.
 * The server render has none; the form remounts once they are known.
 */
export function EntryForm(props: EntryFormProps) {
  const raw = useSyncExternalStore(noSubscribe, getStored, () => null);
  const saved = readRemembered(raw);
  const { departments, locations, categories } = props;

  // Drop remembered references that no longer exist (deactivated category, removed location…).
  const departmentId = departments.some((d) => d.id === saved.departmentId)
    ? saved.departmentId!
    : departments.length === 1
      ? departments[0]!.id
      : "";
  const defaults: Required<Remembered> = {
    departmentId,
    entryType: props.initialType ?? (ENTRY_TYPES.includes(saved.entryType!) ? saved.entryType! : "RECEIPT"),
    categoryId: props.initialCategoryId ?? (categories.some((c) => c.id === saved.categoryId) ? saved.categoryId! : ""),
    entryDate: saved.entryDate ?? todayISO(),
    brand: saved.brand ?? "",
    unitPrice: saved.unitPrice ?? "",
    remark: saved.remark ?? "",
    locationId: locations.some((l) => l.id === saved.locationId && (!l.departmentId || l.departmentId === departmentId))
      ? saved.locationId!
      : "",
  };

  return <EntryFormFields key={raw ?? "none"} {...props} defaults={defaults} />;
}

// ─── Form ───────────────────────────────────────────────────────────────

function EntryFormFields({
  departments,
  locations,
  categories,
  defaults,
}: EntryFormProps & { defaults: Required<Remembered> }) {
  const router = useRouter();
  const [departmentId, setDepartmentId] = useState(defaults.departmentId);
  const [entryType, setEntryType] = useState<LedgerEntryType>(defaults.entryType);
  const [categoryId, setCategoryId] = useState(defaults.categoryId);
  const [entryDate, setEntryDate] = useState(defaults.entryDate);
  const [brand, setBrand] = useState(defaults.brand);
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState(defaults.unitPrice);
  const [remark, setRemark] = useState(defaults.remark);
  const [locationId, setLocationId] = useState(defaults.locationId);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const value = (Number(quantity) || 0) * (Number(unitPrice) || 0);
  const isReceipt = entryType === "RECEIPT";
  const deptLocations = locations.filter((l) => !l.departmentId || l.departmentId === departmentId);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "").trim() || undefined;

    setPending(true);
    setErrors({});
    setFormError(null);
    try {
      const { data } = await api<{ data: LedgerEntryDetail }>("/ledger", {
        method: "POST",
        body: {
          departmentId: departmentId || undefined,
          entryType,
          categoryId: categoryId || undefined,
          entryDate: entryDate || undefined,
          ...(isReceipt
            ? { receiptNo: text("receiptNo"), sinNo: text("sinNo"), sinDate: text("sinDate") }
            : { refNo: text("refNo") }),
          description: text("description"),
          brand: brand.trim() || undefined,
          modelNo: text("modelNo"),
          serialNo: text("serialNo"),
          itemCode: text("itemCode"),
          quantity: Number(quantity),
          unitPrice,
          remark: remark.trim() || undefined,
          hodSigned: form.get("hodSigned") === "on",
          ...(isReceipt && {
            locationId: locationId || undefined,
            isBulk: form.get("isBulk") === "on",
            serialNos: String(form.get("serialNos") ?? "")
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean),
          }),
        },
      });
      saveRemembered({ departmentId, entryType, categoryId, entryDate, brand, unitPrice, remark, locationId });
      router.replace(`/ledger/${data.id}`);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors);
        setFormError(err.message);
      } else {
        setFormError("Could not reach the server. Check your connection.");
      }
      setPending(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {formError && (
        <div role="alert" className="alert alert-error alert-soft">
          {formError}
        </div>
      )}

      {departments.length > 1 && (
        <Section title="Department">
          <Select
            label="Department"
            value={departmentId}
            onChange={(id) => {
              setDepartmentId(id);
              setLocationId(""); // locations belong to a department
            }}
            error={errors.departmentId}
            options={departments.map((d) => ({ value: d.id, label: `${d.code} — ${d.name}` }))}
            required
          />
        </Section>
      )}

      <Section title="Entry type & category">
        <div role="radiogroup" aria-label="Entry type" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ENTRY_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={entryType === type}
              onClick={() => setEntryType(type)}
              className={`btn ${entryType === type ? "btn-secondary" : "btn-outline border-base-300"}`}
            >
              {entryTypeBadge[type].label}
            </button>
          ))}
        </div>
        <Select
          label="Category"
          value={categoryId}
          onChange={setCategoryId}
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
          error={errors.categoryId}
          required
        />
      </Section>

      <Section title="Ledger details">
        {isReceipt ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Input label="No" name="receiptNo" placeholder="Receipt no." error={errors.receiptNo} />
              <Input
                label="Date"
                name="entryDate"
                type="date"
                value={entryDate}
                onChange={setEntryDate}
                error={errors.entryDate}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="SIN No" name="sinNo" placeholder="Store Issue Note" error={errors.sinNo} />
              <Input label="SIN date" name="sinDate" type="date" error={errors.sinDate} />
            </div>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Date"
              name="entryDate"
              type="date"
              value={entryDate}
              onChange={setEntryDate}
              error={errors.entryDate}
              required
            />
            <Input label="Ref. No" name="refNo" placeholder="Transfer / BOS ref." error={errors.refNo} />
          </div>
        )}
        <Input
          label="Description"
          name="description"
          placeholder="e.g. Digital multimeter"
          error={errors.description}
          required
        />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Brand" name="brand" value={brand} onChange={setBrand} error={errors.brand} />
          <Input label="Model No" name="modelNo" error={errors.modelNo} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Serial No" name="serialNo" error={errors.serialNo} />
          <Input label="Item code" name="itemCode" error={errors.itemCode} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Quantity"
            name="quantity"
            type="number"
            inputMode="numeric"
            min={1}
            value={quantity}
            onChange={setQuantity}
            error={errors.quantity}
            required
          />
          <Input
            label="Unit price (LKR)"
            name="unitPrice"
            inputMode="decimal"
            placeholder="0.00"
            value={unitPrice}
            onChange={setUnitPrice}
            error={errors.unitPrice}
            required
          />
        </div>
        <div className="flex items-center justify-between rounded-box bg-secondary px-4 py-3 text-secondary-content">
          <span className="text-sm opacity-80">Value</span>
          <span className="text-xl font-bold">{formatLKR(value)}</span>
        </div>
        <Textarea
          label="Remark"
          name="remark"
          rows={2}
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          error={errors.remark}
        />
        <label className="flex cursor-pointer items-center gap-3 py-1">
          <input type="checkbox" name="hodSigned" className="checkbox checkbox-primary" />
          <span className="font-medium">Signed by HOD in the book</span>
        </label>
      </Section>

      {isReceipt && (
        <Section title="Items & location">
          <Select
            label="Location"
            value={locationId}
            onChange={setLocationId}
            options={deptLocations.map((l) => ({ value: l.id, label: `${l.code} — ${l.name}` }))}
            error={errors.locationId}
          />
          <Textarea
            label="Serial numbers per tag"
            hint="One per line, in order, for the QR-tagged items. Leave blank if none."
            name="serialNos"
            rows={3}
            error={errors.serialNos}
            className="font-mono"
          />
          <label className="flex cursor-pointer items-start gap-3 py-1">
            <input type="checkbox" name="isBulk" className="checkbox checkbox-primary mt-0.5" />
            <span>
              <span className="font-medium">Bulk / consumable</span>
              <span className="block text-sm text-base-content/60">One tag for the whole quantity instead of one per unit</span>
            </span>
          </label>
        </Section>
      )}

      <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 -mx-4 bg-base-200/90 px-4 py-3 backdrop-blur">
        <button type="submit" className="btn btn-primary btn-lg w-full" disabled={pending}>
          {pending && <span className="loading loading-spinner" />}
          Save entry
        </button>
      </div>
    </form>
  );
}

// ─── Form controls ──────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3 rounded-box border border-base-300 bg-base-100 p-4">
      <legend className="px-1 text-sm font-semibold text-base-content/70">{title}</legend>
      {children}
    </fieldset>
  );
}

function FieldShell({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-sm font-medium">
        {label}
        {required && <span className="text-error"> *</span>}
      </span>
      {children}
      {error ? (
        <span className="text-sm text-error">{error}</span>
      ) : (
        hint && <span className="text-xs text-base-content/60">{hint}</span>
      )}
    </label>
  );
}

type InputProps = {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  value?: string;
  onChange?: (value: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">;

function Input({ label, error, hint, required, value, onChange, ...rest }: InputProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} required={required}>
      <input
        {...rest}
        required={required}
        {...(onChange ? { value, onChange: (e) => onChange(e.target.value) } : {})}
        aria-invalid={Boolean(error)}
        className={`input w-full ${error ? "input-error" : ""}`}
      />
    </FieldShell>
  );
}

function Textarea({
  label,
  error,
  hint,
  className = "",
  ...rest
}: { label: string; error?: string; hint?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FieldShell label={label} hint={hint} error={error}>
      <textarea {...rest} aria-invalid={Boolean(error)} className={`textarea w-full ${error ? "textarea-error" : ""} ${className}`} />
    </FieldShell>
  );
}

function Select({
  label,
  name,
  options,
  error,
  required,
  value,
  onChange,
}: {
  label: string;
  name?: string;
  options: { value: string; label: string }[];
  error?: string;
  required?: boolean;
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <FieldShell label={label} error={error} required={required}>
      <select
        name={name}
        required={required}
        {...(onChange ? { value, onChange: (e) => onChange(e.target.value) } : { defaultValue: "" })}
        className={`select w-full ${error ? "select-error" : ""}`}
      >
        <option value="">— Select —</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}
