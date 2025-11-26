"use client";
import { useEffect, useRef } from "react";
import { useStore } from "@/store/useStore";
import { updatePresence, writeSession } from "@/lib/firestore";
import { pushOffline } from "@/utils/mergeOffline";

type Opts = {
  uid?: string | null;
  onTick?: (secs: number) => void;
};

export function useTimer(opts: Opts = {}) {
  const { uid, onTick } = opts;
  const timer = useStore(s => s.timer);
  const setTimer = useStore(s => s.setTimer);
  const resetTimer = useStore(s => s.resetTimer);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);

  // tick（使用 requestAnimationFrame 平滑，内部按 1s 结算）
  useEffect(() => {
    if (!timer.isRunning) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = null;
      return;
    }
    const loop = (ts: number) => {
      if (!lastTsRef.current) lastTsRef.current = ts;
      const delta = ts - lastTsRef.current;
      if (delta >= 1000) {
        const dec = Math.floor(delta / 1000);
        const left = Math.max(0, timer.secondsLeft - dec);
        setTimer({ secondsLeft: left });
        lastTsRef.current = ts;
        onTick?.(left);

        // 每秒同步 presence（多设备实时一致）
        if (uid) {
          const state = {
            secondsLeft: left,
            isRunning: true,
            mode: timer.mode,
            activeTaskId: timer.activeTaskId
          };
          updatePresence(uid, state).catch(() => {
            // 离线：压队列
            pushOffline({ type: "presence", payload: state });
          });
        }

        // 完成一个番茄
        if (left === 0) {
          const payload = {
            date: new Date().toISOString().slice(0,10),
            mode: timer.mode,
            durationSec: (timer.mode === "focus" ? timer.defaultFocusMin : timer.defaultBreakMin) * 60,
            taskId: timer.activeTaskId ?? null
          };
          if (uid) {
            writeSession(uid, payload).catch(() => {
              pushOffline({ type: "session", payload });
            });
          } else {
            pushOffline({ type: "session", payload });
          }

          // 自动切换到 break/focus
          const nextMode = timer.mode === "focus" ? "break" : "focus";
          resetTimer(nextMode);

          if (uid) {
            const nextState = useStore.getState().timer;
            updatePresence(uid, nextState).catch(() => {
              pushOffline({ type: "presence", payload: nextState });
            });
          }

          // 震动 / 通知
          try { if (navigator.vibrate) navigator.vibrate([80, 40, 80]); } catch {}
          if (typeof window !== "undefined" && "Notification" in window) {
            if (Notification.permission === "granted") {
              new Notification("🔔 海狸时钟", { body: timer.mode === "focus"
                ? "专注完成！休息一下～"
                : "休息结束！继续专注吧！" 
              });
            }
          }

          // 停止当前帧循环，避免在 isRunning 状态更新为 false 之前继续沿用旧的 timer 值
          if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
          }
          lastTsRef.current = null;
          return;
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer.isRunning, timer.mode, timer.secondsLeft, timer.defaultFocusMin, timer.defaultBreakMin, timer.activeTaskId, uid]);

  // 请求通知权限（可选）
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  return { timer, setTimer, resetTimer };
}
