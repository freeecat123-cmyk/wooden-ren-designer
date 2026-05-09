/**
 * 榫卯/工程圖 SVG 基礎繪圖元件 + 常數。
 *
 * Phase 1：抽出 details.tsx 既有的 COLOR/STROKE/FONT/DASH + DimLine + Hatching + fitScale
 *          並新增 10 個 helper 給 Phase 2 重繪 12 種榫卯細節圖使用。
 * Phase 1 嚴禁改動 details.tsx 任何 detail render 函式內部畫法。
 */

import type { ReactNode, JSX } from "react";

// =============================================================================
// 配色（保留 wrd 米黃棕，木頭仁拍板）
// =============================================================================
/** 榫卯/工程圖統一配色。 */
export const COLOR = {
  TENON: "#e6c89a",        // 公榫米黃
  MORTISE: "#b08a4e",      // 母榫深棕
  OUTLINE: "#222",         // 主輪廓
  DIM: "#0a4d8c",          // 老師藍尺寸線
  DIM_TICK: "#c0282d",     // 老師紅刻度
  HIDDEN: "#b59062",       // 隱藏線
  CENTER: "#666",          // 點劃線中心線
  SECTION_HATCH: "#c0282d",// 紅 45° 剖面 hatching
  GRAIN: "#8b6b3a",        // 木紋方向箭頭
} as const;

/** 線寬（px）。 */
export const STROKE = {
  OUTLINE: 1.0,
  HIDDEN: 0.6,
  CENTER: 0.5,
  DIM: 0.5,
  SECTION: 0.7,
} as const;

/** 字級（px）。 */
export const FONT = {
  DIM: 9,
  LABEL: 10,
  TITLE: 12,
  CALLOUT: 8,
} as const;

/** 線型 dasharray。 */
export const DASH = {
  HIDDEN: "3 2",
  CENTER: "6 1.5 1 1.5",  // 點劃線
  DIM: "2 2",
  AUX: "3 3",
} as const;

// =============================================================================
// 既有 helpers — 從 details.tsx 整字搬遷，不改 signature/邏輯
// =============================================================================

/** 尺寸線：兩端引出短線 + 主橫線 + 兩端 tick + 數字 label。 */
export function DimLine({
  x1,
  y1,
  x2,
  y2,
  label,
  side = "top",
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
  side?: "top" | "bottom" | "left" | "right";
}): JSX.Element {
  const tick = 4;
  const dx = side === "left" ? -10 : side === "right" ? 10 : 0;
  const dy = side === "top" ? -10 : side === "bottom" ? 10 : 0;
  const lx1 = x1 + dx;
  const ly1 = y1 + dy;
  const lx2 = x2 + dx;
  const ly2 = y2 + dy;
  return (
    <g stroke={COLOR.DIM} fill={COLOR.DIM} strokeWidth={0.5}>
      <line x1={x1} y1={y1} x2={lx1} y2={ly1} strokeDasharray="2 2" />
      <line x1={x2} y1={y2} x2={lx2} y2={ly2} strokeDasharray="2 2" />
      <line x1={lx1} y1={ly1} x2={lx2} y2={ly2} />
      <line
        x1={lx1 - tick * (side === "top" || side === "bottom" ? 0 : 1)}
        y1={ly1 - tick * (side === "left" || side === "right" ? 0 : 1)}
        x2={lx1 + tick * (side === "top" || side === "bottom" ? 0 : 1)}
        y2={ly1 + tick * (side === "left" || side === "right" ? 0 : 1)}
      />
      <line
        x1={lx2 - tick * (side === "top" || side === "bottom" ? 0 : 1)}
        y1={ly2 - tick * (side === "left" || side === "right" ? 0 : 1)}
        x2={lx2 + tick * (side === "top" || side === "bottom" ? 0 : 1)}
        y2={ly2 + tick * (side === "left" || side === "right" ? 0 : 1)}
      />
      <text
        x={(lx1 + lx2) / 2 + (side === "left" ? -4 : side === "right" ? 4 : 0)}
        y={(ly1 + ly2) / 2 + (side === "bottom" ? 12 : side === "top" ? -4 : 3)}
        fontSize={9}
        textAnchor={side === "left" ? "end" : side === "right" ? "start" : "middle"}
        stroke="none"
      >
        {label}
      </text>
    </g>
  );
}

/** 45° 斜線剖面 hatching（給 <pattern> 用，需透過 fill="url(#id)" 引用）。 */
export function Hatching({ id, color = "#8a6a3a" }: { id: string; color?: string }): JSX.Element {
  return (
    <pattern
      id={id}
      patternUnits="userSpaceOnUse"
      width={4}
      height={4}
      patternTransform="rotate(45)"
    >
      <line x1={0} y1={0} x2={0} y2={4} stroke={color} strokeWidth={0.6} />
    </pattern>
  );
}

