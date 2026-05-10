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

// =============================================================================
// Phase 3 (2026-05-09)：Cabinet projection 等角圖 helper 6 件套
// 依 docs/joinery-refs/iso-style-spec.md C 章 implement
// 全部畫 3 面、必有 hidden edges、線型分層、公母三面色階
// =============================================================================

/** 等角投影常數（cabinet projection 30°）。 */
export const ISO = {
  ANGLE_DEG: 30,
  ANGLE_RAD: Math.PI / 6,
  DEPTH_SCALE: 0.7,
  COS30: Math.cos(Math.PI / 6),
  SIN30: Math.sin(Math.PI / 6),
} as const;

/** 等角圖三層 stroke 寬。 */
export const ISO_STROKE = {
  OUTLINE_VISIBLE: 1.4,
  EDGE_INTERIOR: 0.8,
  HIDDEN_DASHED: 0.6,
  GRAIN_HINT: 0.4,
  HATCH: 0.5,
} as const;

/** 等角圖虛線 pattern。 */
export const ISO_DASH = {
  HIDDEN: "4 3",
  CENTER: "8 2 2 2",
  ARROW: "5 3",
} as const;

/** 三面色階（公榫 / 母榫 各 3 面）。 */
export const ISO_FILL = {
  TENON_FRONT: "#e6c89a",
  TENON_TOP: "#d9b889",
  TENON_SIDE: "#c9a878",
  MORTISE_FRONT: "#b08a4e",
  MORTISE_TOP: "#9d7842",
  MORTISE_SIDE: "#8a6936",
  MORTISE_HOLE_INTERIOR: "#3a2a1c",
  HATCH_SECTION: "#c8553d",
} as const;

/**
 * Cabinet projection 純函式投影。
 * (x, y) = 螢幕座標(SVG y 朝下), z = 深度(z+ 朝後)，z 軸 30° 右上斜 × DEPTH_SCALE
 * 注意：本函式是「相對位移」，不含 origin。caller 需自己加 originX/originY。
 */
export function isoProject(
  x: number,
  y: number,
  z: number,
  opts?: { depthScale?: number; originX?: number; originY?: number },
): [number, number] {
  const depthScale = opts?.depthScale ?? ISO.DEPTH_SCALE;
  const ox = opts?.originX ?? 0;
  const oy = opts?.originY ?? 0;
  const dx = z * depthScale * ISO.COS30;
  const dy = -z * depthScale * ISO.SIN30;
  return [ox + x + dx, oy + y + dy];
}

interface IsoCuboidProps {
  /** 模型空間左下前角 (x, y, z)；y+ 朝下（已是螢幕慣例），z+ 朝後 */
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  fillFront?: string;
  fillTop?: string;
  fillSide?: string;
  stroke?: string;
  strokeWidth?: number;
  /** true → 全部用虛線 */
  hidden?: boolean;
  /** true → 畫背後 3 條看不到的邊（虛線） */
  showHiddenBackEdges?: boolean;
  /** depth scale 覆寫 */
  depthScale?: number;
  /** 額外平移（caller 已 transform 時可省略） */
  originX?: number;
  originY?: number;
  opacity?: number;
}

/**
 * 立方體（cabinet projection 三面）。
 * 這是榫卯立體感根本：強制畫 front + top + right side 三面，避免「壓平 2D」。
 */
