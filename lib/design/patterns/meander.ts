/**
 * 回紋 / Greek Key / Meander
 *
 * 結構：直角折線形成的「凹」形單元 × 四方連續鋪面（橫向）。
 * 漢代簡單一回頭，明清演化為「丁字回紋」「曲尺回紋」等。
 *
 * 演算法（per drafting-math.md §U.1）：
 *   單元 = 5 × 5 grid 的 polyline，掃出凹字形
 *   單元邊長 a = unit；以 a 為步長橫向 tile
 */

import type { PatternGenerator, PatternMeta } from "./types";

export const meanderMeta: PatternMeta = {
  id: "meander",
  nameZh: "回紋",
  nameEn: "Meander / Greek Key",
  category: "geometric",
  schools: ["jing", "jin"],
  defaults: { unit: 16, strokeWidth: 1.5, stroke: "#5a3a20" },
};

export const meander: PatternGenerator = (opts) => {
  const a = opts.unit ?? 16;
  const sw = opts.strokeWidth ?? 1.5;
  const stroke = opts.stroke ?? "#5a3a20";
  const W = opts.width;
  const H = opts.height;

  // 單元：從左下角 (0, a) 起跑，回字形畫到 (a, a)
  // 形狀：凹字 — 進去再回來
  const unitPath = (xOff: number, yOff: number) => {
    const t = a / 5; // 線粗在 grid 上佔 1/5
    return [
      `M ${xOff} ${yOff + a}`,
      `L ${xOff} ${yOff + t}`,
      `L ${xOff + a - t} ${yOff + t}`,
      `L ${xOff + a - t} ${yOff + a - t}`,
      `L ${xOff + 2 * t} ${yOff + a - t}`,
      `L ${xOff + 2 * t} ${yOff + 2 * t}`,
      `L ${xOff + a - 2 * t} ${yOff + 2 * t}`,
    ].join(" ");
  };

  const cols = Math.ceil(W / a) + 1;
  const rows = Math.ceil(H / a) + 1;
  const paths: string[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      paths.push(unitPath(c * a, r * a));
    }
  }

  return `<g stroke="${stroke}" stroke-width="${sw}" fill="none" stroke-linecap="square">${paths.map((d) => `<path d="${d}" />`).join("")}</g>`;
};
