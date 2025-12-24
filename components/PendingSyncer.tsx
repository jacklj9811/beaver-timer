"use client";

import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth } from "@/lib/firebase";
import { usePendingOps } from "@/hooks/usePendingOps";
import { sessionsCollection, tasksCollection, updatePresence, writeSession } from "@/lib/firestore";

export default function PendingSyncer() {
  const pendingOps = usePendingOps();
  const [uid, setUid] = useState<string | null>(null);
  const syncingRef = useRef(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!uid || pendingOps.length === 0) return;
    if (syncingRef.current) return;

    let cancelled = false;
    syncingRef.current = true;

    const sync = async () => {
      for (const op of pendingOps) {
        if (cancelled) break;
        try {
          if (op.type === "task") {
            const payload = op.payload as any;
            const id = payload.id;
            if (!id) continue;

            if (payload.action === "add") {
              await setDoc(doc(tasksCollection, id), {
                name: payload.name ?? "",
                tagIds: payload.tagIds ?? [],
                priority: payload.priority ?? "medium",
                done: payload.done ?? false,
                archived: payload.archived ?? false,
                user_uid: uid,
                createdAt: payload.createdAt ?? serverTimestamp(),
                updatedAt: serverTimestamp(),
                createdOpId: op.opId,
                lastOpId: op.opId,
              });
              continue;
            }

            if (payload.action === "update") {
              const updates = payload.data ?? {};
              await setDoc(
                doc(tasksCollection, id),
                {
                  ...updates,
                  user_uid: uid,
                  updatedAt: serverTimestamp(),
                  lastOpId: op.opId,
                },
                { merge: true }
              );
            }
          }

          if (op.type === "session") {
            const payload = op.payload as any;
            await writeSession(uid, payload, { opId: op.opId, sessionId: payload.id });
          }

          if (op.type === "presence") {
            const state = op.payload as any;
            await updatePresence(uid, state, op.opId);
          }
        } catch (err) {
          console.error("同步待处理操作失败", op.opId, err);
        }
      }

      syncingRef.current = false;
    };

    void sync();

    return () => {
      cancelled = true;
      syncingRef.current = false;
    };
  }, [pendingOps, uid]);

  return null;
}
