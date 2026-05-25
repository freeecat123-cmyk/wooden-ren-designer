/**
 * 和室架高平台 2D 俯視預覽。
 * 畫:平台 footprint + 骨架虛線(沿短軸=角材方向)+ 挨柱陰影(對角斜線 hatch)
 *     + 上方總寬 / 左側總深尺寸標註 + 左下圖例 + 右下架高高度。
 */
import type { JSX } from "react";
import type { RaisedFloorBom } from "./types";
import { boundingBox } from "@/lib/floor/geometry";

interface Props {
  bom: RaisedFloorBom;
  /** SVG 寬度 px,高度依平台比例 */
  width?: number;
}

export function RaisedFloorOverviewSvg({ bom, width = 388 }: Props): JSX.Element {
  const platform = bom.platform;
  const bb = boundingBox(platform);
  const padL = 34;
  const padR = 14;
  const padT = 22;
  const padB = 30;
  const W = bb.maxX - bb.minX;
  const D = bb.maxY - bb.minY;
  const scale = (width - padL - padR) / Math.max(W, 1);
  const drawW = W * scale;
  const drawH = D * scale;
  const height = drawH + padT + padB;
  const tx = (x: number) => (x - bb.minX) * scale + padL;
  const ty = (y: number) => (y - bb.minY) * scale + padT;

  // 骨架方向跟 geometry.joistRunLengthsM 對齊:短軸=角材方向
  const shortAlongX = W <= D;
  const longSpan = shortAlongX ? D : W;
  const spacing = Math.max(bom.input.joistSpacingCm, 1);
  const middleCount = Math.max(0, Math.floor(longSpan / spacing));
  // 中間支撐位置(沿長軸均分 middleCount + 1 段)
  const joistTs: number[] = [];
  for (let i = 1; i <= middleCount; i++) {
    joistTs.push((i * longSpan) / (middleCount + 1));
  }

  const platformPath =
    platform.vertices.map((p, i) => `${i ? "L" : "M"}${tx(p.x)} ${ty(p.y)}`).join(" ") + " Z";

  // 挨柱矩形位置:從 input.shape + widthCm/depthCm 推 corner 在原矩形 bbox
  // (挨柱是從原 rect/L 的 bbox 角往內挖,跟 platform polygon 的角同位)
  const rectW = bom.input.widthCm;
  const rectD = bom.input.depthCm;
  const pillarRects = bom.input.pillars.map((p) => {
    const x0 =
      p.corner === "tl" || p.corner === "bl" ? 0 : rectW - p.widthCm;
    const y0 =
      p.corner === "tl" || p.corner === "tr" ? 0 : rectD - p.depthCm;
    return { x: x0, y: y0, w: p.widthCm, d: p.depthCm };
  });

  const legendY = padT + drawH + 18;
  const hasPillar = bom.input.pillars.length > 0;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ maxWidth: `${width}px`, height: "auto", display: "block" }}
      className="rounded border border-zinc-200"
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

      {/* 平台 footprint(米底) */}
      <path d={platformPath} fill="#fff8eb" stroke="#333" strokeWidth={1.5} />

      {/* 骨架網格(沿短軸=角材方向畫線,沿長軸均布;clip 在 polygon 內) */}
      <g clipPath="url(#raisedFloorPlatformClip)">
        {joistTs.map((t, i) => {
          if (shortAlongX) {
            // 角材沿 X 走 → 水平線 y = bb.minY + t
            const yLevel = ty(bb.minY + t);
            return (
              <line
                key={i}
                x1={tx(bb.minX)}
                y1={yLevel}
                x2={tx(bb.maxX)}
                y2={yLevel}
                stroke="#bd9955"
                strokeWidth={0.6}
                strokeDasharray="3 2"
              />
            );
          }
          // 角材沿 Y 走 → 垂直線 x = bb.minX + t
          const xLevel = tx(bb.minX + t);
          return (
            <line
              key={i}
              x1={xLevel}
              y1={ty(bb.minY)}
              x2={xLevel}
              y2={ty(bb.maxY)}
              stroke="#bd9955"
              strokeWidth={0.6}
              strokeDasharray="3 2"
            />
          );
        })}
      </g>

      {/* 挨柱陰影 + 對角 hatch */}
      {pillarRects.map((r, i) => (
        <g key={i}>
          <rect
            x={tx(r.x)}
            y={ty(r.y)}
            width={r.w * scale}
            height={r.d * scale}
            fill="#aaa"
            fillOpacity={0.3}
            stroke="#666"
            strokeWidth={0.6}
          />
          <rect
            x={tx(r.x)}
            y={ty(r.y)}
            width={r.w * scale}
            height={r.d * scale}
            fill="url(#raisedFloorPillarHatch)"
            stroke="none"
          />
        </g>
      ))}

      {/* 總寬尺寸標註(上方) */}
      <line x1={padL} y1={11} x2={padL + drawW} y2={11} stroke="#999" strokeWidth={0.8} />
      <text x={padL + drawW / 2} y={9} textAnchor="middle" fontSize={10} fill="#666">
        總寬 {Math.round(W)} cm
      </text>

      {/* 總深尺寸標註(左側,旋轉 -90) */}
      <text
        x={12}
        y={padT + drawH / 2}
        textAnchor="middle"
        fontSize={10}
        fill="#666"
        transform={`rotate(-90 12 ${padT + drawH / 2})`}
      >
        總深 {Math.round(D)} cm
      </text>

      {/* 左下圖例 */}
      <rect
        x={padL}
        y={legendY - 8}
        width={11}
        height={11}
        fill="#fff8eb"
        stroke="#333"
        strokeWidth={0.6}
      />
      <text x={padL + 15} y={legendY} fontSize={10} fill="#666">
        平台 {bom.auto.platformAreaM2.toFixed(2)} m²
      </text>

      <rect
        x={padL + 100}
        y={legendY - 8}
        width={11}
        height={11}
        fill="none"
        stroke="#bd9955"
        strokeWidth={0.6}
        strokeDasharray="3 2"
      />
      <text x={padL + 115} y={legendY} fontSize={10} fill="#666">
        骨架 {bom.trace.joistRowCount} 條 @ {bom.input.joistSpacingCm}cm
      </text>

      {hasPillar && (
        <g>
          <rect
            x={padL + 230}
            y={legendY - 8}
            width={11}
            height={11}
            fill="#aaa"
            fillOpacity={0.3}
            stroke="#666"
            strokeWidth={0.6}
          />
          <text x={padL + 245} y={legendY} fontSize={10} fill="#666">
            挨柱 {bom.input.pillars.length} 根
          </text>
        </g>
      )}

      {/* 右下架高高度 */}
      <text x={width - padR} y={legendY} textAnchor="end" fontSize={10} fill="#888">
        H={bom.input.heightCm}cm
      </text>
    </svg>
  );
}
