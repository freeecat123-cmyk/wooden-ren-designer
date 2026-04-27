import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { HeaderUser } from "@/components/auth/HeaderUser";
import { StudentWelcomeModal } from "@/components/StudentWelcomeModal";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "木頭仁家具設計生成器 · 自動產出工程圖紙",
  description:
    "輸入尺寸選木材，自動產出三視圖、透視圖、榫卯細節、材料單、工具清單、A4 PDF 工程圖紙。木頭仁木匠學院出品。",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "木頭仁",
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/logo.png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#8B4513",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // SSR 階段先讀一次 user，傳給 client AuthProvider 避免閃白「未登入」
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html
      lang="zh-Hant"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      style={{ colorScheme: "light" }}
    >
      <body className="bg-[#fafaf7] text-zinc-900">
        <AuthProvider initialUser={user}>
          {/* 全站固定右上角浮動的登入狀態 widget，不干擾既有 per-page header */}
          <div className="fixed top-4 right-4 z-40">
            <HeaderUser />
          </div>
          {children}
          <StudentWelcomeModal />
        </AuthProvider>
      </body>
    </html>
  );
}
