"use client";
import { useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent } from "react";
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
  orderBy,
  deleteDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useStore, Task, Tag } from "@/store/useStore";
import { pushOffline } from "@/utils/mergeOffline";
import { tasksCollection, updatePresence, userDoc } from "@/lib/firestore";
import { Plus, Tag as TagIcon, X, ChevronDown, ChevronUp, GripVertical } from "lucide-react";
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
  const [hoveredAction, setHoveredAction] = useState<{
    id: string;
    action: "complete" | "delete";
  } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const editingInputRef = useRef<HTMLInputElement | null>(null);

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

      const tasksQuery = query(tasksCollection, where("user_uid", "==", u.uid), orderBy("order", "asc"));
      const tagsCol = TAG_COLLECTION(u.uid);

      unsubTasks = onSnapshot(tasksQuery, (snap) => {
        const list = snap.docs.map((d) => {
          const data = d.data() as any;
          const order = typeof data.order === "number" ? data.order : undefined;
          return {
            id: d.id,
            name: data.name ?? "",
            tagIds: data.tagIds ?? data.tags ?? [],
            order,
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
      const existingOrders = rawTasks
        .map((task) => task.order)
        .filter((order): order is number => typeof order === "number");
      let nextOrder = existingOrders.length ? Math.max(...existingOrders) + 1 : 0;

      for (const task of rawTasks) {
        const normalizedTagIds: string[] = [];
        const rawTagIds = Array.isArray(task.tagIds) ? task.tagIds : [];
        let order = typeof task.order === "number" ? task.order : undefined;
        if (order === undefined) {
          order = nextOrder;
          nextOrder += 1;
        }

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
        const needsTagUpdate =
          dedupedTagIds.length !== rawTagIds.length ||
          dedupedTagIds.some((id, idx) => rawTagIds[idx] !== id);
        const needsOrderUpdate = order !== task.order;

        const normalizedTask: Task = { ...task, tagIds: dedupedTagIds, order };
        if (task.archived) archived.push(normalizedTask);
        else active.push(normalizedTask);

        if (needsTagUpdate || needsOrderUpdate) {
          await updateDoc(doc(db, "tasks", task.id), {
            ...(needsTagUpdate ? { tagIds: dedupedTagIds } : {}),
            ...(needsOrderUpdate ? { order } : {}),
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

    const maxOrder = tasks.reduce((max, task) => Math.max(max, task.order ?? -1), -1);
    const nextOrder = maxOrder + 1;

    const historical = archivedTasks.find((t) => t.name === name);
    if (historical) {
      const reuse = window.confirm(`检测到你曾创建过任务“${name}”，是否继承历史统计数据？`);
      if (reuse) {
        await updateDoc(doc(db, "tasks", historical.id), {
          archived: false,
          done: false,
          order: nextOrder,
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
          order: nextOrder,
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
      order: nextOrder,
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

  const sortByOrder = (a: Task, b: Task) => (a.order ?? 0) - (b.order ?? 0);
  const pendingTasks = useMemo(
    () => [...tasks.filter((t) => !t.done)].sort(sortByOrder),
    [tasks]
  );
  const completedTasks = useMemo(
    () => [...tasks.filter((t) => t.done)].sort(sortByOrder),
    [tasks]
  );

  const persistOrder = async (ordered: Task[]) => {
    if (!uid) return;
    try {
      await Promise.all(
        ordered.map((task, index) =>
          updateDoc(doc(db, "tasks", task.id), { order: index, updatedAt: new Date() })
        )
      );
    } catch {
      ordered.forEach((task, index) => {
        pushOffline({ type: "task", payload: { action: "update", id: task.id, order: index } });
      });
    }
  };

  const applyOrder = (ordered: Task[]) => {
    const orderMap = new Map(ordered.map((task, index) => [task.id, index]));
    const nextTasks = tasks.map((task) => {
      const order = orderMap.get(task.id);
      return order === undefined ? task : { ...task, order };
    });
    setTasks(nextTasks);
    void persistOrder(ordered);
  };

  const reorderList = (list: Task[], fromId: string, toId: string) => {
    const fromIndex = list.findIndex((task) => task.id === fromId);
    const toIndex = list.findIndex((task) => task.id === toId);
    if (fromIndex === -1 || toIndex === -1) return null;
    const next = [...list];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
  };

  const handleDragStart = (id: string) => (event: DragEvent) => {
    event.dataTransfer.setData("text/plain", id);
    event.dataTransfer.effectAllowed = "move";
    setDraggingId(id);
  };

  const handleDragOver = (id: string) => (event: DragEvent) => {
    event.preventDefault();
    if (dragOverId !== id) setDragOverId(id);
  };

  const handleDrop = (list: Task[], targetId: string) => (event: DragEvent) => {
    event.preventDefault();
    const sourceId = draggingId ?? event.dataTransfer.getData("text/plain");
    if (!sourceId || sourceId === targetId) {
      setDragOverId(null);
      return;
    }
    const reordered = reorderList(list, sourceId, targetId);
    if (reordered) applyOrder(reordered);
    setDragOverId(null);
  };

  const handleDragEnd = (_event?: DragEvent) => {
    setDraggingId(null);
    setDragOverId(null);
  };

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

  const renderTaskItem = (
    t: Task,
    variant: "pending" | "completed",
    dragProps: {
      onDragStart: (event: DragEvent) => void;
      onDragEnd: (event: DragEvent) => void;
      isDragging: boolean;
      isOver: boolean;
    }
  ) => {
    const isPending = variant === "pending";
    const isActive = activeTaskId === t.id;
    const isConfirmingComplete = hoveredAction?.id === t.id && hoveredAction.action === "complete";
    const isConfirmingDelete = hoveredAction?.id === t.id && hoveredAction.action === "delete";
    const isConfirmingAny = hoveredAction?.id === t.id;
    const completeLabel = isPending ? "完成" : "恢复";
    const confirmLabel = isPending ? "已完成？" : "恢复？";

    return (
      <div
        onClick={(event) => handleTaskClick(t.id, event)}
        className={`flex min-w-0 flex-1 cursor-pointer items-start justify-between gap-4 rounded-xl border border-slate-200/80 bg-white/70 px-4 py-3 shadow-sm transition-transform duration-300 dark:border-slate-800/80 dark:bg-slate-900/50 ${
          isActive
            ? "border-indigo-400/80 bg-indigo-50/80 ring-2 ring-indigo-200/70 dark:border-indigo-300/70 dark:bg-indigo-500/10 dark:ring-indigo-400/30"
            : ""
        } ${dragProps.isDragging ? "scale-[0.99] opacity-90 shadow-md" : ""} ${
          dragProps.isOver ? "ring-2 ring-indigo-200/70" : ""
        }`}
      >
        <div className="flex min-w-0 flex-1 gap-3">
          <button
            type="button"
            draggable
            onDragStart={dragProps.onDragStart}
            onDragEnd={dragProps.onDragEnd}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 cursor-grab active:cursor-grabbing"
            aria-label="拖拽排序"
          >
            <GripVertical className="h-4 w-4" />
          </button>
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
          </div>
        </div>
          <div
            className="group/action relative flex items-center justify-end w-[152px] shrink-0"
            onMouseLeave={() =>
              setHoveredAction((current) => (current?.id === t.id ? null : current))
            }
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setHoveredAction((current) => (current?.id === t.id ? null : current));
              }
            }}
          >
            <div className="absolute right-9 top-1/2 -translate-y-1/2">
              <div
                className={`grid w-[120px] grid-cols-2 overflow-hidden rounded-full border border-slate-200/70 bg-white/90 text-xs shadow-sm transition-all duration-200 ease-out dark:border-slate-700 dark:bg-slate-900/90 ${
                  isConfirmingAny ? "opacity-100 translate-x-0 pointer-events-auto" : "opacity-0 translate-x-3 pointer-events-none"
                } group-hover/action:opacity-100 group-hover/action:translate-x-0 group-hover/action:pointer-events-auto group-hover/action:delay-100`}
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
            >
              ⋯
            </button>
          </div>
      </div>
    );
  };

  const TaskItem = ({
    task,
    variant,
    list,
  }: {
    task: Task;
    variant: "pending" | "completed";
    list: Task[];
  }) => {
    const isLeaving = !!leavingIds[task.id];
    const isDragging = draggingId === task.id;
    const isOver = dragOverId === task.id && draggingId !== task.id;

    return (
      <li
        onDragOver={handleDragOver(task.id)}
        onDrop={handleDrop(list, task.id)}
        className={`overflow-hidden transition-[max-height,opacity,transform] duration-300 ease-out ${
          isLeaving ? "max-h-0 opacity-0 translate-x-10" : "max-h-[240px] opacity-100 translate-x-0"
        }`}
      >
        {renderTaskItem(task, variant, {
          onDragStart: handleDragStart(task.id),
          onDragEnd: handleDragEnd,
          isDragging,
          isOver,
        })}
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
              {pendingTasks.map((t) => (
                <TaskItem key={t.id} task={t} variant="pending" list={pendingTasks} />
              ))}
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
              {completedTasks.map((t) => (
                <TaskItem key={t.id} task={t} variant="completed" list={completedTasks} />
              ))}
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
