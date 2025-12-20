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
    // 最外层容器：深色背景，全屏高度
    <div className="min-h-screen w-full relative overflow-hidden bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">
      
      {/* 背景氛围光效（绝对定位） */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] left-1/2 w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px] -translate-x-1/2" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-sky-600/10 rounded-full blur-[100px]" />
      </div>

      {/* 主要内容区域 */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-8">
          
          {/* 标题部分 */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white tracking-tight">
              {isLogin ? "欢迎回来" : "加入海狸计时"}
            </h1>
            <p className="text-sm text-slate-400 mt-2">
              {isLogin ? "继续你的专注之旅" : "开始记录你的每一次专注"}
            </p>
          </div>

          <form className="space-y-5" onSubmit={onSubmit}>
            {/* 邮箱输入 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 ml-1">邮箱</label>
              <input
                type="email"
                className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all placeholder:text-slate-600"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {/* 密码输入 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 ml-1">密码</label>
              <input
                type="password"
                className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all placeholder:text-slate-600"
                placeholder="••••••••"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                required
              />
            </div>

            {/* 错误信息 */}
            {err && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-2 rounded-lg">
                {err}
              </div>
            )}

            {/* 主按钮 */}
            <button className="w-full bg-gradient-to-r from-indigo-500 to-sky-500 text-white font-semibold py-3 px-4 rounded-xl hover:shadow-lg hover:shadow-indigo-500/25 active:scale-[0.98] transition-all duration-200">
              {isLogin ? "登 录" : "注 册"}
            </button>
          </form>

          {/* 分割线 */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-transparent px-2 text-slate-500">或者</span>
            </div>
          </div>

          {/* Google 登录按钮 */}
          <button
            onClick={async () => {
              try {
                await signInWithPopup(auth, googleProvider);
                window.location.href = "/";
              } catch (e: any) {
                setErr(e.message || "Google 登录失败");
              }
            }}
            className="w-full flex items-center justify-center gap-3 bg-white text-slate-900 font-medium py-3 px-4 rounded-xl hover:bg-slate-100 transition-colors"
          >
            {/* 修复：显式设置 SVG 宽高，防止图标巨大化 */}
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z"
                fill="#FBBC05"
              />
              <path
                d="M12 4.63c1.69 0 3.26.58 4.54 1.8l3.49-3.49C17.92.95 15.18 0 12 0 7.7 0 3.99 2.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            使用 Google 账号
          </button>

          {/* 底部链接 */}
          <div className="mt-8 flex flex-col items-center gap-4 text-sm">
            <p className="text-slate-400">
              {isLogin ? "还没有账号？" : "已有账号？"}{" "}
              <button 
                onClick={() => setIsLogin(!isLogin)}
                className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
              >
                {isLogin ? "立即注册" : "直接登录"}
              </button>
            </p>
            <Link href="/" className="text-slate-500 hover:text-slate-300 text-xs transition-colors">
              ← 返回首页
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}