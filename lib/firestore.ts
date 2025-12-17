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
} from "firebase/firestore";
import { db } from "./firebase";

export const userDoc = (uid: string) => doc(db, "users", uid);
export const tasksCollection = collection(db, "tasks");
export const sessionsCollection = collection(db, "sessions");
export const presenceDoc = (uid: string) => doc(db, "users", uid, "presence", "timer");

export async function upsertTask(
  uid: string,
  taskId: string | null,
  data: any,
  userEmail?: string | null
) {
  const payload = {
    ...data,
    user_uid: uid,
    user_email: userEmail ?? null,
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

export async function writeSession(uid: string, payload: any, userEmail?: string | null) {
  await addDoc(sessionsCollection, {
    ...payload,
    user_uid: uid,
    user_email: userEmail ?? null,
    ts: serverTimestamp(),
  });
}

export function listenTodaySessions(uid: string, onData: (docs: any[]) => void) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const q = query(
    sessionsCollection,
    where("user_uid", "==", uid),
    where("date", "==", start.toISOString().slice(0, 10)),
    orderBy("ts", "asc")
  );
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export async function updatePresence(uid: string, state: any) {
  await setDoc(presenceDoc(uid), { ...state, updatedAt: serverTimestamp() }, { merge: true });
}

export function listenPresence(uid: string, onChange: (s: any) => void) {
  return onSnapshot(presenceDoc(uid), (snap) => {
    if (snap.exists()) onChange(snap.data());
  });
}
