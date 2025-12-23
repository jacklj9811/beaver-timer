"use client";
import { useState } from "react";
import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useStore } from "@/store/useStore";
import { Trash2 } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  uid: string | null;
  onDeleteTag: (tagId: string) => Promise<void>;
}

export default function TagManager({ open, onClose, uid, onDeleteTag }: Props) {
  const tags = useStore((s) => s.tags);
  const [input, setInput] = useState("");
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const createTag = async () => {
    if (!uid) return;
    const name = input.trim();
    if (!name) return;
    if (tags.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      setError("已存在同名标签");
      return;
    }
    setError(null);
    await addDoc(collection(db, "users", uid, "tags"), { name, createdAt: serverTimestamp() });
    setInput("");
  };

  const saveRename = async (tagId: string) => {
    if (!uid) return;
    const name = (editing[tagId] ?? "").trim();
    if (!name) return;
    if (tags.some((t) => t.id !== tagId && t.name.toLowerCase() === name.toLowerCase())) {
      setError("已存在同名标签");
      return;
    }
    setError(null);
    await updateDoc(doc(db, "users", uid, "tags", tagId), { name, updatedAt: serverTimestamp() });
    setEditing((prev) => {
      const next = { ...prev };
      delete next[tagId];
      return next;
    });
  };

  const deleteTag = async (tagId: string, tagName: string) => {
    if (!uid) return;
    const confirmed = window.confirm(`确认删除标签「${tagName}」？相关任务会解除关联`);
    if (!confirmed) return;
    await onDeleteTag(tagId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-lg p-4 space-y-4 border">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">标签管理</h3>
          <button onClick={onClose} className="text-sm underline">
            关闭
          </button>
        </div>

        {error ? <div className="text-sm text-red-500">{error}</div> : null}

        <div className="flex gap-2">
          <input
            className="flex-1 rounded border px-2 py-1 bg-transparent"
            placeholder="新增标签名"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void createTag();
            }}
          />
          <button onClick={createTag} className="px-3 py-1 rounded border">
            新建
          </button>
        </div>

        <div className="space-y-2 max-h-72 overflow-y-auto">
          {tags.length ? (
            tags.map((tag) => (
              <div key={tag.id} className="flex items-center gap-2">
                <input
                  className="flex-1 rounded border px-2 py-1 bg-transparent"
                  value={editing[tag.id] ?? tag.name}
                  onChange={(e) => setEditing((prev) => ({ ...prev, [tag.id]: e.target.value }))}
                  onBlur={() => void saveRename(tag.id)}
                />
                <button className="text-sm underline" onClick={() => void saveRename(tag.id)}>
                  重命名
                </button>
                <button
                  className="w-9 h-9 grid place-items-center rounded border border-red-300 text-red-600"
                  onClick={() => void deleteTag(tag.id, tag.name)}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          ) : (
            <div className="text-sm opacity-70">暂无标签</div>
          )}
        </div>
      </div>
    </div>
  );
}
