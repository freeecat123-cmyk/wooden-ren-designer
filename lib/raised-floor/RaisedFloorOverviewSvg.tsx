/**
 * 和室架高平台 2D 俯視 SVG — 對標 lib/ceiling/CeilingOverviewSvg.tsx
 *
 * 視覺層級(由下到上):
 *   1. 平台外框(虛線,牆面)
 *   2. 邊框角材(實心矩形,沿 polygon 內側)
 *   3. 副支(細灰矩形,沿長軸跨)
 *   4. 頂主支(實心矩形,沿短軸跨,扣兩端邊框)
 *   5. 底主支(深咖矩形,只在「有內柱」row,跟頂主支區隔)
 *   6. 腳柱(深色實心方塊,內柱外柱都標,挨柱挖空處過濾)
 *   7. 挨柱挖空(灰底 + 對角 hatch)
 *   8. 尺寸標註(總寬上方、總深左方,DimLine 帶箭頭)
 *   9. 圖例(底部)
 *
 * 座標慣例:
 *   SVG units = cm(1:1),viewBox = 平台 bbox + PAD;preserveAspectRatio xMidYMid meet。
 *   主支方向跟 geometry.joistRunLengthsM 對齊:短軸=角材方向,沿長軸均分排列。
 */
import type { JSX } from "react";
import type { RaisedFloorBom } from "./types";
import { boundingBox } from "@/lib/floor/geometry";

const PAD_TOP = 50;
const PAD_LEFT = 60;
const PAD_RIGHT = 40;
const PAD_BOTTOM = 60;
const LEG_MAX_SPACING_CM = 80; // 跟 RaisedFloorScene3D 同步
const LEG_SIZE_CM = 6;          // 視覺腳柱斷面(對標 Scene3D 的 LEG_CROSS_CM)

interface Props {
  bom: RaisedFloorBom;
  /** 預留 prop,不影響繪製(viewBox 是 cm,RWD 自動縮放) */
  width?: number;
}

