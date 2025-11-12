import "../globals.css";
import AuthGate from "@/components/AuthGate";
import Header from "@/components/Header";

export const metadata = {
  title: "海狸时钟 Beaver Timer",
  description: "多设备实时同步的番茄时钟"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body>
        <AuthGate>
          <Header />
          <main className="container-page py-6">{children}</main>
        </AuthGate>
      </body>
    </html>
  );
}
