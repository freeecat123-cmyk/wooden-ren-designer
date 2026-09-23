import { ImageResponse } from "next/og";
import { getTemplate } from "@/lib/templates";
import { MATERIALS } from "@/lib/materials";
import type { FurnitureCategory, MaterialId } from "@/lib/types";

// nodejs runtime（不是 edge）：og 透過 getTemplate import 整套模板/geometry 引擎，
// 模板持續長大後 edge bundle 撐破 1 MB 上限→部署失敗卡住整批。Node 函式 ~250MB 無此限，
// next/og 的 ImageResponse 在 Node runtime 一樣可用（見 next docs image-response 範例）。
export const runtime = "nodejs";

const STYLE_LABEL_ZH: Record<string, string> = {
  shaker: "⛪ Shaker",
  "mid-century": "🇩🇰 Mid-Century",
  mission: "⚒️ Mission",
  ming: "🏯 明式",
  windsor: "🐎 Windsor",
  industrial: "🏭 工業風",
  japanese: "🎋 日式",
  chippendale: "👑 Chippendale",
};

const STYLE_LABEL_EN: Record<string, string> = {
  shaker: "⛪ Shaker",
  "mid-century": "🇩🇰 Mid-Century",
  mission: "⚒️ Mission",
  ming: "🏯 Ming",
  windsor: "🐎 Windsor",
  industrial: "🏭 Industrial",
  japanese: "🎋 Japanese",
  chippendale: "👑 Chippendale",
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = (searchParams.get("type") ?? "dining-chair") as FurnitureCategory;
  /**
   * 🧷 尺寸只接受數字。
   *
   * ⛔ 原本直接把 query 的字串印進圖裡。任何人 GET
   *      /api/og?length=<任意詐騙文案>&material=<任意文字>
   *    就得到一張 1200×630、**網址掛在木頭仁正式網域**的圖,內容由對方決定 ——
   *    可以直接拿去社群做假冒你的釣魚貼文。(2026-08-21 稽核發現。)
   *
   * ✅ `type` / `material` / `style` 本來就是查表(查不到就 fallback),等於白名單;
   *    真正能塞任意文字的只有這三個尺寸。改成**只接受合理範圍內的數字**,
   *    其餘一律顯示 "?"(跟原本缺參數時的行為一致)。
   *
   * ⚠️ 不額外加限流:這支的快取 key 就是 query string,擋不住換亂數參數的洗版;
   *    但把「可控文字」拿掉之後,剩下的濫用價值只有燒 CPU,而那是 Vercel 平台層
   *    (WAF / DDoS)該處理的事,不是在這裡疊一層擋不住的計數器。
   */
  const dim = (key: string): string => {
    const raw = searchParams.get(key);
    if (!raw) return "?";
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0 || n > 100000) return "?";
    return String(Math.round(n));
  };
  const length = dim("length");
  const width = dim("width");
  const height = dim("height");
  const material = (searchParams.get("material") ?? "douglas-fir") as MaterialId;
  const style = searchParams.get("style") ?? "";
  const locale = searchParams.get("locale") === "en" ? "en" : "zh-TW";
  const isEn = locale === "en";

  const tmpl = getTemplate(type);
  const tmplName = isEn
    ? (tmpl?.nameEn ?? tmpl?.nameZh ?? "Furniture")
    : (tmpl?.nameZh ?? "家具");
  const mat = MATERIALS[material];
  const materialName = isEn
    ? (mat?.nameEn ?? material)
    : (mat?.nameZh ?? material);
  const styleName = (isEn ? STYLE_LABEL_EN : STYLE_LABEL_ZH)[style] ?? "";
  const brandLine = isEn ? "Wooden Ren Blueprint" : "木頭仁 木作藍圖";
  const footerTagline = isEn
    ? "woodenren.com · 3-views, cut list and quote in one click"
    : "woodenren.com · 三視圖 / 材料單 / 報價一鍵生成";
  const ctaLine = isEn ? "👉 Open for the 3D view" : "👉 點開連結看 3D";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #fef3c7 0%, #fcd34d 100%)",
          padding: "80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 56 }}>🪵</span>
          <span style={{ fontSize: 32, color: "#78350f", fontWeight: 600 }}>
            {brandLine}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 80,
            gap: 24,
          }}
        >
          <div style={{ fontSize: 96, fontWeight: 800, color: "#1c1917", letterSpacing: -2 }}>
            {tmplName}
          </div>
          {/* satori 規則：>1 個子節點的 div 必須明寫 display。
              `{length} × {width} × {height} mm` 會被 JSX 拆成 6 個子節點 →
              整張圖 500。合成單一字串節點，樣式完全不動。 */}
          <div style={{ fontSize: 56, fontWeight: 600, color: "#44403c" }}>
            {`${length} × ${width} × ${height} mm`}
          </div>
          <div style={{ display: "flex", gap: 24, marginTop: 16, flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: 36,
                color: "#78350f",
                background: "#fff7ed",
                padding: "12px 28px",
                borderRadius: 999,
                border: "2px solid #fed7aa",
              }}
            >
              🌳 {materialName}
            </span>
            {styleName && (
              <span
                style={{
                  fontSize: 36,
                  color: "#78350f",
                  background: "#fff7ed",
                  padding: "12px 28px",
                  borderRadius: 999,
                  border: "2px solid #fed7aa",
                }}
              >
                {styleName}
              </span>
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            marginTop: "auto",
            justifyContent: "space-between",
            alignItems: "flex-end",
            color: "#78350f",
            fontSize: 28,
          }}
        >
          <span>{footerTagline}</span>
          <span style={{ fontWeight: 600 }}>{ctaLine}</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        // OG 圖完全由 query params 決定（含 locale），內容不會變 → 強快取避免每次社群爬蟲
        // 都重跑 edge function。一年 immutable + s-maxage 給 CDN，瀏覽器同上。
        "Cache-Control":
          "public, max-age=31536000, s-maxage=31536000, immutable",
      },
    },
  );
}
