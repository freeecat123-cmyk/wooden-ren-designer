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
  // Mother face-on view needs: panel face (tw*3) + gap + side cross-section (tw+60) + dim label
  const expMotherW = PX(tw) * 3 + 40 + PX(tw) + 60 + 50;
  const expWidth = Math.max(expMotherW, PX(cw) + 80);
  // reserve 40 extra px for 柱寬 dim label below the leg body when shoulders exist
  const extraBottomForShoulders = cw !== tw ? 40 : 0;
  // mother face view is taller than thin edge-strip (panelFaceH = tt*3); reserve it
  const motherFaceH = Math.max(PX(tt) * 3, PX(mt));
  const expHeight = motherFaceH + childBodyLen + PX(tl) + 100 + extraBottomForShoulders;

  // --- ASSEMBLED panel dimensions ---
  const asmWidth = motherDrawWidth + 40;
  const asmHeight = PX(mt) + childBodyLen + PX(tl) + 60;

  const w = expWidth + asmWidth + PADDING * 3;
  const h = Math.max(expHeight, asmHeight) + PADDING;

  // ---- exploded piece positions ----
  // Mother face-on view centered horizontally in the exploded pane; mAx is
  // the LEFT edge of the hole (not of the panel face, which extends wider).
  const panelFaceW = PX(tw) * 3;
  const motherBlockX = PADDING + (expWidth - (panelFaceW + 30 + PX(mt) * 1.5 + 20)) / 2;
  const mAx = motherBlockX + (panelFaceW - PX(tw)) / 2;
  const mAy = PADDING + 30 + (motherFaceH - PX(mt)) / 2; // mAy is where the mortise vertically starts inside the face
  // Child (bottom half): body + tenon stub going up
  const cBodyX = PADDING + expWidth / 2 - PX(cw) / 2;
  const cBodyY = PADDING + 30 + motherFaceH + 50;

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
        {/* End-grain pattern: dotted to indicate exposed cross-cut wood */}
        <pattern
          id="end-grain-through"
          patternUnits="userSpaceOnUse"
          width={4}
          height={4}
        >
          <rect width={4} height={4} fill={COLOR_TENON} />
          <circle cx={2} cy={2} r={0.6} fill="#7a5a2c" />
        </pattern>
      </defs>

      {/* =========== EXPLODED =========== */}
      <text x={PADDING} y={18} fontSize={11} fontWeight="bold" fill={COLOR_OUTLINE}>
        分解圖
      </text>

      {/* Mother: face-on view — panel seen from above, with a rectangular hole
          surrounded by wood on all four sides. A small cross-section strip on
          the right shows the panel thickness. This replaces the old edge-view
          which was read as "panel broken in half". */}
      {(() => {
        const panelFaceW = PX(tw) * 3; // abstracted panel extent on the face
        const panelFaceH = PX(tt) * 3; // abstracted panel depth
        const pFaceX = mAx - (panelFaceW - PX(tw)) / 2;
        const pFaceY = mAy - (panelFaceH - PX(mt)) / 2;
        // Hole centered in the face
        const holeX = pFaceX + (panelFaceW - PX(tw)) / 2;
        const holeY = pFaceY + (panelFaceH - PX(tt)) / 2;
        // Side cross-section (cut along a plane through the leg, looking sideways):
        //   horizontal axis = a portion of the panel's length (shows wood either side of hole)
        //   vertical axis   = panel thickness (mt), going top-face → bottom-face
        //   the through-hole appears as a vertical slot PX(tw) wide × PX(mt) tall
        const xsX = pFaceX + panelFaceW + 40;
        const xsW = PX(tw) + 60;                    // hole + wood margins left/right
        const xsH = PX(mt);                          // panel thickness (vertical)
        // vertically center the cross-section within the face view's height so the
        // two views align neatly
        const xsY = pFaceY + (panelFaceH - xsH) / 2;
        const xsHoleX = xsX + (xsW - PX(tw)) / 2;   // hole horizontally centered
        return (
          <g>
            {/* panel face (top view) */}
            <rect
              x={pFaceX}
              y={pFaceY}
              width={panelFaceW}
              height={panelFaceH}
              fill={COLOR_MORTISE}
              stroke={COLOR_OUTLINE}
            />
            {/* hole on the face — solid outline since we're looking AT the opening */}
            <rect
              x={holeX}
              y={holeY}
              width={PX(tw)}
              height={PX(tt)}
              fill="white"
              stroke={COLOR_OUTLINE}
            />
            <text
              x={pFaceX + panelFaceW / 2}
              y={pFaceY + panelFaceH + 14}
              fontSize={9}
              textAnchor="middle"
              fill="#666"
            >
              母件（俯視）
            </text>
            <DimLine
              x1={holeX}
              y1={holeY - 4}
              x2={holeX + PX(tw)}
              y2={holeY - 4}
              label={`榫孔長 ${tw}`}
              side="top"
            />
            <DimLine
              x1={holeX + PX(tw) + 4}
              y1={holeY}
              x2={holeX + PX(tw) + 4}
              y2={holeY + PX(tt)}
              label={`榫孔寬 ${tt}`}
              side="right"
            />

            {/* Side cross-section: panel thickness visible as a horizontal band;
                through-hole appears as a vertical slot punched top-to-bottom */}
            <rect
              x={xsX}
              y={xsY}
              width={xsW}
              height={xsH}
              fill={COLOR_MORTISE}
              stroke={COLOR_OUTLINE}
            />
            {/* hole = vertical slot from top face to bottom face */}
            <rect
              x={xsHoleX}
              y={xsY}
              width={PX(tw)}
              height={xsH}
              fill="white"
              stroke={COLOR_OUTLINE}
            />
            <text
              x={xsX + xsW / 2}
              y={xsY + xsH + 14}
              fontSize={9}
              textAnchor="middle"
              fill="#666"
            >
              側剖面（切過榫孔）
            </text>
            {/* thickness = vertical (穿透方向) */}
            <DimLine
              x1={xsX + xsW + 8}
              y1={xsY}
              x2={xsX + xsW + 8}
              y2={xsY + xsH}
              label={`板厚 ${mt}`}
              side="right"
            />
            {/* hole width = horizontal */}
            <DimLine
              x1={xsHoleX}
              y1={xsY - 4}
              x2={xsHoleX + PX(tw)}
              y2={xsY - 4}
              label={`${tw}`}
              side="top"
            />
          </g>
        );
      })()}

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
          <>
            <DimLine
              x1={cBodyX}
              y1={cBodyY + PX(tl) + childBodyLen + 20}
              x2={cBodyX + PX(cw)}
              y2={cBodyY + PX(tl) + childBodyLen + 20}
              label={`柱寬 ${cw}`}
              side="bottom"
            />
            {/* shoulder label on the left side */}
            <DimLine
              x1={cBodyX}
              y1={cBodyY + PX(tl) + 4}
              x2={cBodyX + PX(cw) / 2 - PX(tw) / 2}
              y2={cBodyY + PX(tl) + 4}
              label={`肩 ${Math.round((cw - tw) / 2)}`}
              side="bottom"
            />
          </>
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
        {/* End-grain pattern on top face of tenon — visible from above */}
        <rect
          x={asmChildX}
          y={asmChildTop - 5}
          width={PX(tt)}
          height={5}
          fill="url(#end-grain-through)"
          stroke={COLOR_OUTLINE}
          strokeWidth={0.5}
        />
        <text
          x={asmChildX + PX(tt) + 4}
          y={asmChildTop - 1}
          fontSize={8}
          fill="#666"
        >
          端面（木紋橫切）
        </text>
        {/* label line: tenon flush with top */}
        <text
          x={asmMotherX + asmMotherW / 2}
          y={asmMotherY + PX(mt) + asmChildBottomExt + 14}
          fontSize={9}
          textAnchor="middle"
          fill="#666"
        >
          榫頭貫穿母件、端面可見；柱肩頂在母件底面，鎖住不上滑
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

  // Exploded view scale: fits mother face + child body
  const s = fitScale(Math.max(mt * 2, tw + 40, cw + 40, tl * 4), 180);
  const PX = (mm: number) => mm * s;

  // Assembled view uses its OWN scale — and a MIN so the mother square
  // is always at least ~160px (big enough to see the mortise/tenon
  // engagement clearly, even for thin mothers like an 18mm slat backer).
  // Scale is clamped UPWARD when the base scale would leave mt too small.
  const baseAsmScale = fitScale(Math.max(mt, tl + cw, cw) * 1.1, 180);
  const sAsm = Math.max(baseAsmScale, 160 / mt);
  const AX = (mm: number) => mm * sAsm;

  const leftPad = 50;

  // ---- EXPLODED: mother = piece side face (vertical orientation).
  const faceMarginY = Math.max(45, PX(tw) * 0.7);
  const motherFaceW = Math.max(PX(mt), 90);
  const motherFaceH = PX(tw) + 2 * faceMarginY;

  const childBodyLen = Math.max(120, PX(cw) * 1.8);
  const gapBetween = 40;

  const expWidth = Math.max(motherFaceW + 100, childBodyLen + PX(tl) + 80);
  const expHeight = motherFaceH + gapBetween + PX(ct) + 60;

  // ---- ASSEMBLED: top-down cross-section. Mother = mt × mt square.
  const asmLegSide = AX(mt);
  const asmApronLen = Math.max(150, AX(cw) * 1.2);
  const asmWidth = asmLegSide + asmApronLen + 120;
  const asmHeight = asmLegSide + 100;

  const w = expWidth + asmWidth + PADDING * 3 + leftPad;
  const h = Math.max(expHeight, asmHeight) + PADDING + 60;

  // Mother position
  const mAx = PADDING + leftPad;
  const mAy = PADDING + 30;
  // Mortise: centered horizontally on the leg face, positioned with equal
  // wood margin above and below
  const mortiseW = PX(tt); // thin horizontal extent (tenon thickness)
  const mortiseH = PX(tw); // tall vertical extent (tenon width)
  const mortiseX = mAx + (motherFaceW - mortiseW) / 2;
  const mortiseY = mAy + faceMarginY;

  // Child position
  const cAx = PADDING + leftPad;
  const cAy = mAy + motherFaceH + gapBetween;
  const cTop = cAy;
  const cBottom = cAy + PX(ct);
  const tenonY = cAy + (PX(ct) - PX(tt)) / 2;

  // Assembled positions
  const asmOriginX = PADDING * 2 + expWidth + leftPad;
  const asmLegX = asmOriginX + 20;
  const asmLegY = PADDING + 30;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      style={{ maxWidth: "720px" }}
      className="bg-white"
    >
      <defs>
        <Hatching id="hatch-blind" color="#7a5a2c" />
      </defs>

      {/* ========= EXPLODED ========= */}
      <text x={PADDING} y={18} fontSize={11} fontWeight="bold" fill={COLOR_OUTLINE}>
        分解圖
      </text>

      {/* Mother: leg side face. Mortise = recess OPEN on this face, so use
          a solid outline (visible from this angle) and a dark shadow fill
          to convey "cavity into the wood", not white/air. Wood margins are
          now generous (>= tw * 0.6) so the mortise reads as "a hole in a
          piece of wood" rather than "piece of wood split into two". */}
      <g>
        <rect
          x={mAx}
          y={mAy}
          width={motherFaceW}
          height={motherFaceH}
          fill={COLOR_MORTISE}
          stroke={COLOR_OUTLINE}
        />
        {/* blind mortise recess — solid outline + dark shadow */}
        <rect
          x={mortiseX}
          y={mortiseY}
          width={mortiseW}
          height={mortiseH}
          fill="#3d2a14"
          stroke={COLOR_OUTLINE}
        />
        {/* inner shadow hint — small inset rect suggests depth into the wood */}
        <rect
          x={mortiseX + 1.5}
          y={mortiseY + 1.5}
          width={mortiseW - 3}
          height={mortiseH - 3}
          fill="none"
          stroke="#2a1808"
          strokeWidth={0.5}
          strokeDasharray="2 1.5"
        />
        <text
          x={mAx + motherFaceW / 2}
          y={mAy + motherFaceH + 16}
          fontSize={9}
          textAnchor="middle"
          fill="#666"
        >
          母件（側面觀，盲孔）
        </text>
        {/* leg width (horizontal) */}
        <DimLine
          x1={mAx}
          y1={mAy + motherFaceH + 28}
          x2={mAx + motherFaceW}
          y2={mAy + motherFaceH + 28}
          label={`母件寬 ${mt}`}
          side="bottom"
        />
        {/* mortise height = tenon width (along leg's up-down axis) */}
        <DimLine
          x1={mortiseX + mortiseW + 8}
          y1={mortiseY}
          x2={mortiseX + mortiseW + 8}
          y2={mortiseY + mortiseH}
          label={`榫眼長 ${tw}`}
          side="right"
        />
        {/* mortise width = tenon thickness (across leg face) */}
        <DimLine
          x1={mortiseX}
          y1={mortiseY - 4}
          x2={mortiseX + mortiseW}
          y2={mortiseY - 4}
          label={`榫眼厚 ${tt}`}
          side="top"
        />
        {/* wood margin above the mortise */}
        <DimLine
          x1={mAx - 10}
          y1={mAy}
          x2={mAx - 10}
          y2={mortiseY}
          label={`${Math.round(faceMarginY / s)}`}
          side="left"
        />
        {/* wood margin below the mortise */}
        <DimLine
          x1={mAx - 10}
          y1={mortiseY + mortiseH}
          x2={mAx - 10}
          y2={mAy + motherFaceH}
          label={`${Math.round(faceMarginY / s)}`}
          side="left"
        />
      </g>

      {/* Child: apron body with tenon stub on the right end */}
      <g>
        <rect
          x={cAx}
          y={cTop}
          width={childBodyLen}
          height={PX(ct)}
          fill={COLOR_TENON}
          stroke={COLOR_OUTLINE}
        />
        <rect
          x={cAx + childBodyLen}
          y={tenonY}
          width={PX(tl)}
          height={PX(tt)}
          fill={COLOR_TENON}
          stroke={COLOR_OUTLINE}
        />
        {/* shoulder line */}
        <line
          x1={cAx + childBodyLen}
          y1={cTop}
          x2={cAx + childBodyLen}
          y2={cBottom}
          stroke={COLOR_OUTLINE}
          strokeWidth={0.8}
        />
        <text
          x={cAx + childBodyLen / 2}
          y={cBottom + 14}
          fontSize={9}
          textAnchor="middle"
          fill="#666"
        >
          公件（凸，牙板/橫撐）
        </text>
        <DimLine
          x1={cAx + childBodyLen}
          y1={tenonY + PX(tt) + 4}
          x2={cAx + childBodyLen + PX(tl)}
          y2={tenonY + PX(tt) + 4}
          label={`榫長 ${tl}`}
          side="bottom"
        />
        <DimLine
          x1={cAx + childBodyLen + PX(tl) + 10}
          y1={tenonY}
          x2={cAx + childBodyLen + PX(tl) + 10}
          y2={tenonY + PX(tt)}
          label={`榫厚 ${tt}`}
          side="right"
        />
        {ct !== tt && (
          <DimLine
            x1={cAx - 14}
            y1={cTop}
            x2={cAx - 14}
            y2={cBottom}
            label={`板厚 ${ct}`}
            side="left"
          />
        )}
      </g>

      {/* ========= ASSEMBLED (top-down cross-section) ========= */}
      <text x={asmOriginX} y={18} fontSize={11} fontWeight="bold" fill={COLOR_OUTLINE}>
        組合剖面（上視切面）
      </text>

      {/* Draw the leg as a single path that EXCLUDES the mortise zone — so
          the hatching clearly shows "mother wood around the cavity". Then
          overlay the tenon (child wood, solid tan) filling the cavity. This
          reads as three distinct zones:
            1. hatched: 母件木料
            2. light tan inside leg: 榫頭（公件）填入榫眼
            3. light tan right of leg: 牙板 body
      */}
      {(() => {
        const legX = asmLegX;
        const legY = asmLegY;
        const legSide = asmLegSide;
        const mortiseL = AX(tl);
        const mortiseT = AX(tt);
        // Mortise opens from the right face, centered vertically in the leg
        const mortiseTop = legY + (legSide - mortiseT) / 2;
        const mortiseBottom = mortiseTop + mortiseT;
        const mortiseLeft = legX + legSide - mortiseL;
        // Path traces around the leg perimeter, then dips INTO the right face
        // to carve out the mortise.
        const legPath =
          `M${legX} ${legY} ` +
          `L${legX + legSide} ${legY} ` +
          `L${legX + legSide} ${mortiseTop} ` +
          `L${mortiseLeft} ${mortiseTop} ` +
          `L${mortiseLeft} ${mortiseBottom} ` +
          `L${legX + legSide} ${mortiseBottom} ` +
          `L${legX + legSide} ${legY + legSide} ` +
          `L${legX} ${legY + legSide} Z`;
        return (
          <g>
            {/* Mother — hatched, with mortise cavity carved out */}
            <path d={legPath} fill="url(#hatch-blind)" stroke={COLOR_OUTLINE} />
            {/* Mortise cavity outline (inside the leg) — faint dashed to show
                where the wood was removed before tenon was inserted */}
            <rect
              x={mortiseLeft}
              y={mortiseTop}
              width={mortiseL}
              height={mortiseT}
              fill="none"
              stroke="#555"
              strokeWidth={0.5}
              strokeDasharray="2 1.5"
            />
            {/* Tenon filling the cavity (child wood, solid tan) */}
            <rect
              x={mortiseLeft}
              y={mortiseTop}
              width={mortiseL}
              height={mortiseT}
              fill={COLOR_TENON}
              stroke={COLOR_OUTLINE}
              strokeWidth={0.8}
            />
            {/* Apron body sticking out the right face */}
            <rect
              x={legX + legSide}
              y={legY + (legSide - AX(ct)) / 2}
              width={asmApronLen}
              height={AX(ct)}
              fill={COLOR_TENON}
              stroke={COLOR_OUTLINE}
            />
            {/* Shoulder line where apron body meets leg face */}
            <line
              x1={legX + legSide}
              y1={legY + (legSide - AX(ct)) / 2}
              x2={legX + legSide}
              y2={legY + (legSide + AX(ct)) / 2}
              stroke={COLOR_OUTLINE}
              strokeWidth={0.8}
            />
            {/* Labels outside with leader lines — easier to read than
                overlapping hatch/color. */}
            {(() => {
              // 母件 label at top-left corner with leader
              const motherLabelX = legX - 30;
              const motherLabelY = legY + 18;
              return (
                <g fontSize={9} fill="#5a3f1e" stroke="none">
                  <text x={motherLabelX} y={motherLabelY} textAnchor="end" fontWeight="bold">母件</text>
                  <line x1={motherLabelX + 2} y1={motherLabelY - 3} x2={legX + 6} y2={legY + 10} stroke="#5a3f1e" strokeWidth={0.5} />
                </g>
              );
            })()}
            {(() => {
              // 榫頭 label below apron body
              const tenonLabelX = legX + legSide + 30;
              const tenonLabelY = legY + legSide + 4;
              return (
                <g fontSize={9} fill="#8a6a3a" stroke="none">
                  <text x={tenonLabelX} y={tenonLabelY} textAnchor="start" fontWeight="bold">榫頭（公件）</text>
                  <line x1={tenonLabelX + 2} y1={tenonLabelY - 3} x2={mortiseLeft + mortiseL / 2} y2={legY + legSide / 2} stroke="#8a6a3a" strokeWidth={0.5} />
                </g>
              );
            })()}
            {/* 牙板 body label */}
            <text
              x={legX + legSide + asmApronLen / 2 + 30}
              y={legY + (legSide - AX(ct)) / 2 - 6}
              fontSize={9}
              textAnchor="middle"
              fill="#666"
              stroke="none"
            >
              牙板 body
            </text>
            <text
              x={legX + legSide / 2 + asmApronLen / 2}
              y={legY + legSide + 20}
              fontSize={9}
              textAnchor="middle"
              fill="#666"
            >
              榫頭藏於母件內部，未穿透
            </text>
            <DimLine
              x1={legX}
              y1={legY - 6}
              x2={legX + legSide}
              y2={legY - 6}
              label={`母件厚 ${mt}`}
              side="top"
            />
            <DimLine
              x1={mortiseLeft}
              y1={legY + legSide + 34}
              x2={legX + legSide}
              y2={legY + legSide + 34}
              label={`榫眼深 ${tl}`}
              side="bottom"
            />
            <DimLine
              x1={legX + legSide + asmApronLen + 10}
              y1={legY + (legSide - AX(ct)) / 2}
              x2={legX + legSide + asmApronLen + 10}
              y2={legY + (legSide + AX(ct)) / 2}
              label={`板厚 ${ct}`}
              side="right"
            />
          </g>
        );
      })()}
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

