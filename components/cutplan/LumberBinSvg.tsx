import type { LinearBin } from "@/lib/cutplan";

export function LumberBinSvg({
  bin,
  index,
  kerf,
  colorFor,
}: {
  bin: LinearBin;
  index: number;
  kerf: number;
  colorFor: (partId: string) => string;
}) {
  const PAD = 20;
  const BAR_H = 60;
  const WIDTH = 1100;
  const scale = (WIDTH - 2 * PAD) / bin.stockLength;

  const usedPct = (bin.usedLength / bin.stockLength) * 100;
  const waste = bin.stockLength - bin.usedLength;

  return (
    <div className="border border-zinc-200 rounded p-3 bg-white">
      <div className="flex items-baseline justify-between mb-2 text-xs">
        <span className="font-semibold text-zinc-700">
          #{index}．原料長 {bin.stockLength} mm
        </span>
        <span className="text-zinc-500">
          用 {bin.usedLength} / 剩 {waste} mm．利用率 {usedPct.toFixed(1)}%
        </span>
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${BAR_H + 2 * PAD + 24}`}
        className="w-full"
      >
        {/* 原料本體外框 */}
        <rect
          x={PAD}
          y={PAD}
          width={bin.stockLength * scale}
          height={BAR_H}
          fill="#f4f4f5"
          stroke="#a1a1aa"
          strokeWidth={1}
        />
        {/* 剩餘料區塊（斜線） */}
        {waste > 0 && (
          <g>
            <defs>
              <pattern
                id={`wastePat-${index}`}
                patternUnits="userSpaceOnUse"
                width="8"
                height="8"
                patternTransform="rotate(45)"
              >
                <line x1="0" y1="0" x2="0" y2="8" stroke="#d4d4d8" strokeWidth="2" />
              </pattern>
            </defs>
            <rect
              x={PAD + bin.usedLength * scale}
              y={PAD}
              width={waste * scale}
              height={BAR_H}
              fill={`url(#wastePat-${index})`}
            />
          </g>
        )}
        {/* 零件 */}
        {bin.pieces.map(({ piece, startMm }, i) => {
          const x = PAD + startMm * scale;
          const w = piece.length * scale;
          const color = colorFor(piece.partId);
          return (
            <g key={i}>
              <rect
                x={x}
                y={PAD}
                width={w}
                height={BAR_H}
                fill={color}
                stroke="#52525b"
                strokeWidth={0.7}
              />
              {w > 30 && (
                <text
                  x={x + w / 2}
                  y={PAD + BAR_H / 2 - 4}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#18181b"
                  fontWeight={600}
                >
                  {piece.partNameZh}
                </text>
              )}
              {w > 30 && (
                <text
                  x={x + w / 2}
                  y={PAD + BAR_H / 2 + 10}
                  textAnchor="middle"
                  fontSize={9}
                  fill="#52525b"
                >
                  {piece.length} mm
                </text>
              )}
              {/* kerf 虛線（零件之間） */}
              {i > 0 && (
                <line
                  x1={x - (kerf / 2) * scale}
                  x2={x - (kerf / 2) * scale}
                  y1={PAD}
                  y2={PAD + BAR_H}
                  stroke="#ef4444"
                  strokeDasharray="2 2"
                  strokeWidth={0.6}
                />
              )}
            </g>
          );
        })}
        {/* 比例尺 */}
        <line
          x1={PAD}
          x2={PAD + bin.stockLength * scale}
          y1={PAD + BAR_H + 6}
          y2={PAD + BAR_H + 6}
          stroke="#71717a"
          strokeWidth={0.5}
        />
        <text
          x={PAD + (bin.stockLength * scale) / 2}
          y={PAD + BAR_H + 22}
          textAnchor="middle"
          fontSize={10}
          fill="#52525b"
        >
          {bin.stockLength} mm
        </text>
      </svg>
    </div>
  );
}
