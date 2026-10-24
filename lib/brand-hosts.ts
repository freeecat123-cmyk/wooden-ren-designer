/**
 * 中性品牌（Furniture Blueprints）網域判斷 —— 純函式、沒有 next/headers 依賴，
 * middleware、next.config、route handler、client 元件都能 import。
 *
 * 背景：英文版要用中性品牌對國外賣，「盡量不讓人知道是 Wooden Ren」。
 * 同一套程式依 Host 分流：從 NEUTRAL_HOSTS 進來的訪客整站只有英文、
 * 品牌一律顯示 Furniture Blueprints；designer.woodenren.com / cnc.woodenren.com
 * 的行為一個字都不能變 —— 所以所有改動都必須走「isNeutral 才生效」的分支。
 *
 * ⚠️ 要加正式網域就加在 NEUTRAL_HOSTS（第一個會被當成 canonical 網域）。
 */
export const NEUTRAL_HOSTS = ["furniture-blueprints.vercel.app"] as const;

export const NEUTRAL_BRAND_NAME = "Furniture Blueprints";

/** middleware 傳給 server component 的 request header（只是輔助；權威判斷仍是 Host） */
export const BRAND_HEADER = "x-wr-brand";

export type Brand = "woodenren" | "neutral";

/** 去掉 port、轉小寫 */
export function normalizeHost(host: string | null | undefined): string {
  return (host ?? "").trim().toLowerCase().split(":")[0] ?? "";
}

export function isNeutralHost(host: string | null | undefined): boolean {
  const h = normalizeHost(host);
  return (NEUTRAL_HOSTS as readonly string[]).includes(h);
}

/**
 * 本機開發用的強制中性模式：只有 NODE_ENV !== "production" 且 BRAND_FORCE_NEUTRAL=1 才生效。
 * ⛔ 正式環境不能被 query / cookie / 任何 client 可控的東西切到中性模式
 *   （切錯一次，CDN 快取就可能把中性頁面餵給主站訪客，或反過來）。
 */
export function devForceNeutral(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.BRAND_FORCE_NEUTRAL === "1";
}

/**
 * 由 request headers 判斷品牌。
 * - 正式環境：只看 Host。
 * - 非正式環境：另外接受 x-forwarded-host（本機用 curl / Playwright 模擬時方便），以及 BRAND_FORCE_NEUTRAL。
 */
export function brandFromHeaders(h: { get(name: string): string | null }): Brand {
  if (isNeutralHost(h.get("host"))) return "neutral";
  if (process.env.NODE_ENV !== "production") {
    if (isNeutralHost(h.get("x-forwarded-host"))) return "neutral";
    if (devForceNeutral()) return "neutral";
  }
  return "woodenren";
}

/**
 * 中性品牌的對外網址（canonical / sitemap / 結帳回跳用）。
 * 傳入的 host 若在白名單就用它（之後加正式網域時，各網域各用各的）；否則用第一個。
 * ⛔ 不接受白名單外的 host —— 不能信任任意 Host header 拿來組回跳網址。
 */
export function neutralOrigin(host?: string | null): string {
  const h = normalizeHost(host);
  const pick = (NEUTRAL_HOSTS as readonly string[]).includes(h) ? h : NEUTRAL_HOSTS[0];
  return `https://${pick}`;
}

/**
 * 中性網域上允許存在的路徑（比對前先剝掉 /en 前綴）。
 * 只開放「賣圖紙＋登入＋付款＋付費用戶會用到」的頁面；其餘一律導到中性網域的 /en，
 * ⛔ 不要導回 woodenren 主站 —— 那會直接露餡。
 */
export function allowedOnNeutralHost(pathname: string): boolean {
  const p = pathname.replace(/^\/en(?=\/|$)/, "") || "/";
  if (
    p === "/" ||
    p === "/app" ||
    p === "/templates" ||
    p === "/design" ||
    p === "/workbench" ||
    p === "/pricing" ||
    p === "/help" ||
    p === "/login" ||
    p === "/my-subscription" ||
    p === "/account/designs" ||
    p === "/projects" ||
    p === "/settings/branding" ||
    p === "/terms" ||
    p === "/privacy" ||
    p === "/refund" ||
    p === "/install"
  ) {
    return true;
  }
  return (
    p.startsWith("/templates/") ||
    p.startsWith("/design/") ||
    p.startsWith("/projects/") ||
    p.startsWith("/shared-design/") ||
    p.startsWith("/auth/")
  );
}

/** 中性網域 sitemap 收錄的公開英文路徑（不含登入後頁面、/design 子頁等） */
export const NEUTRAL_PUBLIC_PATHS = [
  "/",
  "/app",
  "/templates",
  "/workbench",
  "/pricing",
  "/help",
  "/install",
  "/terms",
  "/privacy",
  "/refund",
] as const;