export function IsoCuboid({
  x,
  y,
  z,
  w,
  h,
  d,
  fillFront = ISO_FILL.TENON_FRONT,
  fillTop = ISO_FILL.TENON_TOP,
  fillSide = ISO_FILL.TENON_SIDE,
  stroke = "#222",
  strokeWidth = ISO_STROKE.OUTLINE_VISIBLE,
  hidden = false,
  showHiddenBackEdges = true,
  depthScale,
  originX = 0,
  originY = 0,
  opacity = 1,
}: IsoCuboidProps): JSX.Element {
  const opt = { depthScale, originX, originY };
  // 8 個頂點：f=front(z=z), b=back(z=z+d). 0=左下 1=右下 2=右上 3=左上 (y+ 朝下，所以「上」=y 較小)
  const f0 = isoProject(x, y + h, z, opt);          // front 左下
  const f1 = isoProject(x + w, y + h, z, opt);      // front 右下
  const f2 = isoProject(x + w, y, z, opt);          // front 右上
  const f3 = isoProject(x, y, z, opt);              // front 左上
  const b0 = isoProject(x, y + h, z + d, opt);      // back 左下
  const b1 = isoProject(x + w, y + h, z + d, opt);  // back 右下
  const b2 = isoProject(x + w, y, z + d, opt);      // back 右上
  const b3 = isoProject(x, y, z + d, opt);          // back 左上

  const dash = hidden ? ISO_DASH.HIDDEN : undefined;
  const front = `${f0[0]},${f0[1]} ${f1[0]},${f1[1]} ${f2[0]},${f2[1]} ${f3[0]},${f3[1]}`;
  const top = `${f3[0]},${f3[1]} ${f2[0]},${f2[1]} ${b2[0]},${b2[1]} ${b3[0]},${b3[1]}`;
  const side = `${f1[0]},${f1[1]} ${b1[0]},${b1[1]} ${b2[0]},${b2[1]} ${f2[0]},${f2[1]}`;

  return (
    <g opacity={opacity}>
      {/* 三面 polygon — 順序：底層 top/side 先畫，front 最上 */}
      <polygon
        points={top}
        fill={fillTop}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={dash}
      />
      <polygon
        points={side}
        fill={fillSide}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={dash}
      />
      <polygon
        points={front}
        fill={fillFront}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={dash}
      />
      {/* hidden back edges：背後 3 條邊（左後立邊 + 後底邊 + 後左邊） */}
      {showHiddenBackEdges && !hidden && (
        <g
          fill="none"
          stroke={COLOR.HIDDEN}
          strokeWidth={ISO_STROKE.HIDDEN_DASHED}
          strokeDasharray={ISO_DASH.HIDDEN}
        >
          <line x1={b0[0]} y1={b0[1]} x2={b1[0]} y2={b1[1]} />
          <line x1={b0[0]} y1={b0[1]} x2={b3[0]} y2={b3[1]} />
          <line x1={b0[0]} y1={b0[1]} x2={f0[0]} y2={f0[1]} />
        </g>
      )}
    </g>
  );
}

interface IsoCylinderProps {
  x: number;
  y: number;
  z: number;
  radius: number;
  height: number;
  axis: "x" | "y" | "z";
  fillSide?: string;
  fillCap?: string;
  stroke?: string;
  strokeWidth?: number;
  hidden?: boolean;
  originX?: number;
  originY?: number;
  depthScale?: number;
}

/**
 * 圓柱（dowel / 圓榫）— axis="z" 軸朝後最常見，畫 2 條母線 + 前後橢圓。
 * 隱藏圓柱（埋入木釘）= 全虛線。
 */
