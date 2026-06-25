import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "線上預約系統",
  title: "線上預約系統",
  description: "支援 Zoom 邀請解析、公開預約與管理後台的線上預約系統。",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "線上預約系統",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#287067",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
