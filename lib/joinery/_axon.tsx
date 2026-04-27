/**
 * 軸測投影（axonometric / isometric）SVG 工具——畫榫卯細節用。
 *
 * 採用標準 isometric 投影：
 *   x 軸：往右下 30°（看到右側面）
 *   z 軸：往左下 30°（看到左側面 / 後側面）
 *   y 軸：垂直向上
 *
 * 螢幕座標換算（注意 SVG Y 軸朝下）：
 *   screenX = (x - z) × cos(30°)
 *   screenY = -y + (x + z) × sin(30°)
 *
 * 所有 helper 接受「3D 毫米尺寸」回傳 SVG path。直接放在 <svg> 裡即可。
 */

import type * as React from "react";

const COS30 = Math.cos(Math.PI / 6); // ≈ 0.866
const SIN30 = Math.sin(Math.PI / 6); // 0.5

/** 工程圖配色 */
export const AXON_COLOR = {
  outline: "#222",       // 主體輪廓
  hidden: "#aaa",        // 看不到的邊（虛線）
  tenon: "#e6c89a",      // 公榫淺木色
  mortise: "#7c5a30",    // 母件深色
  dim: "#0a4d8c",        // 標尺藍
  dimLight: "#5a86b8",   // 標尺輔助線
};

export interface Pt {
  x: number;
  y: number;
}

/** 3D mm → 2D screen pt（注意 SVG Y 朝下所以 y 取負） */
export function project(x: number, y: number, z: number): Pt {
  return {
    x: (x - z) * COS30,
    y: -y + (x + z) * SIN30,
  };
}

/** 把 6 個 box 頂點算出來 (front/back × bottom/top × left/right 排列) */
export function boxVertices(
  ox: number,
  oy: number,
  oz: number,
  l: number,
  h: number,
  d: number,
): { fbl: Pt; fbr: Pt; ftl: Pt; ftr: Pt; bbl: Pt; bbr: Pt; btl: Pt; btr: Pt } {
  return {
    fbl: project(ox, oy, oz + d),     // front-bottom-left（z 大 = 靠近觀察者）
    fbr: project(ox + l, oy, oz + d),
    ftl: project(ox, oy + h, oz + d),
    ftr: project(ox + l, oy + h, oz + d),
    bbl: project(ox, oy, oz),
    bbr: project(ox + l, oy, oz),
    btl: project(ox, oy + h, oz),
    btr: project(ox + l, oy + h, oz),
  };
}

/** 一條 SVG line element（pt → pt） */
export function lineFromTo(
  a: Pt,
  b: Pt,
  opts: { stroke?: string; strokeWidth?: number; dash?: string; key?: string | number } = {},
): React.ReactElement {
  return (
    <line
      key={opts.key}
      x1={a.x}
      y1={a.y}
      x2={b.x}
      y2={b.y}
      stroke={opts.stroke ?? AXON_COLOR.outline}
      strokeWidth={opts.strokeWidth ?? 1.2}
      strokeDasharray={opts.dash}
      fill="none"
    />
  );
}

/** 軸測投影的盒子——畫 9 條可見邊 + 3 條虛線（後左下角看不到的邊）*/
export function AxonBox({
  ox = 0,
  oy = 0,
  oz = 0,
  length,
  height,
  depth,
  fill,
  stroke = AXON_COLOR.outline,
  strokeWidth = 1.2,
  showHidden = true,
}: {
  ox?: number;
  oy?: number;
  oz?: number;
  length: number;
  height: number;
  depth: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  showHidden?: boolean;
}): React.ReactElement {
  const v = boxVertices(ox, oy, oz, length, height, depth);

  // 可見三面：前面（fbl-fbr-ftr-ftl）、頂面（ftl-ftr-btr-btl）、右面（fbr-bbr-btr-ftr）
  // 用 path d 合在一起，含 fill 用
  const frontPath = `M ${v.fbl.x} ${v.fbl.y} L ${v.fbr.x} ${v.fbr.y} L ${v.ftr.x} ${v.ftr.y} L ${v.ftl.x} ${v.ftl.y} Z`;
  const topPath = `M ${v.ftl.x} ${v.ftl.y} L ${v.ftr.x} ${v.ftr.y} L ${v.btr.x} ${v.btr.y} L ${v.btl.x} ${v.btl.y} Z`;
  const rightPath = `M ${v.fbr.x} ${v.fbr.y} L ${v.bbr.x} ${v.bbr.y} L ${v.btr.x} ${v.btr.y} L ${v.ftr.x} ${v.ftr.y} Z`;

  return (
    <g>
      {fill && (
        <>
          {/* 三面分色：前淺、頂中、右深，模擬光線 */}
          <path d={frontPath} fill={fill} fillOpacity={0.95} stroke="none" />
          <path d={topPath} fill={fill} fillOpacity={0.7} stroke="none" />
          <path d={rightPath} fill={fill} fillOpacity={0.55} stroke="none" />
        </>
      )}
      {/* 9 條可見邊 */}
      {[
        [v.fbl, v.fbr],
        [v.fbr, v.ftr],
        [v.ftr, v.ftl],
        [v.ftl, v.fbl],
        [v.ftl, v.btl],
        [v.ftr, v.btr],
        [v.btl, v.btr],
        [v.fbr, v.bbr],
        [v.bbr, v.btr],
      ].map(([a, b], i) => lineFromTo(a, b, { stroke, strokeWidth, key: `e${i}` }))}
      {/* 3 條虛線 hidden edges（從 bbl 那個看不到的角延伸） */}
      {showHidden &&
        [
          [v.bbl, v.bbr],
          [v.bbl, v.btl],
          [v.bbl, v.fbl],
        ].map(([a, b], i) =>
          lineFromTo(a, b, {
            stroke: AXON_COLOR.hidden,
            strokeWidth: 0.7,
            dash: "3 2",
            key: `h${i}`,
          }),
        )}
    </g>
  );
}

