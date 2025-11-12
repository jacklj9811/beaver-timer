"use client";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem("theme_dark") === "1";
    setDark(stored);
    document.documentElement.classList.toggle("dark", stored);
  }, []);
  return (
    <button
      onClick={() => {
        const next = !dark;
        setDark(next);
        localStorage.setItem("theme_dark", next ? "1" : "0");
        document.documentElement.classList.toggle("dark", next);
      }}
      className="px-2 py-1 rounded border border-slate-200/60 dark:border-slate-700/60 text-sm"
      aria-label="Toggle theme"
    >
      {dark ? "🌙" : "☀️"}
    </button>
  );
}
