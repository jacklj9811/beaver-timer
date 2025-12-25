"use client";
import { useCallback, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { usePendingOps } from "@/hooks/usePendingOps";
import { removePendingOps } from "@/utils/mergeOffline";
import { subscribeUserSessions, subscribeUserTasks } from "@/lib/firestoreSubscriptions";
import { useAuthSubscriptions } from "@/hooks/useAuthSubscriptions";

type Session = {
  id: string;
  dateKey?: string; // 新写入只使用 dateKey；date / ts 仅兼容历史数据
  date?: string;
  ts?: any;
  mode: "focus" | "break";
  durationSec: number;
  taskId?: string | null;
};
type Task = { id: string; name?: string | null };

const getSessionDateKey = (s: Session) => {
  if (s.dateKey) return s.dateKey;
  if (s.date) return s.date;

  // 历史数据兜底：如果旧文档缺失 dateKey/date，才从 ts 推导
  if (s.ts?.toDate) return s.ts.toDate().toISOString().slice(0, 10);
  if (typeof s.ts === "number") return new Date(s.ts).toISOString().slice(0, 10);
  if (s.ts?.seconds) return new Date(s.ts.seconds * 1000).toISOString().slice(0, 10);
  return null;
};

export default function StatsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const pendingOps = usePendingOps();

  const handleUserChange = useCallback((user: User | null) => {
    if (!user) {
      setSessions([]);
      setTasks([]);
    }
  }, []);

  const subscribeForUser = useCallback(
    (user: User) => {
      const sessionsUnsub = subscribeUserSessions(user, {
        onData: (docs) => {
          const confirmedOpIds = docs
            .filter((docSnap) => !docSnap.metadata.hasPendingWrites)
            .map((docSnap) => (docSnap.data() as any).opId)
            .filter(Boolean);
          removePendingOps(confirmedOpIds);
          setSessions(
            docs
              .filter((docSnap) => !docSnap.metadata.hasPendingWrites)
              .map((d) => ({ id: d.id, ...(d.data() as any) }))
          );
        },
        onError: (error) => console.error(error),
      });

      const tasksUnsub = subscribeUserTasks(user, {
        onData: (docs) => {
          const confirmedOpIds = docs
            .filter((docSnap) => !docSnap.metadata.hasPendingWrites)
            .flatMap((docSnap) => {
              const data = docSnap.data() as any;
              return [data.createdOpId, data.lastOpId].filter(Boolean);
            });
          removePendingOps(confirmedOpIds);
          setTasks(
            docs
              .filter((docSnap) => !docSnap.metadata.hasPendingWrites)
              .map((d) => ({ id: d.id, ...(d.data() as any) }))
          );
        },
        onError: (error) => console.error(error),
      });

      return [sessionsUnsub, tasksUnsub];
    },
    []
  );

  useAuthSubscriptions(subscribeForUser, handleUserChange);

  const pendingSessions = useMemo(
    () =>
      pendingOps
        .filter((op) => op.type === "session")
        .map((op) => {
          const payload = op.payload as Partial<Session>;
          const dateKey = payload.dateKey ?? payload.date ?? new Date().toISOString().slice(0, 10);
          return {
            id: payload.id ?? op.opId,
            dateKey,
            mode: (payload.mode ?? "focus") as "focus" | "break",
            durationSec: payload.durationSec ?? 0,
            taskId: payload.taskId ?? null,
          } satisfies Session;
        }),
    [pendingOps]
  );

  const pendingTaskOps = useMemo(() => pendingOps.filter((op) => op.type === "task"), [pendingOps]);

  const sessionsForStats = useMemo(() => {
    const map = new Map(sessions.map((s) => [s.id, s]));
    pendingSessions.forEach((s) => map.set(s.id, s));
    return Array.from(map.values());
  }, [pendingSessions, sessions]);

  const tasksForStats = useMemo(() => {
    const map = new Map(tasks.map((t) => [t.id, t]));
    pendingTaskOps.forEach((op) => {
      const payload = op.payload as {
        action?: "add" | "update";
        id?: string;
        data?: Partial<Task>;
      } & Partial<Task>;
      if (!payload?.id) return;
      const existing = map.get(payload.id) ?? { id: payload.id };
      if (payload.action === "add") {
        map.set(payload.id, { ...existing, ...payload });
        return;
      }
      if (payload.action === "update") {
        map.set(payload.id, { ...existing, ...(payload.data ?? {}) });
      }
    });
    return Array.from(map.values());
  }, [pendingTaskOps, tasks]);

  const todayFocusMin = useMemo(() => {
    const today = new Date();
    return Math.round(
      sessionsForStats
        .filter((s) => {
          if (s.mode !== "focus") return false;
          const dateKey = getSessionDateKey(s);
          return dateKey ? isSameDay(new Date(dateKey), today) : false;
        })
        .reduce((acc, s) => acc + s.durationSec, 0) / 60
    );
  }, [sessionsForStats]);

  const weekData = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 }); // week starts Monday
    const arr = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(start, i);
      const label = format(d, "EEE");
      const min = Math.round(
        sessionsForStats
          .filter((s) => {
            if (s.mode !== "focus") return false;
            const dateKey = getSessionDateKey(s);
            return dateKey ? isSameDay(new Date(dateKey), d) : false;
          })
          .reduce((acc, s) => acc + s.durationSec, 0) / 60
      );
      return { label, min };
    });
    return arr;
  }, [sessionsForStats]);

  const finishedRate = useMemo(() => {
    const focusCnt = sessionsForStats.filter((s) => s.mode === "focus").length;
    const total = sessionsForStats.length || 1;
    return Math.round((focusCnt / total) * 100);
  }, [sessionsForStats]);

  const taskNameById = useMemo(() => {
    return tasksForStats.reduce((acc, t) => {
      acc[t.id] = t.name ?? "未分配任务";
      return acc;
    }, {} as Record<string, string>);
  }, [tasksForStats]);

  const taskTotals = useMemo(() => {
    const totals: Record<string, { name: string; seconds: number }> = {};

    sessionsForStats.forEach((s) => {
      if (s.mode !== "focus") return;
      const key = s.taskId ?? "__none__";
      const name = (s.taskId && taskNameById[s.taskId]) || "未分配任务";
      if (!totals[key]) totals[key] = { name, seconds: 0 };
      totals[key].seconds += s.durationSec;
    });

    return Object.entries(totals)
      .map(([id, data]) => ({ id, name: data.name, min: Math.round(data.seconds / 60) }))
      .sort((a, b) => b.min - a.min);
  }, [sessionsForStats, taskNameById]);

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
