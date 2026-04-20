/**
 * Joinery detail drawings (榫卯細節圖).
 *
 * Each renderer produces an SVG with two panels:
 *  - Left：分解圖 — both pieces separated, showing profiles & tenon shape
 *  - Right：組合剖面 — assembled cross-section (cut through the joint)
 *
 * All pieces are drawn to the SAME scale within a single renderer so the
 * tenon / mortise proportions match reality.
 */

import type { JoineryType } from "@/lib/types";

export interface JoineryDetailParams {
  /** mm — tenon protrusion length */
  tenonLength: number;
  /** mm — tenon cross-section long edge (wide axis) */
  tenonWidth: number;
  /** mm — tenon cross-section short edge (thin axis) */
  tenonThickness: number;
  /** mm — mother piece thickness (depth the tenon penetrates) */
  motherThickness: number;
  /** mm — child piece thickness (thin axis of the tenon-carrier's cross-section) */
  childThickness?: number;
  /** mm — child piece width (wide axis of the tenon-carrier's cross-section) */
  childWidth?: number;
}

const COLOR_TENON = "#e6c89a";
const COLOR_MORTISE = "#b08a4e";
const COLOR_OUTLINE = "#222";
const COLOR_DIM = "#0a4d8c";
const COLOR_HIDDEN = "#b59062";

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