/* ============================================================
 * 帶肩榫 (haunched / shouldered tenon) — apron-to-leg standard
 *
 *   Main tenon occupies the middle of the apron width, with a short
 *   "haunch" stub above it (prevents twist + fills the gap up to the
 *   top edge of the apron). Bottom has a shoulder (no tenon).
 *
 *   Dimensions used:
 *     tenon.length    = main tenon protrusion length
 *     tenon.width     = main tenon height (vertical on apron face)
 *     tenon.thickness = tenon thickness (horizontal, into the leg)
 *     childWidth  (cw) = FULL apron width — haunch + main tenon + bottom shoulder
 *     childThickness (ct) = apron body thickness
 *     haunchLen       = tenon.length / 3
 *     haunchHeight    = (cw - tw) / 2  (the gap between main tenon top and apron top)
 *     bottomShoulder  = (cw - tw) / 2  (symmetric)
 * ============================================================ */
function ShoulderedTenonDetail(p: JoineryDetailParams) {
  const tl = p.tenonLength;
  const tw = p.tenonWidth;
  const tt = p.tenonThickness;
  const mt = p.motherThickness;
  const ct = p.childThickness ?? tt;
  const cw = p.childWidth ?? tw;

  // Haunch geometry (default, from 1/3 rule)
  const haunchLen = Math.max(4, Math.round(tl / 3));
  // Distribute remaining apron width: shoulder top + main tenon centered + shoulder bottom
  // Haunch replaces the top shoulder (fills it in).
  const topGap = Math.max(0, (cw - tw) / 2);
  const bottomGap = Math.max(0, (cw - tw) / 2);

  const s = fitScale(Math.max(mt * 2 + 40, cw + 40, tw + 40, tl * 4), 200);
  const PX = (mm: number) => mm * s;

  const leftPad = 50;
  // Mother is the leg's SIDE FACE, drawn tall (vertical = leg's up/down axis).
  // Layout top→bottom: [top wood margin] → [haunch slot] → [main mortise] → [bottom wood]
  // Haunch slot is SAME WIDTH as main mortise (= tenon thickness) — they're cut
  // contiguously, the haunch is just a shallower extension above the main mortise.
  const motherFaceW = PX(mt) + 40;
  const topWoodMargin = 22; // wood BETWEEN leg top face and haunch slot
  const bottomWoodMargin = 30;
  const motherFaceH = topWoodMargin + PX(topGap) + PX(tw) + bottomWoodMargin;
  const cBodyLenForCalc = Math.max(120, PX(ct) * 4);
  const xsSectionW = PX(ct) * 1.6 + 70 + 40; // gap + section + right label
  const expChildW = cBodyLenForCalc + PX(tl) + xsSectionW;
  const expWidth = Math.max(motherFaceW + 80, expChildW) + 60;

  const asmWidth = PX(mt) * 2 + PX(tl) + 60;

  // Vertical budget: top pad + mother + gap + child + bottom text + pad
  const gapBetween = 50;
  const bottomTextReserve = 24;
  const motherTopOffset = 32;
  const h =
    PADDING + motherTopOffset + motherFaceH + gapBetween + PX(cw) + bottomTextReserve + PADDING;
  const w = expWidth + asmWidth + PADDING * 3 + leftPad;

  const mAx = PADDING + leftPad;
  const mAy = PADDING + motherTopOffset;

  // Haunch slot: same width as main mortise (PX(tt)), positioned below the top wood margin
  const haunchMotherW = PX(tt);
  const haunchMotherX = mAx + (motherFaceW - haunchMotherW) / 2;
  const haunchMotherY = mAy + topWoodMargin;
  const haunchMotherH = PX(topGap);
  // Main mortise: directly below haunch slot, same x, wider vertically
  const mortiseX = mAx + (motherFaceW - PX(tt)) / 2;
  const mortiseY = haunchMotherY + haunchMotherH;
  const mortiseW = PX(tt);
  const mortiseH = PX(tw);

  // Child (apron) drawn FACE-ON below the mother:
  // wide face visible, cw vertical × some horizontal length
  const cAx = PADDING + leftPad;
  const cAy = mAy + motherFaceH + gapBetween;
  const cBodyLen = Math.max(120, PX(ct) * 4); // abstract body length
  // Apron top & bottom edges (on the face we're looking at)
  const cTop = cAy;
  const cBottom = cAy + PX(cw);
  // Main tenon vertical position (centered in the apron width, above bottom shoulder)
  const tenonTop = cAy + PX(bottomGap); // tenon starts this far above the bottom
  const tenonBottom = tenonTop + PX(tw);
  // Haunch vertical range = from apron top DOWN to the main tenon's top
  const haunchTop = cTop;
  const haunchBottom = tenonTop;

  // Assembled positions
  const asmOriginX = PADDING * 2 + expWidth + leftPad;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      style={{ maxWidth: "720px" }}
      className="bg-white"
    >
      <defs>
        <Hatching id="hatch-shouldered" color="#7a5a2c" />
      </defs>

      {/* ========= EXPLODED ========= */}
      <text x={PADDING} y={18} fontSize={11} fontWeight="bold" fill={COLOR_OUTLINE}>
        分解圖（牙板/橫撐端面視角）
      </text>

      {/* Mother = leg side face (vertical orientation: TOP of rect = top of
          leg, where the table top sits). Haunch slot is at the TOP edge,
          main mortise below. Main mortise is narrow horizontally (= tenon
          thickness) × tall vertically (= tenon width), matching how the
          mortise actually looks on the leg face. */}
      <g>
        {/* leg face */}
        <rect
          x={mAx}
          y={mAy}
          width={motherFaceW}
          height={motherFaceH}
          fill={COLOR_MORTISE}
          stroke={COLOR_OUTLINE}
        />
        {/* Main mortise */}
        <rect
          x={mortiseX}
          y={mortiseY}
          width={mortiseW}
          height={mortiseH}
          fill="white"
          stroke={COLOR_OUTLINE}
          strokeDasharray="3 2"
        />
        {/* Haunch slot at the TOP of the leg face */}
        <rect
          x={haunchMotherX}
          y={haunchMotherY}
          width={haunchMotherW}
          height={haunchMotherH}
          fill="white"
          stroke={COLOR_OUTLINE}
          strokeDasharray="3 2"
        />
        <text
          x={mAx + motherFaceW / 2}
          y={mAy + motherFaceH + 16}
          fontSize={9}
          textAnchor="middle"
          fill="#666"
        >
          母件（柱腳側面）
        </text>
        {/* leg cross-section width (horizontal) */}
        <DimLine
          x1={mAx}
          y1={mAy + motherFaceH + 28}
          x2={mAx + motherFaceW}
          y2={mAy + motherFaceH + 28}
          label={`柱寬 ${mt}`}
          side="bottom"
        />
        {/* mortise vertical span — matches tenon.width */}
        <DimLine
          x1={mortiseX + mortiseW + 8}
          y1={mortiseY}
          x2={mortiseX + mortiseW + 8}
          y2={mortiseY + mortiseH}
          label={`榫眼長 ${tw}`}
          side="right"
        />
        {/* mortise horizontal span — matches tenon.thickness */}
        <DimLine
          x1={mortiseX}
          y1={mortiseY - 4}
          x2={mortiseX + mortiseW}
          y2={mortiseY - 4}
          label={`榫眼厚 ${tt}`}
          side="top"
        />
        {/* haunch slot height */}
        <DimLine
          x1={haunchMotherX - 8}
          y1={haunchMotherY}
          x2={haunchMotherX - 8}
          y2={haunchMotherY + haunchMotherH}
          label={`肩 ${Math.round(topGap)}`}
          side="left"
        />
        {/* Annotation: "TOP of leg" — pointing at the top edge above wood margin */}
        <text
          x={mAx + motherFaceW + 4}
          y={mAy + 10}
          fontSize={8}
          fill="#999"
        >
          ↑ 腿頂（接桌面）
        </text>
      </g>

      {/* Child (apron) — wide-face view with tenon + haunch on the right end */}
      <g>
        {/* Apron body */}
        <rect
          x={cAx}
          y={cTop}
          width={cBodyLen}
          height={PX(cw)}
          fill={COLOR_TENON}
          stroke={COLOR_OUTLINE}
        />
        {/* Bottom shoulder — visible as absence of wood below main tenon */}
        {/* Main tenon (middle, full length) */}
        <rect
          x={cAx + cBodyLen}
          y={tenonTop}
          width={PX(tl)}
          height={PX(tw)}
          fill={COLOR_TENON}
          stroke={COLOR_OUTLINE}
        />
        {/* Haunch (top, short stub) */}
        <rect
          x={cAx + cBodyLen}
          y={haunchTop}
          width={PX(haunchLen)}
          height={PX(topGap)}
          fill={COLOR_TENON}
          stroke={COLOR_OUTLINE}
        />

        {/* Shoulder lines (vertical divider at body-tenon transition) */}
        <line
          x1={cAx + cBodyLen}
          y1={cTop}
          x2={cAx + cBodyLen}
          y2={cBottom}
          stroke={COLOR_OUTLINE}
          strokeWidth={0.8}
        />

        {/* 格肩 45° 斜面（明式做法）：在主榫底角畫一條 45° miter 標示線。
            西式 haunched 是直角肩；中式格肩是 45° 斜面，外觀只見一條斜線。 */}
        {bottomGap > 0 && (
          <>
            <line
              x1={cAx + cBodyLen}
              y1={tenonBottom}
              x2={cAx + cBodyLen + Math.min(PX(bottomGap), PX(haunchLen))}
              y2={cBottom}
              stroke="#a85"
              strokeWidth={1.5}
            />
            <text
              x={cAx + cBodyLen + Math.min(PX(bottomGap), PX(haunchLen)) + 4}
              y={cBottom - 2}
              fontSize={8}
              fill="#a85"
            >
              45° 格肩
            </text>
          </>
        )}

        <text
          x={cAx + cBodyLen / 2}
          y={cBottom + 14}
          fontSize={9}
          textAnchor="middle"
          fill="#666"
        >
          公件（凸，牙板端面視角）
        </text>

        {/* Labels */}
        <DimLine
          x1={cAx + cBodyLen}
          y1={tenonBottom + 4}
          x2={cAx + cBodyLen + PX(tl)}
          y2={tenonBottom + 4}
          label={`主榫長 ${tl}`}
          side="bottom"
        />
        <DimLine
          x1={cAx + cBodyLen + PX(tl) + 10}
          y1={tenonTop}
          x2={cAx + cBodyLen + PX(tl) + 10}
          y2={tenonBottom}
          label={`榫寬 ${tw}`}
          side="right"
        />
        {haunchLen > 0 && topGap > 0 && (
          <DimLine
            x1={cAx + cBodyLen + PX(haunchLen) + 30}
            y1={haunchTop}
            x2={cAx + cBodyLen + PX(haunchLen) + 30}
            y2={haunchBottom}
            label={`肩寬 ${Math.round(topGap)}`}
            side="right"
          />
        )}
        {haunchLen > 0 && (
          <DimLine
            x1={cAx + cBodyLen}
            y1={haunchTop - 6}
            x2={cAx + cBodyLen + PX(haunchLen)}
            y2={haunchTop - 6}
            label={`肩長 ${haunchLen}`}
            side="top"
          />
        )}
        <DimLine
          x1={cAx - 14}
          y1={cTop}
          x2={cAx - 14}
          y2={cBottom}
          label={`板寬 ${cw}`}
          side="left"
        />
      </g>

      {/* End-face cross-section of the apron — shows thickness dims AND the
          haunch (which is narrower horizontally and sits above the main tenon).
          Looking at the apron from the end: you see the apron's thickness ×
          apron's width, and the tenon+haunch as solid fill inside. */}
      {(() => {
        const xsX = cAx + cBodyLen + PX(tl) + 70;
        const xsY = cAy + PX(cw) / 2 - PX(ct) * 2; // roughly centered vertically
        const xsCw = PX(ct) * 1.6; // apron cross-section width (= board thickness, horizontal)
        const xsCh = PX(cw);       // apron cross-section height (= board width, vertical)
        // Main tenon window inside cross-section — centered horizontally
        const tenonXsW = PX(tt);
        const tenonXsH = PX(tw);
        // Haunch cross-section — same horizontal width as main tenon, height = topGap
        const haunchXsH = PX(topGap);
        return (
          <g>
            {/* Dashed outline of apron end face */}
            <rect
              x={xsX}
              y={xsY}
              width={xsCw}
              height={xsCh}
              fill="none"
              stroke={COLOR_OUTLINE}
              strokeDasharray="4 2"
            />
            {/* Main tenon cross-section (solid) — in the middle vertical band */}
            <rect
              x={xsX + (xsCw - tenonXsW) / 2}
              y={xsY + PX(bottomGap)}
              width={tenonXsW}
              height={tenonXsH}
              fill={COLOR_TENON}
              stroke={COLOR_OUTLINE}
            />
            {/* Haunch cross-section — at the TOP of the end face, same width as main tenon */}
            {haunchXsH > 0 && (
              <rect
                x={xsX + (xsCw - tenonXsW) / 2}
                y={xsY}
                width={tenonXsW}
                height={haunchXsH}
                fill={COLOR_TENON}
                stroke={COLOR_OUTLINE}
              />
            )}
            <text
              x={xsX + xsCw / 2}
              y={xsY + xsCh + 14}
              fontSize={9}
              textAnchor="middle"
              fill="#666"
            >
              端面剖面
            </text>
            <DimLine
              x1={xsX}
              y1={xsY + xsCh + 26}
              x2={xsX + xsCw}
              y2={xsY + xsCh + 26}
              label={`板厚 ${ct}`}
              side="bottom"
            />
            <DimLine
              x1={xsX + (xsCw - tenonXsW) / 2}
              y1={xsY - 4}
              x2={xsX + (xsCw + tenonXsW) / 2}
              y2={xsY - 4}
              label={`榫厚 ${tt}`}
              side="top"
            />
          </g>
        );
      })()}

      {/* ========= ASSEMBLED (top-down cross-section) ========= */}
      <text x={asmOriginX} y={18} fontSize={11} fontWeight="bold" fill={COLOR_OUTLINE}>
        組合剖面（上視切面）
      </text>

      <g>
        {/* Leg cross-section (hatched square) */}
        <rect
          x={asmOriginX + 20}
          y={mAy}
          width={PX(mt) * 2}
          height={PX(mt)}
          fill="url(#hatch-shouldered)"
          stroke={COLOR_OUTLINE}
        />
        {/* Main tenon inside leg */}
        <rect
          x={asmOriginX + 20 + PX(mt) * 2 - PX(tl)}
          y={mAy + PX(mt) / 2 - PX(tt) / 2}
          width={PX(tl)}
          height={PX(tt)}
          fill={COLOR_TENON}
          stroke={COLOR_OUTLINE}
        />
        {/* Apron body extending right */}
        <rect
          x={asmOriginX + 20 + PX(mt) * 2}
          y={mAy + PX(mt) / 2 - PX(ct) / 2}
          width={PX(ct) * 4}
          height={PX(ct)}
          fill={COLOR_TENON}
          stroke={COLOR_OUTLINE}
        />
        {/* 45° 格肩 miter 線：腳柱外角到牙板上緣，明式格肩的標誌 */}
        <line
          x1={asmOriginX + 20 + PX(mt) * 2}
          y1={mAy}
          x2={asmOriginX + 20 + PX(mt) * 2 + 14}
          y2={mAy + 14}
          stroke="#a85"
          strokeWidth={1.5}
        />
        <text
          x={asmOriginX + 20 + PX(mt) * 2 + 16}
          y={mAy + 10}
          fontSize={8}
          fill="#a85"
        >
          45° 格肩線
        </text>
        <text
          x={asmOriginX + 20 + PX(mt)}
          y={mAy + PX(mt) + 16}
          fontSize={9}
          textAnchor="middle"
          fill="#666"
        >
          主榫藏於柱腳，上方肩榫防旋轉，外角 45° 格肩
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
 *
 *   Drawer-corner convention:
 *     - 抽屜面板 (drawer front, in template: child, has tenons)
 *         = PIN BOARD: pins (narrow-outside, wide-inside trapezoids) on its end
 *     - 抽屜側板 (drawer side, in template: mother, has mortises)
 *         = TAIL BOARD: tails (wide-outside, narrow-inside trapezoids) on its end
 *
 *   Earlier the mother was rendered as the pin board — traditionally it
 *   should be the tail board, so the roles have been swapped here.
 * ============================================================ */
function DovetailDetail(p: JoineryDetailParams) {
  const tl = p.tenonLength;
  const tw = p.tenonWidth;
  void tw;
  const tt = p.tenonThickness;
  const ct = p.childThickness ?? tt;
  const mt = p.motherThickness;
  void mt;

  // Typical drawer: 3 tails and 4 pins (pins = tails + 1 so the corners of
  // the joint are always pins, not tails — pins catch the outside pull force).
  const N_TAILS = 3;
  const N_PINS = N_TAILS + 1;

  // Exaggerated visual taper — real angle is 1:6 to 1:8 (~7–10°) but at
  // this render scale that reads as nearly rectangular. Push to ~1:3 so
  // the trapezoid is unambiguous. The dim label still states standard 1:8.
  const s = fitScale(Math.max(tl * 6, 80), 180);
  const PX = (mm: number) => mm * s;

  const pieceDepth = PX(tl);
  const pieceLen = Math.max(200, PX(ct) * 6);
  const bodyExt = pieceDepth * 1.0;

  const dtAngleHOffset = pieceDepth * 0.35;

  const tailW = pieceLen / (N_TAILS + 0.55 * N_PINS);
  const pinW = tailW * 0.55;

  const leftPad = 40;
  const gap = 50;
  const expW = pieceLen * 2 + gap;
  const asmW = pieceLen * 0.9 + pieceDepth + 30;
  const w = expW + asmW + PADDING * 3 + leftPad;
  const h = pieceDepth + bodyExt + 80;

  // Mother = TAIL board (left)
  const mAx = PADDING + leftPad;
  const mAy = PADDING + 20;
  const mBodyTop = mAy + pieceDepth;
  const mBodyBot = mBodyTop + bodyExt;

  // Child = PIN board (right)
  const cAx = mAx + pieceLen + gap;
  const cAy = mAy;

  const asmX = mAx + expW + PADDING;
  const asmY = mAy;

  // Tail shape: solid wood sticking out of end. Wider at outside (top in our
  // drawing, away from body) than at body side. Shape: △
  const tailPath = (cx: number, yBottom: number, yTop: number) => {
    const halfBot = tailW / 2 - dtAngleHOffset;
    const halfTop = tailW / 2;
    return `M${cx - halfBot} ${yBottom} L${cx - halfTop} ${yTop} L${cx + halfTop} ${yTop} L${cx + halfBot} ${yBottom} Z`;
  };

  // Pin shape: solid wood sticking out of end. Wider at body side (bottom),
  // narrower at outside (top). Shape: ▽
  const pinPath = (cx: number, yBottom: number, yTop: number) => {
    const halfBot = pinW / 2;
    const halfTop = halfBot - dtAngleHOffset;
    return `M${cx - halfBot} ${yBottom} L${cx - halfTop} ${yTop} L${cx + halfTop} ${yTop} L${cx + halfBot} ${yBottom} Z`;
  };

  // Tail centers (N_TAILS) are placed on the mother board
  const totalMotherFeatures = N_TAILS * tailW + (N_TAILS + 1) * pinW;
  const mMargin = (pieceLen - totalMotherFeatures) / 2;
  const tailCenters: number[] = [];
  {
    let x = mAx + mMargin + pinW + tailW / 2; // leading pin-socket, then tail
    for (let i = 0; i < N_TAILS; i++) {
      tailCenters.push(x);
      x += tailW + pinW;
    }
  }
  // Pin centers (N_PINS) on the child board
  const pinCenters: number[] = [];
  {
    let x = cAx + mMargin + pinW / 2;
    for (let i = 0; i < N_PINS; i++) {
      pinCenters.push(x);
      x += pinW + tailW;
    }
  }

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      style={{ maxWidth: "720px" }}
      className="bg-white"
    >
      <defs>
        <Hatching id="hatch-dt" color="#7a5a2c" />
      </defs>

      <text x={PADDING} y={18} fontSize={11} fontWeight="bold" fill={COLOR_OUTLINE}>
        分解圖（兩片板端面對端面）
      </text>

      {/* MOTHER (tail board — drawer side) */}
      <g>
        <rect
          x={mAx}
          y={mBodyTop}
          width={pieceLen}
          height={bodyExt}
          fill={COLOR_MORTISE}
          stroke={COLOR_OUTLINE}
        />
        {/* tails sticking up from the end — wide at top (outside), narrow at bottom */}
        {tailCenters.map((cx, i) => (
          <path
            key={i}
            d={tailPath(cx, mBodyTop, mAy)}
            fill={COLOR_MORTISE}
            stroke={COLOR_OUTLINE}
          />
        ))}
        <text
          x={mAx + pieceLen / 2}
          y={mBodyBot + 14}
          fontSize={9}
          textAnchor="middle"
          fill="#666"
        >
          母件（尾板，{N_TAILS} 個尾；抽屜側板）
        </text>
        <DimLine
          x1={mAx - 10}
          y1={mAy}
          x2={mAx - 10}
          y2={mBodyTop}
          label={`榫深 ${tl}`}
          side="left"
        />
        <text x={mAx} y={mAy - 6} fontSize={8} fill="#999">
          ← 尾面（寬）
        </text>
      </g>

      {/* CHILD (pin board — drawer front) */}
      <g>
        <rect
          x={cAx}
          y={mBodyTop}
          width={pieceLen}
          height={bodyExt}
          fill={COLOR_TENON}
          stroke={COLOR_OUTLINE}
        />
        {/* pins sticking up from the end — narrow at top (outside), wide at bottom */}
        {pinCenters.map((cx, i) => (
          <path
            key={i}
            d={pinPath(cx, mBodyTop, mAy)}
            fill={COLOR_TENON}
            stroke={COLOR_OUTLINE}
          />
        ))}
        <text
          x={cAx + pieceLen / 2}
          y={mBodyBot + 14}
          fontSize={9}
          textAnchor="middle"
          fill="#666"
        >
          公件（銷板，{N_PINS} 個銷；抽屜面板）
        </text>
        <text x={cAx} y={mAy - 6} fontSize={8} fill="#999">
          ← 銷面（窄）
        </text>
      </g>

      {/* ASSEMBLED L-corner */}
      <text
        x={asmX}
        y={18}
        fontSize={11}
        fontWeight="bold"
        fill={COLOR_OUTLINE}
      >
        組合（L 型轉角）
      </text>
      <g>
        {/* horizontal tail board (top of corner) */}
        <rect
          x={asmX}
          y={asmY}
          width={pieceLen * 0.9}
          height={pieceDepth}
          fill={COLOR_TENON}
          stroke={COLOR_OUTLINE}
        />
        {/* vertical pin board (side of corner) */}
        <rect
          x={asmX + pieceLen * 0.9}
          y={asmY}
          width={pieceDepth}
          height={pieceLen * 0.7}
          fill="url(#hatch-dt)"
          stroke={COLOR_OUTLINE}
        />
        {/* interlock zigzag at corner (dashed — interior sockets hidden) */}
        <g stroke={COLOR_OUTLINE} fill="none" strokeWidth={0.8} strokeDasharray="2 2">
          {Array.from({ length: N_PINS + N_TAILS }).map((_, i) => {
            const y = asmY + (pieceDepth / (N_PINS + N_TAILS + 1)) * (i + 1);
            return (
              <line
                key={i}
                x1={asmX + pieceLen * 0.9 - pinW * 0.3}
                y1={y}
                x2={asmX + pieceLen * 0.9 + pieceDepth}
                y2={y}
              />
            );
          })}
        </g>
        <text
          x={asmX + pieceLen * 0.45}
          y={asmY + pieceDepth + 16}
          fontSize={9}
          textAnchor="middle"
          fill="#666"
        >
          梯形咬合，抽屜前後板常用
        </text>
      </g>
    </svg>
  );
}

