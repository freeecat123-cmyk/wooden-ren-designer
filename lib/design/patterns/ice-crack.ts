/**
 * 冰裂紋 / Ice Crack
 *
 * 結構：不規則多邊形網格，視覺上像玻璃裂紋。
 * 真正的冰裂紋是 Voronoi tessellation；MVP 不引入 d3-delaunay 依賴，
 * 改用「隨機點 + 鄰近連線（k-NN edges）」的近似法，視覺夠用。
 *
 * 演算法（簡化版 per drafting-math.md §U.8）：
 *   1. Poisson-disk-like 散佈點（用 LCG 隨機 + 最小距離 reject）
 *   2. 每個點連到最近的 3-4 個鄰居 → 形成不規則網
 *   3. 重複的邊 dedup
 */

import type { PatternGenerator, PatternMeta } from "./types";

export const iceCrackMeta: PatternMeta = {
  id: "iceCrack",
  nameZh: "冰裂紋",
  nameEn: "Ice Crack",
  category: "lattice",
  schools: ["su", "hui"],
  defaults: { unit: 40, strokeWidth: 0.8, stroke: "#7a5a3a", seed: 42 },
};

/** Linear congruential generator — 可重現的偽隨機 */
function lcg(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

interface Pt {
  x: number;
  y: number;
}

export const iceCrack: PatternGenerator = (opts) => {
  const W = opts.width;
  const H = opts.height;
  const unit = opts.unit ?? 40; // 控制密度（每多大面積一個點）
  const sw = opts.strokeWidth ?? 0.8;
  const stroke = opts.stroke ?? "#7a5a3a";
  const seed = opts.seed ?? 42;
  const rand = lcg(seed);

  // 1. 散佈點（rejection sampling）
  const minDist = unit * 0.7;
  const targetCount = Math.max(8, Math.floor((W * H) / (unit * unit)));
  const pts: Pt[] = [];
  let attempts = 0;
  while (pts.length < targetCount && attempts < targetCount * 30) {
    attempts++;
    const x = rand() * W;
    const y = rand() * H;
    let ok = true;
    for (const q of pts) {
      const dx = q.x - x;
      const dy = q.y - y;
      if (dx * dx + dy * dy < minDist * minDist) {
        ok = false;
        break;
      }
    }
    if (ok) pts.push({ x, y });
  }

  // 2. 每點連最近 3 鄰居（dedup edge by canonical key）
  const edges = new Set<string>();
  const k = 3;
  for (let i = 0; i < pts.length; i++) {
    const dists: { j: number; d: number }[] = [];
    for (let j = 0; j < pts.length; j++) {
      if (i === j) continue;
      const dx = pts[i].x - pts[j].x;
      const dy = pts[i].y - pts[j].y;
      dists.push({ j, d: dx * dx + dy * dy });
    }
    dists.sort((a, b) => a.d - b.d);
    for (let n = 0; n < k && n < dists.length; n++) {
      const a = Math.min(i, dists[n].j);
      const b = Math.max(i, dists[n].j);
      edges.add(`${a}-${b}`);
    }
  }

  // 3. 輸出 line segments
  const lines: string[] = [];
  for (const key of edges) {
    const [a, b] = key.split("-").map(Number);
    const p = pts[a];
    const q = pts[b];
    lines.push(`<line x1="${p.x.toFixed(1)}" y1="${p.y.toFixed(1)}" x2="${q.x.toFixed(1)}" y2="${q.y.toFixed(1)}" />`);
  }

  return `<g stroke="${stroke}" stroke-width="${sw}" fill="none" stroke-linecap="round">${lines.join("")}</g>`;
};
