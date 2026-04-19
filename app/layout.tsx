import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-Hant"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      style={{ colorScheme: "light" }}
    >
      <body className="min-h-full flex flex-col bg-[#fafaf7] text-zinc-900">
        {children}
      </body>
    </html>
  );
}