/* ============================================================
 * 明式進階榫卯（Ming-style advanced）—— 概念圖，凸顯關鍵幾何而非工程精度
 *
 * 共用設計：
 *   - 左側分解圖（exploded） + 右側組合剖面（assembled）
 *   - 用 schematic 比例（不嚴格按 mm），但保留榫長 / 母厚 / 板厚的相對大小
 *   - 標註重點尺寸與該榫的「明式 know-how」字句
 * ============================================================ */

/* ─── 抱肩榫 clamping-shoulder ───
 * 三件互鎖：腳柱頂端 / 束腰 / 牙板。
 * 腳柱開三角形榫眼（45° 內斜），牙板上端有 45° 斜肩 + 主榫，
 * 束腰夾在中間。難度 ★★★★★
 */
function ClampingShoulderDetail(p: JoineryDetailParams) {
  const tw = p.tenonWidth;
  const tt = p.tenonThickness;
  const mt = p.motherThickness;
  const ct = p.childThickness ?? tt;
  const cw = p.childWidth ?? tw;
  const tl = p.tenonLength;

  const w = 720;
  const h = 320;

  // Exploded 分解圖（左半）
  const eX = 30;
  const eY = 50;

  // 腳柱（leg）— 垂直長條
  const legW = 56;
  const legH = 220;
  const legX = eX;
  const legY = eY;

  // 三角形榫眼（45° 切角）位於腳柱頂端內側
  const sockH = 70;
  const sockW = legW * 0.65;
  // 三角形：起點在腳柱右上角內側、向下延伸 + 45° 斜下到內側面
  const sockX = legX + (legW - sockW);
  const sockY = legY + 28;

  // 束腰（waist rail）— 細長橫條，原本位置在腳柱右側
  const waistW = 130;
  const waistH = 22;
  const waistX = legX + legW + 24;
  const waistY = legY + 30;

  // 牙板（apron）— 較高的橫板，下方有 45° 斜肩 + 主榫
  const apronW = 130;
  const apronH = 90;
  const apronX = waistX;
  const apronY = waistY + waistH + 6;

  // 牙板末端（左邊）有 45° 斜肩 + 主榫舌
  const tongueLen = 22;
  const miterDepth = 16;

  // Assembled 組合剖面（右半）
  const aX = 360;
  const aY = 50;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      style={{ maxWidth: "720px" }}
      className="bg-white"
    >
      <defs>
        <Hatching id="hatch-cs" color="#7a5a2c" />
      </defs>

      {/* ===== 分解圖 ===== */}
      <text x={eX} y={20} fontSize={11} fontWeight="bold" fill={COLOR_OUTLINE}>
        分解圖（束腰桌腳-束腰-牙板）
      </text>
      <text x={eX} y={36} fontSize={9} fill="#888">
        三件互鎖，全靠 45° 斜肩定位，無膠也不脫
      </text>

      {/* 腳柱 */}
      <rect x={legX} y={legY} width={legW} height={legH} fill={COLOR_MORTISE} stroke={COLOR_OUTLINE} />
      <text x={legX + legW / 2} y={legY + legH + 14} fontSize={9} textAnchor="middle" fill="#666">
        腳柱
      </text>
      {/* 三角形榫眼（45° 內斜） */}
      <polygon
        points={`${sockX},${sockY} ${sockX + sockW},${sockY} ${sockX + sockW},${sockY + sockH} ${sockX},${sockY + sockH - sockW * 0.6}`}
        fill="white"
        stroke={COLOR_OUTLINE}
        strokeDasharray="3 2"
      />
      <text
        x={sockX + sockW / 2}
        y={sockY + sockH / 2}
        fontSize={8}
        textAnchor="middle"
        fill="#a85"
      >
        三角榫眼
      </text>

      {/* 束腰 */}
      <rect x={waistX} y={waistY} width={waistW} height={waistH} fill={COLOR_TENON} stroke={COLOR_OUTLINE} />
      <text x={waistX + waistW + 6} y={waistY + waistH / 2 + 3} fontSize={9} fill="#666">
        束腰
      </text>

      {/* 牙板：本體 + 左端 45° 斜肩 + 主榫舌 */}
      <g>
        {/* 牙板本體（含斜肩切口） */}
        <polygon
          points={`
            ${apronX + miterDepth},${apronY}
            ${apronX + apronW},${apronY}
            ${apronX + apronW},${apronY + apronH}
            ${apronX},${apronY + apronH}
            ${apronX},${apronY + miterDepth}
          `}
          fill={COLOR_TENON}
          stroke={COLOR_OUTLINE}
        />
        {/* 主榫舌（向左伸出） */}
        <rect
          x={apronX - tongueLen}
          y={apronY + apronH * 0.4}
          width={tongueLen}
          height={apronH * 0.35}
          fill={COLOR_TENON}
          stroke={COLOR_OUTLINE}
        />
        <text x={apronX + apronW + 6} y={apronY + apronH / 2 + 3} fontSize={9} fill="#666">
          牙板
        </text>
        <text
          x={apronX - tongueLen - 4}
          y={apronY + apronH * 0.4 - 3}
          fontSize={8}
          textAnchor="end"
          fill="#a85"
        >
          主榫
        </text>
        {/* 45° 斜肩標註 */}
        <text x={apronX + miterDepth + 4} y={apronY - 4} fontSize={8} fill="#a85">
          45° 斜肩
        </text>
      </g>

      {/* ===== 組合剖面 ===== */}
      <text x={aX} y={20} fontSize={11} fontWeight="bold" fill={COLOR_OUTLINE}>
        組合剖面
      </text>
      <text x={aX} y={36} fontSize={9} fill="#888">
        牙板斜肩貼住腳柱榫眼斜面，束腰嵌入上方溝
      </text>

      {/* 腳柱 + 嵌入的束腰、牙板 */}
      <g>
        {/* 腳柱（含已開三角榫眼的剖面） */}
        <polygon
          points={`
            ${aX},${aY}
            ${aX + legW},${aY}
            ${aX + legW},${aY + 28}
            ${aX + 18},${aY + 28}
            ${aX + 18},${aY + 28 + sockH}
            ${aX + legW},${aY + 28 + sockH + 4}
            ${aX + legW},${aY + legH}
            ${aX},${aY + legH}
          `}
          fill={COLOR_MORTISE}
          stroke={COLOR_OUTLINE}
        />
        {/* 束腰嵌入 */}
        <rect
          x={aX + 18}
          y={aY + 30}
          width={waistW + 14}
          height={waistH}
          fill={COLOR_TENON}
          stroke={COLOR_OUTLINE}
        />
        {/* 牙板嵌入：含斜肩 + 主榫 */}
        <polygon
          points={`
            ${aX + 18 + miterDepth},${aY + 28 + waistH + 6}
            ${aX + 18 + waistW + 14},${aY + 28 + waistH + 6}
            ${aX + 18 + waistW + 14},${aY + 28 + waistH + 6 + apronH}
            ${aX + 18},${aY + 28 + waistH + 6 + apronH}
            ${aX + 18},${aY + 28 + waistH + 6 + miterDepth}
          `}
          fill={COLOR_TENON}
          stroke={COLOR_OUTLINE}
        />
        {/* 主榫深入腳柱 */}
        <rect
          x={aX + 4}
          y={aY + 28 + waistH + 6 + apronH * 0.4}
          width={14}
          height={apronH * 0.35}
          fill={COLOR_TENON}
          stroke={COLOR_OUTLINE}
          strokeDasharray="3 2"
        />
      </g>

      <text x={aX} y={h - 10} fontSize={9} fill="#666">
        ★★★★★ 純手工放樣，王世襄《明式家具研究》圖 7-1
      </text>

      {/* 關鍵尺寸 */}
      <text x={eX} y={h - 22} fontSize={9} fill="#0a4d8c">
        牙板厚 {ct}mm · 主榫長 {tl}mm · 腳柱寬 {mt}mm · 榫頭 {tw}×{tt}mm
      </text>
      <text x={eX} y={h - 8} fontSize={9} fill="#666">
        cw={cw}mm（牙板寬）
      </text>
    </svg>
  );
}