export function IsoCylinder({
  x,
  y,
  z,
  radius,
  height,
  axis,
  fillSide = ISO_FILL.MORTISE_FRONT,
  fillCap = ISO_FILL.TENON_FRONT,
  stroke = "#222",
  strokeWidth = ISO_STROKE.OUTLINE_VISIBLE,
  hidden = false,
  originX = 0,
  originY = 0,
  depthScale,
}: IsoCylinderProps): JSX.Element {
  const opt = { depthScale, originX, originY };
  const dash = hidden ? ISO_DASH.HIDDEN : undefined;
  const sw = hidden ? ISO_STROKE.HIDDEN_DASHED : strokeWidth;
  const strokeColor = hidden ? COLOR.HIDDEN : stroke;
  const opacity = hidden ? 0.0 : 1.0;

  if (axis === "z") {
    // 圓柱軸沿深度 z，前面圓 (z=z)、後面圓 (z=z+height)
    // 投影成橢圓：rx = radius, ry = radius * SIN30 * depthScale * 0.6 (視覺壓扁)
    const ds = depthScale ?? ISO.DEPTH_SCALE;
    const rx = radius;
    const ry = radius * ISO.SIN30 * ds * 0.85 + 0.5;
    const front = isoProject(x, y, z, opt);
    const back = isoProject(x, y, z + height, opt);
    return (
      <g>
        {/* 後圓（先畫底層） */}
        <ellipse
          cx={back[0]}
          cy={back[1]}
          rx={rx}
          ry={ry}
          fill={fillCap}
          fillOpacity={opacity}
          stroke={strokeColor}
          strokeWidth={sw}
          strokeDasharray={dash}
        />
        {/* 兩條母線（圓柱側面輪廓） */}
        <line
          x1={front[0] - rx}
          y1={front[1]}
          x2={back[0] - rx}
          y2={back[1]}
          stroke={strokeColor}
          strokeWidth={sw}
          strokeDasharray={dash}
        />
        <line
          x1={front[0] + rx}
          y1={front[1]}
          x2={back[0] + rx}
          y2={back[1]}
          stroke={strokeColor}
          strokeWidth={sw}
          strokeDasharray={dash}
        />
        {/* 前圓 */}
        <ellipse
          cx={front[0]}
          cy={front[1]}
          rx={rx}
          ry={ry}
          fill={fillCap}
          fillOpacity={opacity}
          stroke={strokeColor}
          strokeWidth={sw}
          strokeDasharray={dash}
        />
      </g>
    );
  }
  // axis === "y": 直立圓柱（少用）
  if (axis === "y") {
    const ds = depthScale ?? ISO.DEPTH_SCALE;
    const rx = radius;
    const ry = radius * ISO.SIN30 * ds * 0.85 + 0.5;
    const top = isoProject(x, y, z, opt);
    const bot = isoProject(x, y + height, z, opt);
    return (
      <g>
        <ellipse
          cx={bot[0]}
          cy={bot[1]}
          rx={rx}
          ry={ry}
          fill={fillSide}
          fillOpacity={opacity}
          stroke={strokeColor}
          strokeWidth={sw}
          strokeDasharray={dash}
        />
        <line x1={top[0] - rx} y1={top[1]} x2={bot[0] - rx} y2={bot[1]} stroke={strokeColor} strokeWidth={sw} strokeDasharray={dash} />
        <line x1={top[0] + rx} y1={top[1]} x2={bot[0] + rx} y2={bot[1]} stroke={strokeColor} strokeWidth={sw} strokeDasharray={dash} />
        <ellipse
          cx={top[0]}
          cy={top[1]}
          rx={rx}
          ry={ry}
          fill={fillCap}
          fillOpacity={opacity}
          stroke={strokeColor}
          strokeWidth={sw}
          strokeDasharray={dash}
        />
      </g>
    );
  }
  // axis === "x": 橫向圓柱（少用，先用 cuboid 退化）
  return (
    <IsoCuboid
      x={x}
      y={y - radius}
      z={z - radius}
      w={height}
      h={radius * 2}
      d={radius * 2}
      fillFront={fillSide}
      fillTop={fillCap}
      fillSide={fillSide}
      hidden={hidden}
      depthScale={depthScale}
      originX={originX}
      originY={originY}
    />
  );
}

