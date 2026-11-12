"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PencilIcon, PlusIcon } from "@/components/icons";
import { Sheet } from "@/components/sheet";
import { api } from "@/lib/api-client";
import { ROOM_TYPES } from "@/lib/inventory";
import { roomTypeLabel } from "@/lib/lab-status";
import { useAction } from "@/lib/use-action";
import type { Department, RoomType } from "@/lib/types";

interface Editable {
  id: string;
  code: string;
  name: string;
  building: string | null;
  floor: string | null;
  roomType: RoomType;
  updatedAt: string;
}

/**
 * Create a room (any type, can start empty) or edit one. Admins without a
 * department pick one; codes must be unique within the department.
 */
export function RoomForm({ room, departments = [], buildings = [] }: { room?: Editable; departments?: Department[]; buildings?: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { pending, error, fieldErrors, run } = useAction();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (k: string) => String(form.get(k) ?? "").trim() || null;
    const body = {
      code: value("code") ?? "",
      name: value("name") ?? "",
      building: value("building"),
      floor: value("floor"),
      roomType: form.get("roomType"),
    };
    const res = await run(() =>
      room
        ? api<{ data: { id: string } }>(`/inventory/rooms/${room.id}`, { method: "PATCH", body: { ...body, expectedUpdatedAt: room.updatedAt } })
        : api<{ data: { id: string } }>("/inventory/rooms", { method: "POST", body: { ...body, ...(value("departmentId") && { departmentId: value("departmentId") }) } }),
    );
    if (!res) return;
    setOpen(false);
    if (room) router.refresh();
    else router.push(`/inventory/rooms/${res.data.id}`);
  }

  return (
    <>
      {room ? (
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(true)}>
          <PencilIcon className="size-4" /> Edit room
        </button>
      ) : (
        <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
          <PlusIcon className="size-5" />
          <span className="hidden sm:inline">New room</span>
          <span className="sm:hidden">New</span>
        </button>
      )}
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={room ? `Edit ${room.code}` : "New room"}
        subtitle={room ? "Inventory and history are kept" : "A room can start empty; add assets later"}
        footer={
          <button type="submit" form="room-form" className="btn btn-primary w-full" disabled={pending}>
            {pending && <span className="loading loading-spinner loading-sm" />}
            {room ? "Save" : "Create room"}
          </button>
        }
      >
        <form id="room-form" onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
          {error && (
            <div role="alert" className="alert alert-error alert-soft text-sm">
              {error}
            </div>
          )}
          {!room && departments.length > 0 && (
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Department</span>
              <select name="departmentId" required defaultValue={departments.length === 1 ? departments[0]!.id : ""} className={`select w-full ${fieldErrors.departmentId ? "select-error" : ""}`}>
                {departments.length > 1 && (
                  <option value="" disabled>
                    Choose a department
                  </option>
                )}
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Room type</span>
            <select name="roomType" defaultValue={room?.roomType ?? "CLASSROOM"} className="select w-full">
              {ROOM_TYPES.map((t) => (
                <option key={t} value={t}>
                  {roomTypeLabel[t]}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-[9rem_1fr] gap-3">
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-sm font-medium">Code</span>
              <input name="code" required defaultValue={room?.code} placeholder="FB-LH-01" maxLength={30} className={`input w-full font-mono uppercase ${fieldErrors.code ? "input-error" : ""}`} />
            </label>
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-sm font-medium">Name</span>
              <input name="name" required defaultValue={room?.name} placeholder="Lecture Hall 01" maxLength={120} className={`input w-full ${fieldErrors.name ? "input-error" : ""}`} />
            </label>
          </div>
          {(fieldErrors.code || fieldErrors.name) && <p className="text-sm text-error">{fieldErrors.code ?? fieldErrors.name}</p>}
          <div className="grid grid-cols-[1fr_6rem] gap-3">
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-sm font-medium">Building</span>
              <input name="building" defaultValue={room?.building ?? ""} list="building-options" maxLength={120} placeholder="Academic Building" className="input w-full" />
              <datalist id="building-options">
                {buildings.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </label>
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-sm font-medium">Floor</span>
              <input name="floor" defaultValue={room?.floor ?? ""} maxLength={30} placeholder="1" className="input w-full" />
            </label>
          </div>
        </form>
      </Sheet>
    </>
  );
}
