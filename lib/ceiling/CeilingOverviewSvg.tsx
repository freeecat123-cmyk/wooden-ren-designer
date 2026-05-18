/**
 * 階段 2 — 木作天花板骨架俯視 SVG
 *
 * 純元件,只吃 CeilingBom → 畫俯視排版圖。
 *
 * 視覺層級(由下到上):
 *   1. 房間外框(虛線,zinc-300)
 *   2. 矽酸鈣板分割線(虛線,slate-400)
 *   3. 邊框角材(實心矩形,amber-700)
 *   4. 主支角材(實心矩形,amber-600;若被邊框 absorb 則淡化)
 *   5. 副支角材(實心細矩形,zinc-500)
 *   6. 尺寸標註(amber-900 on top + left)
 *
 * 座標慣例:
 *   - SVG units = cm(1:1)
 *   - viewBox 含 PAD cm 邊距留給尺寸標註
 *   - 房間 top-left at (PAD, PAD),長邊水平、短邊垂直
 *   - 主支沿長邊方向排列,單支跨短邊方向(垂直線)
 *   - 副支垂直主支(水平短線),夾在 supports[] 之間
 *
 * 「畫幾根 = 算幾根」:每組數量都對應 trace 裡的值,可肉眼比對。
 */

import type { CeilingBom } from "./types";

const PAD_TOP = 50;     // cm,給上方長邊尺寸 + 主支間距 tick
const PAD_LEFT = 60;    // cm,給左方短邊尺寸
const PAD_RIGHT = 40;
const PAD_BOTTOM = 40;

export type HighlightCategory = "frame" | "main" | "sub" | "board" | null;

