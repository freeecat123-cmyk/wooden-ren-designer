/**
 * 地板 2D 俯視排版圖。
 * 畫:房間外框、可鋪區域(虛線)、每片地板(整片/裁切片不同填色,裁切片標紅框)。
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
  const pad = 16;
  const roomW = bb.maxX - bb.minX;
  const roomH = bb.maxY - bb.minY;
  const scale = (width - pad * 2) / Math.max(roomW, 1);
  const height = roomH * scale + pad * 2;
  const tx = (x: number) => (x - bb.minX) * scale + pad;
  const ty = (y: number) => (y - bb.minY) * scale + pad;

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
    </svg>
  );
}
