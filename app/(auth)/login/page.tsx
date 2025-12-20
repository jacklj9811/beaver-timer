"use client";
import { useState, FormEvent } from "react";
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
    // 1. 背景容器：深色背景 + 溢出隐藏
    <div className="min-h-screen relative overflow-hidden bg-slate-950 text-slate-100 selection:bg-indigo-500/30">
      
      {/* 2. 背景氛围光斑（纯装饰） */}
      <div className="absolute inset-0 z-0">
        <div className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-indigo-500/20 blur-[120px]" />
        <div className="absolute top-1/2 left-0 h-64 w-64 -translate-y-1/2 rounded-full bg-sky-500/10 blur-[100px]" />
        <div className="absolute -bottom-24 right-1/4 h-72 w-72 rounded-full bg-indigo-400/20 blur-[120px]" />
      </div>

      {/* 3. 主要内容区域 */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
          
          {/* 头部标题区 */}
          <div className="mb-8">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-400 mb-2">Beaver Timer</p>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              {isLogin ? "欢迎回来" : "创建账号"}
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              {isLogin ? "登录以同步你的专注数据。" : "开始你的高效专注之旅。"}
            </p>
          </div>

          <form className="space-y-4" onSubmit={onSubmit}>
            {/* 邮箱输入框 */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300 ml-1">邮箱</label>
              <input
                type="email"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/20 transition-all focus:border-indigo-500/50 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {/* 密码输入框 */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300 ml-1">密码</label>
              <input
                type="password"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/20 transition-all focus:border-indigo-500/50 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="••••••••"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                required
              />
            </div>

            {/* 错误提示 */}
            {err && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                {err}
              </div>
            )}

            {/* 提交按钮：渐变色 + 阴影 */}
            <button className="group w-full rounded-xl bg-gradient-to-r from-indigo-500 to-sky-500 p-[1px] text-white shadow-lg shadow-indigo-500/25 transition-all hover:shadow-indigo-500/40 hover:brightness-110 active:scale-[0.98]">
              <div className="rounded-[11px] bg-transparent px-4 py-3 text-sm font-semibold">
                <span className="flex items-center justify-center gap-2">
                  {isLogin ? "登 录" : "注 册"} 
                  <span className="transition-transform group-hover:translate-x-1">→</span>
                </span>
              </div>
            </button>
          </form>

          {/* 分割线 */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/10" />
            <span className="text-xs text-white/30">或者</span>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/10" />
          </div>

          {/* Google 登录 */}
          <button
            onClick={async () => {
              try {
                await signInWithPopup(auth, googleProvider);
                window.location.href = "/";
              } catch (e: any) {
                setErr(e.message || "Google 登录失败");
              }
            }}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10 hover:border-white/20 active:bg-white/5"
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512"><path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path></svg>
              使用 Google 继续
            </span>
          </button>

          {/* 底部切换和返回 */}
          <div className="mt-8">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">
                {isLogin ? "还没有账号？" : "已有账号？"}
              </span>
              <button
                className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-indigo-300 transition-colors hover:bg-indigo-500/10 hover:text-indigo-200"
                onClick={() => setIsLogin(!isLogin)}
              >
                {isLogin ? "去注册" : "去登录"}
              </button>
            </div>
            
            <div className="mt-6 text-center">
              <Link href="/" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                ← 返回首页
              </Link>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}