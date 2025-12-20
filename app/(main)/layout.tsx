import AuthGate from "@/components/AuthGate";
import Header from "@/components/Header";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <Header />
      <main className="container-page py-6">{children}</main>
    </AuthGate>
  );
}
