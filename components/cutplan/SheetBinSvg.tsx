import type { SheetBin } from "@/lib/cutplan";

export function SheetBinSvg({
  bin,
  index,
  colorFor,
}: {
  bin: SheetBin;
  index: number;
  colorFor: (partId: string) => string;
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
            const color = colorFor(p.piece.partId);
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
                {p.piece.code && w > 16 && h > 16 && (
                  <text
                    x={x + w / 2}
                    y={y + h / 2 + 5}
                    textAnchor="middle"
                    fontSize={Math.min(16, Math.max(10, Math.min(w, h) / 2.5))}
                    fill="#18181b"
                    fontWeight={800}
                    fontFamily="monospace"
                  >
                    {p.piece.code}
                  </text>
                )}
                {w > 50 && h > 26 && (
                  <text
                    x={x + w / 2}
                    y={y + h - 4}
                    textAnchor="middle"
                    fontSize={7}
                    fill="#52525b"
                  >
                    {p.w}×{p.h}×{p.piece.thickness}
                    {p.rotated ? " ↻" : ""}
                  </text>
                )}
              </g>
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
    </div>
  );
}
