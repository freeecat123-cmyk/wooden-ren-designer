import type React from "react";
import type { CutPiece, SheetBin } from "@/lib/cutplan";

export function SheetBinSvg({
  bin,
  index,
  colorFor,
}: {
  bin: SheetBin;
  index: number;
  colorFor: (piece: CutPiece) => string;
}) {
  const PAD = 14;
  // 以長邊 = x 軸、寬邊 = y 軸畫。最大 SVG 寬度 500。
  const MAX_W = 500;
  const scale = (MAX_W - 2 * PAD) / bin.stockLength;
  const viewW = bin.stockLength * scale + 2 * PAD;
  const viewH = bin.stockWidth * scale + 2 * PAD + 30;

  const usedAreaMm2 = bin.shelves.reduce(
    (s, sh) => s + sh.pieces.reduce((ss, p) => ss + p.w * p.h, 0),
    0,
  );
  const pct = (usedAreaMm2 / (bin.stockLength * bin.stockWidth)) * 100;

  return (
    <div className="border border-zinc-200 rounded p-3 bg-white">
      <div className="flex items-baseline justify-between mb-2 text-xs">
        <span className="font-semibold text-zinc-700">
          板 #{index}．{bin.stockLength} × {bin.stockWidth} mm
        </span>
        <span className="text-zinc-500">利用率 {pct.toFixed(1)}%</span>
      </div>
      <svg viewBox={`0 0 ${viewW} ${viewH}`} className="w-full">
        {/* 整板 */}
        <rect
          x={PAD}
          y={PAD}
          width={bin.stockLength * scale}
          height={bin.stockWidth * scale}
          fill="#f4f4f5"
          stroke="#a1a1aa"
          strokeWidth={1}
        />
        {/* 零件 */}
        {bin.shelves.flatMap((shelf, si) =>
          shelf.pieces.map((p, pi) => {
            const x = PAD + p.x * scale;
            const y = PAD + p.y * scale;
            const w = p.w * scale;
            const h = p.h * scale;
            const color = colorFor(p.piece);
            return (
              <g key={`${si}-${pi}`}>
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  fill={color}
                  stroke="#52525b"
                  strokeWidth={0.5}
                />
                {/* 編號：threshold 放寬；字級隨 h 縮放但保底 5，上限 14 */}
                {p.piece.code && w >= 8 && h >= 3 && (
                  <text
                    x={x + w / 2}
                    y={y + h / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={Math.min(14, Math.max(5, h * 0.7))}
                    fill="#18181b"
                    fontWeight={800}
                    fontFamily="monospace"
                  >
                    {p.piece.code}
                    {p.rotated ? "↻" : ""}
                  </text>
                )}
                {/* 切料順序：左上角小圓圈數字 */}
                {p.order && w >= 12 && h >= 8 && (
                  <>
                    <circle
                      cx={x + 5}
                      cy={y + 5}
                      r={4}
                      fill="#18181b"
                      stroke="#fff"
                      strokeWidth={0.5}
                    />
                    <text
                      x={x + 5}
                      y={y + 5}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={5}
                      fill="#fff"
                      fontWeight={700}
                    >
                      {p.order}
                    </text>
                  </>
                )}
              </g>
            );
          }),
        )}
        {/* 鋸路（kerf）：零件之間的切割線，深色細線 */}
        {bin.shelves.flatMap((shelf, si) => {
          const lines: React.ReactElement[] = [];
          // shelf 內垂直鋸（相鄰零件之間）
          for (let i = 0; i < shelf.pieces.length - 1; i++) {
            const cur = shelf.pieces[i];
            const next = shelf.pieces[i + 1];
            const gapMid =
              cur.x + cur.w + (next.x - cur.x - cur.w) / 2;
            const cutX = PAD + gapMid * scale;
            lines.push(
              <line
                key={`vk-${si}-${i}`}
                x1={cutX}
                y1={PAD + shelf.y * scale}
                x2={cutX}
                y2={PAD + (shelf.y + shelf.height) * scale}
                stroke="#18181b"
                strokeWidth={0.8}
                strokeDasharray="2 1"
              />,
            );
          }
          return lines;
        })}
        {/* shelf 之間水平鋸——guillotine 模式 shelves 非平行長條，跳過（鋸線無法一刀到底） */}
        {!bin.guillotine &&
          bin.shelves.slice(0, -1).map((shelf, si) => {
            const next = bin.shelves[si + 1];
            const gapMid =
              shelf.y + shelf.height + (next.y - shelf.y - shelf.height) / 2;
            const cutY = PAD + gapMid * scale;
            return (
              <line
                key={`hk-${si}`}
                x1={PAD}
                y1={cutY}
                x2={PAD + bin.stockLength * scale}
                y2={cutY}
                stroke="#18181b"
                strokeWidth={0.8}
                strokeDasharray="2 1"
              />
            );
          })}
        {/* 零件左緣 x 座標標註（從板左起算 mm），供現場對尺 */}
        {bin.shelves.flatMap((shelf, si) =>
          shelf.pieces.map((p, pi) => {
            // 只在零件左緣 >0（不是板邊）時標
            if (p.x <= 0) return null;
            const tx = PAD + p.x * scale;
            const ty = PAD + shelf.y * scale - 2;
            return (
              <text
                key={`x-${si}-${pi}`}
                x={tx}
                y={ty}
                fontSize={5}
                fill="#71717a"
                textAnchor="middle"
              >
                {Math.round(p.x)}
              </text>
            );
          }),
        )}
        {/* 尺標 */}
        <text
          x={PAD + (bin.stockLength * scale) / 2}
          y={PAD + bin.stockWidth * scale + 18}
          textAnchor="middle"
          fontSize={9}
          fill="#52525b"
        >
          {bin.stockLength} mm
        </text>
      </svg>
      <CutListTable bin={bin} />
    </div>
  );
}

function CutListTable({ bin }: { bin: SheetBin }) {
  // 收集所有零件 + 順序 + 位置
  const rows: Array<{
    order: number;
    code?: string;
    name: string;
    L: number;
    W: number;
    T: number;
    x: number;
    y: number;
    rotated: boolean;
  }> = [];
  for (const shelf of bin.shelves) {
    for (const p of shelf.pieces) {
      rows.push({
        order: p.order ?? 0,
        code: p.piece.code,
        name: p.piece.partNameZh,
        L: Math.round(p.w),
        W: Math.round(p.h),
        T: Math.round(p.piece.thickness),
        x: Math.round(p.x),
        y: Math.round(p.y),
        rotated: p.rotated,
      });
    }
  }
  rows.sort((a, b) => a.order - b.order);
  if (rows.length === 0) return null;
  return (
    <details className="mt-2 text-[11px] text-zinc-700" open>
      <summary className="cursor-pointer font-semibold text-zinc-600 hover:text-zinc-900 select-none">
        切料清單（{rows.length} 刀）
      </summary>
      <table className="w-full mt-1 border-collapse">
        <thead>
          <tr className="bg-zinc-50 text-zinc-500">
            <th className="text-center px-1 py-0.5 w-8">#</th>
            <th className="text-left px-1 py-0.5 w-10">編號</th>
            <th className="text-left px-1 py-0.5">零件</th>
            <th className="text-right px-1 py-0.5 w-28">長×寬×厚 mm</th>
            <th className="text-right px-1 py-0.5 w-20">起點 x,y</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.order} className="border-t border-zinc-100">
              <td className="text-center px-1 py-0.5 font-mono font-bold">{r.order}</td>
              <td className="px-1 py-0.5 font-mono">
                {r.code}
                {r.rotated && "↻"}
              </td>
              <td className="px-1 py-0.5">{r.name}</td>
              <td className="text-right px-1 py-0.5 font-mono">
                {r.L} × {r.W} × {r.T}
              </td>
              <td className="text-right px-1 py-0.5 font-mono text-zinc-500">
                {r.x}, {r.y}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
