"use client";
import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, addDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useStore } from "@/store/useStore";
import { pushOffline } from "@/utils/mergeOffline";
import { updatePresence } from "@/lib/firestore";
import { Check, Plus } from "lucide-react";

export default function TaskList() {
  const tasks = useStore(s => s.tasks);
  const setTasks = useStore(s => s.setTasks);
  const setTimer = useStore(s => s.setTimer);
  const [uid, setUid] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [tag, setTag] = useState("");
  const [prio, setPrio] = useState<"low"|"medium"|"high">("medium");

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUid(u?.uid ?? null);
      if (!u) return;
      const colRef = collection(db, "users", u.uid, "tasks");
      const unsub = onSnapshot(colRef, (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        setTasks(list as any);
      });
      return () => unsub();
    });
    return () => unsubAuth();
  }, [setTasks]);

  const create = async () => {
    if (!uid || !input.trim()) return;
    const payload = {
      name: input.trim(),
      tags: tag ? tag.split(",").map(t => t.trim()).filter(Boolean) : [],
      priority: prio,
      done: false,
      createdAt: new Date()
    };
    try {
      await addDoc(collection(db, "users", uid, "tasks"), payload);
      setInput(""); setTag("");
    } catch {
      pushOffline({ type: "task", payload: { action: "add", ...payload } });
    }
  };

  const toggleDone = async (id: string, done: boolean) => {
    if (!uid) return;
    try {
      await updateDoc(doc(db, "users", uid, "tasks", id), { done: !done, updatedAt: new Date() });
    } catch {
      pushOffline({ type: "task", payload: { action: "update", id, done: !done } });
    }
  };

  const setActiveTask = async (id: string) => {
    setTimer({ activeTaskId: id });
    if (!uid) return;
    const state = useStore.getState().timer;
    try {
      await updatePresence(uid, state);
    } catch {
      pushOffline({ type: "presence", payload: state });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          className="flex-1 rounded border px-3 py-2 bg-transparent"
          placeholder="任务名"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <input
          className="rounded border px-3 py-2 bg-transparent"
          placeholder="标签（逗号分隔）"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
        />
        <select
          className="rounded border px-2 py-2 bg-transparent"
          value={prio}
          onChange={(e) => setPrio(e.target.value as any)}
        >
          <option value="low">低</option>
          <option value="medium">中</option>
          <option value="high">高</option>
        </select>
        <button onClick={create} className="inline-flex items-center gap-1 px-3 py-2 rounded bg-slate-900 text-white dark:bg-white dark:text-slate-900">
          <Plus className="w-4 h-4"/> 添加
        </button>
      </div>

      <ul className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
        {tasks.map(t => (
          <li key={t.id} className="py-2 flex items-center justify-between">
            <div className="min-w-0">
              <div className="font-medium truncate">{t.name}</div>
              <div className="text-xs opacity-70">
                优先级：{t.priority} {t.tags?.length ? `· 标签：${t.tags.join(", ")}` : ""}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { void setActiveTask(t.id); }}
                className="text-sm underline"
              >
                设为当前
              </button>
              <button
                onClick={() => toggleDone(t.id, !!t.done)}
                className={`w-8 h-8 rounded border grid place-items-center ${t.done ? "bg-emerald-500/20 border-emerald-500" : "border-slate-300 dark:border-slate-700"}`}
                title="完成/未完成"
              >
                {t.done ? <Check className="w-4 h-4" /> : null}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