function Hatching({ id, color = "#8a6a3a" }: { id: string; color?: string }) {
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

/** Pick a unit scale so the biggest dimension fills ~maxPx pixels. */
function fitScale(maxMm: number, maxPx: number) {
  return maxPx / Math.max(1, maxMm);
}

/* ============================================================
 * 通榫 — through-tenon
 *   Example: stool leg passing up through a seat panel.
 *   - Mother (seat) is a horizontal panel, thickness=mt, with a hole.
 *   - Child (leg) is a vertical stick passing through, tenon flush
 *     with mother's top face.
 * ============================================================ */
function ThroughTenonDetail(p: JoineryDetailParams) {
  const tl = p.tenonLength;
  const tw = p.tenonWidth;
  const tt = p.tenonThickness;
  const mt = p.motherThickness;
  const ct = p.childThickness ?? tt;
  const cw = p.childWidth ?? tw;

  // scale everything together
  const s = fitScale(Math.max(mt + ct * 3, tw + 40, cw + tl + 40), 200);
  const PX = (mm: number) => mm * s;

  // child (leg) body shown below mortise; tenon flush with mortise top
  const motherDrawWidth = Math.max(PX(mt) * 3, PX(tw) * 1.6);
  const childBodyLen = PX(ct) * 3; // how far below mortise we show

  // --- EXPLODED panel dimensions ---
  const expWidth = Math.max(PX(tw) + 80, PX(cw) + 80);
  const expHeight = PX(mt) + childBodyLen + PX(tl) + 60;

  // --- ASSEMBLED panel dimensions ---
  const asmWidth = motherDrawWidth + 40;
  const asmHeight = PX(mt) + childBodyLen + PX(tl) + 60;

  const w = expWidth + asmWidth + PADDING * 3;
  const h = Math.max(expHeight, asmHeight) + PADDING;

  // ---- exploded piece positions ----
  // Mother (top half)
  const mAx = PADDING + expWidth / 2 - PX(tw) / 2;
  const mAy = PADDING + 20;
  // Child (bottom half): body + tenon stub going up
  const cBodyX = PADDING + expWidth / 2 - PX(cw) / 2;
  const cBodyY = mAy + PX(mt) + 60;

  // ---- assembled positions ----
  const asmOriginX = PADDING * 2 + expWidth;
  const asmMotherY = PADDING + 20;
  const asmMotherX = asmOriginX + 20;
  const asmMotherW = motherDrawWidth;
  // child passes vertically through the middle of the mother
  const asmChildX = asmMotherX + asmMotherW / 2 - PX(tt) / 2;
  const asmChildTop = asmMotherY; // tenon flush with top surface of mother
  const asmChildBottomExt = childBodyLen;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      style={{ maxWidth: "680px" }}
      className="bg-white"
    >
      <defs>
        <Hatching id="hatch-through" color="#7a5a2c" />
      </defs>

      {/* =========== EXPLODED =========== */}
      <text x={PADDING} y={18} fontSize={11} fontWeight="bold" fill={COLOR_OUTLINE}>
        分解圖
      </text>

      {/* mother: a panel (top edge view) — horizontal strip, thickness mt */}
      <g>
        {/* panel body */}
        <rect
          x={mAx - 40}
          y={mAy}
          width={PX(tw) + 80}
          height={PX(mt)}
          fill={COLOR_MORTISE}
          stroke={COLOR_OUTLINE}
        />
        {/* through hole (dashed — hole passes vertically) */}
        <rect
          x={mAx}
          y={mAy}
          width={PX(tw)}
          height={PX(mt)}
          fill="white"
          stroke={COLOR_OUTLINE}
          strokeDasharray="3 2"
        />
        <text
          x={mAx + PX(tw) / 2}
          y={mAy + PX(mt) + 14}
          fontSize={9}
          textAnchor="middle"
          fill="#666"
        >
          母件（凹，貫通孔）
        </text>
        <DimLine
          x1={mAx}
          y1={mAy}
          x2={mAx + PX(tw)}
          y2={mAy}
          label={`榫孔 ${tw}`}
          side="top"
        />
        <DimLine
          x1={mAx + PX(tw) + 40}
          y1={mAy}
          x2={mAx + PX(tw) + 40}
          y2={mAy + PX(mt)}
          label={`厚 ${mt}`}
          side="right"
        />
      </g>

      {/* child: leg/stick with tenon on top */}
      <g>
        {/* body */}
        <rect
          x={cBodyX}
          y={cBodyY + PX(tl)}
          width={PX(cw)}
          height={childBodyLen}
          fill={COLOR_TENON}
          stroke={COLOR_OUTLINE}
        />
        {/* tenon stub at top, centered on child width */}
        <rect
          x={cBodyX + PX(cw) / 2 - PX(tw) / 2}
          y={cBodyY}
          width={PX(tw)}
          height={PX(tl)}
          fill={COLOR_TENON}
          stroke={COLOR_OUTLINE}
        />
        <text
          x={cBodyX + PX(cw) / 2}
          y={cBodyY + PX(tl) + childBodyLen + 14}
          fontSize={9}
          textAnchor="middle"
          fill="#666"
        >
          公件（凸，柱/腳）
        </text>
        <DimLine
          x1={cBodyX + PX(cw) / 2 - PX(tw) / 2 - 20}
          y1={cBodyY}
          x2={cBodyX + PX(cw) / 2 - PX(tw) / 2 - 20}
          y2={cBodyY + PX(tl)}
          label={`榫長 ${tl}`}
          side="left"
        />
        <DimLine
          x1={cBodyX + PX(cw) / 2 - PX(tw) / 2}
          y1={cBodyY - 2}
          x2={cBodyX + PX(cw) / 2 + PX(tw) / 2}
          y2={cBodyY - 2}
          label={`榫寬 ${tw}`}
          side="top"
        />
        {cw !== tw && (
          <DimLine
            x1={cBodyX}
            y1={cBodyY + PX(tl) + childBodyLen + 20}
            x2={cBodyX + PX(cw)}
            y2={cBodyY + PX(tl) + childBodyLen + 20}
            label={`柱寬 ${cw}`}
            side="bottom"
          />
        )}
      </g>

      {/* =========== ASSEMBLED (cross-section) =========== */}
      <text x={asmOriginX} y={18} fontSize={11} fontWeight="bold" fill={COLOR_OUTLINE}>
        組合剖面
      </text>

      <g>
        {/* mother - horizontal panel, shown hatched */}
        <rect
          x={asmMotherX}
          y={asmMotherY}
          width={asmMotherW}
          height={PX(mt)}
          fill="url(#hatch-through)"
          stroke={COLOR_OUTLINE}
        />
        {/* tenon IN the mother (filled, not hatched — it's the male wood) */}
        <rect
          x={asmChildX}
          y={asmChildTop}
          width={PX(tt)}
          height={PX(mt)}
          fill={COLOR_TENON}
          stroke={COLOR_OUTLINE}
        />
        {/* child body extending DOWN below mother (the leg continues) */}
        <rect
          x={asmMotherX + asmMotherW / 2 - PX(ct) / 2}
          y={asmMotherY + PX(mt)}
          width={PX(ct)}
          height={asmChildBottomExt}
          fill={COLOR_TENON}
          stroke={COLOR_OUTLINE}
        />
        {/* label line: tenon flush with top */}
        <text
          x={asmMotherX + asmMotherW / 2}
          y={asmMotherY + PX(mt) + asmChildBottomExt + 14}
          fontSize={9}
          textAnchor="middle"
          fill="#666"
        >
          榫頭貫穿母件，與頂面齊平
        </text>
        {/* dim the tenon length = mother thickness */}
        <DimLine
          x1={asmMotherX + asmMotherW + 20}
          y1={asmMotherY}
          x2={asmMotherX + asmMotherW + 20}
          y2={asmMotherY + PX(mt)}
          label={`${mt}`}
          side="right"
        />
      </g>
    </svg>
  );
}

