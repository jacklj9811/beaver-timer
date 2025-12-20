import "./globals.css";

export const metadata = {
  title: "海狸时钟 Beaver Timer",
  description: "多设备实时同步的番茄时钟"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh">
      <body>{children}</body>
    </html>
  );
}
