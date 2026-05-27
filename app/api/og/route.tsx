import { ImageResponse } from "next/og";
import { getTemplate } from "@/lib/templates";
import { MATERIALS } from "@/lib/materials";
import type { FurnitureCategory, MaterialId } from "@/lib/types";

export const runtime = "edge";

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
  const length = searchParams.get("length") ?? "?";
  const width = searchParams.get("width") ?? "?";
  const height = searchParams.get("height") ?? "?";
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
          <div style={{ fontSize: 56, fontWeight: 600, color: "#44403c" }}>
            {length} × {width} × {height} mm
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
