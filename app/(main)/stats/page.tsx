"use client";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { onSnapshot, query, where, orderBy } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { sessionsCollection, tasksCollection } from "@/lib/firestore";

type Session = { id: string; date: string; mode: "focus" | "break"; durationSec: number; taskId?: string | null };
type Task = { id: string; name?: string | null };

export default function StatsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    let unsubSessions: (() => void) | null = null;
    let unsubTasks: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (u) => {
      unsubSessions?.();
      unsubTasks?.();

      if (!u) {
        setSessions([]);
        setTasks([]);
        return;
      }

      const sessionsQuery = query(
        sessionsCollection,
        where("user_uid", "==", u.uid),
        where("date", ">=", "1970-01-01"),
        orderBy("date", "asc")
      );
      unsubSessions = onSnapshot(sessionsQuery, (snap) => {
        setSessions(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      });

      const tasksQuery = query(tasksCollection, where("user_uid", "==", u.uid));
      unsubTasks = onSnapshot(tasksQuery, (snap) => {
        setTasks(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      });
    });

    return () => {
      unsubSessions?.();
      unsubTasks?.();
      unsubAuth();
    };
  }, []);

  const todayFocusMin = useMemo(() => {
    const today = new Date();
    return Math.round(
      sessions
        .filter((s) => s.mode === "focus" && isSameDay(new Date(s.date), today))
        .reduce((acc, s) => acc + s.durationSec, 0) / 60
    );
  }, [sessions]);

  const weekData = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 }); // week starts Monday
    const arr = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(start, i);
      const label = format(d, "EEE");
      const min = Math.round(
        sessions
          .filter((s) => s.mode === "focus" && isSameDay(new Date(s.date), d))
          .reduce((acc, s) => acc + s.durationSec, 0) / 60
      );
      return { label, min };
    });
    return arr;
  }, [sessions]);

  const finishedRate = useMemo(() => {
    const focusCnt = sessions.filter((s) => s.mode === "focus").length;
    const total = sessions.length || 1;
    return Math.round((focusCnt / total) * 100);
  }, [sessions]);

  const taskNameById = useMemo(() => {
    return tasks.reduce((acc, t) => {
      acc[t.id] = t.name ?? "未分配任务";
      return acc;
    }, {} as Record<string, string>);
  }, [tasks]);

  const taskTotals = useMemo(() => {
    const totals: Record<string, { name: string; seconds: number }> = {};

    sessions.forEach((s) => {
      if (s.mode !== "focus") return;
      const key = s.taskId ?? "__none__";
      const name = (s.taskId && taskNameById[s.taskId]) || "未分配任务";
      if (!totals[key]) totals[key] = { name, seconds: 0 };
      totals[key].seconds += s.durationSec;
    });

    return Object.entries(totals)
      .map(([id, data]) => ({ id, name: data.name, min: Math.round(data.seconds / 60) }))
      .sort((a, b) => b.min - a.min);
  }, [sessions, taskNameById]);

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

      <div className="rounded-2xl border p-4">
        <div className="text-sm opacity-70 mb-3">按任务统计（专注分钟）</div>
        {taskTotals.length ? (
          <ul className="space-y-2">
            {taskTotals.map((t) => (
              <li key={t.id} className="flex items-center justify-between text-sm">
                <span className="truncate pr-2">{t.name}</span>
                <span className="font-semibold">{t.min}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm opacity-70">暂无相关数据</div>
        )}
      </div>
    </div>
  );
}