/* ─── 粽角榫 three-way-mitered ───
 * 三件 45° 在一個角點相會（頂面板邊 + 側面板邊 + 腳柱頂）。
 * 從外面看像「粽子角」全 45° 線。
 */
function ThreeWayMiteredDetail(p: JoineryDetailParams) {
  const w = 720;
  const h = 300;

  const eX = 30;
  const eY = 60;
  const aX = 380;
  const aY = 60;

  const memberThk = 28;
  const memberLen = 130;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      style={{ maxWidth: "720px" }}
      className="bg-white"
    >
      <text x={eX} y={20} fontSize={11} fontWeight="bold" fill={COLOR_OUTLINE}>
        分解圖（三件 45° 切角）
      </text>
      <text x={eX} y={36} fontSize={9} fill="#888">
        頂板 + 側板 + 腳柱頂，各自切 45° 後相互嵌合
      </text>

      {/* 三件分解 — 用 isometric-ish 排列 */}
      {/* 件 A：頂板（橫向） */}
      <polygon
        points={`
          ${eX},${eY}
          ${eX + memberLen},${eY}
          ${eX + memberLen - memberThk},${eY + memberThk}
          ${eX + memberThk},${eY + memberThk}
        `}
        fill={COLOR_MORTISE}
        stroke={COLOR_OUTLINE}
      />
      <text x={eX + memberLen / 2} y={eY - 4} fontSize={9} textAnchor="middle" fill="#666">
        頂面板（A）
      </text>

      {/* 件 B：側板（垂直） */}
      <polygon
        points={`
          ${eX},${eY + 60}
          ${eX + memberThk},${eY + 60 + memberThk}
          ${eX + memberThk},${eY + 60 + memberLen}
          ${eX},${eY + 60 + memberLen - memberThk}
        `}
        fill={COLOR_MORTISE}
        stroke={COLOR_OUTLINE}
      />
      <text x={eX + memberThk + 6} y={eY + 60 + memberLen / 2} fontSize={9} fill="#666">
        側板（B）
      </text>

      {/* 件 C：腳柱頂（從 z 軸過來，畫成傾斜方塊） */}
      <polygon
        points={`
          ${eX + 90},${eY + 60}
          ${eX + 90 + memberThk * 1.3},${eY + 60 + memberThk * 0.5}
          ${eX + 90 + memberThk * 1.3},${eY + 60 + memberThk * 0.5 + memberLen}
          ${eX + 90},${eY + 60 + memberLen}
        `}
        fill={COLOR_MORTISE}
        stroke={COLOR_OUTLINE}
      />
      <text x={eX + 90 + memberThk + 6} y={eY + 60 + memberLen / 2} fontSize={9} fill="#666">
        腳柱頂（C）
      </text>

      {/* 45° 切角線示意 */}
      <line
        x1={eX + memberThk}
        y1={eY + memberThk}
        x2={eX + memberThk + 30}
        y2={eY + memberThk + 30}
        stroke="#a85"
        strokeWidth={1.2}
        strokeDasharray="4 3"
      />
      <text x={eX + memberThk + 36} y={eY + memberThk + 36} fontSize={8} fill="#a85">
        45° 切口
      </text>

      {/* ===== 組合剖面：三件相會於右上角點 ===== */}
      <text x={aX} y={20} fontSize={11} fontWeight="bold" fill={COLOR_OUTLINE}>
        組合（三向 45° 相會於角點）
      </text>
      <text x={aX} y={36} fontSize={9} fill="#888">
        外觀只看到三條 45° 線從同一點發散，明式櫃頂特徵
      </text>

      {/* 一個 isometric corner cube */}
      <g>
        {/* Top face (rhombus) */}
        <polygon
          points={`
            ${aX + 80},${aY}
            ${aX + 160},${aY + 30}
            ${aX + 80},${aY + 60}
            ${aX},${aY + 30}
          `}
          fill={COLOR_TENON}
          stroke={COLOR_OUTLINE}
        />
        {/* Right face */}
        <polygon
          points={`
            ${aX + 160},${aY + 30}
            ${aX + 160},${aY + 130}
            ${aX + 80},${aY + 160}
            ${aX + 80},${aY + 60}
          `}
          fill={COLOR_MORTISE}
          stroke={COLOR_OUTLINE}
        />
        {/* Left face */}
        <polygon
          points={`
            ${aX},${aY + 30}
            ${aX + 80},${aY + 60}
            ${aX + 80},${aY + 160}
            ${aX},${aY + 130}
          `}
          fill={COLOR_HIDDEN}
          stroke={COLOR_OUTLINE}
        />
        {/* 三條 45° 切角線 — 從中心點向外延伸 */}
        <line
          x1={aX + 80}
          y1={aY + 60}
          x2={aX + 80}
          y2={aY}
          stroke="#a85"
          strokeWidth={1.4}
        />
        <line
          x1={aX + 80}
          y1={aY + 60}
          x2={aX + 160}
          y2={aY + 30}
          stroke="#a85"
          strokeWidth={1.4}
        />
        <line
          x1={aX + 80}
          y1={aY + 60}
          x2={aX}
          y2={aY + 30}
          stroke="#a85"
          strokeWidth={1.4}
        />
        <circle cx={aX + 80} cy={aY + 60} r={3} fill="#a85" />
        <text x={aX + 168} y={aY + 24} fontSize={9} fill="#a85">
          三線一點
        </text>
      </g>

      <text x={aX} y={h - 12} fontSize={9} fill="#666">
        ★★★★★ 三向 45° 必須完全對齊，常見小櫃、香几頂角
      </text>
      <text x={eX} y={h - 12} fontSize={9} fill="#0a4d8c">
        構材厚 {p.motherThickness}mm；三件規格相等
      </text>
    </svg>
  );
}

