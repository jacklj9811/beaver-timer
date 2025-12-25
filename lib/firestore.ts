import {
  collection,
  doc,
  serverTimestamp,
  setDoc,
  addDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  updateDoc,
  type SnapshotMetadata,
} from "firebase/firestore";
import { db } from "./firebase";

export const userDoc = (uid: string) => doc(db, "users", uid);
export const tasksCollection = collection(db, "tasks");
export const sessionsCollection = collection(db, "sessions");
export const presenceDoc = (uid: string) => doc(db, "users", uid, "presence", "timer");

export async function upsertTask(uid: string, taskId: string | null, data: any) {
  const payload = {
    ...data,
    user_uid: uid,
  };

  if (taskId) {
    await setDoc(
      doc(tasksCollection, taskId),
      { ...payload, updatedAt: serverTimestamp() },
      { merge: true }
    );
  } else {
    await addDoc(tasksCollection, {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}

export async function writeSession(
  uid: string,
  payload: any,
  options: { opId?: string; sessionId?: string } = {}
) {
  const { id: _omitId, date: legacyDate, ...rest } = payload ?? {};
  const dateKey = rest?.dateKey ?? legacyDate ?? new Date().toISOString().slice(0, 10);
  const ref = options.sessionId ? doc(sessionsCollection, options.sessionId) : doc(sessionsCollection);
  await setDoc(ref, {
    ...rest,
    dateKey,
    user_uid: uid,
    ts: serverTimestamp(),
    opId: options.opId ?? null,
  });
  return ref.id;
}

export function listenTodaySessions(uid: string, onData: (docs: any[]) => void) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const q = query(
    sessionsCollection,
    where("user_uid", "==", uid),
    where("ts", ">=", start),
    where("ts", "<", end),
    orderBy("ts", "asc")
  );
  let unsubscribe: (() => void) | null = null;
  const handleError = (error: any) => {
    if (error?.code === "permission-denied") {
      console.error(`[firestore-permission-denied] scope=sessions uid=${uid} query=today`, error.message);
      unsubscribe?.();
    }
  };
  unsubscribe = onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    handleError
  );
  return unsubscribe;
}

export async function updatePresence(uid: string, state: any, opId?: string) {
  await setDoc(
    presenceDoc(uid),
    { ...state, lastOpId: opId ?? state.lastOpId ?? null, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export function listenPresence(
  uid: string,
  onChange: (s: any, metadata: SnapshotMetadata) => void
) {
  let unsubscribe: (() => void) | null = null;
  const handleError = (error: any) => {
    if (error?.code === "permission-denied") {
      console.error(`[firestore-permission-denied] scope=presence uid=${uid}`, error.message);
      unsubscribe?.();
    }
  };
  unsubscribe = onSnapshot(
    presenceDoc(uid),
    { includeMetadataChanges: true },
    (snap) => {
      if (snap.exists()) onChange(snap.data(), snap.metadata);
    },
    handleError
  );
  return unsubscribe;
}
