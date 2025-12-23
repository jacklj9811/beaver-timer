"use client";
import { useEffect, useRef } from "react";
import { useStore } from "@/store/useStore";
import { doc } from "firebase/firestore";
import { sessionsCollection, updatePresence, writeSession } from "@/lib/firestore";
import { addPendingOp } from "@/utils/mergeOffline";

type Opts = {
  uid?: string | null;
  onTick?: (secs: number) => void;
};

export function useTimer(opts: Opts = {}) {
  const { uid, onTick } = opts;

  // 这里只订阅 timer，用来判断要不要启动 / 停止循环
  const timer = useStore((s) => s.timer);
  const setTimer = useStore((s) => s.setTimer);
  const resetTimer = useStore((s) => s.resetTimer);

  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);

  useEffect(() => {
    if (!timer.isRunning) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = null;
      return;
    }

    let stopped = false;

    const loop = (ts: number) => {
      if (stopped) return;

      if (!lastTsRef.current) lastTsRef.current = ts;
      const delta = ts - lastTsRef.current;

      if (delta >= 1000) {
        const dec = Math.floor(delta / 1000);

        // 每次 tick 都拿最新的 timer 状态，而不是用闭包里的旧 timer
        const current = useStore.getState().timer;
        const left = Math.max(0, current.secondsLeft - dec);
        const roundTotalSec =
          current.roundTotalSec ??
          ((current.mode === "focus" ? current.defaultFocusMin : current.defaultBreakMin) * 60);

        // 更新本地剩余秒数
        setTimer({ secondsLeft: left });
        lastTsRef.current = ts;
        onTick?.(left);

        // 每秒同步 presence
        if (uid) {
          const presenceState = {
            secondsLeft: left,
            isRunning: left > 0, // 归零时可先标记 false
            mode: current.mode,
            activeTaskId: current.activeTaskId ?? null,
            roundTotalSec,
          };
          const opId = addPendingOp({
            type: "presence",
            payload: presenceState,
            opKey: `presence:${uid}`,
          });
          updatePresence(uid, presenceState, opId).catch(() => {});
        }

        // 🔔 完成一个番茄
        if (left === 0) {
          // 再次拿最新状态（刚刚 setTimer 后的）
          const finalTimer = useStore.getState().timer;
          const sessionDurationSec =
            finalTimer.roundTotalSec ??
            ((finalTimer.mode === "focus" ? finalTimer.defaultFocusMin : finalTimer.defaultBreakMin) * 60);

          const payload = {
            date: new Date().toISOString().slice(0, 10),
            mode: finalTimer.mode,
            durationSec: sessionDurationSec,
            taskId: finalTimer.activeTaskId ?? null,
          };

          const sessionId = uid ? doc(sessionsCollection).id : undefined;
          const opId = addPendingOp({
            type: "session",
            payload: { id: sessionId, ...payload, user_uid: uid ?? null },
          });

          if (uid && sessionId) {
            writeSession(uid, payload, { opId, sessionId }).catch(() => {});
          }

          // 自动切换模式 + 重置时间（resetTimer 会把 isRunning 设为 false）
          const nextMode = finalTimer.mode === "focus" ? "break" : "focus";
          resetTimer(nextMode);

          // 切换模式之后，再同步一次 presence（确保远端拿到“下一轮”的状态）
          if (uid) {
            const nextState = useStore.getState().timer;
            const nextOpId = addPendingOp({
              type: "presence",
              payload: nextState,
              opKey: `presence:${uid}`,
            });
            updatePresence(uid, nextState, nextOpId).catch(() => {});
          }

          // 震动 / 通知
          try {
            if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
          } catch {}
          if (typeof window !== "undefined" && "Notification" in window) {
            if (Notification.permission === "granted") {
              new Notification("🔔 海狸时钟", {
                body:
                  finalTimer.mode === "focus"
                    ? "专注完成！休息一下～"
                    : "休息结束！继续专注吧！",
              });
            }
          }

          // ❗️结束当前循环，不再 requestAnimationFrame
          stopped = true;
          return;
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      stopped = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = null;
    };
  }, [timer.isRunning, uid, onTick, resetTimer, setTimer]);

  // 请求通知权限（可选保留）
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    }
  }, []);

  return { timer, setTimer, resetTimer };
}
