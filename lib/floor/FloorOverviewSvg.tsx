/**
 * 地板 2D 俯視排版圖。
 * 畫:房間外框、可鋪區域(虛線)、每片地板(整片/裁切片不同填色)、
 *     總寬/總深尺寸標註、整片vs裁切圖例 + 損耗率。
 */
import type { FloorBom } from "./types";
import { boundingBox } from "./geometry";

interface Props {
  bom: FloorBom;
  /** SVG 寬度 px,高度依房間比例 */
  width?: number;
}

export function FloorOverviewSvg({ bom, width = 520 }: Props) {
  const room = bom.input.room;
  const bb = boundingBox(room);
  const padL = 34;
  const padR = 14;
  const padT = 22;
  const padB = 30;
  const roomW = bb.maxX - bb.minX;
  const roomH = bb.maxY - bb.minY;
  const scale = (width - padL - padR) / Math.max(roomW, 1);
  const drawW = roomW * scale;
  const drawH = roomH * scale;
  const height = drawH + padT + padB;
  const tx = (x: number) => (x - bb.minX) * scale + padL;
  const ty = (y: number) => (y - bb.minY) * scale + padT;

  // 與 layout.ts 相同邏輯推 runAlongX:地板片「長度」方向是否沿 X
  const layBb = boundingBox(bom.layout.layableRegion);
  const runAlongX =
    bom.input.direction === "long-axis"
      ? layBb.maxX - layBb.minX >= layBb.maxY - layBb.minY
      : layBb.maxX - layBb.minX < layBb.maxY - layBb.minY;

  const roomPath =
    room.vertices.map((p, i) => `${i ? "L" : "M"}${tx(p.x)} ${ty(p.y)}`).join(" ") +
    " Z";
  const layablePath =
    bom.layout.layableRegion.vertices
      .map((p, i) => `${i ? "L" : "M"}${tx(p.x)} ${ty(p.y)}`)
      .join(" ") + " Z";

  const fullCount = bom.layout.planks.filter((p) => p.kind === "full").length;
  const cutCount = bom.layout.planks.length - fullCount;
  const legendY = padT + drawH + 18;

  return (
    <svg width={width} height={height} className="rounded border border-zinc-200">
      {/* 地板片(人字拼為旋轉四邊形,直鋪為軸對齊矩形) */}
      {bom.layout.planks.map((p, i) => {
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
      {/* 可鋪區域虛線 */}
      <path
        d={layablePath}
        fill="none"
        stroke="#bd9955"
        strokeWidth={1}
        strokeDasharray="4 3"
      />
      {/* 房間外框 */}
      <path d={roomPath} fill="none" stroke="#333" strokeWidth={1.5} />

      {/* 總寬尺寸標註(上方) */}
      <line x1={padL} y1={11} x2={padL + drawW} y2={11} stroke="#999" strokeWidth={0.8} />
      <text
        x={padL + drawW / 2}
        y={9}
        textAnchor="middle"
        fontSize={10}
        fill="#666"
      >
        總寬 {Math.round(roomW)} cm
      </text>
      {/* 總深尺寸標註(左側,直書) */}
      <text
        x={12}
        y={padT + drawH / 2}
        textAnchor="middle"
        fontSize={10}
        fill="#666"
        transform={`rotate(-90 12 ${padT + drawH / 2})`}
      >
        總深 {Math.round(roomH)} cm
      </text>

      {/* 圖例 + 損耗率 */}
      <rect x={padL} y={legendY - 8} width={11} height={11} fill="#e7d8ae" stroke="#bd9955" strokeWidth={0.6} />
      <text x={padL + 15} y={legendY} fontSize={10} fill="#666">
        整片 {fullCount}
      </text>
      <rect x={padL + 70} y={legendY - 8} width={11} height={11} fill="#f3d9d4" stroke="#c0392b" strokeWidth={0.6} />
      <text x={padL + 85} y={legendY} fontSize={10} fill="#666">
        裁切 {cutCount}
      </text>
      <text x={width - padR} y={legendY} textAnchor="end" fontSize={10} fill="#c0392b" fontWeight={600}>
        損耗 {bom.trace.wastePercent.toFixed(1)}%
      </text>
    </svg>
  );
}
