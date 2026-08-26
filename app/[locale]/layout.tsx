import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Geist, Geist_Mono, Noto_Serif_TC } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale, getMessages } from "next-intl/server";
import "../globals.css";
import { routing, type Locale } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { SiteHeader } from "@/components/SiteHeader";
import { StudentWelcomeModal } from "@/components/StudentWelcomeModal";
import { StudentExpiryNotice } from "@/components/StudentExpiryNotice";
import { SiteFooter } from "@/components/SiteFooter";
import { BugReportFab } from "@/components/BugReportFab";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { IOSInstallBanner } from "@/components/IOSInstallBanner";
import { WebInstallBanner } from "@/components/WebInstallBanner";
import { pickClientMessages } from "@/lib/i18n/client-namespaces";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 中文標題用 serif — 對齊木匠學院的工坊質感
// display:swap 確保 LCP 不受影響
//
// ⚠️ 只留 700。全站 121 處 .font-serif-tc / .font-serif 有 117 處直接寫 font-bold，
// 其餘 4 處是 <strong>（瀏覽器本來就給 700）—— 400 與 600 一個字都沒用到，
// 卻讓手機每次多下載約 366KB 的中文字檔。要加回別的字重前先確認畫面真的用得到。
const notoSerifTC = Noto_Serif_TC({
  variable: "--font-serif-tc",
  weight: ["700"],
  subsets: ["latin"],
  display: "swap",
  preload: false, // 中文檔大，不 preload，等實際需要再載
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://designer.woodenren.com";

// Phase 1：metadata 依 locale 切換語言；Phase 2 行銷頁英譯時會把這段抽到 messages/。
const META: Record<
  Locale,
  { title: string; description: string; ogLocale: string; htmlLang: string }
> = {
  "zh-TW": {
    title: "木頭仁 木作藍圖 · 自動產出工程圖紙",
    description:
      "輸入尺寸選木材，自動產出三視圖、透視圖、榫卯細節、材料單、工具清單、A4 PDF 工程圖紙。木頭仁木匠學院出品。",
    ogLocale: "zh_TW",
    htmlLang: "zh-Hant",
  },
  en: {
    title: "Wooden Ren Designer — Asian joinery furniture design tool",
    description:
      "Generate three-view drawings, exploded views, mortise & tenon details, cut lists, and printable plans from dimensions. By a 200K-subscriber woodworking YouTuber.",
    ogLocale: "en_US",
    htmlLang: "en",
  },
};

function urlFor(locale: Locale, path: string = "") {
  return locale === routing.defaultLocale
    ? `${SITE_URL}${path}`
    : `${SITE_URL}/${locale}${path}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = hasLocale(routing.locales, raw) ? raw : routing.defaultLocale;
  const m = META[locale];

  return {
    metadataBase: new URL(SITE_URL),
    title: m.title,
    description: m.description,
    alternates: {
      canonical: urlFor(locale),
      languages: {
        "zh-TW": SITE_URL,
        en: `${SITE_URL}/en`,
        "x-default": SITE_URL,
      },
    },
    /**
     * ⛔ 原本兩個語言都指同一份中文 manifest。英文使用者從 /en 或 /install 按
     *    「加到主畫面」→ 桌面圖示名稱是中文「木作藍圖」,點開走 start_url "/"
     *    直接落到中文首頁,等於裝了一個他看不懂的 App。
     * ⚠️ 英文版的 start_url 是 "/en";scope 仍是 "/" 讓兩邊共用同一個安裝範圍。
     */
    manifest: locale === "en" ? "/manifest.en.json" : "/manifest.json",
    appleWebApp: {
      capable: true,
      title: locale === "en" ? "Wooden Ren Designer" : "木作藍圖",
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
      locale: m.ogLocale,
      url: urlFor(locale),
      siteName: locale === "en" ? "Wooden Ren Designer" : "木頭仁 木作藍圖",
      title: m.title,
      description: m.description,
      images: [{ url: "/og.png", width: 1200, height: 630, alt: m.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: m.title,
      description: m.description,
      images: ["/og.png"],
    },
    // Pinterest 網域認領（解鎖 Rich Pins）— 整站共用
    other: {
      "p:domain_verify": "73e5f47e3f4c52852e6d215f04c8251e",
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1e3a5f",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale: raw } = await params;
  if (!hasLocale(routing.locales, raw)) notFound();
  const locale: Locale = raw;
  setRequestLocale(locale);

  // SSR 階段先讀一次 user，傳給 client AuthProvider 避免閃白「未登入」
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const m = META[locale];

  // JSON-LD 價格鎖 locale，不跟著 CurrencyToggle cookie 變。
  // 理由：付款系統是 locale-pinned（ZH→ECPay TWD、EN→LemonSqueezy USD），
  // Google 看到的價格必須等於使用者實際被收的金額。

  return (
    <html
      lang={m.htmlLang}
      className={`${geistSans.variable} ${geistMono.variable} ${notoSerifTC.variable} antialiased`}
      style={{ colorScheme: "light" }}
    >
      <body className="bg-[#fafaf7] text-zinc-900">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name:
                locale === "en"
                  ? "Wooden Ren Designer"
                  : "木頭仁 木作藍圖",
              alternateName:
                locale === "en" ? ["Wooden Ren Designer"] : "木頭仁 木作藍圖",
              applicationCategory: "DesignApplication",
              operatingSystem: "Web",
              url: urlFor(locale),
              description: m.description,
              inLanguage: locale,
              offers:
                locale === "en"
                  ? [
                      // EN 走 LemonSqueezy 實價：單一 Pro tier 三種計費 + Lifetime。
                      // variant-map.ts 是 source of truth。
                      { "@type": "Offer", name: "Free trial", price: "0", priceCurrency: "USD" },
                      { "@type": "Offer", name: "Pro Monthly", price: "9", priceCurrency: "USD" },
                      { "@type": "Offer", name: "Pro Annual", price: "79", priceCurrency: "USD" },
                      { "@type": "Offer", name: "Lifetime", price: "129", priceCurrency: "USD" },
                    ]
                  : [
                      { "@type": "Offer", name: "免費試用", price: "0", priceCurrency: "TWD" },
                      { "@type": "Offer", name: "個人版", price: "390", priceCurrency: "TWD" },
                      { "@type": "Offer", name: "專業版", price: "890", priceCurrency: "TWD" },
                    ],
              creator: {
                "@type": "Organization",
                name:
                  locale === "en"
                    ? "Wooden Ren Education Co., Ltd."
                    : "木頭仁木匠學院 Wooden Ren Education",
                url: "https://woodenren.com",
              },
            }),
          }}
        />
        {/* Organization schema — 獨立宣告，讓 Google 認 brand entity，
            有機會在 SERP 出現 knowledge panel。聯絡資訊跟 Terms / Privacy 一致。 */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "木頭仁木匠學院 Wooden Ren Education Co., Ltd.",
              alternateName: ["木頭仁", "Wooden Ren"],
              url: "https://woodenren.com",
              logo: `${SITE_URL}/og.png`,
              sameAs: [
                "https://www.youtube.com/@woodenren",
                "https://woodenrenclass.com",
              ],
              address: {
                "@type": "PostalAddress",
                streetAddress: "東勢街 6-34 號 4 樓",
                addressLocality: "暖暖區",
                addressRegion: "基隆市",
                addressCountry: "TW",
              },
              contactPoint: {
                "@type": "ContactPoint",
                email: "wengbinren@gmail.com",
                contactType: "customer support",
                availableLanguage:
                  locale === "en" ? ["en", "zh-TW"] : ["zh-TW"],
              },
            }),
          }}
        />
        {/*
          ⛔ 不傳 messages 的話,next-intl 會把**整包** 243KB 的翻譯字典塞進
             每一頁的 HTML —— gzip 後佔傳輸量約 69%,而其中九成以上是那一頁
             根本用不到的(後台、問卷、天花板算料、各行銷頁文案全都跟著送)。
             設計頁「拉滑桿改尺寸」是整頁重新導覽,所以每動一下就再吃一次。

          只送 client 元件真的會讀的命名空間(92 / 129),gzip 少 35KB。
          server 元件的翻譯在伺服器就解完了,不需要進 client payload。

          ⚠️ 名單由 scripts/gen-client-namespaces.ts **掃描產生**,不手寫 ——
             漏一個命名空間,畫面上就會直接顯示 key 名稱,而且只在那個元件
             被 render 到才看得出來。改完 client 元件的 useTranslations 要重跑,
             CI 有 `--check` 擋過期。(2026-08-24)
        */}
        <NextIntlClientProvider messages={pickClientMessages(await getMessages())}>
          <AuthProvider initialUser={user}>
            {/* 學員到期前 30 天頂部橫幅（其他狀態自動隱藏） */}
            <StudentExpiryNotice />
            {/* 全站頂部導覽列；設計頁/列印頁自動隱藏。HeaderUser 嵌入右側。*/}
            <SiteHeader />
            {children}
            <SiteFooter />
            <BugReportFab />
            <StudentWelcomeModal />
            <ServiceWorkerRegister />
            <IOSInstallBanner />
            <WebInstallBanner />
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
