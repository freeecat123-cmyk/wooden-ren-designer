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
import type { LayerKey } from "./RaisedFloorScene3D";
import { boundingBox } from "@/lib/floor/geometry";
import { computePlywoodLayout } from "./cutting";

const PAD_TOP = 50;
const PAD_LEFT = 60;
const PAD_RIGHT = 40;
const PAD_BOTTOM = 80; // 留兩行 legend + H 標籤的空間
const LEG_MAX_SPACING_CM = 80; // 跟 RaisedFloorScene3D 同步
const LEG_SIZE_CM = 6;          // 視覺腳柱斷面(對標 Scene3D 的 LEG_CROSS_CM)

interface Props {
  bom: RaisedFloorBom;
  /** 圖層顯示開關(2D/3D 共用同一份 layers state) */
  layers?: Record<LayerKey, boolean>;
  /** 預留 prop,不影響繪製(viewBox 是 cm,RWD 自動縮放) */
  width?: number;
}

const ALL_ON: Record<LayerKey, boolean> = {
  legs: true,
  frameTop: true,
  frameBottom: true,
  mainTop: true,
  mainBottom: true,
  sub: true,
  plywood: true,
  plank: true,
};

export function RaisedFloorOverviewSvg({
  bom,
  layers = ALL_ON,
}: Props): JSX.Element {
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

  // 副支(長軸=方向)— 用對齊夾板 helper(從 0 起算、aligned spacing)
  const subTs = (() => {
    const target = Math.max(bom.input.subJoistSpacingCm, 10);
    const plyLong = bom.input.plywood.sheetWidthCm;
    const aligned =
      plyLong > 0 ? plyLong / Math.max(2, Math.round(plyLong / target)) : target;
    const out: number[] = [];
    let pos = aligned;
    while (pos < shortSpan - 0.5) {
      out.push(pos);
      pos += aligned;
    }
    return out;
  })();

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

  // 夾板拼法用共用模組(SVG + 裁切表)
  const plywoodLayout = computePlywoodLayout(bom);
  const plywoodSheets = plywoodLayout.sheets;

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
        {/* 整片夾板:斜紋淡米 hatch(對標 ceiling board-hatch) */}
        <pattern
          id="raisedFloorPlywoodHatch"
          patternUnits="userSpaceOnUse"
          width={6}
          height={6}
          patternTransform="rotate(45)"
        >
          <rect width={6} height={6} fill="#fef3c7" opacity={0.45} />
          <line x1={0} y1={0} x2={0} y2={6} stroke="#fbbf24" strokeWidth={0.4} opacity={0.5} />
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

      {/* ────── 2. 邊框角材 — 頂框 / 底框(2D 重疊,先底再頂半透明蓋上) ────── */}
      {layers.frameBottom && (
        <g clipPath="url(#raisedFloorPlatformClip)" opacity={layers.frameTop ? 0.7 : 1}>
          {renderFrameBeams(platform.vertices, bb.minX, bb.minY, x0, y0, mainTw)}
        </g>
      )}
      {layers.frameTop && (
        <g clipPath="url(#raisedFloorPlatformClip)">
          {renderFrameBeams(platform.vertices, bb.minX, bb.minY, x0, y0, mainTw)}
        </g>
      )}

      {/* ────── 3. 副支(細灰,沿長軸跑,clip 在 polygon 內) ────── */}
      {layers.sub && (
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
      )}

      {/* ────── 4. 頂主支(實心矩形,沿短軸跨,扣兩端邊框) ────── */}
      {layers.mainTop && (
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
      )}

      {/* ────── 5. 底主支(只在「有內柱」row,深咖,半透明標示) ────── */}
      {layers.mainBottom && (
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
      )}

      {/* ────── 5b. 夾板拼法 — 矩形塊(clipPath 內,挨柱自動切掉) ────── */}
      {layers.plywood && (
        <g clipPath="url(#raisedFloorPlatformClip)" opacity={0.85}>
          {plywoodSheets.map((s, i) => {
            const gapCm = (bom.input.plywoodGapMm ?? 0) / 10;
            const inset = gapCm / 2;
            const rw = Math.max(0, s.w - 2 * inset);
            const rh = Math.max(0, s.h - 2 * inset);
            const fill = s.isFull
              ? s.parity === 0
                ? "#fde68a"
                : "#fcd34d"
              : s.parity === 0
                ? "#fecaca"
                : "#fda4af";
            const stroke = s.isFull ? "#a16207" : "#be123c";
            return (
              <rect
                key={`ply-${i}`}
                x={x0 + s.x + inset}
                y={y0 + s.y + inset}
                width={rw}
                height={rh}
                fill={fill}
                stroke={stroke}
                strokeWidth={0.6}
              />
            );
          })}
        </g>
      )}

      {/* ────── 5c. 夾板編號 + 料 N(clipPath 外,確保挨柱旁小 cell 也看得到字) ────── */}
      {/* 標籤位置移到「visible centroid」:cell 跟所有挨柱做差後的可見區中心,而非 cell rect 中心 */}
      {layers.plywood &&
        plywoodSheets.map((s, i) => {
          const rw = s.w;
          const rh = s.h;
          // 計算可見區中心:cell 跟每個挨柱做差,取最大子矩形的中心
          let visRect = { xL: s.x, yL: s.y, xR: s.x + s.w, yR: s.y + s.h };
          for (const p of pillarRects) {
            // p in bbox-local: { x, y, w, d }
            const ox = Math.max(visRect.xL, p.x);
            const oy = Math.max(visRect.yL, p.y);
            const orL = Math.min(visRect.xR, p.x + p.w);
            const orB = Math.min(visRect.yR, p.y + p.d);
            if (ox >= orL || oy >= orB) continue; // 不重疊
            // 重疊:把 visRect 切成 4 條(上/下/左/右),取最大的當新 visRect
            const candidates = [
              { xL: visRect.xL, yL: visRect.yL, xR: visRect.xR, yR: oy }, // 上條
              { xL: visRect.xL, yL: orB, xR: visRect.xR, yR: visRect.yR }, // 下條
              { xL: visRect.xL, yL: visRect.yL, xR: ox, yR: visRect.yR }, // 左條
              { xL: orL, yL: visRect.yL, xR: visRect.xR, yR: visRect.yR }, // 右條
            ];
            let best = visRect;
            let bestArea = 0;
            for (const c of candidates) {
              const w = c.xR - c.xL;
              const h = c.yR - c.yL;
              if (w <= 0 || h <= 0) continue;
              if (w * h > bestArea) {
                bestArea = w * h;
                best = c;
              }
            }
            if (bestArea <= 0) return null; // 整片在挨柱裡,不畫字
            visRect = best;
          }
          const cx = x0 + (visRect.xL + visRect.xR) / 2;
          const cy = y0 + (visRect.yL + visRect.yR) / 2;
          const vw = visRect.xR - visRect.xL;
          const vh = visRect.yR - visRect.yL;
          const fontSize = Math.max(6, Math.min(14, Math.min(vw, vh) * 0.22));
          const compact = Math.min(rw, rh) < 35 || Math.min(vw, vh) < 35;
          return (
            <g key={`ply-label-${i}`}>
              {compact ? (
                <text
                  x={cx}
                  y={cy + fontSize * 0.35}
                  fontSize={fontSize}
                  fill={s.isFull ? "#78350f" : "#9f1239"}
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {s.isFull ? `${s.index}` : `${s.index}裁`}
                  {s.orderSheetIndex != null ? `·料${s.orderSheetIndex}` : ""}
                </text>
              ) : (
                <>
                  <text
                    x={cx}
                    y={cy - fontSize * 0.3}
                    fontSize={fontSize}
                    fill={s.isFull ? "#78350f" : "#9f1239"}
                    fontWeight="600"
                    textAnchor="middle"
                  >
                    {s.isFull ? `${s.index}` : `${s.index}裁`}
                  </text>
                  {s.orderSheetIndex != null && (
                    <text
                      x={cx}
                      y={cy + fontSize * 0.95}
                      fontSize={fontSize * 0.85}
                      fill="#52525b"
                      fontWeight="600"
                      textAnchor="middle"
                    >
                      料{s.orderSheetIndex}
                    </text>
                  )}
                </>
              )}
            </g>
          );
        })}

      {/* ────── 6. 腳柱(內+周邊,挨柱挖空處過濾) ────── */}
      {layers.legs && legLongs.flatMap((lLong, li) =>
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

      {/* ────── 9. 圖例(兩行排版避免擠在一起) ────── */}
      <g transform={`translate(${PAD_LEFT}, ${y1 + 18})`}>
        {/* 第一行:框 + 主支 */}
        <LegendBox color="#a16207" label="頂框" x={0} />
        <LegendBox color="#a16207" label="底框" x={48} opacity={0.7} />
        <LegendBox color="#d97706" label={`頂主支 ${bom.trace.joistRowCount}`} x={100} />
        <LegendBox color="#8a6d3b" label="底主支" x={170} opacity={0.55} />
        {/* 第二行:副支 / 腳柱 / 夾板(整 + 裁) / 挨柱 */}
        <g transform="translate(0, 14)">
          <LegendBox color="#a1a1aa" label="副支" x={0} />
          <LegendBox color="#27272a" label="腳柱" x={48} />
          <g transform="translate(96, 0)">
            <rect width={6} height={4} fill="#fde68a" stroke="#a16207" strokeWidth={0.3} />
            <text x={8} y={3.5} fontSize={9} fill="#52525b">夾板整片</text>
          </g>
          <g transform="translate(156, 0)">
            <rect width={6} height={4} fill="#fda4af" stroke="#be123c" strokeWidth={0.3} />
            <text x={8} y={3.5} fontSize={9} fill="#52525b">夾板裁切</text>
          </g>
          {hasPillar && (
            <LegendBox
              color="#aaa"
              label={`挨柱 ${pillarRects.length}`}
              x={216}
              opacity={0.3}
            />
          )}
        </g>
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
