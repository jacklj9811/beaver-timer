"use client";
import { create } from "zustand";

export type Tag = {
  id: string;
  name: string;
};

export type Task = {
  id: string;
  name: string;
  tagIds: string[];
  priority: "low" | "medium" | "high";
  done?: boolean;
  archived?: boolean;
};

type TimerState = {
  secondsLeft: number;        // 当前剩余秒数
  isRunning: boolean;
  defaultFocusMin: number;    // 默认 25
  defaultBreakMin: number;    // 默认 5
  mode: "focus"|"break";
  roundTotalSec: number;      // 本轮开始时的总秒数，用于统计
  activeTaskId?: string | null;
};

type AppState = {
  tasks: Task[];
  archivedTasks: Task[];
  tags: Tag[];
  timer: TimerState;
  setTasks: (tasks: Task[]) => void;
  setArchivedTasks: (tasks: Task[]) => void;
  setTags: (tags: Tag[]) => void;
  setTimer: (t: Partial<TimerState>) => void;
  resetTimer: (mode?: "focus" | "break") => void;
};

export const useStore = create<AppState>((set) => ({
  tasks: [],
  archivedTasks: [],
  tags: [],
  timer: {
    secondsLeft: 25*60,
    isRunning: false,
    defaultFocusMin: 25,
    defaultBreakMin: 5,
    mode: "focus",
    roundTotalSec: 25*60,
    activeTaskId: null
  },
  setTasks: (tasks) => set({ tasks }),
  setArchivedTasks: (tasks) => set({ archivedTasks: tasks }),
  setTags: (tags) => set({ tags }),
  setTimer: (t) => set((s) => ({ timer: { ...s.timer, ...t } })),
  resetTimer: (mode) => set((s) => {
    const m = mode ?? s.timer.mode;
    const minutes = m === "focus" ? s.timer.defaultFocusMin : s.timer.defaultBreakMin;
    const totalSec = minutes * 60;
    return { timer: { ...s.timer, mode: m, secondsLeft: totalSec, roundTotalSec: totalSec, isRunning: false } };
  })
}));