/** 計算單位縮放：讓最大尺寸（mm）剛好佔滿目標 px。 */
export function fitScale(maxMm: number, maxPx: number): number {
  return maxPx / Math.max(1, maxMm);
}

// =============================================================================
// 新增 helpers（Phase 2 用，目前還沒有 caller）
// =============================================================================

/** 點劃線中心線（給對稱軸/迴轉軸用）。 */
export function CenterLine({
  x1,
  y1,
  x2,
  y2,
  color = COLOR.CENTER,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color?: string;
}): JSX.Element {
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={color}
      strokeWidth={STROKE.CENTER}
      strokeDasharray={DASH.CENTER}
    />
  );
}

/** 老師慣用的剖面標記「A→ ←A」短粗線+箭頭+大寫字母。 */
export function SectionMark({
  x,
  y,
  label,
  direction,
}: {
  x: number;
  y: number;
  label: string;
  direction: "right" | "left" | "up" | "down";
}): JSX.Element {
  const dirVec: Record<typeof direction, [number, number]> = {
    right: [1, 0],
    left: [-1, 0],
    up: [0, -1],
    down: [0, 1],
  };
  const [vx, vy] = dirVec[direction];
  const lineLen = 5;
  const arrowLen = 6;
  const arrowHalf = 3;
  // 短粗線：以 (x,y) 為起點往反方向延 lineLen
  const lx1 = x - vx * lineLen;
  const ly1 = y - vy * lineLen;
  const lx2 = x;
  const ly2 = y;
  // 箭頭：從 (x,y) 往方向延 arrowLen，三角形
  const tipX = x + vx * arrowLen;
  const tipY = y + vy * arrowLen;
  // 箭頭底邊兩點（垂直方向）
  const baseX1 = x + (-vy) * arrowHalf;
  const baseY1 = y + vx * arrowHalf;
  const baseX2 = x - (-vy) * arrowHalf;
  const baseY2 = y - vx * arrowHalf;
  // label 位置：箭頭尖端再往同方向 6px
  const labelX = tipX + vx * 6;
  const labelY = tipY + vy * 6 + (direction === "right" || direction === "left" ? 4 : 0);
  return (
    <g>
      <line x1={lx1} y1={ly1} x2={lx2} y2={ly2} stroke="#000" strokeWidth={1.5} />
      <polygon
        points={`${tipX},${tipY} ${baseX1},${baseY1} ${baseX2},${baseY2}`}
        fill="#000"
      />
      <text
        x={labelX}
        y={labelY}
        fontSize={FONT.LABEL}
        fontWeight="bold"
        textAnchor={direction === "left" ? "end" : direction === "right" ? "start" : "middle"}
      >
        {label}
      </text>
    </g>
  );
}

/** 統一虛線隱線：可給 d 走 path，或 x1/y1/x2/y2 走 line。 */
export function HiddenEdge({
  d,
  x1,
  y1,
  x2,
  y2,
  color = COLOR.HIDDEN,
}: {
  d?: string;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  color?: string;
}): JSX.Element {
  if (d) {
    return (
      <path
        d={d}
        stroke={color}
        strokeWidth={STROKE.HIDDEN}
        strokeDasharray={DASH.HIDDEN}
        fill="none"
      />
    );
  }
  return (
    <line
      x1={x1 ?? 0}
      y1={y1 ?? 0}
      x2={x2 ?? 0}
      y2={y2 ?? 0}
      stroke={color}
      strokeWidth={STROKE.HIDDEN}
      strokeDasharray={DASH.HIDDEN}
    />
  );
}

