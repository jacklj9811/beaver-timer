"use client";
import { ReactNode, useEffect, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Link from "next/link";

export default function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setReady(true);
    });
    return () => unsub();
  }, []);

  if (!ready) return <div className="h-screen grid place-items-center">Loading…</div>;
  if (!user) {
    return (
      <div className="h-screen grid place-items-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-semibold">海狸时钟 Beaver Timer</h1>
          <p>请先登录以开始专注。</p>
          <Link className="inline-block px-4 py-2 rounded bg-slate-900 text-white dark:bg-white dark:text-slate-900" href="/(auth)/login">去登录</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {children}
      <div className="fixed bottom-3 right-3 text-xs opacity-70">
        <button
          onClick={() => signOut(auth)}
          className="underline"
        >
          退出登录
        </button>
      </div>
    </div>
  );
}
