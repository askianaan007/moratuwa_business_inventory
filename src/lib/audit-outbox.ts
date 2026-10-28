"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "./api-client";
import { newId } from "./use-action";
import type { LabCheck, LabCheckStatus } from "./types";

/** What the auditor recorded for one item. Sent as one entry of PATCH /checks. */
export interface CheckEdit {
  status: LabCheckStatus;
  faultReasonId: string | null;
  reasonText: string | null;
  notes: string | null;
  actionTaken: string | null;
  followUp: string | null;
}

interface Change extends CheckEdit {
  checkId: string;
  mutationId: string;
}

export interface Conflict {
  checkId: string;
  mine: CheckEdit;
  theirs: LabCheck;
}

export type SaveState = "saved" | "pending" | "saving" | "offline" | "error";

const BATCH = 50;
const DEBOUNCE_MS = 600;
const storageKey = (auditId: string) => `labledger:audit-outbox:${auditId}`;
const editFields = (c: CheckEdit): CheckEdit => ({
  status: c.status,
  faultReasonId: c.faultReasonId,
  reasonText: c.reasonText,
  notes: c.notes,
  actionTaken: c.actionTaken,
  followUp: c.followUp,
});

function readStored(auditId: string): Change[] {
  try {
    const raw = localStorage.getItem(storageKey(auditId));
    return raw ? (JSON.parse(raw) as Change[]) : [];
  } catch {
    return [];
  }
}

function writeStored(auditId: string, changes: Change[]) {
  try {
    if (changes.length) localStorage.setItem(storageKey(auditId), JSON.stringify(changes));
    else localStorage.removeItem(storageKey(auditId));
  } catch {
    // Storage full or blocked: the in-memory queue still works for this tab.
  }
}

/**
 * Shows check results on screen at once and saves them in the background.
 * Each change has a mutationId and is written to localStorage before it is
 * sent, so a dropped connection or closed tab loses nothing; the next send is
 * an idempotent retry. Conflicts with another auditor are shown, except when
 * the newer server row came from this device (then it is rebased quietly).
 *
 * The maps live in refs so the send loop never works from a stale copy;
 * `snap` is a copy of them for rendering.
 */
