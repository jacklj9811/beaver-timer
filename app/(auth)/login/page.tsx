"use client";
import { FormEvent, useState } from "react";
import { auth, googleProvider } from "@/lib/firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [err, setErr] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, pwd);
      } else {
        await createUserWithEmailAndPassword(auth, email, pwd);
      }
      window.location.href = "/";
    } catch (e: any) {
      setErr(e.message || "Auth error");
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950 text-slate-100">
      <div className="absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-indigo-500/30 blur-[120px]" />
        <div className="absolute -bottom-24 right-1/4 h-72 w-72 rounded-full bg-sky-400/20 blur-[120px]" />
      </div>
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-white/50">Beaver Timer</p>
              <h1 className="mt-2 text-3xl font-semibold">{isLogin ? "欢迎回来" : "创建账号"}</h1>
              <p className="mt-2 text-sm text-white/70">
                {isLogin ? "登录后继续你的专注计时。" : "注册后即可同步你的专注记录。"}
              </p>
            </div>
            <span className="hidden sm:inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
              {isLogin ? "登录" : "注册"}
            </span>
          </div>

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <label className="block text-sm">
              <span className="text-white/70">邮箱</span>
              <input
                type="email"
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder:text-white/40 shadow-sm outline-none transition focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-400/30"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label className="block text-sm">
              <span className="text-white/70">密码</span>
              <input
                type="password"
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder:text-white/40 shadow-sm outline-none transition focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-400/30"
                placeholder="至少 6 位"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                required
              />
            </label>
            {err ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{err}</div> : null}
            <button className="group w-full rounded-xl bg-gradient-to-r from-indigo-400 via-indigo-500 to-sky-400 px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-lg shadow-indigo-500/30 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300">
              <span className="inline-flex items-center justify-center gap-2">
                {isLogin ? "登录" : "注册"}
                <span className="text-base transition-transform group-hover:translate-x-0.5">→</span>
              </span>
            </button>
          </form>

          <div className="mt-4 flex items-center gap-3 text-xs text-white/40">
            <span className="h-px flex-1 bg-white/10" />
            其他方式
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <button
            onClick={async () => {
              try {
                await signInWithPopup(auth, googleProvider);
                window.location.href = "/";
              } catch (e: any) {
                setErr(e.message || "Google 登录失败");
              }
            }}
            className="mt-4 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:border-white/30 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            使用 Google 登录
          </button>

          <div className="mt-5 flex items-center justify-between text-sm text-white/70">
            <span>{isLogin ? "还没有账号？" : "已有账号？"}</span>
            <button
              className="rounded-full border border-white/20 px-4 py-1 text-xs font-semibold text-white transition hover:border-white/40 hover:text-white"
              onClick={() => setIsLogin(!isLogin)}
              type="button"
            >
              {isLogin ? "注册一个" : "去登录"}
            </button>
          </div>

          <div className="mt-6 text-xs text-white/50">
            <Link className="transition hover:text-white" href="/">
              ← 返回首页
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
