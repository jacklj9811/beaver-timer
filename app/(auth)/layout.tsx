export const metadata = {
  title: "登录 - 海狸时钟 Beaver Timer",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh">
      <body className="bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
        <main className="min-h-screen grid place-items-center">
          {children}
        </main>
      </body>
    </html>
  );
}