/* ============================================================
 * 半榫 / 盲榫 — blind tenon
 *   Example: apron tenon into leg's side face.
 *   - Mother (leg) is a square cross-section, blind hole in side.
 *   - Child (apron) comes in horizontally with tenon on end.
 * ============================================================ */
function BlindTenonDetail(p: JoineryDetailParams) {
  const tl = p.tenonLength;
  const tw = p.tenonWidth;
  const tt = p.tenonThickness;
  const mt = p.motherThickness;
  const ct = p.childThickness ?? tt;
  const cw = p.childWidth ?? tw;

  const s = fitScale(Math.max(mt * 2 + 40, cw + 40, tw + 40), 180);
  const PX = (mm: number) => mm * s;

  const expWidth = Math.max(PX(mt) + PX(ct) + PX(tl) + 100, PX(cw) + 80);
  const expHeight = PX(mt) + PX(cw) + 80;

  const asmWidth = PX(mt) * 2 + PX(tl) + 60;
  const asmHeight = PX(mt) + 60;

  // Leave 50px left padding so `板厚` / `母厚` labels don't get clipped.
  const leftPad = 50;
  const w = expWidth + asmWidth + PADDING * 3 + leftPad;
  const h = Math.max(expHeight, asmHeight) + PADDING + 20;

  // ---- exploded positions ----
  // Mother: top-left, drawn as side view (width = some extent, height = mt)
  const motherExt = PX(mt) * 2 + 20;
  const mAx = PADDING + leftPad;
  const mAy = PADDING + 10;
  // Child: bottom-left, horizontal stick with tenon on right
  const cBodyX = PADDING + leftPad;
  const cBodyY = mAy + PX(mt) + 40;

  // ---- assembled positions ----
  const asmOriginX = PADDING * 2 + expWidth + leftPad;
  const asmMotherX = asmOriginX + 20;
  const asmMotherY = PADDING + 10;
  const asmMotherExt = PX(mt) * 2;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      style={{ maxWidth: "680px" }}
      className="bg-white"
    >
      <defs>
        <Hatching id="hatch-blind" color="#7a5a2c" />
      </defs>

      {/* =========== EXPLODED =========== */}
      <text x={PADDING} y={18} fontSize={11} fontWeight="bold" fill={COLOR_OUTLINE}>
        分解圖
      </text>

      {/* mother: side view of leg with blind hole */}
      <g>
        <rect
          x={mAx}
          y={mAy}
          width={motherExt}
          height={PX(mt)}
          fill={COLOR_MORTISE}
          stroke={COLOR_OUTLINE}
        />
        {/* blind hole - on front face, dashed (hidden) */}
        <rect
          x={mAx + motherExt / 2 - PX(tw) / 2}
          y={mAy + PX(mt) / 2 - PX(tt) / 2}
          width={PX(tw)}
          height={PX(tt)}
          fill="white"
          stroke={COLOR_OUTLINE}
          strokeDasharray="3 2"
        />
        <text
          x={mAx + motherExt / 2}
          y={mAy + PX(mt) + 20}
          fontSize={9}
          textAnchor="middle"
          fill="#666"
        >
          母件（凹，盲孔）
        </text>
        <DimLine
          x1={mAx + motherExt / 2 - PX(tw) / 2}
          y1={mAy + PX(mt) / 2 - PX(tt) / 2}
          x2={mAx + motherExt / 2 + PX(tw) / 2}
          y2={mAy + PX(mt) / 2 - PX(tt) / 2}
          label={`榫孔寬 ${tw}`}
          side="top"
        />
        <DimLine
          x1={mAx + motherExt + 20}
          y1={mAy}
          x2={mAx + motherExt + 20}
          y2={mAy + PX(mt)}
          label={`母厚 ${mt}`}
          side="right"
        />
      </g>

      {/* child: horizontal apron with tenon on right end */}
      <g>
        <rect
          x={cBodyX}
          y={cBodyY}
          width={PX(cw)}
          height={PX(ct)}
          fill={COLOR_TENON}
          stroke={COLOR_OUTLINE}
        />
        {/* tenon stub on right side, centered thickness-wise */}
        <rect
          x={cBodyX + PX(cw)}
          y={cBodyY + PX(ct) / 2 - PX(tt) / 2}
          width={PX(tl)}
          height={PX(tt)}
          fill={COLOR_TENON}
          stroke={COLOR_OUTLINE}
        />
        <text
          x={cBodyX + PX(cw) / 2}
          y={cBodyY + PX(ct) + 14}
          fontSize={9}
          textAnchor="middle"
          fill="#666"
        >
          公件（凸，牙板/橫撐）
        </text>
        <DimLine
          x1={cBodyX + PX(cw)}
          y1={cBodyY + PX(ct) / 2 + PX(tt) / 2 + 4}
          x2={cBodyX + PX(cw) + PX(tl)}
          y2={cBodyY + PX(ct) / 2 + PX(tt) / 2 + 4}
          label={`榫長 ${tl}`}
          side="bottom"
        />
        <DimLine
          x1={cBodyX + PX(cw) + PX(tl) + 10}
          y1={cBodyY + PX(ct) / 2 - PX(tt) / 2}
          x2={cBodyX + PX(cw) + PX(tl) + 10}
          y2={cBodyY + PX(ct) / 2 + PX(tt) / 2}
          label={`榫厚 ${tt}`}
          side="right"
        />
        {ct !== tt && (
          <DimLine
            x1={cBodyX - 10}
            y1={cBodyY}
            x2={cBodyX - 10}
            y2={cBodyY + PX(ct)}
            label={`板厚 ${ct}`}
            side="left"
          />
        )}
      </g>

      {/* =========== ASSEMBLED (cross-section) =========== */}
      <text x={asmOriginX} y={18} fontSize={11} fontWeight="bold" fill={COLOR_OUTLINE}>
        組合剖面
      </text>

      <g>
        {/* mother (leg) */}
        <rect
          x={asmMotherX}
          y={asmMotherY}
          width={asmMotherExt}
          height={PX(mt)}
          fill="url(#hatch-blind)"
          stroke={COLOR_OUTLINE}
        />
        {/* tenon inside mother, from right edge going left by tl */}
        <rect
          x={asmMotherX + asmMotherExt - PX(tl)}
          y={asmMotherY + PX(mt) / 2 - PX(tt) / 2}
          width={PX(tl)}
          height={PX(tt)}
          fill={COLOR_TENON}
          stroke={COLOR_OUTLINE}
        />
        {/* child body extending right of mother */}
        <rect
          x={asmMotherX + asmMotherExt}
          y={asmMotherY + PX(mt) / 2 - PX(ct) / 2}
          width={PX(cw) * 0.9}
          height={PX(ct)}
          fill={COLOR_TENON}
          stroke={COLOR_OUTLINE}
        />
        <text
          x={asmMotherX + asmMotherExt / 2}
          y={asmMotherY + PX(mt) + 14}
          fontSize={9}
          textAnchor="middle"
          fill="#666"
        >
          榫頭藏於母件內部
        </text>
      </g>
    </svg>
  );
}