interface IsoTenonProps {
  /** 母件表面上的榫頭根部「中心」(在母件表面) */
  baseX: number;
  baseY: number;
  baseZ: number;
  width: number;
  thickness: number;
  length: number;
  /** 榫頭凸出方向（從母件表面向外） */
  direction: "+x" | "-x" | "+y" | "-y" | "+z" | "-z";
  shape?: "rect" | "round" | "dovetail";
  dovetailAngleDeg?: number;
  fillFront?: string;
  fillTop?: string;
  fillSide?: string;
  stroke?: string;
  strokeWidth?: number;
  showShoulder?: boolean;
  originX?: number;
  originY?: number;
  depthScale?: number;
  /**
   * 嵌入母件的 mm 長度（從根部往榫尖算）。> 0 時在根部 4 條長軸邊
   * 疊一層虛線，視覺上提示「這段藏在母件裡」。預設 0=全段實線。
   */
  embeddedLength?: number;
}

/**
 * 凸出公榫（IsoCuboid 變體 + 強制三面 + 公榫色階）。
 * 老師原則：必畫六邊形（3 面）不是單一矩形。
 */
export function IsoTenon({
  baseX,
  baseY,
  baseZ,
  width,
  thickness,
  length,
  direction,
  shape = "rect",
  fillFront = ISO_FILL.TENON_FRONT,
  fillTop = ISO_FILL.TENON_TOP,
  fillSide = ISO_FILL.TENON_SIDE,
  stroke = "#222",
  strokeWidth = ISO_STROKE.OUTLINE_VISIBLE,
  showShoulder = false,
  originX = 0,
  originY = 0,
  depthScale,
  embeddedLength = 0,
}: IsoTenonProps): JSX.Element {
  const opt = { depthScale, originX, originY };
  // direction 決定哪個軸是「長度」方向，其餘兩軸是「寬」「厚」
  // 我們把模型空間：x=width, y=thickness（垂直）, z=depth
  // 為簡化，IsoTenon 把 (baseX, baseY, baseZ) 當作 cuboid 中心軸線根部
  let cx = baseX, cy = baseY, cz = baseZ;
  let w = width, h = thickness, d = length;
  // 預設 +z（榫頭朝後），即 length 沿 z；w 沿 x；h 沿 y
  switch (direction) {
    case "+z":
      cx = baseX - width / 2;
      cy = baseY - thickness / 2;
      cz = baseZ;
      w = width; h = thickness; d = length;
      break;
    case "-z":
      cx = baseX - width / 2;
      cy = baseY - thickness / 2;
      cz = baseZ - length;
      w = width; h = thickness; d = length;
      break;
    case "+x":
      cx = baseX;
      cy = baseY - thickness / 2;
      cz = baseZ - width / 2;
      w = length; h = thickness; d = width;
      break;
    case "-x":
      cx = baseX - length;
      cy = baseY - thickness / 2;
      cz = baseZ - width / 2;
      w = length; h = thickness; d = width;
      break;
    case "+y":
      // 榫頭往下（y+），寬沿 x、厚沿 z
      cx = baseX - width / 2;
      cy = baseY;
      cz = baseZ - thickness / 2;
      w = width; h = length; d = thickness;
      break;
    case "-y":
      cx = baseX - width / 2;
      cy = baseY - length;
      cz = baseZ - thickness / 2;
      w = width; h = length; d = thickness;
      break;
  }

  // dovetail 變體：用 polygon 自畫梯形 front face（先用 rect fallback）
  if (shape === "dovetail") {
    // dovetail 用 IsoCuboid 退化（精細版可後續加），保 3D 立體
    return (
      <IsoCuboid
        x={cx}
        y={cy}
        z={cz}
        w={w}
        h={h}
        d={d}
        fillFront={fillFront}
        fillTop={fillTop}
        fillSide={fillSide}
        stroke={stroke}
        strokeWidth={strokeWidth}
        depthScale={depthScale}
        originX={originX}
        originY={originY}
      />
    );
  }

  // 若 embeddedLength > 0：把榫頭結構性切成「露出段（實體）+ 嵌入段（虛線輪廓）」
  // 視覺意圖：榫頭從母件「長出來」，嵌入段不畫實體 polygon，只用虛線勾出輪廓，
  // 讓人看穿母件看到榫頭內部形狀（取代舊的「4 條長軸虛線疊加」做法）。
  const e = Math.max(0, Math.min(embeddedLength, length));
  const hasEmbedded = e > 0;
  const visLen = length - e;

  // 依 direction 計算露出段 / 嵌入段的 bbox（cx,cy,cz,w,h,d）
  // 慣例：root 在母件表面側，tip 朝 direction 指向方向。
  // 「嵌入段」= 靠 tip 那 e 長度（藏在母件內）；「露出段」= 靠 root 那 (length-e) 長度。
  let visBox = { x: cx, y: cy, z: cz, w, h, d };
  let embBox = { x: cx, y: cy, z: cz, w, h, d };
  if (hasEmbedded) {
    switch (direction) {
      case "+z":
        // root z=cz, tip z=cz+d；露出段在前 (visLen)，嵌入段在後 (e)
        visBox = { x: cx, y: cy, z: cz, w, h, d: visLen };
        embBox = { x: cx, y: cy, z: cz + visLen, w, h, d: e };
        break;
      case "-z":
        // root z=cz+d, tip z=cz；露出段在後 (visLen)，嵌入段在前 (e)
        visBox = { x: cx, y: cy, z: cz + e, w, h, d: visLen };
        embBox = { x: cx, y: cy, z: cz, w, h, d: e };
        break;
      case "+x":
        // root x=cx, tip x=cx+w (w=length)；露出段在左 (visLen)，嵌入段在右 (e)
        visBox = { x: cx, y: cy, z: cz, w: visLen, h, d };
        embBox = { x: cx + visLen, y: cy, z: cz, w: e, h, d };
        break;
      case "-x":
        // root x=cx+w, tip x=cx；露出段在右 (visLen)，嵌入段在左 (e)
        visBox = { x: cx + e, y: cy, z: cz, w: visLen, h, d };
        embBox = { x: cx, y: cy, z: cz, w: e, h, d };
        break;
      case "+y":
        // root y=cy, tip y=cy+h (h=length)；露出段在上 (visLen)，嵌入段在下 (e)
        visBox = { x: cx, y: cy, z: cz, w, h: visLen, d };
        embBox = { x: cx, y: cy + visLen, z: cz, w, h: e, d };
        break;
      case "-y":
        // root y=cy+h, tip y=cy；露出段在下 (visLen)，嵌入段在上 (e)
        visBox = { x: cx, y: cy + e, z: cz, w, h: visLen, d };
        embBox = { x: cx, y: cy, z: cz, w, h: e, d };
        break;
    }
  }

  return (
    <g>
      {/* 露出段：完整 fill + 實線 outline（沒有 embeddedLength 時整段=露出段） */}
      {visLen > 0 && (
        <IsoCuboid
          x={visBox.x}
          y={visBox.y}
          z={visBox.z}
          w={visBox.w}
          h={visBox.h}
          d={visBox.d}
          fillFront={fillFront}
          fillTop={fillTop}
          fillSide={fillSide}
          stroke={stroke}
          strokeWidth={strokeWidth}
          depthScale={depthScale}
          originX={originX}
          originY={originY}
          showHiddenBackEdges={false}
        />
      )}
      {/* 嵌入段：hidden=true → 虛線輪廓 + fill="none"（看穿母件看到榫頭形狀） */}
      {hasEmbedded && (
        <IsoCuboid
          x={embBox.x}
          y={embBox.y}
          z={embBox.z}
          w={embBox.w}
          h={embBox.h}
          d={embBox.d}
          fillFront="none"
          fillTop="none"
          fillSide="none"
          stroke={COLOR.HIDDEN}
          strokeWidth={ISO_STROKE.HIDDEN_DASHED}
          hidden={true}
          depthScale={depthScale}
          originX={originX}
          originY={originY}
          showHiddenBackEdges={false}
        />
      )}
      {showShoulder && (
        <line
          // 肩線：榫頭根部畫一條粗線，凸顯承力面
          x1={isoProject(cx, cy + h, cz, opt)[0]}
          y1={isoProject(cx, cy + h, cz, opt)[1]}
          x2={isoProject(cx + w, cy + h, cz, opt)[0]}
          y2={isoProject(cx + w, cy + h, cz, opt)[1]}
          stroke={COLOR.DIM_TICK}
          strokeWidth={ISO_STROKE.OUTLINE_VISIBLE}
        />
      )}
      {/* shape hint：圓榫 → 在前端面畫一個小橢圓 */}
      {shape === "round" && (() => {
        const front = isoProject(cx + w / 2, cy + h / 2, cz, opt);
        return (
          <ellipse
            cx={front[0]}
            cy={front[1]}
            rx={w / 2 * 0.8}
            ry={h / 2 * 0.8}
            fill={fillFront}
            stroke={stroke}
            strokeWidth={ISO_STROKE.EDGE_INTERIOR}
          />
        );
      })()}
    </g>
  );
}

