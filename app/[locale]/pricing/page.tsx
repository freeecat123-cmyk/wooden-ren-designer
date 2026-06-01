import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LemonSqueezyPricingClient } from "@/components/LemonSqueezyPricingClient";
import { PricingClient } from "@/components/PricingClient";
import { routing, type Locale } from "@/i18n/routing";
import { bilingualAlternates } from "@/i18n/metadata";
import {
  isSellableFurniture,
  isSellableTool,
} from "@/lib/lemon-squeezy/tier-map";
import { createClient } from "@/lib/supabase/server";
import { FURNITURE_CATALOG } from "@/lib/templates";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const alt = bilingualAlternates("/pricing", locale);

  if (locale !== routing.defaultLocale) {
    const t = await getTranslations({ locale, namespace: "pricingStub.metadata" });
    const title = t("title");
    const description = t("description");
    return {
      title,
      description,
      alternates: alt,
      openGraph: {
        title,
        description,
        url: alt.canonical,
        images: [{ url: "/og.png", width: 1200, height: 630 }],
      },
    };
  }

  return {
    title: "方案與訂閱｜木頭仁 木作藍圖",
    description:
      "個人 390、專業 890、學員 2 年免費。月付 / 年付兩種選擇，從免費試用到接案專業版。木頭仁木匠學院出品。",
    alternates: alt,
    openGraph: {
      title: "方案與訂閱｜木頭仁 木作藍圖",
      description:
        "個人 390、專業 890、學員 2 年免費。月付 / 年付兩種選擇，從免費試用到接案專業版。",
      url: alt.canonical,
      images: [{ url: "/og.png", width: 1200, height: 630 }],
    },
  };
}

export default async function PricingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = (raw as Locale) ?? routing.defaultLocale;
  setRequestLocale(locale);

  // 中文版：原 PricingClient（含 ECPay 完整金流流程）
  if (locale === routing.defaultLocale) {
    return <PricingClient />;
  }

  // 國際版：Lemon Squeezy（MoR 處理 VAT/稅務）
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // /design/[type] paywall 會 redirect 過來 ?locked=stool — 高亮對應卡。
  // 工具銷售頁(Ceiling/Floor/RaisedFloor Marketing)用 ?upgrade=<tool> 同樣意思。
  const sp = await searchParams;
  const lockedRaw = sp?.locked ?? sp?.upgrade;
  const lockedCategory = typeof lockedRaw === "string" ? lockedRaw : null;

  // 蒐集所有可單買的項目（27 家具 + ceiling/floor 兩工具）
  const catalog = [
    ...FURNITURE_CATALOG.filter((c) => isSellableFurniture(c.category)).map((c) => ({
      id: c.category,
      nameEn: c.nameEn,
      kind: "furniture" as const,
      difficulty: c.difficulty,
    })),
    {
      id: "ceiling",
      nameEn: "Ceiling Framing Calculator",
      kind: "tool" as const,
      difficulty: "intermediate" as const,
    },
    {
      id: "floor",
      nameEn: "Flooring Layout Calculator",
      kind: "tool" as const,
      difficulty: "intermediate" as const,
    },
    {
      id: "raised-floor",
      nameEn: "Raised-Floor Tatami Calculator",
      kind: "tool" as const,
      difficulty: "intermediate" as const,
    },
  ].filter((c) => isSellableFurniture(c.id) || isSellableTool(c.id));

  return (
    <LemonSqueezyPricingClient
      isAuthed={!!user}
      loginHref={`/${locale}/login?next=/${locale}/pricing`}
      catalog={catalog}
      lockedCategory={lockedCategory}
    />
  );
}
