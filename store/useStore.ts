"use client";
import { create } from "zustand";

type Task = {
  id: string;
  name: string;
  tags: string[];
  priority: "low"|"medium"|"high";
  done?: boolean;
};

type TimerState = {
  secondsLeft: number;        // 当前剩余秒数
  isRunning: boolean;
  defaultFocusMin: number;    // 默认 25
  defaultBreakMin: number;    // 默认 5
  mode: "focus"|"break";
  activeTaskId?: string | null;
};

type AppState = {
  tasks: Task[];
  timer: TimerState;
  setTasks: (tasks: Task[]) => void;
  setTimer: (t: Partial<TimerState>) => void;
  resetTimer: (mode?: "focus"|"break") => void;
};

export const useStore = create<AppState>((set) => ({
  tasks: [],
  timer: {
    secondsLeft: 25*60,
    isRunning: false,
    defaultFocusMin: 25,
    defaultBreakMin: 5,
    mode: "focus",
    activeTaskId: null
  },
  setTasks: (tasks) => set({ tasks }),
  setTimer: (t) => set((s) => ({ timer: { ...s.timer, ...t }})),
  resetTimer: (mode) => set((s) => {
    const m = mode ?? s.timer.mode;
    const minutes = m === "focus" ? s.timer.defaultFocusMin : s.timer.defaultBreakMin;
    return { timer: { ...s.timer, mode: m, secondsLeft: minutes*60, isRunning: false } };
  })
}));
