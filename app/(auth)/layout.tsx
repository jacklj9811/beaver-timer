export const metadata = {
  title: "登录 - 海狸时钟 Beaver Timer",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <main>{children}</main>
    </div>
  );
}
