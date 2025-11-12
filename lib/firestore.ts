import {
  collection, doc, serverTimestamp, setDoc, addDoc,
  onSnapshot, query, where, orderBy, updateDoc
} from "firebase/firestore";
import { db } from "./firebase";

export const userDoc = (uid: string) => doc(db, "users", uid);
export const tasksCol = (uid: string) => collection(db, "users", uid, "tasks");
export const sessionsCol = (uid: string) => collection(db, "users", uid, "sessions");
export const presenceDoc = (uid: string) => doc(db, "users", uid, "presence", "timer");

export async function upsertTask(uid: string, taskId: string | null, data: any) {
  if (taskId) {
    await setDoc(doc(tasksCol(uid), taskId), { ...data, updatedAt: serverTimestamp() }, { merge: true });
  } else {
    await addDoc(tasksCol(uid), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }
}

export async function writeSession(uid: string, payload: any) {
  await addDoc(sessionsCol(uid), { ...payload, ts: serverTimestamp() });
}

export function listenTodaySessions(uid: string, onData: (docs: any[]) => void) {
  const start = new Date(); start.setHours(0,0,0,0);
  const q = query(sessionsCol(uid), where("date", "==", start.toISOString().slice(0,10)), orderBy("ts", "asc"));
  return onSnapshot(q, (snap) => onData(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

export async function updatePresence(uid: string, state: any) {
  await setDoc(presenceDoc(uid), { ...state, updatedAt: serverTimestamp() }, { merge: true });
}

export function listenPresence(uid: string, onChange: (s: any) => void) {
  return onSnapshot(presenceDoc(uid), (snap) => {
    if (snap.exists()) onChange(snap.data());
  });
}