export function useAuditOutbox(auditId: string, initial: LabCheck[], editable: boolean) {
  const server = useRef(new Map(initial.map((c) => [c.id, c])));
  const queue = useRef(new Map<string, Change>());
  const inflight = useRef(new Map<string, Change>());
  const sentIds = useRef(new Set<string>());
  const sending = useRef<Promise<void> | null>(null);
  const retryDelay = useRef(1000);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const takeSnap = () => ({ server: new Map(server.current), local: new Map([...inflight.current, ...queue.current]) });
  const [snap, setSnap] = useState(takeSnap);
  const [state, setState] = useState<SaveState>("saved");
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [lockedMessage, setLockedMessage] = useState<string | null>(null);

  const changed = useCallback(() => {
    writeStored(auditId, [...new Map([...inflight.current, ...queue.current]).values()]);
    setSnap(takeSnap());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditId]);

  const mergeServer = useCallback(
    (rows: LabCheck[]) => {
      for (const r of rows) {
        const old = server.current.get(r.id);
        if (!old || r.version >= old.version) {
          server.current.set(r.id, { ...old, ...r, faultReason: r.faultReason ?? null, checkedBy: r.checkedBy ?? old?.checkedBy ?? null });
        }
      }
      setSnap(takeSnap());
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // A server re-render (router.refresh) brings fresh rows: keep the newer copy.
  useEffect(() => mergeServer(initial), [initial, mergeServer]);

  const send = useCallback(async () => {
    if (!editable || lockedMessage || !queue.current.size) return;
    const batch = [...queue.current.values()].slice(0, BATCH);
    for (const c of batch) {
      queue.current.delete(c.checkId);
      inflight.current.set(c.checkId, c);
      sentIds.current.add(c.mutationId);
    }
    changed(); // persisted before the request goes out
    setState("saving");

    const putBack = (changes: Change[]) => {
      for (const c of changes) if (!queue.current.has(c.checkId)) queue.current.set(c.checkId, c); // a newer edit wins
    };

    try {
      const res = await api<{ data: LabCheck[] }>(`/lab-audits/${auditId}/checks`, {
        method: "PATCH",
        body: { changes: batch.map((c) => ({ ...c, expectedVersion: server.current.get(c.checkId)?.version ?? 0 })) },
      });
      mergeServer(res.data);
      setErrors((e) => {
        const next = { ...e };
        for (const c of batch) delete next[c.checkId];
        return next;
      });
      retryDelay.current = 1000;
      setState(queue.current.size ? "pending" : "saved");
    } catch (err) {
      if (err instanceof ApiError && err.code === "VERSION_CONFLICT" && err.details.length) {
        const rows = err.details.map((d) => d.current as LabCheck | undefined).filter((r): r is LabCheck => Boolean(r?.id));
        mergeServer(rows);
        const byId = new Map(batch.map((c) => [c.checkId, c]));
        const real: Conflict[] = [];
        for (const row of rows) {
          const mine = byId.get(row.id);
          if (!mine) continue;
          if (row.lastMutationId && sentIds.current.has(row.lastMutationId)) continue; // ours: retry on the new version
          real.push({ checkId: row.id, mine: editFields(mine), theirs: row });
          byId.delete(row.id);
        }
        putBack([...byId.values()]);
        setConflicts((list) => [...list.filter((x) => !real.some((r) => r.checkId === x.checkId)), ...real]);
        setState(real.length ? "error" : "pending");
      } else if (err instanceof ApiError && err.status === 423) {
        setLockedMessage(err.message);
        putBack(batch);
        setState("error");
      } else if (err instanceof ApiError && err.status === 400) {
        // One bad entry fails the batch: mark it, resend the rest.
        const bad: Record<string, string> = {};
        for (const d of err.details) {
          const id = d.path.split(".")[0] ?? "";
          if (batch.some((c) => c.checkId === id)) bad[id] = d.message;
        }
        if (!Object.keys(bad).length && batch.length === 1) bad[batch[0]!.checkId] = err.message;
        setErrors((e) => ({ ...e, ...bad }));
        putBack(batch.filter((c) => !(c.checkId in bad)));
        setState(Object.keys(bad).length ? "error" : "pending");
      } else {
        putBack(batch);
        retryDelay.current = Math.min(retryDelay.current * 2, 30000);
        setState(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "pending");
      }
    } finally {
      inflight.current.clear();
      changed();
    }
  }, [auditId, changed, editable, lockedMessage, mergeServer]);

  /** One send at a time; callers share the running one. */
  const flushOnce = useCallback(() => {
    if (!sending.current) {
      sending.current = send().finally(() => {
        sending.current = null;
      });
    }
    return sending.current;
  }, [send]);

  const schedule = useCallback(
    (delay = DEBOUNCE_MS) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        await flushOnce();
        if (queue.current.size) schedule(Math.max(DEBOUNCE_MS, retryDelay.current));
      }, delay);
    },
    [flushOnce],
  );

  // Restore anything left unsent from a previous visit and retry it.
  useEffect(() => {
    const stored = readStored(auditId);
    if (!stored.length) return;
    for (const c of stored) {
      sentIds.current.add(c.mutationId);
      if (!queue.current.has(c.checkId)) queue.current.set(c.checkId, c);
    }
    setState("pending");
    changed();
    schedule(200);
  }, [auditId, changed, schedule]);

  useEffect(() => {
    const onOnline = () => {
      retryDelay.current = 1000;
      schedule(100);
    };
    const onHide = () => {
      if (document.visibilityState === "hidden" && queue.current.size) void flushOnce();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onHide);
      clearTimeout(timer.current);
    };
  }, [flushOnce, schedule]);

  /** Checks as shown on screen: server values with unsent edits on top. */
  const checks = useMemo(() => {
    const list: LabCheck[] = [];
    for (const c of snap.server.values()) {
      const local = snap.local.get(c.id);
      list.push(local ? { ...c, ...editFields(local), faultReason: local.faultReasonId === c.faultReasonId ? c.faultReason : null } : c);
    }
    return list.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [snap]);

  const record = useCallback(
    (checkId: string, edit: Partial<CheckEdit>) => {
      const base = queue.current.get(checkId) ?? inflight.current.get(checkId) ?? server.current.get(checkId);
      if (!base || !editable || lockedMessage) return;
      const merged: CheckEdit = { ...editFields(base), ...edit };
      if (merged.status === "WORKING") {
        merged.faultReasonId = null;
        merged.reasonText = null;
      }
      queue.current.set(checkId, { ...merged, checkId, mutationId: newId() });
      setErrors((e) => {
        if (!(checkId in e)) return e;
        const next = { ...e };
        delete next[checkId];
        return next;
      });
      setState("pending");
      changed();
      schedule();
    },
    [changed, editable, lockedMessage, schedule],
  );

  const resolve = useCallback(
    (checkId: string, keep: "mine" | "theirs") => {
      const found = conflicts.find((c) => c.checkId === checkId);
      setConflicts((list) => list.filter((c) => c.checkId !== checkId));
      if (found && keep === "mine") {
        queue.current.set(checkId, { ...found.mine, checkId, mutationId: newId() });
        changed();
        schedule(100);
      }
    },
    [changed, conflicts, schedule],
  );

  /** Saves everything now. Resolves true when nothing is left unsent. */
  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    for (let i = 0; i < 20 && (queue.current.size || sending.current); i++) {
      const before = queue.current.size;
      await flushOnce();
      if (queue.current.size >= before && before > 0 && !sending.current) break; // failing: stop and report
    }
    return queue.current.size === 0 && inflight.current.size === 0;
  }, [flushOnce]);

  return {
    checks,
    record,
    mergeServer,
    /** Bulk writes made outside the queue still count as "ours" for rebasing. */
    markSent: (mutationId: string) => sentIds.current.add(mutationId),
    flush,
    unsaved: snap.local.size,
    state,
    lockedMessage,
    conflicts,
    resolve,
    errors,
  };
}
