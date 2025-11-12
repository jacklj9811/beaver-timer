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
    <div className="min-h-screen grid place-items-center">
      <div className="w-full max-w-md p-6 rounded-2xl border">
        <h1 className="text-2xl font-semibold mb-4">{isLogin ? "登录" : "注册"}</h1>

        <form className="space-y-3" onSubmit={onSubmit}>
          <input
            type="email"
            className="w-full rounded border px-3 py-2 bg-transparent"
            placeholder="邮箱"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            className="w-full rounded border px-3 py-2 bg-transparent"
            placeholder="密码"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            required
          />
          {err ? <div className="text-red-500 text-sm">{err}</div> : null}
          <button className="w-full py-2 rounded bg-slate-900 text-white dark:bg-white dark:text-slate-900">
            {isLogin ? "登录" : "注册"}
          </button>
        </form>

        <button
          onClick={async () => {
            try {
              await signInWithPopup(auth, googleProvider);
              window.location.href = "/";
            } catch (e: any) {
              setErr(e.message || "Google 登录失败");
            }
          }}
          className="w-full py-2 rounded border mt-3"
        >
          使用 Google 登录
        </button>

        <div className="text-sm mt-3">
          {isLogin ? "还没有账号？" : "已有账号？"}{" "}
          <button className="underline" onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? "注册一个" : "去登录"}
          </button>
        </div>

        <div className="mt-4 text-sm opacity-70">
          <Link href="/">返回首页</Link>
        </div>
      </div>
    </div>
  );
}
