import { ImageResponse } from "next/og";
import { getTemplate } from "@/lib/templates";
import { MATERIALS } from "@/lib/materials";
import type { FurnitureCategory, MaterialId } from "@/lib/types";

export const runtime = "edge";

const STYLE_LABEL: Record<string, string> = {
  shaker: "⛪ Shaker",
  "mid-century": "🇩🇰 Mid-Century",
  mission: "⚒️ Mission",
  ming: "🏯 明式",
  windsor: "🐎 Windsor",
  industrial: "🏭 工業風",
  japanese: "🎋 日式",
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

  const tmpl = getTemplate(type);
  const tmplName = tmpl?.nameZh ?? "家具";
  const materialName = MATERIALS[material]?.nameZh ?? material;
  const styleName = STYLE_LABEL[style] ?? "";

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
            木頭仁家具設計器
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
          <span>woodenren.com · 三視圖 / 材料單 / 報價一鍵生成</span>
          <span style={{ fontWeight: 600 }}>👉 點開連結看 3D</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
