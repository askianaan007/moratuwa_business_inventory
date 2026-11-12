"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PlusIcon, SearchIcon } from "@/components/icons";
import { Sheet } from "@/components/sheet";
import { Badge } from "@/components/ui";
import { api } from "@/lib/api-client";
import { TRANSFER_TYPES, type InventoryAsset, type TransferType } from "@/lib/inventory";
import { useAction } from "@/lib/use-action";

/** Archive an empty room (HOD/Admin). The API refuses while anything is still in it. */
export function ArchiveRoom({ room }: { room: { id: string; code: string } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { pending, error, run } = useAction();

  async function archive() {
    const ok = await run(async () => {
      await api(`/inventory/rooms/${room.id}`, { method: "DELETE" });
      return true;
    });
    if (ok) {
      setOpen(false);
      router.replace("/inventory/rooms");
      router.refresh();
    }
  }

  return (
    <>
      <button type="button" className="btn btn-ghost btn-sm text-error" onClick={() => setOpen(true)}>
        Archive
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={`Archive ${room.code}?`}>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-base-content/70">The room disappears from lists but its transfer and audit history is kept. Only empty rooms can be archived.</p>
          {error && <div className="alert alert-error alert-soft text-sm">{error}</div>}
          <button type="button" className="btn btn-error" disabled={pending} onClick={() => void archive()}>
            {pending && <span className="loading loading-spinner loading-sm" />}
            Archive room
          </button>
        </div>
      </Sheet>
    </>
  );
}

/** Find assets that are registered elsewhere (or nowhere) and transfer them into this room. */
export function BringAssets({ room }: { room: { id: string; code: string; departmentId: string } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<InventoryAsset[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const search = useAction();
  const save = useAction();

  async function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = String(new FormData(event.currentTarget).get("q") ?? "").trim();
    if (q.length < 2) return search.setError("Type at least 2 characters");
    const res = await search.run(() => api<{ data: InventoryAsset[] }>(`/inventory/assets?pageSize=30&departmentId=${room.departmentId}&q=${encodeURIComponent(q)}`));
    if (res) setResults(res.data.filter((a) => a.location?.id !== room.id));
  }

  async function onTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const res = await save.run(() =>
      api("/inventory/transfers", { method: "POST", body: { ids: [...picked], toLocationId: room.id, type: form.get("type"), reason: String(form.get("reason") ?? "").trim() } }),
    );
    if (res) {
      setOpen(false);
      setResults(null);
      setPicked(new Set());
      router.refresh();
    }
  }

  return (
    <>
      <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(true)}>
        <PlusIcon className="size-4" /> Bring assets here
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={`Bring assets to ${room.code}`} subtitle="Search registered assets and transfer them in" wide>
        <div className="flex flex-col gap-3">
          <form onSubmit={onSearch} className="join w-full">
            <label className="input join-item w-full">
              <SearchIcon className="size-4 opacity-50" />
              <input name="q" type="search" placeholder="Tag, serial or description" className="grow" aria-label="Search assets" autoFocus />
            </label>
            <button className="btn join-item" disabled={search.pending}>
              {search.pending ? <span className="loading loading-spinner loading-sm" /> : "Find"}
            </button>
          </form>
          {search.error && <p className="text-sm text-error">{search.error}</p>}
          {results && results.length === 0 && <p className="text-sm text-base-content/60">Nothing found outside this room.</p>}
          {results && results.length > 0 && (
            <ul className="flex max-h-72 flex-col divide-y divide-base-200 overflow-y-auto rounded-box border border-base-300">
              {results.map((a) => {
                const blocked = a.status === "DISPOSED" || a.equipment.length > 0;
                return (
                  <li key={a.id}>
                    <label className={`flex items-center gap-3 p-2.5 ${blocked ? "opacity-50" : "cursor-pointer hover:bg-base-200/50"}`}>
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        disabled={blocked}
                        checked={picked.has(a.id)}
                        onChange={() =>
                          setPicked((s) => {
                            const n = new Set(s);
                            if (n.has(a.id)) n.delete(a.id);
                            else n.add(a.id);
                            return n;
                          })
                        }
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{a.ledgerEntry.description}</span>
                        <span className="block font-mono text-xs text-base-content/60">
                          {a.tagCode} · {a.location?.code ?? "no room"}
                        </span>
                      </span>
                      {a.equipment[0] && <Badge className="badge-ghost">Lab {a.equipment[0].code}</Badge>}
                      {a.status === "DISPOSED" && <Badge className="badge-neutral">Disposed</Badge>}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          {picked.size > 0 && (
            <form onSubmit={onTransfer} className="animate-in flex flex-col gap-2 rounded-box border border-primary p-3" noValidate>
              <p className="text-sm font-medium">{picked.size} selected</p>
              {save.error && <p className="text-sm text-error">{save.error}</p>}
              <select name="type" defaultValue="ROOM_TO_ROOM" className="select select-sm w-full" aria-label="Transfer type">
                {(Object.keys(TRANSFER_TYPES) as TransferType[]).map((t) => (
                  <option key={t} value={t}>
                    {TRANSFER_TYPES[t]}
                  </option>
                ))}
              </select>
              <input name="reason" required minLength={3} maxLength={500} placeholder="Reason (required)" aria-label="Reason" className="input input-sm w-full" />
              <button type="submit" className="btn btn-primary btn-sm" disabled={save.pending}>
                {save.pending && <span className="loading loading-spinner loading-xs" />}
                Transfer into {room.code}
              </button>
            </form>
          )}
        </div>
      </Sheet>
    </>
  );
}
