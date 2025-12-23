"use client";
import { useState, useEffect } from "react";
import { useStore } from "@/store/useStore";
import { useTimer } from "@/hooks/useTimer";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { listenPresence, updatePresence } from "@/lib/firestore";
import { addPendingOp, removePendingOps } from "@/utils/mergeOffline";

const fmt = (s: number) => {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
};

export default function Timer() {
  // 状态
  const timer = useStore((s) => s.timer);
  const setTimer = useStore((s) => s.setTimer);
  const resetTimer = useStore((s) => s.resetTimer);

  // 获取任务，用于显示任务标题
  const tasks = useStore((s) => s.tasks ?? []);
  const activeTask = tasks.find((t) => t.id === timer.activeTaskId);
  const hasTasks = tasks.length > 0;
  const hasActiveTask = !!activeTask;

  // 当前登录用户
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUid(u?.uid ?? null);
    });
    return () => unsub();
  }, []);

  // 启动计时逻辑
  useTimer({
    uid,
    onTick: () => {},
  });

  // 多设备同步 presence
  useEffect(() => {
    if (!uid) return;
    const unsub = listenPresence(uid, (remote, metadata) => {
      if (remote?.lastOpId && !metadata.hasPendingWrites) {
        removePendingOps([remote.lastOpId]);
      }
      if (remote && typeof remote.secondsLeft === "number") {
        const local = useStore.getState().timer;
        const remoteMode = (remote.mode as "focus" | "break") ?? local.mode;
        const roundTotalSec =
          typeof remote.roundTotalSec === "number"
            ? remote.roundTotalSec
            : local.roundTotalSec ??
              ((remoteMode === "focus" ? local.defaultFocusMin : local.defaultBreakMin) * 60);
        const desync =
          Math.abs((remote.secondsLeft ?? 0) - local.secondsLeft) > 2 ||
          remote.isRunning !== local.isRunning ||
          remoteMode !== local.mode ||
          remote.activeTaskId !== local.activeTaskId ||
          roundTotalSec !== local.roundTotalSec;

        if (desync && !local.isRunning) {
          setTimer({
            secondsLeft: remote.secondsLeft ?? local.secondsLeft,
            isRunning: !!remote.isRunning,
            mode: remoteMode,
            activeTaskId: remote.activeTaskId ?? null,
            roundTotalSec,
          });
        }
      }
    });
    return () => unsub();
  }, [uid, setTimer]);

  // 控制按钮
  const start = async () => {
    setTimer({ isRunning: true });
    if (uid) {
      const opId = addPendingOp({
        type: "presence",
        payload: { ...timer, isRunning: true },
        opKey: `presence:${uid}`,
      });
      updatePresence(uid, { ...timer, isRunning: true }, opId).catch(() => {});
    }
  };

  const pause = async () => {
    setTimer({ isRunning: false });
    if (uid) {
      const opId = addPendingOp({
        type: "presence",
        payload: { ...timer, isRunning: false },
        opKey: `presence:${uid}`,
      });
      updatePresence(uid, { ...timer, isRunning: false }, opId).catch(() => {});
    }
  };

  const reset = async () => {
    resetTimer(); // 重置为当前模式的默认值
    if (uid) {
      const t = useStore.getState().timer;
      const opId = addPendingOp({ type: "presence", payload: t, opKey: `presence:${uid}` });
      updatePresence(uid, t, opId).catch(() => {});
    }
  };

  const showStartBlockedHint = () => {
    if (!hasTasks) {
      window.alert(
        [
          "无任务可选",
          "请先创建一个新任务，并在创建后将其设为当前任务。",
          "（提示：你也可以将此作为当前教程步骤）",
        ].join("\n")
      );
      return;
    }

    window.alert(
      [
        "需要先选择一个任务作为当前任务。",
        "或者新建一个任务并设置为当前任务。",
      ].join("\n")
    );
  };

  const handleStartClick = () => {
    if (!hasActiveTask) {
      showStartBlockedHint();
      return;
    }

    void start();
  };

  return (
    <div className="rounded-2xl border p-6 flex flex-col items-center gap-4">
      {/* 模式显示 */}
      <div className="text-sm opacity-70">
        模式：{timer.mode === "focus" ? "专注" : "休息"}
      </div>

      {/* 时间显示 */}
      <div className="text-6xl tabular-nums font-semibold">
        {fmt(timer.secondsLeft)}
      </div>

      {/* 控制按钮 */}
      <div className="flex items-center gap-2">
        {!timer.isRunning ? (
          <div className="relative">
            <button
              onClick={handleStartClick}
              disabled={!hasActiveTask}
              className={`px-4 py-2 rounded bg-emerald-600 text-white transition ${
                hasActiveTask ? "" : "opacity-50 cursor-not-allowed"
              }`}
            >
              开始
            </button>
            {!hasActiveTask ? (
              <div
                role="presentation"
                className="absolute inset-0 rounded"
                onClick={showStartBlockedHint}
              />
            ) : null}
          </div>
        ) : (
          <button
            onClick={pause}
            className="px-4 py-2 rounded bg-amber-600 text-white"
          >
            暂停
          </button>
        )}

        <button onClick={reset} className="px-4 py-2 rounded border">
          重置
        </button>

        <button
          onClick={() => {
            const next = timer.mode === "focus" ? "break" : "focus";
            resetTimer(next); // 使用新版 resetTimer(带模式)
          }}
          className="px-4 py-2 rounded border"
        >
          切换 {timer.mode === "focus" ? "→ 休息" : "→ 专注"}
        </button>
      </div>

      {/* 调整默认时间 */}
      <div className="flex items-center gap-2 text-sm">
        <label className="flex items-center gap-1">
          专注分钟
          <input
            type="number"
            className="w-16 rounded border px-2 py-1 bg-transparent"
            min={1}
            value={timer.defaultFocusMin}
            onChange={(e) =>
              useStore
                .getState()
                .setTimer({ defaultFocusMin: Math.max(1, Number(e.target.value)) })
            }
          />
        </label>

        <label className="flex items-center gap-1">
          休息分钟
          <input
            type="number"
            className="w-16 rounded border px-2 py-1 bg-transparent"
            min={1}
            value={timer.defaultBreakMin}
            onChange={(e) =>
              useStore
                .getState()
                .setTimer({ defaultBreakMin: Math.max(1, Number(e.target.value)) })
            }
          />
        </label>
      </div>

      {/* 显示当前任务 */}
      <div className="text-xs opacity-70">
        当前任务：{activeTask ? activeTask.name : "未选择"}
      </div>
    </div>
  );
}