/* ─── 夾頭榫 clamping-tenon-frame ───
 * 案桌（平頭/翹頭案）腳柱穿過面框、再夾住牙板。
 * 腳上端開大榫眼，牙板有鳩尾形雙榫從兩側插入並收緊。
 */
function ClampingTenonFrameDetail(p: JoineryDetailParams) {
  const tw = p.tenonWidth;
  const tt = p.tenonThickness;
  const mt = p.motherThickness;
  const tl = p.tenonLength;

  const w = 720;
  const h = 300;

  const eX = 30;
  const eY = 50;

  const legW = 50;
  const legH = 220;
  // 腳柱頂端有大型方榫眼 + 兩側夾住牙板
  const slotY = eY + 50;
  const slotH = 90;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      style={{ maxWidth: "720px" }}
      className="bg-white"
    >
      <text x={eX} y={20} fontSize={11} fontWeight="bold" fill={COLOR_OUTLINE}>
        分解圖（案桌腳-面框-牙板）
      </text>
      <text x={eX} y={36} fontSize={9} fill="#888">
        腳穿面框、再從兩側夾住牙板
      </text>

      {/* 腳柱（中央） */}
      <g>
        <rect x={eX + 50} y={eY} width={legW} height={legH} fill={COLOR_MORTISE} stroke={COLOR_OUTLINE} />
        {/* 腳頂的「夾口」溝 */}
        <rect
          x={eX + 50 - 18}
          y={slotY}
          width={legW + 36}
          height={slotH}
          fill="white"
          stroke={COLOR_OUTLINE}
          strokeDasharray="3 2"
        />
        <text x={eX + 50 + legW / 2} y={eY + legH + 14} fontSize={9} textAnchor="middle" fill="#666">
          腳柱（含夾口）
        </text>
        <text x={eX + 50 - 22} y={slotY + slotH / 2 + 3} fontSize={8} textAnchor="end" fill="#a85">
          夾口
        </text>
      </g>

      {/* 牙板（從腳左邊插入） */}
      <g>
        <polygon
          points={`
            ${eX + 180},${slotY + 8}
            ${eX + 280},${slotY + 8}
            ${eX + 280},${slotY + slotH - 8}
            ${eX + 180},${slotY + slotH - 8}
            ${eX + 168},${slotY + slotH / 2}
          `}
          fill={COLOR_TENON}
          stroke={COLOR_OUTLINE}
        />
        <text x={eX + 230} y={slotY + slotH + 14} fontSize={9} textAnchor="middle" fill="#666">
          牙板（鳩尾雙榫）
        </text>
        <text x={eX + 162} y={slotY + slotH / 2 + 3} fontSize={8} textAnchor="end" fill="#a85">
          鳩尾收緊
        </text>
      </g>

      {/* ===== 組合剖面 ===== */}
      <text x={400} y={20} fontSize={11} fontWeight="bold" fill={COLOR_OUTLINE}>
        組合剖面
      </text>
      <text x={400} y={36} fontSize={9} fill="#888">
        牙板鳩尾從腳兩側嵌入夾口，受力越大夾越緊
      </text>

      <g>
        <rect x={400 + 50} y={eY} width={legW} height={legH} fill={COLOR_MORTISE} stroke={COLOR_OUTLINE} />
        {/* 牙板（穿過腳兩側） */}
        <polygon
          points={`
            ${400 + 10},${slotY + 8}
            ${400 + 50 + legW + 60},${slotY + 8}
            ${400 + 50 + legW + 60},${slotY + slotH - 8}
            ${400 + 10},${slotY + slotH - 8}
          `}
          fill={COLOR_TENON}
          stroke={COLOR_OUTLINE}
        />
        {/* 鳩尾收緊角度（內側） */}
        <line
          x1={400 + 50 - 6}
          y1={slotY + 8}
          x2={400 + 50 + 6}
          y2={slotY + slotH - 8}
          stroke="#a85"
          strokeWidth={1}
          strokeDasharray="3 2"
        />
        <line
          x1={400 + 50 + legW + 6}
          y1={slotY + 8}
          x2={400 + 50 + legW - 6}
          y2={slotY + slotH - 8}
          stroke="#a85"
          strokeWidth={1}
          strokeDasharray="3 2"
        />
      </g>

      <text x={400} y={h - 12} fontSize={9} fill="#666">
        ★★★★ 平頭案、翹頭案的腳-牙板鎖法
      </text>
      <text x={eX} y={h - 12} fontSize={9} fill="#0a4d8c">
        腳寬 {mt}mm · 榫長 {tl}mm · 牙板榫 {tw}×{tt}mm
      </text>
    </svg>
  );
}