/** 木紋方向雙頭箭頭 + 「木紋」字樣。 */
export function GrainArrow({
  x,
  y,
  length,
  angle = 0,
  label = "木紋",
}: {
  x: number;
  y: number;
  length: number;
  angle?: 0 | 90;
  label?: string;
}): JSX.Element {
  const isHoriz = angle === 0;
  const x1 = x;
  const y1 = y;
  const x2 = isHoriz ? x + length : x;
  const y2 = isHoriz ? y : y + length;
  const arrowSize = 4;
  // 左/上端箭頭（指向起點外）
  const head1 = isHoriz
    ? `${x1},${y1} ${x1 + arrowSize},${y1 - arrowSize / 2} ${x1 + arrowSize},${y1 + arrowSize / 2}`
    : `${x1},${y1} ${x1 - arrowSize / 2},${y1 + arrowSize} ${x1 + arrowSize / 2},${y1 + arrowSize}`;
  // 右/下端箭頭
  const head2 = isHoriz
    ? `${x2},${y2} ${x2 - arrowSize},${y2 - arrowSize / 2} ${x2 - arrowSize},${y2 + arrowSize / 2}`
    : `${x2},${y2} ${x2 - arrowSize / 2},${y2 - arrowSize} ${x2 + arrowSize / 2},${y2 - arrowSize}`;
  const labelX = isHoriz ? (x1 + x2) / 2 : x + 8;
  const labelY = isHoriz ? y - 4 : (y1 + y2) / 2;
  return (
    <g stroke={COLOR.GRAIN} fill={COLOR.GRAIN}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={0.7} />
      <polygon points={head1} />
      <polygon points={head2} />
      <text
        x={labelX}
        y={labelY}
        fontSize={FONT.CALLOUT}
        textAnchor={isHoriz ? "middle" : "start"}
        stroke="none"
      >
        {label}
      </text>
    </g>
  );
}

/** 比例尺條：水平刻度條，預設 4 段切成 5 個刻度。 */
export function ScaleBar({
  x,
  y,
  widthMm,
  pxPerMm,
  segments = 4,
  label,
}: {
  x: number;
  y: number;
  widthMm: number;
  pxPerMm: number;
  segments?: number;
  label?: string;
}): JSX.Element {
  const widthPx = widthMm * pxPerMm;
  const stepPx = widthPx / segments;
  const stepMm = widthMm / segments;
  const tickH = 4;
  const ticks: JSX.Element[] = [];
  for (let i = 0; i <= segments; i++) {
    const tx = x + stepPx * i;
    const isMajor = i === 0 || i === segments;
    ticks.push(
      <line
        key={`t${i}`}
        x1={tx}
        y1={y - tickH}
        x2={tx}
        y2={y + (isMajor ? tickH : tickH / 2)}
        stroke={COLOR.OUTLINE}
        strokeWidth={STROKE.DIM}
      />,
    );
    ticks.push(
      <text
        key={`l${i}`}
        x={tx}
        y={y + tickH + FONT.DIM + 1}
        fontSize={FONT.DIM}
        textAnchor="middle"
        fill={COLOR.OUTLINE}
      >
        {Math.round(stepMm * i)}
      </text>,
    );
  }
  return (
    <g>
      <line
        x1={x}
        y1={y}
        x2={x + widthPx}
        y2={y}
        stroke={COLOR.OUTLINE}
        strokeWidth={STROKE.OUTLINE}
      />
      {ticks}
      {label && (
        <text
          x={x + widthPx / 2}
          y={y - tickH - 2}
          fontSize={FONT.CALLOUT}
          textAnchor="middle"
          fill={COLOR.OUTLINE}
        >
          {label}
        </text>
      )}
    </g>
  );
}

/** 圖框右下角標題欄：圖名/比例/繪圖/圖號 三行顯示。 */
export function TitleBlock({
  x,
  y,
  width,
  joineryType,
  joineryNameZh,
  scale,
  drawnBy,
  drawingNumber,
}: {
  x: number;
  y: number;
  width: number;
  joineryType: string;
  joineryNameZh: string;
  scale?: string;
  drawnBy?: string;
  drawingNumber?: string;
}): JSX.Element {
  const rowH = 16;
  const totalH = rowH * 3 + 2;
  const pad = 6;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={totalH}
        fill="white"
        stroke={COLOR.OUTLINE}
        strokeWidth={STROKE.OUTLINE}
      />
      <line
        x1={x}
        y1={y + rowH}
        x2={x + width}
        y2={y + rowH}
        stroke={COLOR.OUTLINE}
        strokeWidth={0.5}
      />
      <line
        x1={x}
        y1={y + rowH * 2}
        x2={x + width}
        y2={y + rowH * 2}
        stroke={COLOR.OUTLINE}
        strokeWidth={0.5}
      />
      <text x={x + pad} y={y + rowH - 4} fontSize={FONT.LABEL} fill={COLOR.OUTLINE}>
        圖名：{joineryNameZh}（{joineryType}）
      </text>
      <text
        x={x + pad}
        y={y + rowH * 2 - 4}
        fontSize={FONT.DIM}
        fill={COLOR.OUTLINE}
      >
        比例：{scale ?? "1:1"} ｜ 繪圖：{drawnBy ?? "wrd-auto"}
      </text>
      <text
        x={x + pad}
        y={y + rowH * 3 - 4}
        fontSize={FONT.DIM}
        fill={COLOR.OUTLINE}
      >
        圖號：{drawingNumber ?? "—"}
      </text>
    </g>
  );
}