/**
 * 標尺：兩個 3D 點之間畫雙箭頭 + 文字標籤。
 * `offsetDir` 是「往哪個方向偏移」（x / y / z 軸 ± 方向），這樣標尺不會跟物體重疊。
 */
export function AxonDimLine({
  from,
  to,
  label,
  offsetDir,
  offsetMm = 25,
}: {
  from: { x: number; y: number; z: number };
  to: { x: number; y: number; z: number };
  label: string;
  offsetDir: { x?: number; y?: number; z?: number };
  offsetMm?: number;
}): React.ReactElement {
  // 計算偏移後的 3D 起訖點
  const ox = (offsetDir.x ?? 0) * offsetMm;
  const oy = (offsetDir.y ?? 0) * offsetMm;
  const oz = (offsetDir.z ?? 0) * offsetMm;
  const a = project(from.x + ox, from.y + oy, from.z + oz);
  const b = project(to.x + ox, to.y + oy, to.z + oz);
  // 從原點到偏移點的 leader line
  const aBase = project(from.x, from.y, from.z);
  const bBase = project(to.x, to.y, to.z);
  // 中點放標籤
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;

  const arrow = 4;
  // 箭頭方向（沿 a→b）
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  // 法向（90°）
  const nx = -uy;
  const ny = ux;

  return (
    <g
      stroke={AXON_COLOR.dim}
      fill={AXON_COLOR.dim}
      strokeWidth={0.7}
      fontSize={10}
      fontFamily="-apple-system, BlinkMacSystemFont, 'Noto Sans TC', sans-serif"
    >
      {/* 兩條延伸線（從物體角到標尺） */}
      <line
        x1={aBase.x}
        y1={aBase.y}
        x2={a.x}
        y2={a.y}
        stroke={AXON_COLOR.dimLight}
        strokeDasharray="2 2"
      />
      <line
        x1={bBase.x}
        y1={bBase.y}
        x2={b.x}
        y2={b.y}
        stroke={AXON_COLOR.dimLight}
        strokeDasharray="2 2"
      />
      {/* 主標尺線 */}
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
      {/* 兩端箭頭 */}
      <polygon
        points={`${a.x},${a.y} ${a.x + ux * arrow + nx * arrow * 0.5},${a.y + uy * arrow + ny * arrow * 0.5} ${a.x + ux * arrow - nx * arrow * 0.5},${a.y + uy * arrow - ny * arrow * 0.5}`}
      />
      <polygon
        points={`${b.x},${b.y} ${b.x - ux * arrow + nx * arrow * 0.5},${b.y - uy * arrow + ny * arrow * 0.5} ${b.x - ux * arrow - nx * arrow * 0.5},${b.y - uy * arrow - ny * arrow * 0.5}`}
      />
      {/* 標籤背景白底 + 文字 */}
      <rect
        x={midX - label.length * 4 - 3}
        y={midY - 8}
        width={label.length * 8 + 6}
        height={14}
        fill="white"
        stroke="none"
      />
      <text x={midX} y={midY + 3} textAnchor="middle" stroke="none">
        {label}
      </text>
    </g>
  );
}

/** 計算所有 SVG 元素的 bounding box，再加 padding，回傳適合 svg viewBox 的字串 */
export function autoViewBox(pts: Pt[], pad = 30): string {
  if (pts.length === 0) return "0 0 100 100";
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const maxX = Math.max(...xs) + pad;
  const maxY = Math.max(...ys) + pad;
  return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
}

/** 收集 boxVertices 結果中的所有 8 個點，給 autoViewBox 用 */
export function allPts(...vsArr: ReturnType<typeof boxVertices>[]): Pt[] {
  return vsArr.flatMap((v) => Object.values(v));
}