/* ============================================================
 * 半搭榫 — half-lap (two pieces each cut halfway and lapped)
 * ============================================================ */
function HalfLapDetail(p: JoineryDetailParams) {
  const tl = p.tenonLength;
  const mt = p.motherThickness;
  const s = fitScale(Math.max(tl * 4, mt * 4), 160);
  const PX = (mm: number) => mm * s;
  const pieceLen = Math.max(PX(tl) * 3, 160);
  const halfThick = PX(mt) / 2;

  const expWidth = pieceLen + 40;
  const expHeight = PX(mt) * 2 + 60;
  const asmWidth = pieceLen + 40;
  const w = expWidth + asmWidth + PADDING * 3;
  const h = expHeight + PADDING + 20;

  const bAx = PADDING + 30;
  const bAy = PADDING + 20;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      style={{ maxWidth: "680px" }}
      className="bg-white"
    >
      <text x={PADDING} y={18} fontSize={11} fontWeight="bold" fill={COLOR_OUTLINE}>
        分解圖
      </text>
      {/* Piece A — top half cut off at right end */}
      <g>
        <path
          d={`M${bAx} ${bAy} L${bAx + pieceLen - PX(tl)} ${bAy} L${bAx + pieceLen - PX(tl)} ${bAy + halfThick} L${bAx + pieceLen} ${bAy + halfThick} L${bAx + pieceLen} ${bAy + PX(mt)} L${bAx} ${bAy + PX(mt)} Z`}
          fill={COLOR_MORTISE}
          stroke={COLOR_OUTLINE}
        />
        <text
          x={bAx + pieceLen / 2}
          y={bAy + PX(mt) + 14}
          fontSize={9}
          textAnchor="middle"
          fill="#666"
        >
          A 件（上半削去）
        </text>
        <DimLine
          x1={bAx + pieceLen - PX(tl)}
          y1={bAy + halfThick - 4}
          x2={bAx + pieceLen}
          y2={bAy + halfThick - 4}
          label={`搭長 ${tl}`}
          side="top"
        />
        <DimLine
          x1={bAx - 14}
          y1={bAy}
          x2={bAx - 14}
          y2={bAy + PX(mt)}
          label={`板厚 ${mt}`}
          side="left"
        />
      </g>

      {/* Piece B — bottom half cut off at left end, drawn below */}
      <g transform={`translate(0,${PX(mt) + 30})`}>
        <path
          d={`M${bAx} ${bAy} L${bAx + pieceLen} ${bAy} L${bAx + pieceLen} ${bAy + PX(mt)} L${bAx + PX(tl)} ${bAy + PX(mt)} L${bAx + PX(tl)} ${bAy + halfThick} L${bAx} ${bAy + halfThick} Z`}
          fill={COLOR_TENON}
          stroke={COLOR_OUTLINE}
        />
        <text
          x={bAx + pieceLen / 2}
          y={bAy + PX(mt) + 14}
          fontSize={9}
          textAnchor="middle"
          fill="#666"
        >
          B 件（下半削去）
        </text>
      </g>

      {/* Assembled — pieces fully overlap with interlocked half-laps */}
      <text
        x={expWidth + PADDING * 2}
        y={18}
        fontSize={11}
        fontWeight="bold"
        fill={COLOR_OUTLINE}
      >
        組合剖面
      </text>
      <g transform={`translate(${expWidth + PADDING * 2},0)`}>
        {/* Piece A outline (top half present on left, absent at right) */}
        <rect
          x={PADDING}
          y={bAy}
          width={pieceLen - PX(tl)}
          height={halfThick}
          fill={COLOR_MORTISE}
          stroke={COLOR_OUTLINE}
        />
        {/* Piece A bottom half full length */}
        <rect
          x={PADDING}
          y={bAy + halfThick}
          width={pieceLen}
          height={halfThick}
          fill={COLOR_MORTISE}
          stroke={COLOR_OUTLINE}
        />
        {/* Piece B top half overlapping at lap zone */}
        <rect
          x={PADDING + pieceLen - PX(tl)}
          y={bAy}
          width={PX(tl)}
          height={halfThick}
          fill={COLOR_TENON}
          stroke={COLOR_OUTLINE}
        />
        {/* Piece B full thickness to the right of overlap */}
        <rect
          x={PADDING + pieceLen}
          y={bAy}
          width={PX(tl) * 2}
          height={PX(mt)}
          fill={COLOR_TENON}
          stroke={COLOR_OUTLINE}
        />
        {/* Piece B bottom half, overlap region — extends into B's body */}
        <rect
          x={PADDING + pieceLen - PX(tl)}
          y={bAy + halfThick}
          width={PX(tl)}
          height={halfThick}
          fill="none"
          stroke={COLOR_OUTLINE}
          strokeDasharray="3 2"
        />
        <DimLine
          x1={PADDING + pieceLen - PX(tl)}
          y1={bAy + PX(mt) + 8}
          x2={PADDING + pieceLen}
          y2={bAy + PX(mt) + 8}
          label={`重疊 ${tl}`}
          side="bottom"
        />
        <text
          x={PADDING + pieceLen / 2}
          y={bAy + PX(mt) + 42}
          fontSize={9}
          textAnchor="middle"
          fill="#666"
        >
          兩件各削一半，咬合後總厚 = 板厚
        </text>
      </g>
    </svg>
  );
}