export function RaisedFloorOverviewSvg({ bom }: Props): JSX.Element {
  const platform = bom.platform;
  const bb = boundingBox(platform);
  const W = bb.maxX - bb.minX;
  const D = bb.maxY - bb.minY;

  const viewW = W + PAD_LEFT + PAD_RIGHT;
  const viewH = D + PAD_TOP + PAD_BOTTOM;

  // 平台「左上角」於 SVG 內的位置
  const x0 = PAD_LEFT;
  const y0 = PAD_TOP;
  const x1 = x0 + W;
  const y1 = y0 + D;

  // 平台 polygon 路徑(bbox-local 平移到 SVG)
  const platformPath =
    platform.vertices
      .map((p, i) => {
        const px = p.x - bb.minX + x0;
        const py = p.y - bb.minY + y0;
        return `${i ? "L" : "M"}${px} ${py}`;
      })
      .join(" ") + " Z";

  // 主支(短軸=角材方向)
  const mainTw = bom.input.mainJoist.widthMm / 10;
  const subTw = bom.input.subJoist.widthMm / 10;
  const shortAlongX = W <= D;
  const longSpan = shortAlongX ? D : W;
  const shortSpan = shortAlongX ? W : D;
  const mainSpacing = Math.max(bom.input.joistSpacingCm, 1);
  const middleCount = Math.max(0, Math.floor(longSpan / mainSpacing));
  const mainTs: number[] = [];
  for (let i = 1; i <= middleCount; i++) {
    mainTs.push((i * longSpan) / (middleCount + 1));
  }

  // 副支(長軸=方向)
  const subSpacing = Math.max(bom.input.subJoistSpacingCm, 1);
  const subCount = Math.max(0, Math.floor(shortSpan / subSpacing));
  const subTs: number[] = [];
  for (let i = 1; i <= subCount; i++) {
    subTs.push((i * shortSpan) / (subCount + 1));
  }

  // 腳柱 grid 內柱 row(沿長軸,= 底主支位置)
  const legCountLong = Math.max(2, Math.ceil(longSpan / LEG_MAX_SPACING_CM) + 1);
  const legCountShort = Math.max(2, Math.ceil(shortSpan / LEG_MAX_SPACING_CM) + 1);
  const innerLegLongTs: number[] = [];
  for (let i = 1; i < legCountLong - 1; i++) {
    innerLegLongTs.push((i * longSpan) / (legCountLong - 1));
  }
  // 全部腳柱 grid(供畫腳柱方塊)
  const legLongs: number[] = [];
  const legShorts: number[] = [];
  for (let i = 0; i < legCountLong; i++) {
    legLongs.push((i * longSpan) / (legCountLong - 1));
  }
  for (let j = 0; j < legCountShort; j++) {
    legShorts.push((j * shortSpan) / (legCountShort - 1));
  }

  // point-in-polygon
  const isInside = (px: number, py: number) => {
    let inside = false;
    const v = platform.vertices;
    for (let i = 0, j = v.length - 1; i < v.length; j = i++) {
      const xi = v[i].x - bb.minX,
        yi = v[i].y - bb.minY;
      const xj = v[j].x - bb.minX,
        yj = v[j].y - bb.minY;
      const cross =
        yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
      if (cross) inside = !inside;
    }
    return inside;
  };

  // 挨柱 rect(bbox-local 座標,SVG 內 = x0+x, y0+y)
  const rectW = bom.input.widthCm;
  const rectD = bom.input.depthCm;
  const pillarRects = bom.input.pillars.map((p) => {
    const px = p.corner === "tl" || p.corner === "bl" ? 0 : rectW - p.widthCm;
    const py = p.corner === "tl" || p.corner === "tr" ? 0 : rectD - p.depthCm;
    return { x: px, y: py, w: p.widthCm, d: p.depthCm };
  });

  const hasPillar = pillarRects.length > 0;

  return (
    <svg
      viewBox={`0 0 ${viewW} ${viewH}`}
      className="w-full h-auto bg-amber-50/30 rounded border border-zinc-200"
      preserveAspectRatio="xMidYMid meet"
      style={{ maxHeight: "70vh" }}
    >
      <defs>
        <clipPath id="raisedFloorPlatformClip">
          <path d={platformPath} />
        </clipPath>
        <pattern
          id="raisedFloorPillarHatch"
          patternUnits="userSpaceOnUse"
          width={6}
          height={6}
          patternTransform="rotate(45)"
        >
          <line x1={0} y1={0} x2={0} y2={6} stroke="#888" strokeWidth={0.7} />
        </pattern>
      </defs>

      {/* ────── 1. 平台外框(虛線,牆面) ────── */}
      <path
        d={platformPath}
        fill="none"
        stroke="#71717a"
        strokeWidth={0.8}
        strokeDasharray="3 2"
      />

      {/* ────── 2. 邊框角材(沿 polygon 每條邊往內偏 mainTw 半寬) ────── */}
      <g clipPath="url(#raisedFloorPlatformClip)">
        {renderFrameBeams(platform.vertices, bb.minX, bb.minY, x0, y0, mainTw)}
      </g>

      {/* ────── 3. 副支(細灰,沿長軸跑,clip 在 polygon 內) ────── */}
      <g clipPath="url(#raisedFloorPlatformClip)">
        {subTs.map((t, i) => {
          if (shortAlongX) {
            // 副支沿 Z(=長軸 Y)跑 → 垂直矩形 at x=t
            return (
              <rect
                key={`sub-${i}`}
                x={x0 + t - subTw / 2}
                y={y0}
                width={subTw}
                height={D}
                fill="#a1a1aa"
                stroke="#52525b"
                strokeWidth={0.2}
                opacity={0.6}
              />
            );
          }
          return (
            <rect
              key={`sub-${i}`}
              x={x0}
              y={y0 + t - subTw / 2}
              width={W}
              height={subTw}
              fill="#a1a1aa"
              stroke="#52525b"
              strokeWidth={0.2}
              opacity={0.6}
            />
          );
        })}
      </g>

      {/* ────── 4. 頂主支(實心矩形,沿短軸跨,扣兩端邊框) ────── */}
      <g clipPath="url(#raisedFloorPlatformClip)">
        {mainTs.map((t, i) => {
          if (shortAlongX) {
            // 主支沿 X 跨 → 水平矩形 at y=t
            return (
              <rect
                key={`main-${i}`}
                x={x0 + mainTw}
                y={y0 + t - mainTw / 2}
                width={W - 2 * mainTw}
                height={mainTw}
                fill="#d97706"
                stroke="#92400e"
                strokeWidth={0.3}
              />
            );
          }
          // 主支沿 Y 跨 → 垂直矩形 at x=t
          return (
            <rect
              key={`main-${i}`}
              x={x0 + t - mainTw / 2}
              y={y0 + mainTw}
              width={mainTw}
              height={D - 2 * mainTw}
              fill="#d97706"
              stroke="#92400e"
              strokeWidth={0.3}
            />
          );
        })}
      </g>

      {/* ────── 5. 底主支(只在「有內柱」row,深咖,半透明標示) ────── */}
      <g clipPath="url(#raisedFloorPlatformClip)">
        {innerLegLongTs.map((t, i) => {
          if (shortAlongX) {
            return (
              <rect
                key={`bmain-${i}`}
                x={x0 + mainTw}
                y={y0 + t - mainTw / 2}
                width={W - 2 * mainTw}
                height={mainTw}
                fill="#8a6d3b"
                stroke="#4a3a1f"
                strokeWidth={0.3}
                opacity={0.45}
              />
            );
          }
          return (
            <rect
              key={`bmain-${i}`}
              x={x0 + t - mainTw / 2}
              y={y0 + mainTw}
              width={mainTw}
              height={D - 2 * mainTw}
              fill="#8a6d3b"
              stroke="#4a3a1f"
              strokeWidth={0.3}
              opacity={0.45}
            />
          );
        })}
      </g>

      {/* ────── 6. 腳柱(內+周邊,挨柱挖空處過濾) ────── */}
      {legLongs.flatMap((lLong, li) =>
        legShorts.map((lShort, sj) => {
          const lx = shortAlongX ? lShort : lLong;
          const ly = shortAlongX ? lLong : lShort;
          const sampleX = Math.max(0.1, Math.min(W - 0.1, lx));
          const sampleY = Math.max(0.1, Math.min(D - 0.1, ly));
          if (!isInside(sampleX, sampleY)) return null;
          return (
            <rect
              key={`leg-${li}-${sj}`}
              x={x0 + lx - LEG_SIZE_CM / 2}
              y={y0 + ly - LEG_SIZE_CM / 2}
              width={LEG_SIZE_CM}
              height={LEG_SIZE_CM}
              fill="#27272a"
              stroke="#fff"
              strokeWidth={0.4}
            />
          );
        }),
      )}

      {/* ────── 7. 挨柱(灰底 + 對角 hatch) ────── */}
      {pillarRects.map((r, i) => (
        <g key={`pillar-${i}`}>
          <rect
            x={x0 + r.x}
            y={y0 + r.y}
            width={r.w}
            height={r.d}
            fill="#aaa"
            fillOpacity={0.3}
            stroke="#666"
            strokeWidth={0.5}
          />
          <rect
            x={x0 + r.x}
            y={y0 + r.y}
            width={r.w}
            height={r.d}
            fill="url(#raisedFloorPillarHatch)"
            stroke="none"
          />
        </g>
      ))}

      {/* ────── 8. 尺寸標註 ────── */}
      <DimLine
        x1={x0}
        y1={y0 - 24}
        x2={x1}
        y2={y0 - 24}
        label={`總寬 ${Math.round(W)} cm`}
        color="#78350f"
      />
      <DimLineVertical
        x1={x0 - 30}
        y1={y0}
        x2={x0 - 30}
        y2={y1}
        label={`總深 ${Math.round(D)} cm`}
        color="#78350f"
      />

      {/* ────── 9. 圖例 ────── */}
      <g transform={`translate(${PAD_LEFT}, ${y1 + 22})`}>
        <LegendBox color="#a16207" label="邊框" x={0} />
        <LegendBox color="#d97706" label={`主支(${bom.trace.joistRowCount})`} x={60} />
        <LegendBox color="#8a6d3b" label="底主支" x={140} opacity={0.45} />
        <LegendBox color="#a1a1aa" label="副支" x={200} />
        <LegendBox color="#27272a" label="腳柱" x={250} />
        {hasPillar && (
          <LegendBox
            color="#aaa"
            label={`挨柱 ${pillarRects.length}`}
            x={300}
            opacity={0.3}
          />
        )}
      </g>

      {/* 右下架高高度 */}
      <text
        x={viewW - PAD_RIGHT}
        y={y1 + 22 + 3.5}
        textAnchor="end"
        fontSize={10}
        fill="#71717a"
      >
        H = {bom.input.heightCm} cm
      </text>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────
// 邊框 — 沿 polygon 每條邊往 CCW 左法向(內側)偏 frameTw/2 畫矩形
// 軸向正交多邊形:每邊不是水平就是垂直。
// ─────────────────────────────────────────────────────────
function renderFrameBeams(
  verts: { x: number; y: number }[],
  bbMinX: number,
  bbMinY: number,
  x0: number,
  y0: number,
  frameTw: number,
): JSX.Element[] {
  // 正規化成 CCW(法向往內)
  let area = 0;
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % verts.length];
    area += a.x * b.y - b.x * a.y;
  }
  const ccw = area < 0 ? [...verts].reverse() : verts;

  const out: JSX.Element[] = [];
  for (let i = 0; i < ccw.length; i++) {
    const a = ccw[i];
    const b = ccw[(i + 1) % ccw.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.1) continue;
    const ux = dx / len;
    const uy = dy / len;
    // CCW 左法向(往內)
    const nx = -uy;
    const ny = ux;
    const cx = (a.x + b.x) / 2 - bbMinX + nx * frameTw / 2 + x0;
    const cy = (a.y + b.y) / 2 - bbMinY + ny * frameTw / 2 + y0;
    const horiz = Math.abs(uy) < 0.01; // 邊沿 X 跑
    const w = horiz ? len : frameTw;
    const h = horiz ? frameTw : len;
    out.push(
      <rect
        key={`frame-${i}`}
        x={cx - w / 2}
        y={cy - h / 2}
        width={w}
        height={h}
        fill="#a16207"
        stroke="#78350f"
        strokeWidth={0.3}
      />,
    );
  }
  return out;
}

