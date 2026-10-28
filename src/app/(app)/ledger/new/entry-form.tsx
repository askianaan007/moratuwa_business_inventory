"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api-client";
import { formatLKR, todayISO } from "@/lib/format";
import type { Department, LedgerEntryDetail, Location } from "@/lib/types";

const CATEGORIES = ["Computer & IT", "Lab equipment", "Measuring instrument", "Tool", "Furniture", "Consumable", "Other"];

export function EntryForm({ departments, locations }: { departments: Department[]; locations: Location[] }) {
  const router = useRouter();
  const [departmentId, setDepartmentId] = useState(departments.length === 1 ? departments[0]!.id : "");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const value = (Number(quantity) || 0) * (Number(unitPrice) || 0);
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
          entryDate: text("entryDate"),
          refNo: text("refNo"),
          description: text("description"),
          brand: text("brand"),
          modelNo: text("modelNo"),
          quantity: Number(quantity),
          unitPrice,
          remark: text("remark"),
          category: text("category"),
          locationId: text("locationId"),
          isBulk: form.get("isBulk") === "on",
          serialNos: String(form.get("serialNos") ?? "")
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
        },
      });
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
            onChange={setDepartmentId}
            error={errors.departmentId}
            options={departments.map((d) => ({ value: d.id, label: `${d.code} — ${d.name}` }))}
            required
          />
        </Section>
      )}

      <Section title="Ledger details">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Date" name="entryDate" type="date" defaultValue={todayISO()} error={errors.entryDate} required />
          <Input label="Ref. No" name="refNo" placeholder="GRN / PO no." error={errors.refNo} />
        </div>
        <Input
          label="Description"
          name="description"
          placeholder="e.g. Digital multimeter"
          error={errors.description}
          required
        />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Brand" name="brand" error={errors.brand} />
          <Input label="Model No" name="modelNo" error={errors.modelNo} />
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
        <Textarea label="Remark" name="remark" rows={2} error={errors.remark} />
      </Section>

      <Section title="Items & location">
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Category"
            name="category"
            options={CATEGORIES.map((c) => ({ value: c, label: c }))}
            error={errors.category}
          />
          <Select
            label="Location"
            name="locationId"
            options={deptLocations.map((l) => ({ value: l.id, label: `${l.code} — ${l.name}` }))}
            error={errors.locationId}
          />
        </div>
        <Textarea
          label="Serial numbers"
          hint="One per line, in order. Leave blank if none."
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
