"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { auth } from "@/lib/firebase";
import { userDoc } from "@/lib/firestore";

type ProfileData = {
  nickname?: string | null;
  email?: string | null;
};

export default function ProfilePage() {
  const [uid, setUid] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeProfile?.();
      setUid(user?.uid ?? null);
      setEmail(user?.email ?? "");
      setMessage(null);

      if (!user) return;

      unsubscribeProfile = onSnapshot(userDoc(user.uid), (snap) => {
        const data = snap.data() as ProfileData | undefined;
        setNickname(data?.nickname ?? "");
      });
    });

    return () => {
      unsubscribeProfile?.();
      unsubscribeAuth();
    };
  }, []);

  const handleSave = async () => {
    if (!uid) return;
    setSaving(true);
    setMessage(null);
    try {
      await setDoc(
        userDoc(uid),
        {
          nickname: nickname.trim(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setMessage("昵称已更新。");
    } catch (error) {
      console.error(error);
      setMessage("保存失败，请稍后再试。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">账号信息</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          设置一个更友好的昵称，用于展示在登录后的页面中。
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="space-y-4">
          <div>
            <div className="text-sm text-slate-500 dark:text-slate-400">登录账号</div>
            <div className="mt-1 font-medium">{email || "—"}</div>
          </div>

          <label className="block space-y-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">昵称</span>
            <input
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="输入一个昵称"
            />
          </label>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              disabled={!uid || saving}
            >
              {saving ? "保存中..." : "保存昵称"}
            </button>
            {message ? <span className="text-sm text-slate-600 dark:text-slate-300">{message}</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