/* ─── 攢邊打槽裝板 frame-and-panel ───
 * 四邊框 45° 接合（或大格肩），內側開槽；心板四邊削薄成舌嵌入。
 * 板可隨季節脹縮，最常見於桌面、椅面、櫃門、抽屜底。
 */
function FrameAndPanelDetail(p: JoineryDetailParams) {
  const tt = p.tenonThickness;
  const ct = p.childThickness ?? tt;

  const w = 720;
  const h = 320;

  const eX = 30;
  const eY = 50;

  // 框 + 心板的「俯視圖」
  const frameW = 280;
  const frameH = 180;
  const railW = 32; // 邊框寬度

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      style={{ maxWidth: "720px" }}
      className="bg-white"
    >
      <defs>
        <Hatching id="hatch-fp" color="#7a5a2c" />
      </defs>

      <text x={eX} y={20} fontSize={11} fontWeight="bold" fill={COLOR_OUTLINE}>
        俯視圖（框 + 心板）
      </text>
      <text x={eX} y={36} fontSize={9} fill="#888">
        四邊框內側開槽，心板浮裝於槽中（不上膠，可漲縮）
      </text>

      {/* 外框 */}
      <rect x={eX} y={eY} width={frameW} height={frameH} fill={COLOR_MORTISE} stroke={COLOR_OUTLINE} />
      {/* 內側心板區 */}
      <rect
        x={eX + railW}
        y={eY + railW}
        width={frameW - 2 * railW}
        height={frameH - 2 * railW}
        fill={COLOR_TENON}
        stroke={COLOR_OUTLINE}
      />
      {/* 四角 45° 對角線 */}
      <line
        x1={eX}
        y1={eY}
        x2={eX + railW}
        y2={eY + railW}
        stroke={COLOR_OUTLINE}
      />
      <line
        x1={eX + frameW}
        y1={eY}
        x2={eX + frameW - railW}
        y2={eY + railW}
        stroke={COLOR_OUTLINE}
      />
      <line
        x1={eX}
        y1={eY + frameH}
        x2={eX + railW}
        y2={eY + frameH - railW}
        stroke={COLOR_OUTLINE}
      />
      <line
        x1={eX + frameW}
        y1={eY + frameH}
        x2={eX + frameW - railW}
        y2={eY + frameH - railW}
        stroke={COLOR_OUTLINE}
      />
      <text x={eX + frameW / 2} y={eY + frameH / 2 + 3} fontSize={10} textAnchor="middle" fill="#5a3">
        心板（floating）
      </text>
      <text x={eX + railW / 2} y={eY + frameH / 2 + 3} fontSize={8} textAnchor="middle" fill="#fff">
        框
      </text>

      {/* ===== 右側：剖面圖 ===== */}
      <text x={380} y={20} fontSize={11} fontWeight="bold" fill={COLOR_OUTLINE}>
        剖面（穿過邊框 + 心板）
      </text>
      <text x={380} y={36} fontSize={9} fill="#888">
        框開凹槽、心板舌嵌入，留 1–2mm 漲縮餘量
      </text>

      {(() => {
        const sX = 380;
        const sY = 60;
        return (
          <g>
            {/* 左邊框剖面 */}
            <rect x={sX} y={sY} width={50} height={60} fill={COLOR_MORTISE} stroke={COLOR_OUTLINE} />
            <rect x={sX + 50 - 14} y={sY + 22} width={14} height={16} fill="white" stroke={COLOR_OUTLINE} strokeDasharray="3 2" />
            <text x={sX + 25} y={sY + 76} fontSize={9} textAnchor="middle" fill="#666">
              邊框
            </text>
            {/* 心板（中間） */}
            <rect x={sX + 50} y={sY + 22} width={120} height={16} fill={COLOR_TENON} stroke={COLOR_OUTLINE} />
            <rect x={sX + 50 - 14} y={sY + 22} width={14} height={16} fill={COLOR_TENON} stroke={COLOR_OUTLINE} strokeDasharray="2 2" />
            <text x={sX + 110} y={sY + 76} fontSize={9} textAnchor="middle" fill="#666">
              心板（厚 {ct}mm）
            </text>
            {/* 右邊框 */}
            <rect x={sX + 170} y={sY} width={50} height={60} fill={COLOR_MORTISE} stroke={COLOR_OUTLINE} />
            <rect x={sX + 170} y={sY + 22} width={14} height={16} fill="white" stroke={COLOR_OUTLINE} strokeDasharray="3 2" />
            <rect x={sX + 170} y={sY + 22} width={14} height={16} fill={COLOR_TENON} stroke={COLOR_OUTLINE} strokeDasharray="2 2" />
            {/* 漲縮餘量標註 */}
            <text x={sX + 110} y={sY + 12} fontSize={8} textAnchor="middle" fill="#a85">
              ← 預留 1–2mm 漲縮 →
            </text>
          </g>
        );
      })()}

      <text x={380} y={h - 12} fontSize={9} fill="#666">
        ★★★ 中式桌面、椅面、門板、抽屜底全用此法
      </text>
      <text x={eX} y={h - 12} fontSize={9} fill="#0a4d8c">
        舌厚 ≈ 板厚 / 3 = {Math.round(ct / 3)}mm
      </text>
    </svg>
  );
}

