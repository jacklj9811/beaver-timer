export type OfflineQueueItem = {
  type: "task" | "session" | "presence";
  payload: any;
};

const KEY = "beaver_offline_queue_v1";

export function pushOffline(item: OfflineQueueItem) {
  const arr = getQueue();
  arr.push(item);
  localStorage.setItem(KEY, JSON.stringify(arr));
}

export function getQueue(): OfflineQueueItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch { return []; }
}

export function clearQueue() {
  localStorage.removeItem(KEY);
}
