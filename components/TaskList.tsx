"use client";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  query,
  where,
  deleteDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useStore, Task, Tag } from "@/store/useStore";
import { pushOffline } from "@/utils/mergeOffline";
import { tasksCollection, updatePresence, userDoc } from "@/lib/firestore";
import { Plus, Tag as TagIcon, X, ChevronDown, ChevronUp } from "lucide-react";
import TagManager from "./TagManager";

const TAG_COLLECTION = (uid: string) => collection(db, "users", uid, "tags");
const COMPLETE_ANIMATION_MS = 320;

export default function TaskList() {
  const tasks = useStore((s) => s.tasks);
  const archivedTasks = useStore((s) => s.archivedTasks);
  const tags = useStore((s) => s.tags);
  const setTasks = useStore((s) => s.setTasks);
  const setArchivedTasks = useStore((s) => s.setArchivedTasks);
  const setTags = useStore((s) => s.setTags);
  const setTimer = useStore((s) => s.setTimer);
  const activeTaskId = useStore((s) => s.timer.activeTaskId);

  const [uid, setUid] = useState<string | null>(null);
  const [rawTasks, setRawTasks] = useState<Task[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [tagInputs, setTagInputs] = useState<Record<string, string>>({});
  const [showTagManager, setShowTagManager] = useState(false);
  const [tagsReady, setTagsReady] = useState(false);
  const [tasksReady, setTasksReady] = useState(false);
  const [leavingIds, setLeavingIds] = useState<Record<string, boolean>>({});
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [hoveredAction, setHoveredAction] = useState<{
    id: string;
    action: "complete" | "delete";
  } | null>(null);
  const editingInputRef = useRef<HTMLInputElement | null>(null);
  const closeMenuTimeout = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  useEffect(() => {
    let unsubTasks: (() => void) | null = null;
    let unsubTags: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUid(u?.uid ?? null);
      setTasks([]);
      setArchivedTasks([]);
      setTags([]);
      setTagsReady(false);
      setTasksReady(false);

      unsubTasks?.();
      unsubTags?.();
      if (!u) return;

      void setDoc(
        userDoc(u.uid),
        { user_uid: u.uid, email: u.email ?? null, updatedAt: serverTimestamp(), createdAt: serverTimestamp() },
        { merge: true }
      );

      const tasksQuery = query(tasksCollection, where("user_uid", "==", u.uid));
      const tagsCol = TAG_COLLECTION(u.uid);

      unsubTasks = onSnapshot(tasksQuery, (snap) => {
        const list = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: data.name ?? "",
            tagIds: data.tagIds ?? data.tags ?? [],
            priority: data.priority ?? "medium",
            done: data.done ?? false,
            archived: data.archived ?? false,
          } satisfies Task;
        });
        setRawTasks(list);
        setTasksReady(true);
      });

      unsubTags = onSnapshot(tagsCol, (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Tag[];
        setTags(list);
        setTagsReady(true);
      });
    });

    return () => {
      unsubTasks?.();
      unsubTags?.();
      unsubAuth();
    };
  }, [setArchivedTasks, setTags, setTasks]);

  useEffect(() => {
    if (!uid || !tagsReady || !tasksReady) return;

    const normalizeTasks = async () => {
      const tagById = new Map(tags.map((t) => [t.id, t]));
      const tagByName = new Map(tags.map((t) => [t.name.toLowerCase(), t]));
      const active: Task[] = [];
      const archived: Task[] = [];
      const looksLikeId = (text: string) => /^[A-Za-z0-9]{16,}$/.test(text);

      for (const task of rawTasks) {
        const normalizedTagIds: string[] = [];
        const rawTagIds = Array.isArray(task.tagIds) ? task.tagIds : [];

        for (const ref of rawTagIds) {
          const value = typeof ref === "string" ? ref.trim() : "";
          if (!value) continue;

          const byId = tagById.get(value);
          if (byId) {
            normalizedTagIds.push(byId.id);
            continue;
          }

          const byName = tagByName.get(value.toLowerCase());
          if (byName) {
            normalizedTagIds.push(byName.id);
            continue;
          }

          if (looksLikeId(value)) {
            normalizedTagIds.push(value);
            continue;
          }

          const newTagRef = await addDoc(TAG_COLLECTION(uid), { name: value, createdAt: new Date() });
          const newTag: Tag = { id: newTagRef.id, name: value };
          tagById.set(newTag.id, newTag);
          tagByName.set(newTag.name.toLowerCase(), newTag);
          normalizedTagIds.push(newTag.id);
        }

        const dedupedTagIds = Array.from(new Set(normalizedTagIds));
        const needsUpdate =
          dedupedTagIds.length !== rawTagIds.length ||
          dedupedTagIds.some((id, idx) => rawTagIds[idx] !== id);

        const normalizedTask: Task = { ...task, tagIds: dedupedTagIds };
        if (task.archived) archived.push(normalizedTask);
        else active.push(normalizedTask);

        if (needsUpdate) {
          await updateDoc(doc(db, "tasks", task.id), {
            tagIds: dedupedTagIds,
          });
        }
      }

      setTasks(active);
      setArchivedTasks(archived);
    };

    void normalizeTasks();
  }, [rawTasks, tags, uid, setArchivedTasks, setTasks]);

  useEffect(() => {
    if (!editingId) return;
    const frame = window.requestAnimationFrame(() => {
      editingInputRef.current?.focus();
      editingInputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [editingId]);

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

  const create = async () => {
    if (!uid) return;
    const name = input.trim();
    setError(null);
    if (!name) return;

    if (tasks.some((t) => t.name === name)) {
      setError("当前列表已存在同名任务，无法创建");
      return;
    }

    const historical = archivedTasks.find((t) => t.name === name);
    if (historical) {
      const reuse = window.confirm(`检测到你曾创建过任务“${name}”，是否继承历史统计数据？`);
      if (reuse) {
        await updateDoc(doc(db, "tasks", historical.id), {
          archived: false,
          done: false,
          updatedAt: new Date(),
        });
        setInput("");
        return;
      }

      const override = window.confirm("覆盖将删除该任务之前的所有历史记录，是否继续？");
      if (!override) return;

      try {
        const sessionsQuery = query(
          collection(db, "sessions"),
          where("user_uid", "==", uid),
          where("taskId", "==", historical.id)
        );
        const snap = await getDocs(sessionsQuery);
        await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));

        const payload = {
          name,
          tagIds: [],
          priority: "medium" as const,
          done: false,
          archived: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await setDoc(doc(db, "tasks", historical.id), {
          ...payload,
          user_uid: uid,
        });
        setInput("");
        return;
      } catch (e) {
        console.error(e);
        setError("覆盖任务失败，请稍后重试");
        return;
      }
    }

    const payload = {
      name,
      tagIds: [],
      priority: "medium" as const,
      done: false,
      archived: false,
      createdAt: new Date(),
    };

    try {
      await addDoc(tasksCollection, {
        ...payload,
        user_uid: uid,
      });
      setInput("");
    } catch {
      pushOffline({
        type: "task",
        payload: { action: "add", ...payload, user_uid: uid },
      });
    }
  };

  const toggleDone = async (id: string, done: boolean) => {
    if (!uid) return;
    try {
      await updateDoc(doc(db, "tasks", id), { done: !done, updatedAt: new Date() });
    } catch {
      pushOffline({ type: "task", payload: { action: "update", id, done: !done } });
    }
  };

  const archiveTask = async (task: Task) => {
    if (!uid) return;
    const confirmed = window.confirm(`确认删除任务“${task.name}”？此操作会保留历史统计`);
    if (!confirmed) return;
    await updateDoc(doc(db, "tasks", task.id), {
      archived: true,
      archivedAt: new Date(),
    });
  };

  const startEditing = (task: Task) => {
    setEditingId(task.id);
    setEditingName(task.name);
  };

  const saveName = async (task: Task) => {
    if (!uid) return;
    const name = editingName.trim();
    if (!name) return;
    if (tasks.some((t) => t.id !== task.id && t.name === name)) {
      setError("当前列表已存在同名任务，无法创建");
      return;
    }
    await updateDoc(doc(db, "tasks", task.id), { name, updatedAt: new Date() });
    setEditingId(null);
    setEditingName("");
  };

  const removeTagFromTask = async (task: Task, tagId: string) => {
    if (!uid) return;
    const next = (task.tagIds || []).filter((id) => id !== tagId);
    await updateDoc(doc(db, "tasks", task.id), { tagIds: next, updatedAt: new Date() });
  };

  const addTagToTask = async (task: Task, value: string) => {
    if (!uid) return;
    const name = value.trim();
    if (!name) return;

    let tag = tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (!tag) {
      const ref = await addDoc(TAG_COLLECTION(uid), { name, createdAt: new Date() });
      tag = { id: ref.id, name };
    }

    const next = Array.from(new Set([...(task.tagIds || []), tag.id]));
    await updateDoc(doc(db, "tasks", task.id), { tagIds: next, updatedAt: new Date() });
    setTagInputs((prev) => ({ ...prev, [task.id]: "" }));
  };

  const taskNameMap = useMemo(() => {
    const map = new Map<string, string>();
    tags.forEach((t) => map.set(t.id, t.name));
    return map;
  }, [tags]);

  const pendingTasks = useMemo(() => tasks.filter((t) => !t.done), [tasks]);
  const completedTasks = useMemo(() => tasks.filter((t) => t.done), [tasks]);

  const handleConfirmComplete = (task: Task) => {
    if (leavingIds[task.id]) return;
    setLeavingIds((prev) => ({ ...prev, [task.id]: true }));
    window.setTimeout(() => {
      void toggleDone(task.id, false);
      setLeavingIds((prev) => {
        const next = { ...prev };
        delete next[task.id];
        return next;
      });
    }, COMPLETE_ANIMATION_MS);
  };

  const handleTaskClick = (id: string, event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("button, input, textarea, select, a, label")) return;
    void setActiveTask(id);
  };

  const renderTaskItem = (t: Task, variant: "pending" | "completed") => {
    const isLeaving = !!leavingIds[t.id];
    const isPending = variant === "pending";
    const isActive = activeTaskId === t.id;
    const isActionOpen = actionMenuId === t.id;
    const isConfirmingComplete = hoveredAction?.id === t.id && hoveredAction.action === "complete";
    const isConfirmingDelete = hoveredAction?.id === t.id && hoveredAction.action === "delete";
    const isConfirmingAny = hoveredAction?.id === t.id;
    const completeLabel = isPending ? "完成" : "恢复";
    const confirmLabel = isPending ? "已完成？" : "恢复？";
    const clearCloseTimer = () => {
      if (closeMenuTimeout.current) {
        window.clearTimeout(closeMenuTimeout.current);
        closeMenuTimeout.current = null;
      }
    };
    const scheduleCloseMenu = () => {
      clearCloseTimer();
      closeMenuTimeout.current = window.setTimeout(() => {
        setActionMenuId((current) => (current === t.id ? null : current));
        setHoveredAction((current) => (current?.id === t.id ? null : current));
      }, 160);
    };

    return (
      <li
        key={t.id}
        className={`overflow-hidden transition-[max-height,opacity,transform] duration-300 ease-out ${
          isLeaving ? "max-h-0 opacity-0 translate-x-10" : "max-h-[240px] opacity-100 translate-x-0"
        }`}
      >
        <div
          onClick={(event) => handleTaskClick(t.id, event)}
          className={`flex min-w-0 flex-1 cursor-pointer items-start justify-between gap-4 rounded-xl border border-slate-200/80 bg-white/70 px-4 py-3 shadow-sm transition-transform duration-300 dark:border-slate-800/80 dark:bg-slate-900/50 ${
            isActive
              ? "border-indigo-400/80 bg-indigo-50/80 ring-2 ring-indigo-200/70 dark:border-indigo-300/70 dark:bg-indigo-500/10 dark:ring-indigo-400/30"
              : ""
          }`}
        >
          <div className="min-w-0 flex-1 space-y-1">
            {editingId === t.id ? (
              <div className="flex gap-2 items-center">
                <input
                  ref={editingInputRef}
                  className="flex-1 rounded border px-2 py-1 bg-transparent"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={() => void saveName(t)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void saveName(t);
                  }}
                />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={`font-medium w-[12ch] max-w-[12ch] overflow-hidden whitespace-nowrap text-left ${
                    t.name.length > 12 ? "task-name-ticker-container" : ""
                  }`}
                  title={t.name}
                  onClick={() => startEditing(t)}
                >
                  <span className={t.name.length > 12 ? "task-name-ticker" : undefined}>
                    {t.name}
                  </span>
                </button>
              </div>
            )}

            <div className="flex flex-wrap gap-2 text-xs">
              {t.tagIds?.map((tagId) => (
                <span
                  key={tagId}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-1"
                >
                  {taskNameMap.get(tagId) ?? "未知标签"}
                  <button onClick={() => void removeTagFromTask(t, tagId)} aria-label="移除标签">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <div className="flex items-center gap-1">
                <input
                  className="rounded border px-2 py-1 bg-transparent text-xs"
                  placeholder="添加或创建标签"
                  value={tagInputs[t.id] ?? ""}
                  onChange={(e) => setTagInputs((prev) => ({ ...prev, [t.id]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void addTagToTask(t, tagInputs[t.id] ?? "");
                    }
                  }}
                  list={`tag-suggestions-${t.id}`}
                />
                <datalist id={`tag-suggestions-${t.id}`}>
                  {tags.map((tag) => (
                    <option key={tag.id} value={tag.name} />
                  ))}
                </datalist>
                <button
                  className="text-xs underline"
                  onClick={() => void addTagToTask(t, tagInputs[t.id] ?? "")}
                >
                  添加
                </button>
              </div>
            </div>

            <div className="text-xs opacity-70">优先级：{t.priority}</div>
          </div>
          <div
            className="relative flex items-center justify-end w-[152px] shrink-0"
            onMouseLeave={scheduleCloseMenu}
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                scheduleCloseMenu();
              }
            }}
          >
            <div className="absolute right-9 top-1/2 -translate-y-1/2">
              <div
                className={`grid w-[120px] grid-cols-2 overflow-hidden rounded-full border border-slate-200/70 bg-white/90 text-xs shadow-sm transition-all duration-200 ease-out dark:border-slate-700 dark:bg-slate-900/90 ${
                  isActionOpen
                    ? "opacity-100 translate-x-0 pointer-events-auto"
                    : "opacity-0 translate-x-3 pointer-events-none"
                }`}
                onMouseEnter={() => {
                  clearCloseTimer();
                  setActionMenuId(t.id);
                }}
                onMouseLeave={scheduleCloseMenu}
              >
                <button
                  type="button"
                  className={`h-8 w-full px-2 text-center transition-colors ${
                    isConfirmingComplete ? "text-emerald-600" : "text-slate-600"
                  } ${isConfirmingAny && !isConfirmingComplete ? "opacity-50" : ""}`}
                  onMouseEnter={() => setHoveredAction({ id: t.id, action: "complete" })}
                  onFocus={() => setHoveredAction({ id: t.id, action: "complete" })}
                  onClick={() => {
                    if (!isConfirmingComplete) return;
                    if (isPending) {
                      handleConfirmComplete(t);
                    } else {
                      void toggleDone(t.id, true);
                    }
                  }}
                >
                  {isConfirmingComplete ? confirmLabel : completeLabel}
                </button>
                <button
                  type="button"
                  className={`h-8 w-full px-2 text-center transition-colors ${
                    isConfirmingDelete ? "text-red-600" : "text-slate-600"
                  } ${isConfirmingAny && !isConfirmingDelete ? "opacity-50" : ""}`}
                  onMouseEnter={() => setHoveredAction({ id: t.id, action: "delete" })}
                  onFocus={() => setHoveredAction({ id: t.id, action: "delete" })}
                  onClick={() => {
                    if (!isConfirmingDelete) return;
                    void archiveTask(t);
                  }}
                >
                  {isConfirmingDelete ? "删除？" : "删除"}
                </button>
              </div>
            </div>
            <button
              type="button"
              className="relative z-10 h-8 w-8 rounded-full border border-slate-200/70 text-slate-500 transition-colors hover:text-slate-700 dark:border-slate-700 dark:text-slate-300"
              aria-label="任务操作"
              onMouseEnter={() => {
                clearCloseTimer();
                setActionMenuId(t.id);
              }}
              onFocus={() => {
                clearCloseTimer();
                setActionMenuId(t.id);
              }}
              onMouseLeave={scheduleCloseMenu}
            >
              ⋯
            </button>
          </div>
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
        <input
          className="flex-1 rounded border px-3 py-2 bg-transparent"
          placeholder="任务名称"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <div className="flex gap-2 items-center">
          <button
            onClick={create}
            className="inline-flex items-center gap-1 px-3 py-2 rounded bg-slate-900 text-white dark:bg-white dark:text-slate-900"
          >
            <Plus className="w-4 h-4" /> 添加
          </button>
          <button
            onClick={() => setShowTagManager(true)}
            className="inline-flex items-center gap-1 px-3 py-2 rounded border"
          >
            <TagIcon className="w-4 h-4" /> 标签管理
          </button>
        </div>
      </div>
      {error ? <div className="text-sm text-red-500">{error}</div> : null}

      <div className="space-y-4">
        <details open className="space-y-2 group">
          <summary className="text-sm font-semibold cursor-pointer select-none list-none flex items-center justify-between rounded-md border border-slate-200/70 dark:border-slate-800 px-3 py-2 bg-slate-50/70 dark:bg-slate-900/40 hover:bg-slate-100/70 dark:hover:bg-slate-900/70 transition">
            <span className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-200/70 dark:bg-slate-800">
                <ChevronDown className="w-4 h-4 group-open:hidden" />
                <ChevronUp className="w-4 h-4 hidden group-open:block" />
              </span>
              未完成任务
            </span>
            <span className="text-xs text-slate-500">共 {pendingTasks.length} 项</span>
          </summary>
          {pendingTasks.length ? (
            <ul className="space-y-3">
              {pendingTasks.map((t) => renderTaskItem(t, "pending"))}
            </ul>
          ) : (
            <div className="text-sm text-slate-500">暂无未完成任务</div>
          )}
        </details>
        <details className="space-y-2 group">
          <summary className="text-sm font-semibold cursor-pointer select-none list-none flex items-center justify-between rounded-md border border-slate-200/70 dark:border-slate-800 px-3 py-2 bg-slate-50/70 dark:bg-slate-900/40 hover:bg-slate-100/70 dark:hover:bg-slate-900/70 transition">
            <span className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-200/70 dark:bg-slate-800">
                <ChevronDown className="w-4 h-4 group-open:hidden" />
                <ChevronUp className="w-4 h-4 hidden group-open:block" />
              </span>
              已完成任务
            </span>
            <span className="text-xs text-slate-500">共 {completedTasks.length} 项</span>
          </summary>
          {completedTasks.length ? (
            <ul className="space-y-3">
              {completedTasks.map((t) => renderTaskItem(t, "completed"))}
            </ul>
          ) : (
            <div className="text-sm text-slate-500">暂无已完成任务</div>
          )}
        </details>
      </div>

      <TagManager
        open={showTagManager}
        onClose={() => setShowTagManager(false)}
        uid={uid}
        onRemoveTagFromTasks={async (tagId) => {
          if (!uid) return;
          const affected = [...tasks, ...archivedTasks].filter((t) => t.tagIds?.includes(tagId));
          await Promise.all(
            affected.map((t) =>
              updateDoc(doc(db, "tasks", t.id), {
                tagIds: (t.tagIds || []).filter((id) => id !== tagId),
                updatedAt: new Date(),
              })
            )
          );
        }}
      />
    </div>
  );
}