interface IsoMortiseProps {
  /** 母件表面上的榫眼開口「中心」 */
  faceX: number;
  faceY: number;
  faceZ: number;
  width: number;
  height: number;
  depth: number;
  /** 哪個面有洞（朝外的面法線） */
  faceNormal: "+x" | "-x" | "+y" | "-y" | "+z" | "-z";
  /** 通榫 vs 盲榫 */
  through?: boolean;
  shape?: "rect" | "round" | "dovetail";
  interiorFill?: string;
  drawBackOpening?: boolean;
  /** 母件總厚度（用來判斷通榫底面位置） */
  motherThickness?: number;
  stroke?: string;
  strokeWidth?: number;
  originX?: number;
  originY?: number;
  depthScale?: number;
}

/**
 * 凹陷母榫（榫眼）— 必畫內壁深度線（凹陷感關鍵）。
 * 老師慣例：不是純黑矩形，畫開口 + 內壁 + (通榫) 背面虛線。
 */
export function IsoMortise({
  faceX,
  faceY,
  faceZ,
  width,
  height,
  depth,
  faceNormal,
  through = false,
  interiorFill = ISO_FILL.MORTISE_HOLE_INTERIOR,
  stroke = "#222",
  strokeWidth = ISO_STROKE.EDGE_INTERIOR,
  originX = 0,
  originY = 0,
  depthScale,
}: IsoMortiseProps): JSX.Element {
  const opt = { depthScale, originX, originY };

  // 簡化：只支援 ±x ±y ±z 的軸對齊面
  // 開口「在面上」是個矩形 (width × height)
  // depth 沿著 faceNormal 反向（凹進去）
  let opening: [number, number][] = [];
  let bottomOpening: [number, number][] = [];

  // 計算開口 4 角 + 內凹底 4 角
  // 約定：對於每個 faceNormal，width 與 height 是面內兩個正交方向
  switch (faceNormal) {
    case "+y": // 頂面開洞（看到頂面有個矩形凹）— width 沿 x, height 沿 z
      opening = [
        isoProject(faceX - width / 2, faceY, faceZ - height / 2, opt),
        isoProject(faceX + width / 2, faceY, faceZ - height / 2, opt),
        isoProject(faceX + width / 2, faceY, faceZ + height / 2, opt),
        isoProject(faceX - width / 2, faceY, faceZ + height / 2, opt),
      ];
      bottomOpening = [
        isoProject(faceX - width / 2, faceY + depth, faceZ - height / 2, opt),
        isoProject(faceX + width / 2, faceY + depth, faceZ - height / 2, opt),
        isoProject(faceX + width / 2, faceY + depth, faceZ + height / 2, opt),
        isoProject(faceX - width / 2, faceY + depth, faceZ + height / 2, opt),
      ];
      break;
    case "-y": // 底面（少用）
      opening = [
        isoProject(faceX - width / 2, faceY, faceZ - height / 2, opt),
        isoProject(faceX + width / 2, faceY, faceZ - height / 2, opt),
        isoProject(faceX + width / 2, faceY, faceZ + height / 2, opt),
        isoProject(faceX - width / 2, faceY, faceZ + height / 2, opt),
      ];
      bottomOpening = [
        isoProject(faceX - width / 2, faceY - depth, faceZ - height / 2, opt),
        isoProject(faceX + width / 2, faceY - depth, faceZ - height / 2, opt),
        isoProject(faceX + width / 2, faceY - depth, faceZ + height / 2, opt),
        isoProject(faceX - width / 2, faceY - depth, faceZ + height / 2, opt),
      ];
      break;
    case "+z": // 後面（背面）— 少用
    case "-z": { // 前面（正面）— width 沿 x, height 沿 y
      opening = [
        isoProject(faceX - width / 2, faceY - height / 2, faceZ, opt),
        isoProject(faceX + width / 2, faceY - height / 2, faceZ, opt),
        isoProject(faceX + width / 2, faceY + height / 2, faceZ, opt),
        isoProject(faceX - width / 2, faceY + height / 2, faceZ, opt),
      ];
      const dz = faceNormal === "-z" ? depth : -depth;
      bottomOpening = [
        isoProject(faceX - width / 2, faceY - height / 2, faceZ + dz, opt),
        isoProject(faceX + width / 2, faceY - height / 2, faceZ + dz, opt),
        isoProject(faceX + width / 2, faceY + height / 2, faceZ + dz, opt),
        isoProject(faceX - width / 2, faceY + height / 2, faceZ + dz, opt),
      ];
      break;
    }
    case "+x": // 右面（少用）
    case "-x": { // 左面 — width 沿 z, height 沿 y
      opening = [
        isoProject(faceX, faceY - height / 2, faceZ - width / 2, opt),
        isoProject(faceX, faceY - height / 2, faceZ + width / 2, opt),
        isoProject(faceX, faceY + height / 2, faceZ + width / 2, opt),
        isoProject(faceX, faceY + height / 2, faceZ - width / 2, opt),
      ];
      const dx = faceNormal === "-x" ? depth : -depth;
      bottomOpening = [
        isoProject(faceX + dx, faceY - height / 2, faceZ - width / 2, opt),
        isoProject(faceX + dx, faceY - height / 2, faceZ + width / 2, opt),
        isoProject(faceX + dx, faceY + height / 2, faceZ + width / 2, opt),
        isoProject(faceX + dx, faceY + height / 2, faceZ - width / 2, opt),
      ];
      break;
    }
  }

  const openPts = opening.map((p) => `${p[0]},${p[1]}`).join(" ");
  const botPts = bottomOpening.map((p) => `${p[0]},${p[1]}`).join(" ");

  return (
    <g>
      {/* 內壁（4 個梯形面）— 用 interiorFill 表示「進去後看不到底」 */}
      {!through && (
        <>
          {/* 內凹深處的「底」— 畫深色矩形作為 bottom */}
          <polygon
            points={botPts}
            fill={interiorFill}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
          {/* 4 條內壁邊（從開口角到底角）— 凹陷感關鍵 */}
          {opening.map((p, i) => {
            const b = bottomOpening[i];
            return (
              <line
                key={`wall-${i}`}
                x1={p[0]}
                y1={p[1]}
                x2={b[0]}
                y2={b[1]}
                stroke={stroke}
                strokeWidth={ISO_STROKE.EDGE_INTERIOR}
              />
            );
          })}
        </>
      )}
      {/* 通榫：背面開口用虛線（看穿透） */}
      {through && (
        <polygon
          points={botPts}
          fill="none"
          stroke={COLOR.HIDDEN}
          strokeWidth={ISO_STROKE.HIDDEN_DASHED}
          strokeDasharray={ISO_DASH.HIDDEN}
        />
      )}
      {/* 開口本身（描深色實線） */}
      <polygon
        points={openPts}
        fill={through ? interiorFill : "none"}
        fillOpacity={through ? 0.85 : 0}
        stroke={stroke}
        strokeWidth={ISO_STROKE.OUTLINE_VISIBLE}
      />
      {/* 通榫額外：開口到背開口的 4 條虛線（穿透感） */}
      {through &&
        opening.map((p, i) => {
          const b = bottomOpening[i];
          return (
            <line
              key={`through-${i}`}
              x1={p[0]}
              y1={p[1]}
              x2={b[0]}
              y2={b[1]}
              stroke={COLOR.HIDDEN}
              strokeWidth={ISO_STROKE.HIDDEN_DASHED}
              strokeDasharray={ISO_DASH.HIDDEN}
            />
          );
        })}
    </g>
  );
}

