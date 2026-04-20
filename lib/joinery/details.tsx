/**
 * Joinery detail drawings (榫卯細節圖).
 *
 * Each renderer produces an SVG showing:
 *  - Left: exploded view (兩件分離)
 *  - Right: assembled cross-section (組合剖面)
 *  - Labeled dimensions in mm
 *
 * The 公 (male/tenon) part is drawn in lighter fill, 母 (female/mortise) part
 * in darker fill so users can identify them at a glance.
 */

import type { JoineryType } from "@/lib/types";

export interface JoineryDetailParams {
  /** mm — the protruding length / cut depth of the joint */
  tenonLength: number;
  /** mm — width of the tenon (long axis of the cross-section) */
  tenonWidth: number;
  /** mm — thickness of the tenon (short axis of the cross-section) */
  tenonThickness: number;
  /** mm — thickness of the mortise piece (the receiving part) */
  motherThickness: number;
  /** mm — thickness of the tenon piece itself */
  childThickness?: number;
}

const COLOR_TENON = "#e6c89a";
const COLOR_MORTISE = "#9c7a4a";
const COLOR_OUTLINE = "#222";
const COLOR_DIM = "#0a4d8c";

const PADDING = 30;

function DimLine({
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
}) {
  const tick = 4;
  const dx = side === "left" ? -10 : side === "right" ? 10 : 0;
  const dy = side === "top" ? -10 : side === "bottom" ? 10 : 0;
  const lx1 = x1 + dx;
  const ly1 = y1 + dy;
  const lx2 = x2 + dx;
  const ly2 = y2 + dy;
  return (
    <g stroke={COLOR_DIM} fill={COLOR_DIM} strokeWidth={0.5}>
      {/* extension lines */}
      <line x1={x1} y1={y1} x2={lx1} y2={ly1} strokeDasharray="2 2" />
      <line x1={x2} y1={y2} x2={lx2} y2={ly2} strokeDasharray="2 2" />
      {/* main dim line */}
      <line x1={lx1} y1={ly1} x2={lx2} y2={ly2} />
      {/* end ticks */}
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
        x={(lx1 + lx2) / 2}
        y={(ly1 + ly2) / 2 + (side === "bottom" ? 12 : -4)}
        fontSize={9}
        textAnchor="middle"
        stroke="none"
      >
        {label}
      </text>
    </g>
  );
}

function Hatching({ id, color = "#888" }: { id: string; color?: string }) {
  return (
    <pattern
      id={id}
      patternUnits="userSpaceOnUse"
      width={5}
      height={5}
      patternTransform="rotate(45)"
    >
      <line x1={0} y1={0} x2={0} y2={5} stroke={color} strokeWidth={0.5} />
    </pattern>
  );
}

