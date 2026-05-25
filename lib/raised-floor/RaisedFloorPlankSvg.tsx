/**
 * 和室架高平台 — 面材拼花 2D 俯視圖。
 * 畫:平台 footprint(米底)+ 每片地板(整片/裁切片不同填色)+ 平台外框
 *     + 上方總寬 / 左側總深尺寸標註 + 左下圖例 + 右下損耗率。
 *
 * 設計:對標 lib/floor/FloorOverviewSvg.tsx 的拼花畫法,版面慣例對齊
 *       lib/raised-floor/RaisedFloorOverviewSvg.tsx。RaisedFloorBom 沒有 layout
 *       欄位,所以在這裡用跟 calc.ts 完全一致的 stub FloorInput 再算一次
 *       computeFloorLayout 以避免片數不一致。平台可能為 L 形或被挖挨柱,
 *       加 clipPath 把 plank 群組裁切在 platform polygon 內。
 */
import type { JSX } from "react";
import type { RaisedFloorBom } from "./types";
import { boundingBox } from "@/lib/floor/geometry";
import { computeFloorLayout } from "@/lib/floor/layout";
import type { FloorInput } from "@/lib/floor/types";

interface Props {
  bom: RaisedFloorBom;
  /** SVG 寬度 px,高度依平台比例 */
  width?: number;
}

export function RaisedFloorPlankSvg({ bom, width = 388 }: Props): JSX.Element {
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

  // ────────────────────────────────────────────────────────
  // 跟 calc.ts 同樣的 stub FloorInput,確保 plank 數一致。
  // ────────────────────────────────────────────────────────
  const floorInput: FloorInput = {
    room: platform,
    pattern: "straight",
    plankLengthCm: bom.input.plankLengthCm,
    plankWidthCm: bom.input.plankWidthCm,
    direction: "long-axis",
    stagger: "half",
    startCorner: "top-left",
    expansionGapMm: bom.input.plankGapMm,
    wasteMode: "computed",
    reuseOffcuts: true,
    skirtingType: "none",
    doorCount: 0,
    doorWidthCm: 0,
    plankPricePerPing: 0,
    skirtingPricePerM: 0,
    underlayPricePerPing: 0,
  };
  const layout = computeFloorLayout(floorInput);

  // 跟 FloorOverviewSvg 一樣推 runAlongX:bom.input 沒 direction 欄位,
  // 走 long-axis 一律比 layable bbox 長邊。
  const layBb = boundingBox(layout.layableRegion);
  const runAlongX = layBb.maxX - layBb.minX >= layBb.maxY - layBb.minY;

  const platformPath =
    platform.vertices
      .map((p, i) => `${i ? "L" : "M"}${tx(p.x)} ${ty(p.y)}`)
      .join(" ") + " Z";

  const fullCount = layout.planks.filter((p) => p.kind === "full").length;
  const cutCount = layout.planks.length - fullCount;
  const legendY = padT + drawH + 18;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ maxWidth: `${width}px`, height: "auto", display: "block" }}
      className="rounded border border-zinc-200"
    >
      <defs>
        <clipPath id="raisedFloorPlankClip">
          <path d={platformPath} />
        </clipPath>
      </defs>

      {/* 1. 平台 footprint(米底) */}
      <path d={platformPath} fill="#fff8eb" stroke="none" />

      {/* 2. 每片 plank(clip 到 platform polygon 內,避免 L 形/挨柱溢出) */}
      <g clipPath="url(#raisedFloorPlankClip)">
        {layout.planks.map((p, i) => {
          const fill = p.kind === "full" ? "#e7d8ae" : "#f3d9d4";
          const stroke = p.kind === "full" ? "#bd9955" : "#c0392b";
          if (p.shape) {
            return (
              <polygon
                key={i}
                points={p.shape.map((q) => `${tx(q.x)},${ty(q.y)}`).join(" ")}
                fill={fill}
                stroke={stroke}
                strokeWidth={0.6}
              />
            );
          }
          return (
            <rect
              key={i}
              x={tx(p.x)}
              y={ty(p.y)}
              width={(runAlongX ? p.lengthCm : p.widthCm) * scale}
              height={(runAlongX ? p.widthCm : p.lengthCm) * scale}
              fill={fill}
              stroke={stroke}
              strokeWidth={0.6}
            />
          );
        })}
      </g>

      {/* 3. 平台外框(黑線,蓋 plank 邊緣) */}
      <path d={platformPath} fill="none" stroke="#333" strokeWidth={1.5} />

      {/* 4a. 總寬尺寸標註(上方) */}
      <line
        x1={padL}
        y1={11}
        x2={padL + drawW}
        y2={11}
        stroke="#999"
        strokeWidth={0.8}
      />
      <text
        x={padL + drawW / 2}
        y={9}
        textAnchor="middle"
        fontSize={10}
        fill="#666"
      >
        總寬 {Math.round(W)} cm
      </text>

      {/* 4b. 總深尺寸標註(左側,旋轉 -90) */}
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

      {/* 5. 左下圖例:整片 / 裁切 */}
      <rect
        x={padL}
        y={legendY - 8}
        width={11}
        height={11}
        fill="#e7d8ae"
        stroke="#bd9955"
        strokeWidth={0.6}
      />
      <text x={padL + 15} y={legendY} fontSize={10} fill="#666">
        整片 {fullCount}
      </text>
      <rect
        x={padL + 70}
        y={legendY - 8}
        width={11}
        height={11}
        fill="#f3d9d4"
        stroke="#c0392b"
        strokeWidth={0.6}
      />
      <text x={padL + 85} y={legendY} fontSize={10} fill="#666">
        裁切 {cutCount}
      </text>

      {/* 6. 右下損耗率(紅字粗體) */}
      <text
        x={width - padR}
        y={legendY}
        textAnchor="end"
        fontSize={10}
        fill="#c0392b"
        fontWeight={600}
      >
        損耗 {bom.trace.plankWastePercent.toFixed(1)}%
      </text>
    </svg>
  );
}