interface IsoExplodeProps {
  pieceA: ReactNode;
  pieceB: ReactNode;
  /** 兩件分開距離（px in projected space） */
  gap: number;
  /** 沿哪個軸分開（screen 軸） */
  axis: "x" | "y";
  showArrow?: boolean;
  arrowColor?: string;
  labelA?: string;
  labelB?: string;
  /** B 件偏移錨點（畫箭頭起終點用） */
  arrowFromX?: number;
  arrowFromY?: number;
  arrowToX?: number;
  arrowToY?: number;
}

/**
 * 拆解配對：把 pieceB 沿 axis 平移 +gap，可選畫一條虛線箭頭從 B 指向 A。
 * pieceA / pieceB 都是 caller 已 project 完的 SVG group。
 */
export function IsoExplode({
  pieceA,
  pieceB,
  gap,
  axis,
  showArrow = true,
  arrowColor = "#0a4d8c",
  labelA,
  labelB,
  arrowFromX,
  arrowFromY,
  arrowToX,
  arrowToY,
}: IsoExplodeProps): JSX.Element {
  const tx = axis === "x" ? gap : 0;
  const ty = axis === "y" ? gap : 0;
  return (
    <g>
      {/* A 件原位 */}
      <g>{pieceA}</g>
      {labelA && (
        <text x={4} y={-4} fontSize={FONT.CALLOUT} fill={COLOR.OUTLINE}>
          {labelA}
        </text>
      )}
      {/* B 件平移 */}
      <g transform={`translate(${tx} ${ty})`}>{pieceB}</g>
      {labelB && (
        <text x={tx + 4} y={ty - 4} fontSize={FONT.CALLOUT} fill={COLOR.OUTLINE}>
          {labelB}
        </text>
      )}
      {/* 組裝箭頭：B → A */}
      {showArrow &&
        arrowFromX !== undefined &&
        arrowFromY !== undefined &&
        arrowToX !== undefined &&
        arrowToY !== undefined && (
          <g stroke={arrowColor} fill={arrowColor} strokeWidth={1}>
            <line
              x1={arrowFromX}
              y1={arrowFromY}
              x2={arrowToX}
              y2={arrowToY}
              strokeDasharray={ISO_DASH.ARROW}
            />
            {(() => {
              const ang = Math.atan2(arrowToY - arrowFromY, arrowToX - arrowFromX);
              const ah = 5;
              const a1x = arrowToX - ah * Math.cos(ang - Math.PI / 6);
              const a1y = arrowToY - ah * Math.sin(ang - Math.PI / 6);
              const a2x = arrowToX - ah * Math.cos(ang + Math.PI / 6);
              const a2y = arrowToY - ah * Math.sin(ang + Math.PI / 6);
              return (
                <polygon
                  points={`${arrowToX},${arrowToY} ${a1x},${a1y} ${a2x},${a2y}`}
                />
              );
            })()}
          </g>
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
