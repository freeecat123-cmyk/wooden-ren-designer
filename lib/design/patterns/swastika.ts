/**
 * 卐字紋 / 萬字錦 / Swastika Lattice
 *
 * 結構：4 個 L 形以中心點旋轉 90° 對稱。明清最常見「卐字錦」是把單個卐字接成網格。
 *
 * 演算法（per drafting-math.md §U.2）：
 *   一個單元 = 中心點 + 4 條 L 形臂（旋轉 0/90/180/270）
 *   每條臂 = 中心向外的直線 + 90° 折回的短臂
 *   橫縱以 a 為間距 tile
 */

import type { PatternGenerator, PatternMeta } from "./types";

export const swastikaMeta: PatternMeta = {
  id: "swastika",
  nameZh: "卐字錦",
  nameEn: "Swastika Lattice",
  category: "geometric",
  schools: ["jing", "jin"],
  defaults: { unit: 24, strokeWidth: 1.5, stroke: "#5a3a20" },
};

export const swastika: PatternGenerator = (opts) => {
  const a = opts.unit ?? 24;
  const sw = opts.strokeWidth ?? 1.5;
  const stroke = opts.stroke ?? "#5a3a20";
  const W = opts.width;
  const H = opts.height;

  // 單元：中心 (cx, cy)，臂長 = a/2，折回 = a/4
  // 一個臂 = 兩段直線：(cx, cy) → (cx + arm, cy) → (cx + arm, cy - hook)
  // 旋轉四次（0°, 90°, 180°, 270°）對稱出萬字
  const unit = (cx: number, cy: number) => {
    const arm = a * 0.45;
    const hook = a * 0.25;
    const segs = [
      // 0°: 右 + 上折
      `M ${cx} ${cy} L ${cx + arm} ${cy} L ${cx + arm} ${cy - hook}`,
      // 90°: 下 + 右折
      `M ${cx} ${cy} L ${cx} ${cy + arm} L ${cx + hook} ${cy + arm}`,
      // 180°: 左 + 下折
      `M ${cx} ${cy} L ${cx - arm} ${cy} L ${cx - arm} ${cy + hook}`,
      // 270°: 上 + 左折
      `M ${cx} ${cy} L ${cx} ${cy - arm} L ${cx - hook} ${cy - arm}`,
    ];
    return segs.join(" ");
  };

  const cols = Math.ceil(W / a) + 1;
  const rows = Math.ceil(H / a) + 1;
  const paths: string[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      paths.push(unit(c * a + a / 2, r * a + a / 2));
    }
  }

  return `<g stroke="${stroke}" stroke-width="${sw}" fill="none" stroke-linecap="square">${paths.map((d) => `<path d="${d}" />`).join("")}</g>`;
};