/* ============================================================
 * 企口榫 — tongue-and-groove (panel edge into grooved rail)
 * ============================================================ */
function TongueAndGrooveDetail(p: JoineryDetailParams) {
  const tl = p.tenonLength;
  const tt = p.tenonThickness;
  const mt = p.motherThickness;
  const ct = p.childThickness ?? tt;

  const s = fitScale(Math.max(mt * 2 + tl, ct * 2 + tl), 120);
  const PX = (mm: number) => mm * s;

  const pieceLen = Math.max(PX(mt) * 2.5, 110);
  const gap = 30;
  const leftPad = 40;
  // Exploded: mother on the LEFT (groove cut on its RIGHT edge),
  //           child  on the RIGHT (tongue sticking out from its LEFT edge)
  const expContentW = pieceLen * 2 + gap;
  const expContentH = Math.max(PX(mt), PX(ct)) + 50;
  // Assembled: horizontal — tongue fully inside groove, two boards meet
  const asmContentW = pieceLen * 2 - PX(tl) + gap;
  const w = expContentW + asmContentW + PADDING * 4 + 20 + leftPad;
  const h = expContentH + PADDING + 20;

  const mAx = PADDING + leftPad;
  const mAy = PADDING + 10;
  const cAx = mAx + pieceLen + gap;
  // Center child vertically on mother (same centerline)
  const cAy = mAy + (PX(mt) - PX(ct)) / 2;

  const asmX = mAx + expContentW + PADDING * 2;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      style={{ maxWidth: "680px" }}
      className="bg-white"
    >
      <defs>
        <Hatching id="hatch-tg" color="#7a5a2c" />
      </defs>

      <text x={PADDING} y={18} fontSize={11} fontWeight="bold" fill={COLOR_OUTLINE}>
        分解圖
      </text>

      {/* mother (grooved rail) — groove on RIGHT edge, opens right */}
      <g>
        <rect
          x={mAx}
          y={mAy}
          width={pieceLen}
          height={PX(mt)}
          fill={COLOR_MORTISE}
          stroke={COLOR_OUTLINE}
        />
        {/* groove cut — centered thickness-wise */}
        <rect
          x={mAx + pieceLen - PX(tl)}
          y={mAy + PX(mt) / 2 - PX(tt) / 2}
          width={PX(tl)}
          height={PX(tt)}
          fill="white"
          stroke={COLOR_OUTLINE}
        />
        <text
          x={mAx + pieceLen / 2}
          y={mAy + PX(mt) + 14}
          fontSize={9}
          textAnchor="middle"
          fill="#666"
        >
          母件（凹槽）
        </text>
        <DimLine
          x1={mAx + pieceLen - PX(tl)}
          y1={mAy + PX(mt) / 2 - PX(tt) / 2 - 3}
          x2={mAx + pieceLen}
          y2={mAy + PX(mt) / 2 - PX(tt) / 2 - 3}
          label={`槽深 ${tl}`}
          side="top"
        />
        <DimLine
          x1={mAx - 10}
          y1={mAy}
          x2={mAx - 10}
          y2={mAy + PX(mt)}
          label={`母厚 ${mt}`}
          side="left"
        />
      </g>

      {/* child (panel with tongue) — tongue on LEFT edge, points left toward mother */}
      <g>
        <rect
          x={cAx + PX(tl)}
          y={cAy}
          width={pieceLen - PX(tl)}
          height={PX(ct)}
          fill={COLOR_TENON}
          stroke={COLOR_OUTLINE}
        />
        <rect
          x={cAx}
          y={cAy + PX(ct) / 2 - PX(tt) / 2}
          width={PX(tl)}
          height={PX(tt)}
          fill={COLOR_TENON}
          stroke={COLOR_OUTLINE}
        />
        <text
          x={cAx + pieceLen / 2}
          y={cAy + PX(ct) + 14}
          fontSize={9}
          textAnchor="middle"
          fill="#666"
        >
          公件（出舌）
        </text>
        <DimLine
          x1={cAx}
          y1={cAy + PX(ct) / 2 + PX(tt) / 2 + 4}
          x2={cAx + PX(tl)}
          y2={cAy + PX(ct) / 2 + PX(tt) / 2 + 4}
          label={`舌長 ${tl}`}
          side="bottom"
        />
        <DimLine
          x1={cAx + pieceLen + 10}
          y1={cAy}
          x2={cAx + pieceLen + 10}
          y2={cAy + PX(ct)}
          label={`板厚 ${ct}`}
          side="right"
        />
      </g>

      {/* =========== ASSEMBLED =========== */}
      <text x={asmX} y={18} fontSize={11} fontWeight="bold" fill={COLOR_OUTLINE}>
        組合剖面
      </text>

      <g>
        {/* mother (hatched) — left side, groove still cut but child fills it */}
        <rect
          x={asmX}
          y={mAy}
          width={pieceLen}
          height={PX(mt)}
          fill="url(#hatch-tg)"
          stroke={COLOR_OUTLINE}
        />
        {/* child body on the right, overlapping mother by tl */}
        <rect
          x={asmX + pieceLen - PX(tl)}
          y={cAy}
          width={pieceLen}
          height={PX(ct)}
          fill={COLOR_TENON}
          stroke={COLOR_OUTLINE}
        />
        {/* where the tongue sits inside the groove, re-draw tongue as filled to make it clear */}
        <rect
          x={asmX + pieceLen - PX(tl)}
          y={mAy + PX(mt) / 2 - PX(tt) / 2}
          width={PX(tl)}
          height={PX(tt)}
          fill={COLOR_TENON}
          stroke={COLOR_OUTLINE}
        />
        <text
          x={asmX + pieceLen}
          y={mAy + PX(mt) + 20}
          fontSize={9}
          textAnchor="middle"
          fill="#666"
        >
          出舌嵌入凹槽
        </text>
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

/* ============================================================
 * 鳩尾榫 — dovetail (drawer corners)
 *   Trapezoidal pins + tails — the signature drawer corner joint.
 * ============================================================ */
function DovetailDetail(p: JoineryDetailParams) {
  const tl = p.tenonLength;
  const tw = p.tenonWidth;
  const tt = p.tenonThickness;
  const ct = p.childThickness ?? tt;
  const mt = p.motherThickness;

  // Dovetails have multiple "tails" — draw 3 tails across the width.
  const N = 3;
  const s = fitScale(Math.max(tl * 4, tt * 4, ct * 4), 140);
  const PX = (mm: number) => mm * s;

  const pinW = PX(tt) / (2 * N + 1); // pin thickness (socket on mother)
  const tailW = pinW * 2; // tail width on child
  const pieceDepth = PX(tt); // height of each piece (depth along the joint face)
  const pieceLen = Math.max(PX(tl) * 4, 160);
  const angle = 0.18; // dovetail angle (roughly 10°)

  const leftPad = 40;
  const expW = pieceLen * 2 + 80;
  const asmW = pieceLen * 1.5 + 40;
  const w = expW + asmW + PADDING * 3 + leftPad;
  const h = pieceDepth + 80;

  const mAx = PADDING + leftPad;
  const mAy = PADDING + 10;

  // Build mother (pin board) path: straight back edge, trapezoidal pins on front
  const makePinsPath = () => {
    const verts: Array<[number, number]> = [];
    const baseY = mAy;
    const tipY = mAy + pieceDepth;
    verts.push([mAx, mAy]);
    verts.push([mAx + pieceLen - PX(tl), mAy]); // top edge until joint start
    // pin-and-socket front edge
    let x = mAx + pieceLen - PX(tl);
    let onBaseLine = true;
    for (let i = 0; i < N * 2 + 1; i++) {
      if (i === 0) {
        // socket at edge — go down with inward slope
        verts.push([x, baseY]);
        verts.push([x + PX(tl) * angle, tipY]);
        x += pinW;
        verts.push([x - PX(tl) * angle, tipY]);
        onBaseLine = false;
      } else if (i % 2 === 1) {
        // pin top
        verts.push([x, tipY]);
        verts.push([x, baseY]);
        x += pinW;
        verts.push([x, baseY]);
        onBaseLine = true;
      } else {
        // socket (going back up)
        verts.push([x + PX(tl) * angle, tipY]);
        x += pinW;
        verts.push([x - PX(tl) * angle, tipY]);
        onBaseLine = false;
      }
    }
    if (!onBaseLine) {
      // close back up
      verts.push([x, tipY]);
    }
    verts.push([mAx + pieceLen, tipY]);
    verts.push([mAx + pieceLen, mAy + pieceDepth + 30]); // extend body down
    verts.push([mAx, mAy + pieceDepth + 30]);
    return "M" + verts.map((v) => v.join(" ")).join(" L") + " Z";
  };

  // Simpler approach — draw the joint schematically using two rects + interlocked zigzag
  const bAx = PADDING + leftPad;
  const bAy = PADDING + 10;
  const cBodyX = bAx + pieceLen + 80;
  const cBodyY = bAy;

  return (
    <svg
      viewBox={`0 0 ${w} ${h + 40}`}
      width="100%"
      style={{ maxWidth: "680px" }}
      className="bg-white"
    >
      <defs>
        <Hatching id="hatch-dt" color="#7a5a2c" />
      </defs>

      <text x={PADDING} y={18} fontSize={11} fontWeight="bold" fill={COLOR_OUTLINE}>
        分解圖
      </text>

      {/* mother (pin board): drawn with pins sticking UP */}
      <g>
        <rect
          x={bAx}
          y={bAy + PX(tl)}
          width={pieceLen}
          height={pieceDepth}
          fill={COLOR_MORTISE}
          stroke={COLOR_OUTLINE}
        />
        {/* pins (trapezoidal) on top edge */}
        {Array.from({ length: N }).map((_, i) => {
          const pinCenterX = bAx + (pieceLen / (N + 1)) * (i + 1);
          const halfBot = pinW * 1.3;
          const halfTop = halfBot * 0.55;
          return (
            <path
              key={i}
              d={`M${pinCenterX - halfBot} ${bAy + PX(tl)} L${pinCenterX - halfTop} ${bAy} L${pinCenterX + halfTop} ${bAy} L${pinCenterX + halfBot} ${bAy + PX(tl)} Z`}
              fill={COLOR_MORTISE}
              stroke={COLOR_OUTLINE}
            />
          );
        })}
        <text
          x={bAx + pieceLen / 2}
          y={bAy + PX(tl) + pieceDepth + 14}
          fontSize={9}
          textAnchor="middle"
          fill="#666"
        >
          母件（pin 面板）
        </text>
        <DimLine
          x1={bAx - 10}
          y1={bAy}
          x2={bAx - 10}
          y2={bAy + PX(tl)}
          label={`榫長 ${tl}`}
          side="left"
        />
      </g>

      {/* child (tail board): drawn with dovetail slots between tails */}
      <g>
        <rect
          x={cBodyX}
          y={cBodyY + PX(tl)}
          width={pieceLen}
          height={pieceDepth}
          fill={COLOR_TENON}
          stroke={COLOR_OUTLINE}
        />
        {/* tails with sockets between them (draw tails sticking up) */}
        {Array.from({ length: N + 1 }).map((_, i) => {
          const tailCenterX = cBodyX + (pieceLen / (N + 2)) * (i + 1);
          const halfBot = pinW * 0.9;
          const halfTop = halfBot * 1.6;
          return (
            <path
              key={i}
              d={`M${tailCenterX - halfBot} ${cBodyY + PX(tl)} L${tailCenterX - halfTop} ${cBodyY} L${tailCenterX + halfTop} ${cBodyY} L${tailCenterX + halfBot} ${cBodyY + PX(tl)} Z`}
              fill={COLOR_TENON}
              stroke={COLOR_OUTLINE}
            />
          );
        })}
        <text
          x={cBodyX + pieceLen / 2}
          y={cBodyY + PX(tl) + pieceDepth + 14}
          fontSize={9}
          textAnchor="middle"
          fill="#666"
        >
          公件（tail 面板）
        </text>
      </g>

      {/* Assembled corner view */}
      <text
        x={expW + PADDING}
        y={18}
        fontSize={11}
        fontWeight="bold"
        fill={COLOR_OUTLINE}
      >
        組合（L 型轉角）
      </text>
      <g transform={`translate(${expW + PADDING},${PADDING + 10})`}>
        {/* horizontal piece (top of drawer — tail board) */}
        <rect
          x={0}
          y={0}
          width={pieceLen}
          height={pieceDepth}
          fill={COLOR_TENON}
          stroke={COLOR_OUTLINE}
        />
        {/* vertical piece (side — pin board) */}
        <rect
          x={pieceLen}
          y={0}
          width={pieceDepth}
          height={pieceLen * 0.8}
          fill="url(#hatch-dt)"
          stroke={COLOR_OUTLINE}
        />
        {/* interlocking zigzag at corner */}
        <g stroke={COLOR_OUTLINE} fill="none" strokeWidth={0.8}>
          {Array.from({ length: N }).map((_, i) => {
            const y = pieceDepth / (N + 1) * (i + 1);
            return (
              <line
                key={i}
                x1={pieceLen - pinW * 0.5}
                y1={y}
                x2={pieceLen + pieceDepth}
                y2={y}
                strokeDasharray="2 2"
              />
            );
          })}
        </g>
        <text
          x={pieceLen / 2}
          y={pieceDepth + 14}
          fontSize={9}
          textAnchor="middle"
          fill="#666"
        >
          梯形榫頭咬合，難拆抗拉
        </text>
      </g>
    </svg>
  );
}

const RENDERERS: Partial<
  Record<JoineryType, (p: JoineryDetailParams) => React.ReactElement>
> = {
  "through-tenon": ThroughTenonDetail,
  "blind-tenon": BlindTenonDetail,
  "shouldered-tenon": BlindTenonDetail,
  "half-lap": HalfLapDetail,
  "tongue-and-groove": TongueAndGrooveDetail,
  dovetail: DovetailDetail,
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
