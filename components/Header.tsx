"use client";
import Link from "next/link";
import ThemeToggle from "./ThemeToggle";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { onSnapshot } from "firebase/firestore";
import { userDoc } from "@/lib/firestore";

type UserProfile = {
  nickname?: string | null;
};

export default function Header() {
  const [accountLabel, setAccountLabel] = useState<string>("");

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeProfile?.();
      if (!user) {
        setAccountLabel("");
        return;
      }

      const fallback = user.displayName || user.email || user.uid;
      setAccountLabel(fallback);

      unsubscribeProfile = onSnapshot(userDoc(user.uid), (snap) => {
        const data = snap.data() as UserProfile | undefined;
        const nickname = data?.nickname?.trim();
        setAccountLabel(nickname || fallback);
      });
    });

    return () => {
      unsubscribeProfile?.();
      unsubscribeAuth();
    };
  }, []);

  return (
    <header className="border-b border-slate-200/50 dark:border-slate-800/70">
      <div className="container-page flex items-center justify-between py-3">
        <Link href="/" className="font-semibold">🐾 海狸时钟</Link>
        <nav className="flex items-center gap-4">
          <Link href="/stats" className="opacity-80 hover:opacity-100">统计</Link>
          {accountLabel ? (
            <div className="flex items-center gap-3 text-sm">
              <span className="hidden sm:inline text-slate-600 dark:text-slate-300">当前账号：{accountLabel}</span>
              <Link
                href="/profile"
                className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-500"
              >
                设置昵称
              </Link>
            </div>
          ) : null}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
