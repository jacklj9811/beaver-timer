export type PendingOp = {
  opId: string;
  type: "task" | "session" | "presence";
  payload: any;
  createdAt: number;
  opKey?: string;
};

type AddPendingOpArgs = {
  type: PendingOp["type"];
  payload: PendingOp["payload"];
  opId?: string;
  opKey?: string;
};

const KEY = "beaver_pending_ops_v1";
const EVENT = "pending-ops-updated";

const isBrowser = () => typeof window !== "undefined";

const emitUpdate = () => {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event(EVENT));
};

const generateOpId = () => {
  if (isBrowser() && "crypto" in window && "randomUUID" in window.crypto) {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export function getQueue(): PendingOp[] {
  if (!isBrowser()) return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

const setQueue = (next: PendingOp[]) => {
  if (!isBrowser()) return;
  localStorage.setItem(KEY, JSON.stringify(next));
  emitUpdate();
};

export function addPendingOp({ type, payload, opId, opKey }: AddPendingOpArgs) {
  const nextOpId = opId ?? generateOpId();
  const arr = getQueue();
  const filtered = opKey ? arr.filter((item) => item.opKey !== opKey) : arr;
  filtered.push({
    opId: nextOpId,
    type,
    payload,
    createdAt: Date.now(),
    opKey,
  });
  setQueue(filtered);
  return nextOpId;
}

export function removePendingOps(opIds: string[] | Set<string>) {
  const ids = Array.isArray(opIds) ? new Set(opIds) : opIds;
  if (ids.size === 0) return;
  const arr = getQueue();
  const next = arr.filter((item) => !ids.has(item.opId));
  if (next.length === arr.length) return;
  setQueue(next);
}

export function clearQueue() {
  if (!isBrowser()) return;
  localStorage.removeItem(KEY);
  emitUpdate();
}
