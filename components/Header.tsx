"use client";
import Link from "next/link";
import ThemeToggle from "./ThemeToggle";

export default function Header() {
  return (
    <header className="border-b border-slate-200/50 dark:border-slate-800/70">
      <div className="container-page flex items-center justify-between py-3">
        <Link href="/" className="font-semibold">🐾 海狸时钟</Link>
        <nav className="flex items-center gap-4">
          <Link href="/(main)/stats" className="opacity-80 hover:opacity-100">统计</Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
