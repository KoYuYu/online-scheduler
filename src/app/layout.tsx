import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "線上預約系統",
  description: "支援 Zoom 邀請解析、公開預約與管理後台的線上預約系統。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
