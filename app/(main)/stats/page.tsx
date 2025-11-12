"use client";
import { onAuthStateChanged } from "firebase/auth";
import { auth, } from "@/lib/firebase";
import { collection, onSnapshot, query, where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useEffect, useMemo, useState } from "react";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";

type Session = { id: string; date: string; mode: "focus"|"break"; durationSec: number; taskId?: string | null };

export default function StatsPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUid(u?.uid ?? null);
      if (!u) return;
      const today = new Date().toISOString().slice(0,10);
      const q = query(collection(db, "users", u.uid, "sessions"), where("date", ">=", "1970-01-01"), orderBy("date", "asc"));
      const unsub = onSnapshot(q, (snap) => {
        setSessions(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
      });
      return () => unsub();
    });
    return () => unsubAuth();
  }, []);

  const todayFocusMin = useMemo(() => {
    const today = new Date();
    return Math.round(
      sessions.filter(s => s.mode === "focus" && isSameDay(new Date(s.date), today))
        .reduce((acc, s) => acc + s.durationSec, 0) / 60
    );
  }, [sessions]);

  const weekData = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 }); // 周一
    const arr = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(start, i);
      const label = format(d, "EEE");
      const min = Math.round(
        sessions.filter(s => s.mode === "focus" && isSameDay(new Date(s.date), d))
          .reduce((acc, s) => acc + s.durationSec, 0) / 60
      );
      return { label, min };
    });
    return arr;
  }, [sessions]);

  const finishedRate = useMemo(() => {
    const focusCnt = sessions.filter(s => s.mode === "focus").length;
    const total = sessions.length || 1;
    return Math.round((focusCnt / total) * 100);
  }, [sessions]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">统计</h1>
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border p-4">
          <div className="text-sm opacity-70">今日专注（分钟）</div>
          <div className="text-3xl font-semibold">{todayFocusMin}</div>
        </div>
        <div className="rounded-2xl border p-4">
          <div className="text-sm opacity-70">本周累计（分钟）</div>
          <div className="text-3xl font-semibold">
            {weekData.reduce((a, b) => a + b.min, 0)}
          </div>
        </div>
        <div className="rounded-2xl border p-4">
          <div className="text-sm opacity-70">完成率（专注 / 全部）</div>
          <div className="text-3xl font-semibold">{finishedRate}%</div>
        </div>
      </div>

      <div className="rounded-2xl border p-4">
        <div className="text-sm opacity-70 mb-2">周视图（专注分钟）</div>
        <div className="grid grid-cols-7 gap-2">
          {weekData.map((d) => (
            <div key={d.label} className="text-center">
              <div className="text-xs opacity-70">{d.label}</div>
              <div className="mt-1 h-24 border rounded flex items-end justify-center overflow-hidden">
                <div
                  className="w-full"
                  style={{ height: `${Math.min(100, d.min)}%`, background: "currentColor", opacity: 0.15 }}
                />
              </div>
              <div className="text-sm mt-1">{d.min}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