// ─────────────────────────────────────────────────────────
// 尺寸標註(對齊 ceiling)
// ─────────────────────────────────────────────────────────
function DimLine({
  x1, y1, x2, y2, label, color,
}: { x1: number; y1: number; x2: number; y2: number; label: string; color: string }) {
  const mid = (x1 + x2) / 2;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={0.5} />
      <line x1={x1} y1={y1 - 4} x2={x1} y2={y1 + 4} stroke={color} strokeWidth={0.5} />
      <line x1={x2} y1={y2 - 4} x2={x2} y2={y2 + 4} stroke={color} strokeWidth={0.5} />
      <polygon points={`${x1},${y1} ${x1 + 4},${y1 - 1.5} ${x1 + 4},${y1 + 1.5}`} fill={color} />
      <polygon points={`${x2},${y2} ${x2 - 4},${y2 - 1.5} ${x2 - 4},${y2 + 1.5}`} fill={color} />
      <text x={mid} y={y1 - 4} fontSize={13} fill={color} textAnchor="middle" fontWeight="600">{label}</text>
    </g>
  );
}

function DimLineVertical({
  x1, y1, x2, y2, label, color,
}: { x1: number; y1: number; x2: number; y2: number; label: string; color: string }) {
  const mid = (y1 + y2) / 2;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={0.5} />
      <line x1={x1 - 4} y1={y1} x2={x1 + 4} y2={y1} stroke={color} strokeWidth={0.5} />
      <line x1={x2 - 4} y1={y2} x2={x2 + 4} y2={y2} stroke={color} strokeWidth={0.5} />
      <polygon points={`${x1},${y1} ${x1 - 1.5},${y1 + 4} ${x1 + 1.5},${y1 + 4}`} fill={color} />
      <polygon points={`${x2},${y2} ${x2 - 1.5},${y2 - 4} ${x2 + 1.5},${y2 - 4}`} fill={color} />
      <text
        x={x1 - 4} y={mid}
        fontSize={13} fill={color} textAnchor="middle" fontWeight="600"
        transform={`rotate(-90 ${x1 - 4} ${mid})`}
      >
        {label}
      </text>
    </g>
  );
}

function LegendBox({
  color, label, x, opacity = 1,
}: { color: string; label: string; x: number; opacity?: number }) {
  return (
    <g transform={`translate(${x}, 0)`}>
      <rect width={6} height={4} fill={color} stroke="#000" strokeWidth={0.15} opacity={opacity} />
      <text x={8} y={3.5} fontSize={9} fill="#52525b">{label}</text>
    </g>
  );
}
