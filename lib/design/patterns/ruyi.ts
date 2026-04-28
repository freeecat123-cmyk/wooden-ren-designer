/**
 * 如意雲頭 / Ruyi Cloud
 *
 * 結構：雲頭（≈ 270° 圓弧）+ 雲身（S 曲線）+ 雲尾（卷收）。
 * 用 cubic Bezier 近似（圓弧的 Bezier 近似常數 0.5523）。
 *
 * 演算法（per drafting-math.md §U.3）：
 *   單一桃形（heart-like）由 4 段 cubic Bezier 圍成。
 *   options.unit 控制大小；不 tile，獨立飾片。
 *   為了當「裝飾元素」用，可以連用幾個不同尺寸組合（四合如意）。
 */

import type { PatternGenerator, PatternMeta } from "./types";

export const ruyiMeta: PatternMeta = {
  id: "ruyi",
  nameZh: "如意雲頭",
  nameEn: "Ruyi Cloud",
  category: "cloud",
  schools: ["jing", "guang"],
  defaults: { unit: 80, strokeWidth: 1.6, stroke: "#5a3a20" },
};

/** 單一如意雲頭（桃形/心形）以 (cx, cy) 為中心，外接半徑 r */
function singleRuyi(cx: number, cy: number, r: number): string {
  const c = 0.5523 * r; // 圓弧 cubic Bezier 控制點偏移近似
  return [
    `M ${cx} ${cy - r}`,
    // 右上半圓
    `C ${cx + c} ${cy - r} ${cx + r} ${cy - c} ${cx + r} ${cy}`,
    // 右下卷收向中心
    `C ${cx + r} ${cy + c} ${cx + c * 0.5} ${cy + r * 0.6} ${cx} ${cy + r * 0.3}`,
    // 左下卷收
    `C ${cx - c * 0.5} ${cy + r * 0.6} ${cx - r} ${cy + c} ${cx - r} ${cy}`,
    // 左上半圓回頭
    `C ${cx - r} ${cy - c} ${cx - c} ${cy - r} ${cx} ${cy - r}`,
    "Z",
  ].join(" ");
}

export const ruyi: PatternGenerator = (opts) => {
  const r = (opts.unit ?? 80) / 2;
  const sw = opts.strokeWidth ?? 1.6;
  const stroke = opts.stroke ?? "#5a3a20";
  const fill = opts.fill ?? "none";
  const W = opts.width;
  const H = opts.height;

  // 預設置中放置一個雲頭（適合當裝飾用）
  const cx = W / 2;
  const cy = H / 2;
  const path = singleRuyi(cx, cy, r);

  return `<g stroke="${stroke}" stroke-width="${sw}" fill="${fill}" stroke-linejoin="round"><path d="${path}" /></g>`;
};

/** 四合如意：四個雲頭十字對稱組合 */
export const ruyiQuad: PatternGenerator = (opts) => {
  const r = (opts.unit ?? 60) / 2;
  const sw = opts.strokeWidth ?? 1.6;
  const stroke = opts.stroke ?? "#5a3a20";
  const fill = opts.fill ?? "none";
  const W = opts.width;
  const H = opts.height;

  const cx = W / 2;
  const cy = H / 2;
  const offset = r * 0.9;
  const paths = [
    singleRuyi(cx + offset, cy, r),
    singleRuyi(cx - offset, cy, r),
    singleRuyi(cx, cy + offset, r),
    singleRuyi(cx, cy - offset, r),
  ];

  return `<g stroke="${stroke}" stroke-width="${sw}" fill="${fill}" stroke-linejoin="round">${paths.map((d) => `<path d="${d}" />`).join("")}</g>`;
};