function ThroughTenonDetail(p: JoineryDetailParams) {
  const scale = 1.2;
  const tw = p.tenonWidth * scale;
  const tl = p.tenonLength * scale;
  const tt = p.tenonThickness * scale;
  const mt = p.motherThickness * scale;
  const ct = (p.childThickness ?? p.tenonThickness * 1.5) * scale;

  const pieceLen = 80;
  const w = pieceLen * 4 + PADDING * 4;
  const h = Math.max(mt, ct) + PADDING * 4;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      style={{ maxWidth: "640px" }}
      className="bg-white"
    >
      <defs>
        <Hatching id="hatch-mortise" color="#5a4220" />
      </defs>

      {/* ===== EXPLODED VIEW ===== */}
      <text x={PADDING} y={20} fontSize={11} fontWeight="bold" fill={COLOR_OUTLINE}>
        分解圖
      </text>
      {/* Mortise piece (母件) */}
      <g transform={`translate(${PADDING},${h / 2 - mt / 2})`}>
        <rect width={pieceLen} height={mt} fill={COLOR_MORTISE} stroke={COLOR_OUTLINE} />
        {/* through hole */}
        <rect
          x={pieceLen / 2 - tt / 2}
          y={0}
          width={tt}
          height={mt}
          fill="white"
          stroke={COLOR_OUTLINE}
          strokeDasharray="3 2"
        />
        <text x={pieceLen / 2} y={mt + 14} fontSize={9} textAnchor="middle" fill="#666">
          母件（凹）
        </text>
        <DimLine
          x1={pieceLen / 2 - tt / 2}
          y1={mt}
          x2={pieceLen / 2 + tt / 2}
          y2={mt}
          label={`${p.tenonThickness}`}
          side="bottom"
        />
        <DimLine x1={0} y1={0} x2={0} y2={mt} label={`${p.motherThickness}`} side="left" />
      </g>

      {/* Tenon piece (公件) */}
      <g transform={`translate(${PADDING + pieceLen + 40},${h / 2 - ct / 2})`}>
        <rect width={pieceLen - tl} height={ct} fill={COLOR_TENON} stroke={COLOR_OUTLINE} />
        <rect
          x={pieceLen - tl}
          y={ct / 2 - tt / 2}
          width={tl}
          height={tt}
          fill={COLOR_TENON}
          stroke={COLOR_OUTLINE}
        />
        <text x={(pieceLen - tl) / 2} y={ct + 14} fontSize={9} textAnchor="middle" fill="#666">
          公件（凸）
        </text>
        <DimLine
          x1={pieceLen - tl}
          y1={ct / 2 - tt / 2}
          x2={pieceLen}
          y2={ct / 2 - tt / 2}
          label={`榫長 ${p.tenonLength}`}
          side="top"
        />
        <DimLine
          x1={pieceLen}
          y1={ct / 2 - tt / 2}
          x2={pieceLen}
          y2={ct / 2 + tt / 2}
          label={`${p.tenonThickness}`}
          side="right"
        />
      </g>

      {/* ===== ASSEMBLED VIEW ===== */}
      <text
        x={PADDING + pieceLen * 2 + 100}
        y={20}
        fontSize={11}
        fontWeight="bold"
        fill={COLOR_OUTLINE}
      >
        組合剖面
      </text>
      <g transform={`translate(${PADDING + pieceLen * 2 + 100},${h / 2 - mt / 2})`}>
        {/* mother */}
        <rect width={mt} height={mt} fill="url(#hatch-mortise)" stroke={COLOR_OUTLINE} />
        <rect
          x={mt / 2 - tt / 2}
          y={0}
          width={tt}
          height={mt}
          fill={COLOR_TENON}
          stroke={COLOR_OUTLINE}
        />
        {/* child extending out */}
        <rect
          x={mt / 2 - tt / 2 - 60}
          y={mt / 2 - ct / 2}
          width={60}
          height={ct}
          fill={COLOR_TENON}
          stroke={COLOR_OUTLINE}
        />
        <text x={mt / 2} y={mt + 14} fontSize={9} textAnchor="middle" fill="#666">
          通榫穿過母件
        </text>
      </g>
    </svg>
  );
}