export function CeilingOverviewSvg({
  bom,
  highlight = null,
  subLengthFilter = null,
  boardKindFilter = null,
}: {
  bom: CeilingBom;
  highlight?: HighlightCategory;
  subLengthFilter?: number | null;
  boardKindFilter?: "full" | "cut" | null;
}) {
  const { input, trace } = bom;
  // 高亮邏輯:有 highlight 時非匹配的 group 變淡
  const dim = (key: Exclude<HighlightCategory, null>) =>
    highlight && highlight !== key ? 0.12 : 1;
  const L = input.longSideCm;
  const S = input.shortSideCm;
  const tw = input.timberWidthCm;

  const viewW = L + PAD_LEFT + PAD_RIGHT;
  const viewH = S + PAD_TOP + PAD_BOTTOM;

  // SVG 內房間範圍
  const x0 = PAD_LEFT;
  const y0 = PAD_TOP;
  const x1 = x0 + L;
  const y1 = y0 + S;

  // 邊框內側面位置(主支對接到這裡)
  const innerY0 = y0 + tw;
  const innerY1 = y1 - tw;

  // 預先算「哪些主支被邊框 absorb」(僅 frameDoublesAsSupport=true 時)
  const absorbed = new Set<number>();
  if (input.frameDoublesAsSupport) {
    const tol = tw / 2 + 0.01;
    trace.mainJoistCentersCm.forEach((c, idx) => {
      if (Math.abs(c - 0) <= tol || Math.abs(c - L) <= tol) absorbed.add(idx);
    });
    // 若 alignment 不貼邊框,仍視兩端為 absorb(對齊 calc.ts 邏輯)
    if (absorbed.size === 0 && trace.mainJoistCentersCm.length >= 2) {
      absorbed.add(0);
      absorbed.add(trace.mainJoistCentersCm.length - 1);
    }
  }

  return (
    <svg
      viewBox={`0 0 ${viewW} ${viewH}`}
      className="w-full h-auto bg-amber-50/30 rounded border border-zinc-200"
      preserveAspectRatio="xMidYMid meet"
      style={{ maxHeight: "70vh" }}
    >
      <defs>
        {/* 矽酸鈣板斜紋(實心 hatch 替代填色,給整片區分視覺) */}
        <pattern id="board-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="#fef3c7" opacity="0.35" />
          <line x1="0" y1="0" x2="0" y2="6" stroke="#fbbf24" strokeWidth="0.4" opacity="0.4" />
        </pattern>
      </defs>

      {/* ────── 1. 矽酸鈣板每片 rect(per-board,可分 整/裁 高亮) ────── */}
      {renderBoardCells(input, trace.mainJoistCentersCm, x0, y0, dim("board"), boardKindFilter)}

      {/* ────── 2. 矽酸鈣板分割線(虛線) ────── */}
      <g opacity={dim("board")}>
        {renderBoardCutLines(input, trace, x0, y0, x1, y1)}
      </g>

      {/* ────── 3. 房間外框(虛線,牆面) ────── */}
      <rect
        x={x0} y={y0} width={L} height={S}
        fill="none" stroke="#71717a" strokeWidth={0.8}
        strokeDasharray="3 2"
      />

      {/* ────── 4. 邊框角材(4 條實心矩形,沿牆內側) ────── */}
      <g opacity={dim("frame")}>
        <rect x={x0} y={y0} width={L} height={tw} fill="#a16207" stroke="#78350f" strokeWidth={0.3} />
        <rect x={x0} y={y1 - tw} width={L} height={tw} fill="#a16207" stroke="#78350f" strokeWidth={0.3} />
        <rect x={x0} y={y0} width={tw} height={S} fill="#a16207" stroke="#78350f" strokeWidth={0.3} />
        <rect x={x1 - tw} y={y0} width={tw} height={S} fill="#a16207" stroke="#78350f" strokeWidth={0.3} />
      </g>

      {/* ────── 5. 主支角材(垂直矩形,跨短邊內側) ────── */}
      <g opacity={dim("main")}>
      {trace.mainJoistCentersCm.map((c, idx) => {
        const cx = x0 + c;
        const isAbsorbed = absorbed.has(idx);
        return (
          <g key={`main-${idx}`}>
            <rect
              x={cx - tw / 2}
              y={innerY0}
              width={tw}
              height={innerY1 - innerY0}
              fill={isAbsorbed ? "#d6d3d1" : "#d97706"}
              stroke={isAbsorbed ? "#a8a29e" : "#92400e"}
              strokeWidth={0.3}
              opacity={isAbsorbed ? 0.5 : 1}
            />
            {/* 主支中心線小 tick(上方) */}
            <line
              x1={cx} y1={y0 - 4} x2={cx} y2={y0 - 1}
              stroke="#a16207" strokeWidth={0.6}
            />
          </g>
        );
      })}
      </g>

      {/* ────── 6. 副支角材(水平矩形,夾在 supports 之間) ────── */}
      {renderSubJoists(trace, x0, innerY0, tw, dim("sub"), subLengthFilter)}

      {/* ────── 7. 尺寸標註 ────── */}
      {/* 長邊 — 頂部 */}
      <DimLine
        x1={x0} y1={y0 - 24}
        x2={x1} y2={y0 - 24}
        label={`長邊 ${L} cm`}
        color="#78350f"
      />
      {/* 短邊 — 左側 */}
      <DimLineVertical
        x1={x0 - 30} y1={y0}
        x2={x0 - 30} y2={y1}
        label={`短邊 ${S} cm`}
        color="#78350f"
      />

      {/* 剩餘收邊提示(僅 alignment != center 時) */}
      {bom.auto.leftoverCm > 1 && (
        <text
          x={x0 + (input.alignmentBase === "left" ? L - bom.auto.leftoverCm / 2 : input.alignmentBase === "right" ? bom.auto.leftoverCm / 2 : L / 2)}
          y={y1 + 14}
          fontSize={11}
          fill="#9a3412"
          textAnchor="middle"
        >
          剩餘收邊 {round1(bom.auto.leftoverCm)} cm
          {input.alignmentBase === "center" ? "(置中分配)" : ""}
        </text>
      )}

      {/* ────── 8. 圖例 ────── */}
      <g transform={`translate(${PAD_LEFT}, ${y1 + 22})`}>
        <LegendBox color="#a16207" label="邊框" x={0} />
        <LegendBox color="#d97706" label="主支" x={70} />
        <LegendBox color="#52525b" label="副支" x={140} />
        <LegendDash color="#1d4ed8" label="板邊·主支中心" x={210} />
        <LegendDash color="#475569" label="板邊·長 180" x={360} />
      </g>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────
// 副支渲染:每 slot 在 supports[i] 和 supports[i+1] 之間
// 放 subJoistCount 根水平短矩形,沿短邊均分
// ─────────────────────────────────────────────────────────
function renderSubJoists(
  trace: CeilingBom["trace"],
  x0: number,
  innerY0: number,
  tw: number,
  baseOpacity: number,
  subLengthFilter: number | null,
) {
  // 副支 Y 位置由 calc.ts trace 給,SVG 不再自算
  const subThickness = Math.max(0.8, tw * 0.6);
  const elements: React.ReactNode[] = [];

  for (let si = 0; si < trace.slots.length; si++) {
    const slot = trace.slots[si];
    const xStart = x0 + slot.fromCm;
    const xEnd = x0 + slot.toCm;
    // 長度 filter:選了特定長度時,其他長度副支變淡(在 baseOpacity 基礎上再 × 0.12)
    const matchesLengthFilter =
      subLengthFilter == null || Math.abs(slot.subJoistLengthCm - subLengthFilter) < 0.5;
    const op = baseOpacity * (matchesLengthFilter ? 1 : 0.12);
    for (let i = 0; i < trace.subJoistYOffsetsCm.length; i++) {
      const yCenter = innerY0 + trace.subJoistYOffsetsCm[i];
      elements.push(
        <rect
          key={`sub-${si}-${i}`}
          x={xStart}
          y={yCenter - subThickness / 2}
          width={xEnd - xStart}
          height={subThickness}
          fill="#71717a"
          stroke="#3f3f46"
          strokeWidth={0.2}
          opacity={op}
        />,
      );
    }
  }
  return elements;
}

// ─────────────────────────────────────────────────────────
// 矽酸鈣板 per-cell rect:每片板獨立 rect,支援 boardKindFilter 分整/裁高亮
// ─────────────────────────────────────────────────────────
function renderBoardCells(
  input: CeilingBom["input"],
  _mainCenters: number[],
  x0: number,
  y0: number,
  baseOpacity: number,
  boardKindFilter: "full" | "cut" | null,
) {
  // naive grid:cols 每 boardShort cm 一格,rows 每 boardLong cm 一格
  // 跟 calc.ts BOM 數一致
  const L = input.longSideCm;
  const S = input.shortSideCm;
  const colEdges: number[] = [0];
  let x = input.boardShortCm;
  while (x < L) { colEdges.push(x); x += input.boardShortCm; }
  colEdges.push(L);
  const rowEdges: number[] = [0];
  let z = input.boardLongCm;
  while (z < S) { rowEdges.push(z); z += input.boardLongCm; }
  rowEdges.push(S);
  const fullColCount = Math.floor(L / input.boardShortCm);
  const fullRowCount = Math.floor(S / input.boardLongCm);

  const cells: React.ReactNode[] = [];
  let key = 0;
  for (let ci = 0; ci < colEdges.length - 1; ci++) {
    const xL = colEdges[ci];
    const xR = colEdges[ci + 1];
    const colFull = ci < fullColCount;
    for (let ri = 0; ri < rowEdges.length - 1; ri++) {
      const zT = rowEdges[ri];
      const zB = rowEdges[ri + 1];
      const rowFull = ri < fullRowCount;
      const isFullBoard = colFull && rowFull;
      const matchesKind =
        !boardKindFilter ||
        (boardKindFilter === "full" && isFullBoard) ||
        (boardKindFilter === "cut" && !isFullBoard);
      const op = baseOpacity * (matchesKind ? 1 : 0.12);
      cells.push(
        <rect
          key={`board-${key++}`}
          x={x0 + xL}
          y={y0 + zT}
          width={xR - xL}
          height={zB - zT}
          fill={isFullBoard ? "url(#board-hatch)" : "#fda4af33"}
          stroke="#94a3b8"
          strokeWidth={0.3}
          strokeDasharray="2 1"
          opacity={op}
        />,
      );
    }
  }
  return cells;
}

// ─────────────────────────────────────────────────────────
// 矽酸鈣板分割線(虛線)
//   沿長邊方向板邊「落在主支中心」(施工 step 5)
//   → 不再每 90 cm 切,改用 trace.mainJoistCentersCm 切欄
//   → 因為跟主支位置重疊,改畫 above/below 房間外短 ticks,內部不畫(避免跟主支撞色)
//
//   沿短邊方向板邊每 boardLong (180) 一條(無主支對齊)
// ─────────────────────────────────────────────────────────
function renderBoardCutLines(
  input: { boardLongCm: number; boardShortCm: number; longSideCm: number; shortSideCm: number },
  trace: CeilingBom["trace"],
  x0: number, y0: number, x1: number, y1: number,
) {
  const lines: React.ReactNode[] = [];
  let key = 0;
  // 沿長邊:在主支中心線上方/下方各畫一段藍色虛線 tick,標示「此處 = 板邊」
  for (const c of trace.mainJoistCentersCm) {
    const cx = x0 + c;
    // 上方 tick
    lines.push(
      <line key={`bv-top-${key++}`}
        x1={cx} y1={y0 - 12} x2={cx} y2={y0 - 1}
        stroke="#1d4ed8" strokeWidth={0.7} strokeDasharray="2 1.5" opacity={0.9}
      />,
    );
    // 下方 tick
    lines.push(
      <line key={`bv-bot-${key++}`}
        x1={cx} y1={y1 + 1} x2={cx} y2={y1 + 12}
        stroke="#1d4ed8" strokeWidth={0.7} strokeDasharray="2 1.5" opacity={0.9}
      />,
    );
  }
  // 沿短邊方向的板邊(水平線,間距 = boardLong)
  for (let cy = input.boardLongCm; cy < input.shortSideCm; cy += input.boardLongCm) {
    lines.push(
      <line key={`bh-${key++}`}
        x1={x0} y1={y0 + cy} x2={x1} y2={y0 + cy}
        stroke="#475569" strokeWidth={0.6} strokeDasharray="3 2" opacity={0.85}
      />,
    );
  }
  return lines;
}

// ─────────────────────────────────────────────────────────
// 尺寸標註元件
// ─────────────────────────────────────────────────────────
function DimLine({
  x1, y1, x2, y2, label, color,
}: { x1: number; y1: number; x2: number; y2: number; label: string; color: string }) {
  const mid = (x1 + x2) / 2;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={0.5} />
      {/* 兩端短刻線 */}
      <line x1={x1} y1={y1 - 4} x2={x1} y2={y1 + 4} stroke={color} strokeWidth={0.5} />
      <line x1={x2} y1={y2 - 4} x2={x2} y2={y2 + 4} stroke={color} strokeWidth={0.5} />
      {/* 兩端箭頭(三角) */}
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

function LegendBox({ color, label, x }: { color: string; label: string; x: number }) {
  return (
    <g transform={`translate(${x}, 0)`}>
      <rect width={6} height={4} fill={color} stroke="#000" strokeWidth={0.15} />
      <text x={8} y={3.5} fontSize={9} fill="#52525b">{label}</text>
    </g>
  );
}

function LegendDash({ color, label, x }: { color: string; label: string; x: number }) {
  return (
    <g transform={`translate(${x}, 0)`}>
      <line x1={0} y1={2} x2={8} y2={2} stroke={color} strokeWidth={0.5} strokeDasharray="1.5 1.5" />
      <text x={10} y={3.5} fontSize={9} fill="#52525b">{label}</text>
    </g>
  );
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