/* ─── 走馬銷 sliding-dovetail ───
 * 一支「鳩尾鍵」從側面滑入榫槽，可拆，無膠不脫。
 * 用於可拆零件、抽屜面板加固。
 */
function SlidingDovetailDetail(p: JoineryDetailParams) {
  const w = 720;
  const h = 280;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ maxWidth: "720px" }} className="bg-white">
      <text x={30} y={20} fontSize={11} fontWeight="bold" fill={COLOR_OUTLINE}>
        分解圖（鳩尾鍵 + 槽）
      </text>
      <text x={30} y={36} fontSize={9} fill="#888">
        鍵為梯形剖面，從側面滑入，越往內越緊
      </text>

      {/* 母板（含鳩尾槽） */}
      <g>
        <rect x={30} y={60} width={300} height={70} fill={COLOR_MORTISE} stroke={COLOR_OUTLINE} />
        {/* 鳩尾槽（內寬 < 外寬） */}
        <polygon
          points={`
            60,80
            300,80
            290,110
            70,110
          `}
          fill="white"
          stroke={COLOR_OUTLINE}
          strokeDasharray="3 2"
        />
        <text x={180} y={150} fontSize={9} textAnchor="middle" fill="#666">
          母板（含鳩尾槽，深 8–10mm）
        </text>
      </g>

      {/* 鳩尾鍵（獨立件） */}
      <g>
        <polygon
          points={`
            30,180
            330,180
            320,220
            40,220
          `}
          fill={COLOR_TENON}
          stroke={COLOR_OUTLINE}
        />
        <text x={180} y={245} fontSize={9} textAnchor="middle" fill="#666">
          鳩尾鍵（梯形剖面，下底 &gt; 上底）
        </text>
      </g>

      {/* 組合：箭頭表示「滑入」方向 */}
      <g>
        <text x={400} y={20} fontSize={11} fontWeight="bold" fill={COLOR_OUTLINE}>
          組合（從側面滑入）
        </text>
        <text x={400} y={36} fontSize={9} fill="#888">
          可重複拆裝、無膠
        </text>
        <rect x={400} y={60} width={280} height={70} fill={COLOR_MORTISE} stroke={COLOR_OUTLINE} />
        <polygon
          points={`
            430,80
            670,80
            660,110
            440,110
          `}
          fill={COLOR_TENON}
          stroke={COLOR_OUTLINE}
        />
        <text
          x={690}
          y={97}
          fontSize={11}
          fill="#a85"
        >
          ←
        </text>
        <text
          x={400}
          y={97}
          fontSize={11}
          fill="#a85"
        >
          滑
        </text>
      </g>

      <text x={30} y={h - 12} fontSize={9} fill="#0a4d8c">
        鍵長 {p.tenonLength}mm · 鍵厚 {p.tenonThickness}mm · 鍵寬 {p.tenonWidth}mm
      </text>
      <text x={400} y={h - 12} fontSize={9} fill="#666">
        ★★★★ 抽屜可拆面板、椅座加固
      </text>
    </svg>
  );
}