function BlindTenonDetail(p: JoineryDetailParams) {
  const scale = 1.2;
  const tw = p.tenonWidth * scale;
  const tl = p.tenonLength * scale;
  const tt = p.tenonThickness * scale;
  const mt = p.motherThickness * scale;
  const ct = (p.childThickness ?? p.tenonThickness * 1.5) * scale;

  const pieceLen = 80;
  const w = pieceLen * 4 + PADDING * 4;
  const h = Math.max(mt, ct) + PADDING * 4;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ maxWidth: "640px" }} className="bg-white">
      <defs>
        <Hatching id="hatch-mortise-blind" color="#5a4220" />
      </defs>

      <text x={PADDING} y={20} fontSize={11} fontWeight="bold" fill={COLOR_OUTLINE}>
        分解圖
      </text>
      {/* Mortise piece — blind hole */}
      <g transform={`translate(${PADDING},${h / 2 - mt / 2})`}>
        <rect width={pieceLen} height={mt} fill={COLOR_MORTISE} stroke={COLOR_OUTLINE} />
        <rect
          x={pieceLen / 2 - tl / 2}
          y={mt / 2 - tt / 2}
          width={tl}
          height={tt}
          fill="white"
          stroke={COLOR_OUTLINE}
          strokeDasharray="3 2"
        />
        <text x={pieceLen / 2} y={mt + 14} fontSize={9} textAnchor="middle" fill="#666">
          母件（凹，盲孔）
        </text>
        <DimLine
          x1={pieceLen / 2 - tl / 2}
          y1={mt / 2 - tt / 2}
          x2={pieceLen / 2 + tl / 2}
          y2={mt / 2 - tt / 2}
          label={`榫眼深 ${p.tenonLength}`}
          side="top"
        />
      </g>

      {/* Tenon piece */}
      <g transform={`translate(${PADDING + pieceLen + 40},${h / 2 - ct / 2})`}>
        <rect width={pieceLen - tl} height={ct} fill={COLOR_TENON} stroke={COLOR_OUTLINE} />
        <rect
          x={pieceLen - tl}
          y={ct / 2 - tt / 2}
          width={tl}
          height={tt}
          fill={COLOR_TENON}
          stroke={COLOR_OUTLINE}
        />
        <text x={(pieceLen - tl) / 2} y={ct + 14} fontSize={9} textAnchor="middle" fill="#666">
          公件（凸）
        </text>
        <DimLine
          x1={pieceLen - tl}
          y1={ct / 2 - tt / 2}
          x2={pieceLen}
          y2={ct / 2 - tt / 2}
          label={`榫長 ${p.tenonLength}`}
          side="top"
        />
      </g>

      <text
        x={PADDING + pieceLen * 2 + 100}
        y={20}
        fontSize={11}
        fontWeight="bold"
        fill={COLOR_OUTLINE}
      >
        組合剖面
      </text>
      <g transform={`translate(${PADDING + pieceLen * 2 + 100},${h / 2 - mt / 2})`}>
        <rect width={mt + 30} height={mt} fill="url(#hatch-mortise-blind)" stroke={COLOR_OUTLINE} />
        <rect
          x={mt + 30 - tl}
          y={mt / 2 - tt / 2}
          width={tl}
          height={tt}
          fill={COLOR_TENON}
          stroke={COLOR_OUTLINE}
        />
        <rect
          x={mt + 30}
          y={mt / 2 - ct / 2}
          width={50}
          height={ct}
          fill={COLOR_TENON}
          stroke={COLOR_OUTLINE}
        />
        <text x={mt + 30} y={mt + 14} fontSize={9} textAnchor="middle" fill="#666">
          榫頭藏在母件內
        </text>
      </g>
    </svg>
  );
}

function HalfLapDetail(p: JoineryDetailParams) {
  const scale = 1.2;
  const tt = p.tenonThickness * scale;
  const mt = p.motherThickness * scale;
  const lap = p.tenonLength * scale;
  const pieceLen = 100;
  const w = pieceLen * 4 + PADDING * 4;
  const h = mt * 2 + PADDING * 4;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ maxWidth: "640px" }} className="bg-white">
      <text x={PADDING} y={20} fontSize={11} fontWeight="bold" fill={COLOR_OUTLINE}>
        分解圖（兩件各削一半）
      </text>
      <g transform={`translate(${PADDING},${h / 2 - mt})`}>
        {/* Piece A — top half removed at right end */}
        <path
          d={`M0 0 L${pieceLen - lap} 0 L${pieceLen - lap} ${mt / 2} L${pieceLen} ${mt / 2} L${pieceLen} ${mt} L0 ${mt} Z`}
          fill={COLOR_MORTISE}
          stroke={COLOR_OUTLINE}
        />
        <text x={pieceLen / 2} y={mt + 14} fontSize={9} textAnchor="middle" fill="#666">
          A 件（下半留，上半削）
        </text>
      </g>
      <g transform={`translate(${PADDING + pieceLen + 40},${h / 2})`}>
        {/* Piece B — bottom half removed at left end */}
        <path
          d={`M0 0 L${pieceLen} 0 L${pieceLen} ${mt} L${lap} ${mt} L${lap} ${mt / 2} L0 ${mt / 2} Z`}
          fill={COLOR_TENON}
          stroke={COLOR_OUTLINE}
        />
        <text x={pieceLen / 2} y={mt + 14} fontSize={9} textAnchor="middle" fill="#666">
          B 件（上半留，下半削）
        </text>
      </g>

      <text
        x={PADDING + pieceLen * 2 + 100}
        y={20}
        fontSize={11}
        fontWeight="bold"
        fill={COLOR_OUTLINE}
      >
        組合剖面
      </text>
      <g transform={`translate(${PADDING + pieceLen * 2 + 100},${h / 2 - mt / 2})`}>
        <rect width={lap} height={mt / 2} y={0} fill={COLOR_TENON} stroke={COLOR_OUTLINE} />
        <rect width={lap} height={mt / 2} y={mt / 2} fill={COLOR_MORTISE} stroke={COLOR_OUTLINE} />
        <rect x={lap} width={pieceLen - lap} height={mt} fill={COLOR_MORTISE} stroke={COLOR_OUTLINE} />
        <rect x={-pieceLen + lap} width={pieceLen - lap} height={mt} fill={COLOR_TENON} stroke={COLOR_OUTLINE} />
        <DimLine x1={0} y1={mt} x2={lap} y2={mt} label={`重疊 ${p.tenonLength}`} side="bottom" />
      </g>
    </svg>
  );
}

