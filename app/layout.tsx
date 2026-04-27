import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { HeaderUser } from "@/components/auth/HeaderUser";
import { StudentWelcomeModal } from "@/components/StudentWelcomeModal";
import { StudentExpiryNotice } from "@/components/StudentExpiryNotice";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://wooden-ren-designer.vercel.app";
const SITE_TITLE = "木頭仁家具設計生成器 · 自動產出工程圖紙";
const SITE_DESC =
  "輸入尺寸選木材，自動產出三視圖、透視圖、榫卯細節、材料單、工具清單、A4 PDF 工程圖紙。木頭仁木匠學院出品。";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESC,
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "木頭仁",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16.png", type: "image/png", sizes: "16x16" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    locale: "zh_TW",
    url: SITE_URL,
    siteName: "木頭仁工程圖生成器",
    title: SITE_TITLE,
    description: SITE_DESC,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: SITE_TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESC,
    images: ["/og.png"],
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "木頭仁工程圖生成器",
              alternateName: "木頭仁家具設計生成器",
              applicationCategory: "DesignApplication",
              operatingSystem: "Web",
              url: SITE_URL,
              description: SITE_DESC,
              inLanguage: "zh-TW",
              offers: [
                { "@type": "Offer", name: "免費試用", price: "0", priceCurrency: "TWD" },
                { "@type": "Offer", name: "個人版", price: "290", priceCurrency: "TWD" },
                { "@type": "Offer", name: "專業版", price: "890", priceCurrency: "TWD" },
              ],
              creator: {
                "@type": "Organization",
                name: "木頭仁木匠學院 Wooden Ren Education",
                url: "https://woodenren.com",
              },
            }),
          }}
        />
        <AuthProvider initialUser={user}>
          {/* 學員到期前 30 天頂部橫幅（其他狀態自動隱藏） */}
          <StudentExpiryNotice />
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
