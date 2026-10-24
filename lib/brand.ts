/**
 * 品牌判斷 —— server 端入口。
 *
 *   const brand = await getBrand();          // "woodenren" | "neutral"
 *   if (brand === "neutral") { ...只有中性網域才生效的分支... }
 *
 * client 元件請用 components/brand/BrandProvider.tsx 的 useBrand()。
 * 純函式（網域白名單、允許路徑、文字中性化）在 lib/brand-hosts.ts、lib/brand-text.ts。
 *
 * ⛔ 權威判斷只看 Host（非正式環境另接受 x-forwarded-host / BRAND_FORCE_NEUTRAL 方便本機模擬）。
 *   不讀 client 可控的 query / cookie / 自訂 header —— 正式環境不能被外部切到中性模式。
 */
import { headers } from "next/headers";
import { brandFromHeaders, neutralOrigin, normalizeHost, type Brand } from "./brand-hosts";
import { bilingualAlternates } from "@/i18n/metadata";

export * from "./brand-hosts";

export async function getBrand(): Promise<Brand> {
  return brandFromHeaders(await headers());
}

export async function isNeutralBrand(): Promise<boolean> {
  return (await getBrand()) === "neutral";
}

/**
 * 這個請求對外的網站 origin：中性網域 → 中性網域自己的 https 網址；主站 → 原本的 SITE_URL。
 */
export async function getSiteOrigin(): Promise<string> {
  const h = await headers();
  if (brandFromHeaders(h) === "neutral") return neutralOrigin(normalizeHost(h.get("host")));
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://designer.woodenren.com";
}

/**
 * 頁面 metadata 用的 alternates：主站照舊（bilingualAlternates：zh-TW + en + x-default），
 * 中性網域只有英文 → canonical / hreflang 全指自己的 /en 路徑（相對網址，靠 layout 的 metadataBase 補成中性網域）。
 * ⛔ 中性網域不能有指向中文版（＝會被導走）或 woodenren 的 hreflang。
 */
export async function brandedAlternates(path: string, locale: string) {
  if ((await getBrand()) !== "neutral") return bilingualAlternates(path, locale);
  const en = path === "/" ? "/en" : `/en${path}`;
  return { canonical: en, languages: { en, "x-default": en } };
}

/**
 * 畫面上顯示的網域字樣（首頁 / 工作台 hero 圖下方那行小字、報價單頁尾等）。
 * 主站固定回原本寫死的 "designer.woodenren.com"（行為不變），中性網域回自己的 host。
 */
export async function getSiteHostLabel(): Promise<string> {
  if ((await getBrand()) !== "neutral") return "designer.woodenren.com";
  return (await getSiteOrigin()).replace(/^https?:\/\//, "");
}

/**
 * 寫死在程式裡的英文文案物件（例如 lib/templates/marketing-en.ts 的模板行銷文案）：
 * 中性網域深層跑一次 neutralizeMessages，主站原物件直接回傳（同一個 reference，零成本）。
 */
export async function brandText<T>(value: T): Promise<T> {
  if (value == null || (await getBrand()) !== "neutral") return value;
  const { neutralizeMessages } = await import("./brand-text");
  return neutralizeMessages(value, await getSiteOrigin());
}

/**
 * og 圖網址的品牌參數：中性網域加 `b=n` 讓 CDN 快取 key 跟主站分開
 * （/api/og 本身仍以 Host 判斷品牌，這個參數不能單獨把主站切成中性）。
 */
export async function ogBrandQuery(): Promise<string> {
  return (await getBrand()) === "neutral" ? "&b=n" : "";
}