function GenericTenonDetail(p: JoineryDetailParams & { typeLabel: string }) {
  return (
    <div className="p-4 text-sm text-zinc-600 bg-zinc-50 rounded">
      {p.typeLabel} 細節圖開發中。預計尺寸：榫 {p.tenonLength}×{p.tenonWidth}×{p.tenonThickness} mm
    </div>
  );
}

const RENDERERS: Partial<
  Record<JoineryType, (p: JoineryDetailParams) => React.ReactElement>
> = {
  "through-tenon": ThroughTenonDetail,
  "blind-tenon": BlindTenonDetail,
  "shouldered-tenon": BlindTenonDetail,
  "half-lap": HalfLapDetail,
};

export function JoineryDetail({
  type,
  params,
}: {
  type: JoineryType;
  params: JoineryDetailParams;
}) {
  const renderer = RENDERERS[type];
  if (renderer) return renderer(params);
  return <GenericTenonDetail {...params} typeLabel={JOINERY_LABEL[type] ?? type} />;
}

export const JOINERY_LABEL: Record<JoineryType, string> = {
  "through-tenon": "通榫",
  "blind-tenon": "半榫 / 盲榫",
  "shouldered-tenon": "搭肩榫",
  "half-lap": "半搭榫",
  dovetail: "鳩尾榫",
  "finger-joint": "指接榫",
  "tongue-and-groove": "企口榫",
  dowel: "圓棒榫",
  "mitered-spline": "斜接餅乾榫",
  "pocket-hole": "口袋孔螺絲（Kreg）",
  screw: "螺絲 + 白膠",
};

export const JOINERY_DESCRIPTION: Record<JoineryType, string> = {
  "through-tenon": "榫頭穿過母件、可從另一面看到。強度最高，適合椅腳、桌腳重要結構。",
  "blind-tenon": "榫頭藏在母件內、外觀看不到。美觀，適合桌腳橫撐、櫃體等。",
  "shouldered-tenon": "榫頭多面有肩，提高抗扭強度。",
  "half-lap": "兩件各削一半厚度後相疊，搭肩固定。簡單常用於框架交叉。",
  dovetail: "梯形榫頭咬合，抗拉力極強。經典用於抽屜、箱體轉角。",
  "finger-joint": "對稱方齒交錯接合。常用於箱體、托盤轉角。",
  "tongue-and-groove": "一面凸舌、一面凹槽，板材拼寬常用。",
  dowel: "另插入圓棒做接合，工法簡單但強度較低。",
  "mitered-spline": "45° 斜接後插入餅乾片或薄木條補強。",
  "pocket-hole": "用 Kreg 夾具鑽斜孔，再用專用螺絲從隱藏處鎖入。初心者最快速的接合方式。",
  screw: "木工白膠 + 木螺絲直鎖。螺絲頭可埋頭並用木塞蓋住，最簡單。",
};