/* ─── 霸王棖 king-strut ───
 * 從桌腳內側對角斜伸到桌面下緣，末端有勾頭卡進桌面下榫眼。
 * 大桌標配，增加抗變形能力。
 */
function KingStrutDetail(p: JoineryDetailParams) {
  const w = 720;
  const h = 320;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ maxWidth: "720px" }} className="bg-white">
      <text x={30} y={20} fontSize={11} fontWeight="bold" fill={COLOR_OUTLINE}>
        側視圖（桌腳 + 桌面下方）
      </text>
      <text x={30} y={36} fontSize={9} fill="#888">
        斜撐從腳內側勾住桌面，提供抗扭抗推力
      </text>

      {/* 桌面（俯視底面） */}
      <rect x={30} y={50} width={400} height={20} fill={COLOR_MORTISE} stroke={COLOR_OUTLINE} />
      {/* 桌面底部的勾頭榫眼 */}
      <rect x={300} y={70} width={18} height={10} fill="white" stroke={COLOR_OUTLINE} strokeDasharray="3 2" />
      <text x={309} y={94} fontSize={8} textAnchor="middle" fill="#a85">
        勾頭眼
      </text>

      {/* 桌腳（垂直） */}
      <rect x={50} y={70} width={36} height={210} fill={COLOR_MORTISE} stroke={COLOR_OUTLINE} />
      <text x={68} y={295} fontSize={9} textAnchor="middle" fill="#666">
        桌腳
      </text>

      {/* 霸王棖：斜撐 */}
      <g>
        <polygon
          points={`
            86,200
            96,210
            300,80
            290,72
          `}
          fill={COLOR_TENON}
          stroke={COLOR_OUTLINE}
        />
        {/* 末端勾頭 */}
        <polygon
          points={`
            290,72
            300,72
            300,80
          `}
          fill={COLOR_HIDDEN}
          stroke={COLOR_OUTLINE}
        />
        <text x={200} y={170} fontSize={10} textAnchor="middle" fill="#666" transform="rotate(-30 200 170)">
          霸王棖（斜撐）
        </text>
      </g>

      {/* 另一支對稱 */}
      <rect x={400} y={70} width={36} height={210} fill={COLOR_MORTISE} stroke={COLOR_OUTLINE} />
      <polygon
        points={`
          400,200
          410,210
          200,80
          210,72
        `}
        fill={COLOR_TENON}
        stroke={COLOR_OUTLINE}
        opacity={0.5}
      />

      {/* ===== 勾頭細節 ===== */}
      <text x={500} y={140} fontSize={11} fontWeight="bold" fill={COLOR_OUTLINE}>
        勾頭剖面
      </text>
      <text x={500} y={156} fontSize={9} fill="#888">
        斜撐末端鈎進桌面榫眼，自鎖
      </text>
      <g>
        <rect x={500} y={180} width={120} height={26} fill={COLOR_MORTISE} stroke={COLOR_OUTLINE} />
        <polygon
          points={`
            500,206
            550,260
            560,260
            560,236
            580,206
          `}
          fill={COLOR_TENON}
          stroke={COLOR_OUTLINE}
        />
        <text x={580} y={194} fontSize={8} fill="#a85">
          鈎口
        </text>
      </g>

      <text x={30} y={h - 8} fontSize={9} fill="#0a4d8c">
        斜撐料厚 {p.tenonThickness}mm × 寬 {p.tenonWidth}mm
      </text>
    </svg>
  );
}

const RENDERERS: Partial<
  Record<JoineryType, (p: JoineryDetailParams) => React.ReactElement>
> = {
  "through-tenon": ThroughTenonDetail,
  "blind-tenon": BlindTenonDetail,
  "shouldered-tenon": ShoulderedTenonDetail,
  "half-lap": HalfLapDetail,
  "tongue-and-groove": TongueAndGrooveDetail,
  dovetail: DovetailDetail,
  "clamping-shoulder": ClampingShoulderDetail,
  "three-way-mitered": ThreeWayMiteredDetail,
  "clamping-tenon-frame": ClampingTenonFrameDetail,
  "frame-and-panel": FrameAndPanelDetail,
  "sliding-dovetail": SlidingDovetailDetail,
  "king-strut": KingStrutDetail,
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
  "shouldered-tenon": "格肩榫（內肩 45°）",
  "half-lap": "半搭榫",
  dovetail: "鳩尾榫",
  "finger-joint": "指接榫",
  "tongue-and-groove": "企口榫",
  dowel: "圓棒榫",
  "mitered-spline": "斜接餅乾榫",
  "pocket-hole": "斜孔螺絲（口袋孔）",
  screw: "螺絲 + 白膠",
  "clamping-shoulder": "抱肩榫（束腰桌專用）",
  "three-way-mitered": "粽角榫（三向 45° 角）",
  "clamping-tenon-frame": "夾頭榫（案桌牙板鎖腳）",
  "frame-and-panel": "攢邊打槽裝板（框中浮裝心板）",
  "sliding-dovetail": "走馬銷（可拆滑鳩尾鍵）",
  "king-strut": "霸王棖（桌腳對角斜撐）",
};

export const JOINERY_DESCRIPTION: Record<JoineryType, string> = {
  "through-tenon": "榫頭穿過母件、可從另一面看到。強度最高，適合椅腳、桌腳重要結構。",
  "blind-tenon": "榫頭藏在母件內、外觀看不到。美觀，適合桌腳橫撐、櫃體等。",
  "shouldered-tenon": "主榫上方加肩榫（haunch），且公件外側肩呈 45° 斜面（明式格肩做法）。主榫扛拉力、肩防旋轉、45° 格肩讓接合處不見直角縫。桌腳↔牙板的明式標準。",
  "half-lap": "兩件各削一半厚度後相疊，搭肩固定。簡單常用於框架交叉。",
  dovetail: "梯形榫頭咬合，抗拉力極強。經典用於抽屜、箱體轉角。",
  "finger-joint": "對稱方齒交錯接合。常用於箱體、托盤轉角。",
  "tongue-and-groove": "一面凸舌、一面凹槽，板材拼寬常用。",
  dowel: "另插入圓棒做接合，工法簡單但強度較低。",
  "mitered-spline": "45° 斜接後插入餅乾片或薄木條補強。",
  "pocket-hole": "用斜孔器夾具鑽 15° 斜孔，再用專用螺絲從隱藏處鎖入。快速、不需榫卯的常見接合方式。",
  screw: "木工白膠 + 木螺絲直鎖。螺絲頭可埋頭並用木塞蓋住，最簡單。",
  "clamping-shoulder": "明式束腰桌的標準做法。腳柱頂端開三角形榫眼 + 45° 內斜，束腰夾在中間，牙板上端有 45° 斜肩 + 主榫，三件互鎖。難度極高，純手工。",
  "three-way-mitered": "三件構材（頂面板、側面板、腳柱頂）在角點以 45° 互切相會。常見於頂端封閉的小櫃、香几頂角。難度極高，三向角度必須完全對齊。",
  "clamping-tenon-frame": "案桌（平頭案／翹頭案）腳柱穿過面框、再從兩側夾住牙板（牙板呈鳩尾收緊）。腳上端開大榫眼，吃下牙板與面框的雙榫。明式經典。",
  "frame-and-panel": "四邊框內側開槽，心板四邊削薄成舌嵌入，板可隨季節脹縮但不被拘束。桌面、椅面、櫃門、抽屜底的標準做法。",
  "sliding-dovetail": "鍵狀鳩尾從側面滑入榫槽，不靠膠也不會脫落，但可以拆。明式抽屜面板加固、可拆裝零件常用。",
  "king-strut": "從桌腳內側對角斜伸到桌面下緣，末端有勾頭卡進桌面下的榫眼。增加大桌的抗變形能力，明式大桌標配。",
};

/**
 * 二級分級：basic = 西式 / 簡單中式（一般人也做得來）；
 *           ming  = 明式進階（高難度、純手工、需要精密放樣）。
 *
 * UI 用此資料分組顯示，提醒使用者「明式榫卯選了會難很多」。
 */
export type JoineryTier = "basic" | "ming";

export const JOINERY_TIER: Record<JoineryType, JoineryTier> = {
  "through-tenon": "basic",
  "blind-tenon": "basic",
  "shouldered-tenon": "basic", // 格肩 — 基礎中還算進階，但標 basic 因常見
  "half-lap": "basic",
  dovetail: "basic",
  "finger-joint": "basic",
  "tongue-and-groove": "basic",
  dowel: "basic",
  "mitered-spline": "basic",
  "pocket-hole": "basic",
  screw: "basic",
  "clamping-shoulder": "ming",
  "three-way-mitered": "ming",
  "clamping-tenon-frame": "ming",
  "frame-and-panel": "ming",
  "sliding-dovetail": "ming",
  "king-strut": "ming",
};

export const JOINERY_TIER_LABEL: Record<JoineryTier, string> = {
  basic: "基礎",
  ming: "明式進階",
};