/** 連續尺寸鏈：在同軸線上串接多段尺寸，共用 DimLine。 */
export function DimChain({
  axis,
  origin,
  segments,
  pxPerMm,
  side,
}: {
  axis: "x" | "y";
  origin: { x: number; y: number };
  segments: { lengthMm: number; label: string }[];
  pxPerMm: number;
  side: "top" | "bottom" | "left" | "right";
}): JSX.Element {
  const dims: JSX.Element[] = [];
  let cursor = axis === "x" ? origin.x : origin.y;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const segPx = seg.lengthMm * pxPerMm;
    const next = cursor + segPx;
    if (axis === "x") {
      dims.push(
        <DimLine
          key={i}
          x1={cursor}
          y1={origin.y}
          x2={next}
          y2={origin.y}
          label={seg.label}
          side={side}
        />,
      );
    } else {
      dims.push(
        <DimLine
          key={i}
          x1={origin.x}
          y1={cursor}
          x2={origin.x}
          y2={next}
          label={seg.label}
          side={side}
        />,
      );
    }
    cursor = next;
  }
  return <g>{dims}</g>;
}

/**
 * 等角投影 wrapper（cabinet projection 容器）。
 *
 * 重要：本 wrapper 「不再」做 30° 旋轉矩陣（舊版 matrix(c·s, s·s, -c·s, s·s) 兩個基底
 * y 分量都是正的，導致任何子矩形被映射成水平菱形，毫無 3D 立體感）。
 *
 * 新規範：
 *   - children 自己負責 cabinet projection（手繪 front/top/side 三個面 polygon）
 *   - wrapper 只做 translate + uniform scale（不旋轉）
 *   - 約定：children 的 (+x, +y) 是螢幕座標（x 右、y 下），用 (-z) 假設 z 軸往內
 *     後縮 30° 0.5 倍：dx = +cos30 * 0.5、dy = -sin30 * 0.5
 *
 * `rotation` prop 保留為 noop（向後相容、只接受 30/45 但不影響繪製）。
 */
export function IsometricGroup({
  children,
  originX,
  originY,
  scale = 1,
  rotation: _rotation = 30,
}: {
  children: ReactNode;
  originX: number;
  originY: number;
  scale?: number;
  /** 已棄用：children 自己負責 30° cabinet projection */
  rotation?: 30 | 45;
}): JSX.Element {
  void _rotation;
  return (
    <g transform={`translate(${originX} ${originY}) scale(${scale})`}>
      {children}
    </g>
  );
}

/** 第一角投影 2x2 grid：左上=正視 / 右上=側視 / 左下=俯視 / 右下=等角圖（option）。 */
export function ThreeViewLayout({
  width,
  height,
  front,
  side,
  top,
  iso,
  titleBlock,
  gap = 10,
}: {
  width: number;
  height: number;
  front: ReactNode;
  side: ReactNode;
  top: ReactNode;
  iso?: ReactNode;
  titleBlock?: ReactNode;
  gap?: number;
}): JSX.Element {
  const titleH = titleBlock ? 50 : 0;
  const W = (width - gap) / 2;
  const H = (height - gap - titleH) / 2;
  return (
    <g>
      <g transform={`translate(0,0)`}>{front}</g>
      <g transform={`translate(${W + gap},0)`}>{side}</g>
      <g transform={`translate(0,${H + gap})`}>{top}</g>
      {iso && <g transform={`translate(${W + gap},${H + gap})`}>{iso}</g>}
      {titleBlock && (
        <g transform={`translate(0,${(H + gap) * 2})`}>{titleBlock}</g>
      )}
    </g>
  );
}

/** 工法警示框：黃底紅框「注意 …」單行提示，不用 emoji。 */
export function WarningCallout({
  x,
  y,
  text,
  severity = "warn",
}: {
  x: number;
  y: number;
  text: string;
  severity?: "info" | "warn";
}): JSX.Element {
  const bg = severity === "warn" ? "#fff7d6" : "#e6f0ff";
  const border = severity === "warn" ? "#c0282d" : "#0a4d8c";
  const fg = severity === "warn" ? "#c0282d" : "#0a4d8c";
  const w = text.length * FONT.CALLOUT * 1.2 + 26;
  const h = FONT.CALLOUT * 1.8;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill={bg}
        stroke={border}
        strokeWidth={0.5}
        rx={2}
      />
      <text
        x={x + 8}
        y={y + FONT.CALLOUT * 1.3}
        fontSize={FONT.CALLOUT}
        fill={fg}
      >
        注意 {text}
      </text>
    </g>
  );
}
