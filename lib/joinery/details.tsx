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
import {
  AXON_COLOR,
  AxonBox,
  AxonDimLine,
  allPts,
  autoViewBox,
  boxVertices,
  lineFromTo,
  project,
} from "./_axon";

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
  /** 母件斷面形狀。"round" → 母件畫圓（圓腳），公件榫頭也視為圓榫（直徑 = min(width, thickness)）*/
  motherShape?: "box" | "round";
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
        {/* 楔片（wedges）：正規通榫的精髓——榫頭頂端鋸兩道縫，組裝後敲入楔片把榫頭撐開，
            從另一面看是「鎖死」狀態，永遠拉不出來。畫成兩個小三角放在端面上方。 */}
        {(() => {
          const wedgeBase = PX(tt) * 0.18;
          const wedgeH = 8;
          const w1cx = asmChildX + PX(tt) * 0.28;
          const w2cx = asmChildX + PX(tt) * 0.72;
          // saw kerfs（榫頭內看不到，畫虛線提示）
          return (
            <g>
              <line
                x1={w1cx}
                y1={asmChildTop}
                x2={w1cx}
                y2={asmChildTop + PX(mt) * 0.55}
                stroke="#a85"
                strokeWidth={0.8}
                strokeDasharray="2 2"
              />
              <line
                x1={w2cx}
                y1={asmChildTop}
                x2={w2cx}
                y2={asmChildTop + PX(mt) * 0.55}
                stroke="#a85"
                strokeWidth={0.8}
                strokeDasharray="2 2"
              />
              {/* 兩個楔片三角形 */}
              <polygon
                points={`${w1cx - wedgeBase},${asmChildTop - 5 - wedgeH} ${w1cx + wedgeBase},${asmChildTop - 5 - wedgeH} ${w1cx},${asmChildTop - 5}`}
                fill="#a85"
                stroke={COLOR_OUTLINE}
                strokeWidth={0.5}
              />
              <polygon
                points={`${w2cx - wedgeBase},${asmChildTop - 5 - wedgeH} ${w2cx + wedgeBase},${asmChildTop - 5 - wedgeH} ${w2cx},${asmChildTop - 5}`}
                fill="#a85"
                stroke={COLOR_OUTLINE}
                strokeWidth={0.5}
              />
              <text
                x={asmChildX + PX(tt) / 2}
                y={asmChildTop - 5 - wedgeH - 4}
                fontSize={8}
                textAnchor="middle"
                fill="#a85"
              >
                楔片 × 2（敲入後撐開榫頭，鎖死）
              </text>
            </g>
          );
        })()}
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
        const isRoundMother = p.motherShape === "round";
        // Mortise opens from the right face, centered vertically in the leg
        const mortiseTop = legY + (legSide - mortiseT) / 2;
        const mortiseBottom = mortiseTop + mortiseT;
        const mortiseLeft = legX + legSide - mortiseL;
        const cx = legX + legSide / 2;
        const cy = legY + legSide / 2;
        const rLeg = legSide / 2;

        if (isRoundMother) {
          // 圓腳 + 圓榫：母件畫圓，榫頭剖面仍是矩形（圓榫的水平剖面 = 矩形）
          // 但榫頭直徑 = min(width, thickness) 較小，視覺上比方榫更細
          return (
            <g>
              <circle cx={cx} cy={cy} r={rLeg} fill="url(#hatch-blind)" stroke={COLOR_OUTLINE} />
              {/* 榫眼開口虛線（內側） */}
              <rect x={mortiseLeft} y={mortiseTop} width={mortiseL} height={mortiseT} fill="none" stroke="#555" strokeWidth={0.5} strokeDasharray="2 1.5" />
              {/* 圓榫剖面 = 矩形（從上方剖開圓柱榫） */}
              <rect x={mortiseLeft} y={mortiseTop} width={mortiseL} height={mortiseT} fill={COLOR_TENON} stroke={COLOR_OUTLINE} strokeWidth={0.8} />
              {/* 牙板 body 從圓腳右邊緣延伸 */}
              <rect x={cx + rLeg} y={cy - AX(ct) / 2} width={asmApronLen} height={AX(ct)} fill={COLOR_TENON} stroke={COLOR_OUTLINE} />
              <line x1={cx + rLeg} y1={cy - AX(ct) / 2} x2={cx + rLeg} y2={cy + AX(ct) / 2} stroke={COLOR_OUTLINE} strokeWidth={0.8} />
              {/* 標籤 */}
              <g fontSize={9} fill="#5a3f1e" stroke="none">
                <text x={legX - 30} y={legY + 18} textAnchor="end" fontWeight="bold">母件（圓腳）</text>
                <line x1={legX - 28} y1={legY + 15} x2={cx - rLeg + 6} y2={cy} stroke="#5a3f1e" strokeWidth={0.5} />
              </g>
              <g fontSize={9} fill="#8a6a3a" stroke="none">
                <text x={cx + rLeg + 30} y={legY + legSide + 4} textAnchor="start" fontWeight="bold">圓榫（公件）</text>
                <line x1={cx + rLeg + 28} y1={legY + legSide + 1} x2={mortiseLeft + mortiseL / 2} y2={cy} stroke="#8a6a3a" strokeWidth={0.5} />
              </g>
              <text x={cx + rLeg + asmApronLen / 2 + 30} y={cy - AX(ct) / 2 - 6} fontSize={9} textAnchor="middle" fill="#666" stroke="none">
                牙板 body
              </text>
              <text x={cx + asmApronLen / 2} y={legY + legSide + 20} fontSize={9} textAnchor="middle" fill="#666">
                圓榫頭埋進圓腳的圓孔（Forstner 鑽頭打孔）
              </text>
              <DimLine x1={cx - rLeg} y1={legY - 6} x2={cx + rLeg} y2={legY - 6} label={`圓腳直徑 ${mt}`} side="top" />
              <DimLine x1={mortiseLeft} y1={legY + legSide + 34} x2={legX + legSide} y2={legY + legSide + 34} label={`榫眼深 ${tl}`} side="bottom" />
              <DimLine x1={cx + rLeg + asmApronLen + 10} y1={cy - AX(ct) / 2} x2={cx + rLeg + asmApronLen + 10} y2={cy + AX(ct) / 2} label={`板厚 ${ct}`} side="right" />
            </g>
          );
        }

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
  // 正規做法：凹槽深度比舌長多 1–2mm 留漲縮餘量（Popular Woodworking, Rockler）。
  // 不留會在乾季時舌縮 → 整片浮，濕季時舌頂底 → 板被拘束撕裂。
  const grooveDepth = tl + 1;

  const s = fitScale(Math.max(mt * 2 + grooveDepth, ct * 2 + tl), 120);
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
        {/* groove cut — centered thickness-wise; depth = tongue + 1mm */}
        <rect
          x={mAx + pieceLen - PX(grooveDepth)}
          y={mAy + PX(mt) / 2 - PX(tt) / 2}
          width={PX(grooveDepth)}
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
          x1={mAx + pieceLen - PX(grooveDepth)}
          y1={mAy + PX(mt) / 2 - PX(tt) / 2 - 3}
          x2={mAx + pieceLen}
          y2={mAy + PX(mt) / 2 - PX(tt) / 2 - 3}
          label={`槽深 ${grooveDepth}`}
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
        {/* 1mm 漲縮空隙：舌的右端 vs 槽底之間的小空白 */}
        <line
          x1={asmX + pieceLen}
          y1={mAy + PX(mt) / 2 - PX(tt) / 2 - 6}
          x2={asmX + pieceLen}
          y2={mAy + PX(mt) / 2 + PX(tt) / 2 + 6}
          stroke="#a85"
          strokeDasharray="2 2"
        />
        <text
          x={asmX + pieceLen + 4}
          y={mAy - 4}
          fontSize={8}
          fill="#a85"
        >
          ← 槽底比舌長深 1mm（漲縮餘量）
        </text>
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
        {(() => {
          const isRoundMother = p.motherShape === "round";
          const legX0 = asmOriginX + 20;
          const legW = PX(mt) * 2;
          const legH = PX(mt);
          const legCx = legX0 + legW / 2;
          const legCy = mAy + legH / 2;
          const legR = legH / 2;
          const tenonRectX = legX0 + legW - PX(tl);
          const tenonRectY = mAy + legH / 2 - PX(tt) / 2;
          const apronX = legX0 + legW;
          const apronY = mAy + legH / 2 - PX(ct) / 2;
          if (isRoundMother) {
            // 圓腳剖面 = 圓；主榫剖面仍為矩形（圓榫的水平剖面）；牙板從圓緣延伸
            return (
              <>
                <circle cx={legCx} cy={legCy} r={legR} fill="url(#hatch-shouldered)" stroke={COLOR_OUTLINE} />
                <rect x={tenonRectX} y={tenonRectY} width={PX(tl)} height={PX(tt)} fill={COLOR_TENON} stroke={COLOR_OUTLINE} />
                <rect x={legCx + legR} y={apronY} width={PX(ct) * 4} height={PX(ct)} fill={COLOR_TENON} stroke={COLOR_OUTLINE} />
                <text x={legCx + legR / 2} y={mAy + legH + 16} fontSize={9} textAnchor="middle" fill="#666">
                  圓榫頭埋進圓腳的圓孔（帶肩防旋轉）
                </text>
              </>
            );
          }
          return (
            <>
              <rect x={legX0} y={mAy} width={legW} height={legH} fill="url(#hatch-shouldered)" stroke={COLOR_OUTLINE} />
              <rect x={tenonRectX} y={tenonRectY} width={PX(tl)} height={PX(tt)} fill={COLOR_TENON} stroke={COLOR_OUTLINE} />
              <rect x={apronX} y={apronY} width={PX(ct) * 4} height={PX(ct)} fill={COLOR_TENON} stroke={COLOR_OUTLINE} />
              <text x={legX0 + PX(mt)} y={mAy + legH + 16} fontSize={9} textAnchor="middle" fill="#666">
                主榫藏於柱腳，上方肩榫防旋轉
              </text>
            </>
          );
        })()}
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
  return <DovetailDetailAxon p={p} />;
}

/**
 * 鳩尾榫——軸測立體版（新版）。
 *
 * 對接抽屜結構：
 *   公件 = TAIL board（鳩尾頭板，傳統側板用）：右端有 N 個梯形鳩尾
 *   母件 = PIN board（鳩尾眼板，傳統面板用）：右端鋸出對應的鳩尾眼
 *
 * 視覺：兩件分左右獨立繪製，30° isometric 投影，標尺直接帶入使用者輸入的尺寸。
 */
function DovetailDetailAxon({ p }: { p: JoineryDetailParams }) {
  // === 從 props 推算所有 3D 尺寸（mm） ===
  const tailDepth = p.tenonLength;                    // 鳩尾深度（= 母件厚）
  const boardT = p.childThickness ?? p.tenonThickness; // 公件板厚
  const motherT = p.motherThickness;                   // 母件板厚（= tailDepth 在通鳩尾）
  // 鳩尾數量（視覺示意，3 個鳩尾就夠表達）
  const N_TAILS = 3;
  // 接合面寬度——使用者輸入的 tenonWidth 通常是「整個鳩尾接合的總寬度」，
  // 若太小視覺看不出來，給最小 100mm
  const jointWidth = Math.max(100, p.tenonWidth);
  // 半個邊角的 pin（鳩尾眼）寬，讓最外側保留 pin 不是 tail
  const halfPin = jointWidth / (N_TAILS * 2);
  // 每個 tail 的 pitch
  const pitch = (jointWidth - 2 * halfPin) / (N_TAILS - 1 + 0.0001);
  // tail 在最窄處的寬度（base，靠母件那端）
  const tailBaseW = pitch * 0.55;
  // tail 在最寬處的寬度（top，往板外端漸闊）
  const tailTopW = pitch * 0.85;
  // 兩件畫面尺寸（顯示用，板長截到夠看到接合就好）
  const showLen = Math.max(80, tailDepth * 1.2);

  // === 計算公件鳩尾頭頂點 ===
  // 公件板：占 x ∈ [0, showLen]（板身），y ∈ [0, boardT]，z ∈ [0, jointWidth]
  // 鳩尾從 x = showLen 突出，到 x = showLen + tailDepth
  // 第 i 個 tail 的中心 z 座標
  const tailZCenters = Array.from({ length: N_TAILS }, (_, i) =>
    halfPin + i * pitch,
  );

  // 公件 axon 視圖
  const tailBoard = (
    <g>
      {/* 主板身 */}
      <AxonBox
        ox={0}
        oy={0}
        oz={0}
        length={showLen}
        height={boardT}
        depth={jointWidth}
        fill={AXON_COLOR.tenon}
        showHidden={false}
      />
      {/* 每個鳩尾的梯形頭 */}
      {tailZCenters.map((zc, i) => {
        // 8 個頂點，base 端在 x = showLen，top 端在 x = showLen + tailDepth
        const xBase = showLen;
        const xTop = showLen + tailDepth;
        const baseZ1 = zc - tailBaseW / 2;
        const baseZ2 = zc + tailBaseW / 2;
        const topZ1 = zc - tailTopW / 2;
        const topZ2 = zc + tailTopW / 2;
        const v = {
          // base = 連接板身那端（窄）
          bbf: project(xBase, 0, baseZ2),         // base bottom front
          bbb: project(xBase, 0, baseZ1),
          btf: project(xBase, boardT, baseZ2),
          btb: project(xBase, boardT, baseZ1),
          // top = 突出端（寬）
          tbf: project(xTop, 0, topZ2),
          tbb: project(xTop, 0, topZ1),
          ttf: project(xTop, boardT, topZ2),
          ttb: project(xTop, boardT, topZ1),
        };
        // 可見面：頂面（梯形 btf-btb-ttb-ttf）、前側梯形面（bbf-btf-ttf-tbf）、
        // 突出端面（tbf-tbb-ttb-ttf）
        const topFace = `M ${v.btf.x} ${v.btf.y} L ${v.btb.x} ${v.btb.y} L ${v.ttb.x} ${v.ttb.y} L ${v.ttf.x} ${v.ttf.y} Z`;
        const frontFace = `M ${v.bbf.x} ${v.bbf.y} L ${v.btf.x} ${v.btf.y} L ${v.ttf.x} ${v.ttf.y} L ${v.tbf.x} ${v.tbf.y} Z`;
        const endFace = `M ${v.tbf.x} ${v.tbf.y} L ${v.tbb.x} ${v.tbb.y} L ${v.ttb.x} ${v.ttb.y} L ${v.ttf.x} ${v.ttf.y} Z`;
        return (
          <g key={`tail-${i}`}>
            <path d={topFace} fill={AXON_COLOR.tenon} fillOpacity={0.7} stroke={AXON_COLOR.outline} strokeWidth={1.2} />
            <path d={frontFace} fill={AXON_COLOR.tenon} fillOpacity={0.95} stroke={AXON_COLOR.outline} strokeWidth={1.2} />
            <path d={endFace} fill={AXON_COLOR.tenon} fillOpacity={0.55} stroke={AXON_COLOR.outline} strokeWidth={1.2} />
          </g>
        );
      })}

      {/* 標尺：鳩尾長（從板端到突出端） */}
      <AxonDimLine
        from={{ x: showLen, y: 0, z: jointWidth }}
        to={{ x: showLen + tailDepth, y: 0, z: jointWidth }}
        label={`榫長 ${tailDepth}mm`}
        offsetDir={{ z: 1 }}
        offsetMm={20}
      />
      {/* 標尺：板厚（公件） */}
      <AxonDimLine
        from={{ x: showLen + tailDepth, y: 0, z: 0 }}
        to={{ x: showLen + tailDepth, y: boardT, z: 0 }}
        label={`板厚 ${boardT}mm`}
        offsetDir={{ x: 1 }}
        offsetMm={15}
      />
      {/* 標尺：tail 寬（最寬處） */}
      <AxonDimLine
        from={{
          x: showLen + tailDepth,
          y: boardT,
          z: tailZCenters[0] - tailTopW / 2,
        }}
        to={{
          x: showLen + tailDepth,
          y: boardT,
          z: tailZCenters[0] + tailTopW / 2,
        }}
        label={`榫寬 ${Math.round(tailTopW)}mm`}
        offsetDir={{ y: 1 }}
        offsetMm={20}
      />
      {/* 標尺：接合總寬 */}
      <AxonDimLine
        from={{ x: 0, y: 0, z: 0 }}
        to={{ x: 0, y: 0, z: jointWidth }}
        label={`接合總寬 ${jointWidth}mm`}
        offsetDir={{ y: -1 }}
        offsetMm={15}
      />
    </g>
  );

  // === 母件 axon（鳩尾眼板）===
  // 母件板：占 x ∈ [0, showLen]，y ∈ [0, motherT]，z ∈ [0, jointWidth]
  // 鳩尾眼從 x = showLen - tailDepth 鋸入到 x = showLen（即從右端鋸入）
  const pinBoard = (
    <g>
      {/* 主板身（不開鳩尾的部分） */}
      <AxonBox
        ox={0}
        oy={0}
        oz={0}
        length={showLen - tailDepth}
        height={motherT}
        depth={jointWidth}
        fill="#c9a16a"
        showHidden={false}
      />
      {/* 鳩尾眼之間的 pin（凸出來的部分） */}
      {/* pin 是 tail 之間 + 兩端的部分 */}
      {(() => {
        // pin 區段：[0, halfPin], [tailZCenters[0]+tailBaseW/2, tailZCenters[1]-tailBaseW/2], ..., [tailZCenters[N-1]+tailBaseW/2, jointWidth]
        const pinSegs: Array<[number, number]> = [];
        let prev = 0;
        for (const zc of tailZCenters) {
          const z1 = zc - tailBaseW / 2;
          if (z1 > prev) pinSegs.push([prev, z1]);
          prev = zc + tailBaseW / 2;
        }
        if (prev < jointWidth) pinSegs.push([prev, jointWidth]);
        return pinSegs.map(([z0, z1], i) => (
          <AxonBox
            key={`pin-${i}`}
            ox={showLen - tailDepth}
            oy={0}
            oz={z0}
            length={tailDepth}
            height={motherT}
            depth={z1 - z0}
            fill="#c9a16a"
            showHidden={false}
          />
        ));
      })()}

      {/* 標尺：鳩尾眼深 */}
      <AxonDimLine
        from={{ x: showLen - tailDepth, y: 0, z: jointWidth }}
        to={{ x: showLen, y: 0, z: jointWidth }}
        label={`眼深 ${tailDepth}mm`}
        offsetDir={{ z: 1 }}
        offsetMm={20}
      />
      {/* 標尺：母件板厚 */}
      <AxonDimLine
        from={{ x: showLen, y: 0, z: 0 }}
        to={{ x: showLen, y: motherT, z: 0 }}
        label={`板厚 ${motherT}mm`}
        offsetDir={{ x: 1 }}
        offsetMm={15}
      />
      {/* 標尺：眼寬（=tailBaseW） */}
      <AxonDimLine
        from={{
          x: showLen,
          y: motherT,
          z: tailZCenters[0] - tailBaseW / 2,
        }}
        to={{
          x: showLen,
          y: motherT,
          z: tailZCenters[0] + tailBaseW / 2,
        }}
        label={`眼寬 ${Math.round(tailBaseW)}mm`}
        offsetDir={{ y: 1 }}
        offsetMm={20}
      />
    </g>
  );

  // === 俯視 2D（最能看出鳩尾形狀的視角）===
  // 公件俯視：看到 3 個梯形 tail 從板端突出
  // 範圍：x ∈ [0, showLen + tailDepth], z ∈ [0, jointWidth]
  // SVG 直接 1mm = 1px（autoViewBox 處理範圍）
  // === 端面俯視 + 3D 深度條（板直立、端面朝上、cabinet projection 加 30° 側深）===
  // SVG 約定：x = 板寬（jointWidth），y = 板長（端面在 y=0，板身往下延伸）。
  // 額外右側畫一條斜向後上的「深度條」表示板厚（boardT），讓 2D 看起來有 3D 感。
  const TOP_PAD = 30;
  const showBodyLen = Math.max(60, tailDepth * 1.5);
  const totalH = tailDepth + showBodyLen;
  const totalW = jointWidth;
  // 深度條偏移（cabinet projection 30°）
  const depthAngle = Math.PI / 6;
  const dxBoard = boardT * Math.cos(depthAngle); // 板厚往右偏
  const dyBoard = -boardT * Math.sin(depthAngle); // 板厚往上偏（負值 = SVG 上方）
  const dxMother = motherT * Math.cos(depthAngle);
  const dyMother = -motherT * Math.sin(depthAngle);
  const tailTopVB = `0 ${dyBoard - 5} ${totalW + 2 * TOP_PAD + dxBoard + 60} ${totalH + 2 * TOP_PAD - dyBoard}`;
  const tailTopView = (
    <svg viewBox={tailTopVB} className="w-full h-auto">
      <g transform={`translate(${TOP_PAD}, ${TOP_PAD})`}>
        {/* === 板身（鳩尾下方部分）+ 右側 3D 深度條 === */}
        {/* 板身右側 3D 深度條（cabinet projection）*/}
        <polygon
          points={`${totalW},${tailDepth} ${totalW + dxBoard},${tailDepth + dyBoard} ${totalW + dxBoard},${totalH + dyBoard} ${totalW},${totalH}`}
          fill={AXON_COLOR.tenon}
          fillOpacity={0.5}
          stroke={AXON_COLOR.outline}
          strokeWidth={1}
        />
        {/* 板身前面 */}
        <rect
          x={0}
          y={tailDepth}
          width={totalW}
          height={showBodyLen}
          fill={AXON_COLOR.tenon}
          fillOpacity={0.95}
          stroke={AXON_COLOR.outline}
          strokeWidth={1.2}
        />
        {/* 板身延伸虛線 */}
        <line
          x1={0}
          y1={totalH}
          x2={totalW}
          y2={totalH}
          stroke={AXON_COLOR.outline}
          strokeDasharray="4 2"
          strokeWidth={0.7}
        />
        {/* 每個 tail（梯形，端面在頂端 y=0，靠板身那端 y=tailDepth 較窄）+ 各自的 3D 深度條 */}
        {tailZCenters.map((zc, i) => {
          const yEnd = 0;             // 端面（頂端，露出鋸口）
          const yBody = tailDepth;    // 連接板身
          const endZ1 = zc - tailTopW / 2;
          const endZ2 = zc + tailTopW / 2;
          const bodyZ1 = zc - tailBaseW / 2;
          const bodyZ2 = zc + tailBaseW / 2;
          return (
            <g key={`tail-${i}`}>
              {/* 上方：tail 的「頂面」（depth strip）— cabinet 投影看到上面 */}
              <polygon
                points={`${endZ1},${yEnd} ${endZ2},${yEnd} ${endZ2 + dxBoard},${yEnd + dyBoard} ${endZ1 + dxBoard},${yEnd + dyBoard}`}
                fill={AXON_COLOR.tenon}
                fillOpacity={0.6}
                stroke={AXON_COLOR.outline}
                strokeWidth={1}
              />
              {/* 右側：tail 的「右側面」（看到斜面）*/}
              <polygon
                points={`${endZ2},${yEnd} ${endZ2 + dxBoard},${yEnd + dyBoard} ${bodyZ2 + dxBoard},${yBody + dyBoard} ${bodyZ2},${yBody}`}
                fill={AXON_COLOR.tenon}
                fillOpacity={0.45}
                stroke={AXON_COLOR.outline}
                strokeWidth={1}
              />
              {/* 前面：trapezoid（最主要視覺）*/}
              <polygon
                points={`${endZ1},${yEnd} ${endZ2},${yEnd} ${bodyZ2},${yBody} ${bodyZ1},${yBody}`}
                fill={AXON_COLOR.tenon}
                fillOpacity={0.85}
                stroke={AXON_COLOR.outline}
                strokeWidth={1.2}
              />
            </g>
          );
        })}
        {/* 標尺：鳩尾長（垂直方向，左側）*/}
        <g stroke={AXON_COLOR.dim} fill={AXON_COLOR.dim} strokeWidth={0.6} fontSize={10}>
          <line x1={-15} y1={0} x2={-15} y2={tailDepth} />
          <line x1={-19} y1={0} x2={-11} y2={0} strokeWidth={0.7} />
          <line x1={-19} y1={tailDepth} x2={-11} y2={tailDepth} strokeWidth={0.7} />
          <text
            x={-22}
            y={tailDepth / 2 + 3}
            textAnchor="end"
            stroke="none"
          >
            榫長 {tailDepth}
          </text>
        </g>
        {/* 標尺：tail 寬端（端面那側）*/}
        <g stroke={AXON_COLOR.dim} fill={AXON_COLOR.dim} strokeWidth={0.6} fontSize={9}>
          <text
            x={tailZCenters[0] + tailTopW / 2 + 3}
            y={-3}
            stroke="none"
          >
            寬端 {Math.round(tailTopW)}
          </text>
          <text
            x={tailZCenters[0] + tailBaseW / 2 + 3}
            y={tailDepth + 11}
            stroke="none"
          >
            窄端 {Math.round(tailBaseW)}
          </text>
        </g>
        {/* 標尺：板厚（右側） */}
        <g stroke={AXON_COLOR.dim} fill={AXON_COLOR.dim} strokeWidth={0.6} fontSize={9}>
          <text
            x={totalW + 4}
            y={tailDepth + showBodyLen / 2 + 3}
            stroke="none"
          >
            板厚 {boardT}
          </text>
        </g>
      </g>
    </svg>
  );

  // === 母件 2.5D：板身（下半段）+ N+1 個 PIN 矩形凸起往上 ===
  // 跟公件相反：公件 tails 是梯形凸起、母件 pins 是矩形凸起（廣面看是直的）。
  // pin 之間的 gap 才是 tail 要進來的位置（剛好跟公件 tails 互鎖）。
  const socketWidthOnFront = tailTopW; // gap 寬 = tail 寬端寬，pin 是 gap 之間的木頭
  const pinSegs: Array<{ left: number; right: number }> = [];
  // 左半 pin
  pinSegs.push({ left: 0, right: tailZCenters[0] - socketWidthOnFront / 2 });
  // 中間 pins
  for (let i = 0; i < N_TAILS - 1; i++) {
    pinSegs.push({
      left: tailZCenters[i] + socketWidthOnFront / 2,
      right: tailZCenters[i + 1] - socketWidthOnFront / 2,
    });
  }
  // 右半 pin
  pinSegs.push({
    left: tailZCenters[N_TAILS - 1] + socketWidthOnFront / 2,
    right: jointWidth,
  });

  const pinTopVB = `0 ${dyMother - 5} ${totalW + 2 * TOP_PAD + dxMother + 60} ${totalH + 2 * TOP_PAD - dyMother}`;
  const pinTopView = (
    <svg viewBox={pinTopVB} className="w-full h-auto">
      <g transform={`translate(${TOP_PAD}, ${TOP_PAD})`}>
        {/* 板身右側 3D 深度條（只到板身段 y ∈ [tailDepth, totalH]）*/}
        <polygon
          points={`${totalW},${tailDepth} ${totalW + dxMother},${tailDepth + dyMother} ${totalW + dxMother},${totalH + dyMother} ${totalW},${totalH}`}
          fill="#a47e4f"
          fillOpacity={0.5}
          stroke={AXON_COLOR.outline}
          strokeWidth={1}
        />
        {/* 板身前面（鳩尾下方部分，y 從 tailDepth 開始）*/}
        <rect
          x={0}
          y={tailDepth}
          width={totalW}
          height={showBodyLen}
          fill="#c9a16a"
          fillOpacity={0.95}
          stroke={AXON_COLOR.outline}
          strokeWidth={1.2}
        />
        {/* 板身延伸虛線 */}
        <line
          x1={0}
          y1={totalH}
          x2={totalW}
          y2={totalH}
          stroke={AXON_COLOR.outline}
          strokeDasharray="4 2"
          strokeWidth={0.7}
        />
        {/* N+1 個矩形 PIN 凸起（每個 pin 是矩形塊，從 y=0 到 y=tailDepth）+ 各自 3D 深度條 */}
        {pinSegs.map((seg, i) => {
          const yTop = 0;       // 端面（pin tip）
          const yBase = tailDepth; // 連接板身（pin base）
          const w = seg.right - seg.left;
          if (w <= 0) return null;
          return (
            <g key={`pin-${i}`}>
              {/* pin 頂面（depth strip on tip）*/}
              <polygon
                points={`${seg.left},${yTop} ${seg.right},${yTop} ${seg.right + dxMother},${yTop + dyMother} ${seg.left + dxMother},${yTop + dyMother}`}
                fill="#b08c5f"
                fillOpacity={0.7}
                stroke={AXON_COLOR.outline}
                strokeWidth={1}
              />
              {/* pin 右側面（厚度方向 3D 深度條）*/}
              <polygon
                points={`${seg.right},${yTop} ${seg.right + dxMother},${yTop + dyMother} ${seg.right + dxMother},${yBase + dyMother} ${seg.right},${yBase}`}
                fill="#8a6c43"
                fillOpacity={0.45}
                stroke={AXON_COLOR.outline}
                strokeWidth={1}
              />
              {/* pin 前面（廣面看到的矩形——直邊沒 taper）*/}
              <rect
                x={seg.left}
                y={yTop}
                width={w}
                height={yBase - yTop}
                fill="#c9a16a"
                fillOpacity={0.95}
                stroke={AXON_COLOR.outline}
                strokeWidth={1.2}
              />
            </g>
          );
        })}
        {/* 板身延伸虛線 */}
        <line
          x1={0}
          y1={totalH}
          x2={totalW}
          y2={totalH}
          stroke={AXON_COLOR.outline}
          strokeDasharray="4 2"
          strokeWidth={0.7}
        />
        {/* 標尺：眼深 */}
        <g stroke={AXON_COLOR.dim} fill={AXON_COLOR.dim} strokeWidth={0.6} fontSize={10}>
          <line x1={-15} y1={0} x2={-15} y2={tailDepth} />
          <line x1={-19} y1={0} x2={-11} y2={0} strokeWidth={0.7} />
          <line x1={-19} y1={tailDepth} x2={-11} y2={tailDepth} strokeWidth={0.7} />
          <text
            x={-22}
            y={tailDepth / 2 + 3}
            textAnchor="end"
            stroke="none"
          >
            眼深 {tailDepth}
          </text>
        </g>
        {/* 標尺：開口寬 / 內窄 */}
        <g stroke={AXON_COLOR.dim} fill={AXON_COLOR.dim} strokeWidth={0.6} fontSize={9}>
          <text
            x={tailZCenters[0] + tailTopW / 2 + 3}
            y={-3}
            stroke="none"
          >
            開口 {Math.round(tailTopW)}
          </text>
          <text
            x={tailZCenters[0] + tailBaseW / 2 + 3}
            y={tailDepth + 11}
            stroke="none"
          >
            內窄 {Math.round(tailBaseW)}
          </text>
        </g>
        {/* 標尺：板厚 */}
        <g stroke={AXON_COLOR.dim} fill={AXON_COLOR.dim} strokeWidth={0.6} fontSize={9}>
          <text
            x={totalW + 4}
            y={tailDepth + showBodyLen / 2 + 3}
            stroke="none"
          >
            板厚 {motherT}
          </text>
        </g>
      </g>
    </svg>
  );

  // === 厚度剖面：在 (length × thickness) 平面切一刀，顯示鳩尾的厚度方向 taper ===
  // 公件側面剖面：板長 × 板厚 = 矩形（直的），tail 段也是矩形（厚度方向沒有 taper）
  // 母件側面剖面：板長 × 板厚 = 矩形，socket 是 TRAPEZOIDAL 切口（厚度方向 taper）
  const SIDE_PAD = 25;
  // socket 在厚度方向的兩個臨界值（以 motherT 為單位）
  // 端面（length=0）較窄、深處（length=tailDepth）較寬 → 鳩尾自鎖原理
  const socketThicknessNarrow = motherT * 0.45;
  const socketThicknessWide = motherT * 0.85;
  // 矩形剖面整體尺寸（visual）
  const sideViewLen = totalH;  // 板長：含端面 + 板身延伸
  const sideViewT = Math.max(motherT, boardT);
  const sideVB = `0 0 ${sideViewLen + 2 * SIDE_PAD + 60} ${sideViewT + 2 * SIDE_PAD + 30}`;

  const tailSideView = (
    <svg viewBox={sideVB} className="w-full h-auto">
      <g transform={`translate(${SIDE_PAD}, ${SIDE_PAD})`}>
        {/* 板身 + tail 全是矩形（厚度方向沒有 taper）*/}
        <rect
          x={0}
          y={0}
          width={sideViewLen}
          height={boardT}
          fill={AXON_COLOR.tenon}
          fillOpacity={0.85}
          stroke={AXON_COLOR.outline}
          strokeWidth={1.2}
        />
        {/* 端面位置標示（tail 跟板身的接縫）*/}
        <line
          x1={tailDepth}
          y1={0}
          x2={tailDepth}
          y2={boardT}
          stroke={AXON_COLOR.outline}
          strokeDasharray="3 2"
          strokeWidth={0.7}
        />
        <text x={tailDepth - 3} y={-5} textAnchor="end" fontSize={9} fill={AXON_COLOR.dim}>
          ← tail 段
        </text>
        <text x={tailDepth + 3} y={-5} textAnchor="start" fontSize={9} fill={AXON_COLOR.dim}>
          板身段 →
        </text>
        {/* 板厚標尺 */}
        <g stroke={AXON_COLOR.dim} fill={AXON_COLOR.dim} strokeWidth={0.6} fontSize={9}>
          <line x1={sideViewLen + 8} y1={0} x2={sideViewLen + 8} y2={boardT} />
          <text x={sideViewLen + 12} y={boardT / 2 + 3} stroke="none">
            板厚 {boardT}
          </text>
        </g>
        {/* 板長延伸虛線 */}
        <line
          x1={sideViewLen}
          y1={boardT / 2}
          x2={sideViewLen + 12}
          y2={boardT / 2}
          stroke={AXON_COLOR.outline}
          strokeDasharray="3 2"
          strokeWidth={0.7}
        />
      </g>
    </svg>
  );

  const pinSideView = (
    <svg viewBox={sideVB} className="w-full h-auto">
      <g transform={`translate(${SIDE_PAD}, ${SIDE_PAD})`}>
        {/* 板身整體矩形 */}
        <rect
          x={0}
          y={0}
          width={sideViewLen}
          height={motherT}
          fill="#c9a16a"
          fillOpacity={0.95}
          stroke={AXON_COLOR.outline}
          strokeWidth={1.2}
        />
        {/* socket 厚度方向梯形：左端（端面）窄，右端（深處）寬。中心對齊板厚中心線 */}
        {(() => {
          const yMid = motherT / 2;
          const yEndTop = yMid - socketThicknessNarrow / 2;
          const yEndBot = yMid + socketThicknessNarrow / 2;
          const yDepthTop = yMid - socketThicknessWide / 2;
          const yDepthBot = yMid + socketThicknessWide / 2;
          return (
            <polygon
              points={`${0},${yEndTop} ${tailDepth},${yDepthTop} ${tailDepth},${yDepthBot} ${0},${yEndBot}`}
              fill="white"
              stroke={AXON_COLOR.outline}
              strokeWidth={1.2}
            />
          );
        })()}
        {/* 端面位置 */}
        <line
          x1={tailDepth}
          y1={0}
          x2={tailDepth}
          y2={motherT}
          stroke={AXON_COLOR.outline}
          strokeDasharray="3 2"
          strokeWidth={0.7}
        />
        <text x={tailDepth + 3} y={-5} textAnchor="start" fontSize={9} fill={AXON_COLOR.dim}>
          板身段 →
        </text>
        <text x={tailDepth - 3} y={-5} textAnchor="end" fontSize={9} fill={AXON_COLOR.dim}>
          ← socket 段
        </text>
        {/* 厚度方向標尺 */}
        <g stroke={AXON_COLOR.dim} fill={AXON_COLOR.dim} strokeWidth={0.6} fontSize={9}>
          {/* 端面窄 */}
          <line x1={-8} y1={motherT / 2 - socketThicknessNarrow / 2} x2={-8} y2={motherT / 2 + socketThicknessNarrow / 2} />
          <text x={-12} y={motherT / 2 + 3} textAnchor="end" stroke="none">
            端面 {Math.round(socketThicknessNarrow)}
          </text>
          {/* 深處寬 */}
          <line x1={tailDepth + 8} y1={motherT / 2 - socketThicknessWide / 2} x2={tailDepth + 8} y2={motherT / 2 + socketThicknessWide / 2} />
          <text x={tailDepth + 12} y={motherT / 2 + 3} stroke="none">
            深處 {Math.round(socketThicknessWide)}
          </text>
          {/* 板厚 */}
          <line x1={sideViewLen + 8} y1={0} x2={sideViewLen + 8} y2={motherT} />
          <text x={sideViewLen + 12} y={motherT / 2 + 3} stroke="none">
            板厚 {motherT}
          </text>
        </g>
        <line
          x1={sideViewLen}
          y1={motherT / 2}
          x2={sideViewLen + 12}
          y2={motherT / 2}
          stroke={AXON_COLOR.outline}
          strokeDasharray="3 2"
          strokeWidth={0.7}
        />
      </g>
    </svg>
  );

  // === axon viewBox 計算 ===
  const tailVerts = [
    boxVertices(0, 0, 0, showLen, boardT, jointWidth),
    boxVertices(showLen, 0, 0, tailDepth, boardT, jointWidth),
  ];
  const pinVerts = [
    boxVertices(0, 0, 0, showLen, motherT, jointWidth),
  ];
  const tailVB = autoViewBox(allPts(...tailVerts), 60);
  const pinVB = autoViewBox(allPts(...pinVerts), 60);

  // 舊 horizontal axon 已不採用（保留 viewBox 變數以免 ts unused 報錯）
  void tailVB;
  void pinVB;
  void tailBoard;
  void pinBoard;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <figure>
        <div className="flex flex-col gap-3">
          <div>
            <div className="text-[10px] text-zinc-400 mb-0.5">廣面（長×寬方向）— 看到梯形 tail</div>
            {tailTopView}
          </div>
          <div>
            <div className="text-[10px] text-zinc-400 mb-0.5">厚度剖面（長×厚方向）— 直的（沒有 taper）</div>
            {tailSideView}
          </div>
        </div>
        <figcaption className="mt-2 text-xs text-zinc-600 text-center">
          <strong>公件</strong>（鳩尾頭板 / Tail board）— 抽屜側板
        </figcaption>
      </figure>
      <figure>
        <div className="flex flex-col gap-3">
          <div>
            <div className="text-[10px] text-zinc-400 mb-0.5">廣面（長×寬方向）— socket 是直的矩形</div>
            {pinTopView}
          </div>
          <div>
            <div className="text-[10px] text-zinc-400 mb-0.5">厚度剖面（長×厚方向）— socket 在這裡才看到鳩尾梯形 taper</div>
            {pinSideView}
          </div>
        </div>
        <figcaption className="mt-2 text-xs text-zinc-600 text-center">
          <strong>母件</strong>（鳩尾眼板 / Pin board）— 抽屜面板
        </figcaption>
      </figure>
      <p className="w-full mt-2 text-[11px] text-zinc-500 leading-relaxed">
        標準角度：硬木 1:8（≈7.1°）／ 軟木 1:6（≈9.5°）。先在公件畫線鋸出鳩尾、
        再用公件當樣板畫到母件鋸出鳩尾眼。最外側保留 pin（半個鳩尾眼）不是 tail，
        承拉力較強。
      </p>
    </div>
  );
}

function DovetailDetailLegacy(p: JoineryDetailParams) {
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

  // pieceDepth = 母件尾深。公件 end view 的高度（peH）必須等於 pieceDepth，
  // 兩件才能共用同一 offset → 同一視覺斜度。否則會產生「比例斜度不一樣」的錯誤。
  const pieceDepth = PX(tl);
  const pieceLen = Math.max(200, PX(ct) * 6);
  const bodyExt = pieceDepth * 1.0;

  const dtAngleHOffset = pieceDepth * 0.35;

  // 半銷慣例（half-pin convention）：兩端各留半個銷做邊緣補強，中間 N_TAILS-1 個全銷。
  // 版面（頂部寬度）：[半銷] [尾] [銷] [尾] [銷] [尾] [半銷]
  //              = 2*(pinW/2) + N_TAILS*tailW + (N_TAILS-1)*pinW
  //              = N_TAILS*tailW + N_TAILS*pinW = N_TAILS*(tailW + pinW)
  // 配 pinW = 0.55*tailW，總寬 = 3*1.55*tailW = 4.65*tailW = pieceLen
  const tailW = pieceLen / (N_TAILS * 1.55);
  const pinW = tailW * 0.55;
  const halfPinW_top = pinW / 2;

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
  void cAy;

  const asmX = mAx + expW + PADDING;
  const asmY = mAy;

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

      {/* MOTHER (tail board — drawer side)
          半銷慣例：兩端各是「半銷凹」（邊緣木料被半銷對方公件填入，所以 tail board
          兩端是缺口）。走法：左半銷凹 → N_TAILS 個尾 + (N_TAILS-1) 個全銷凹 → 右半銷凹。
          邊緣的半銷凹只有「內側的斜邊」，外側（板邊）是垂直的（沒有斜邊超出板外）。 */}
      {(() => {
        const offset = dtAngleHOffset;
        const points: Array<[number, number]> = [];
        // 起點：bottom-left
        points.push([mAx, mBodyBot]);
        // 沿左板邊向上，僅到 body 高度（板邊上面 mBodyTop→mAy 是被左半銷凹挖掉的）
        points.push([mAx, mBodyTop]);
        // 沿左半銷凹底邊往右，到半銷凹的「斜邊底點」
        points.push([mAx + halfPinW_top + offset, mBodyTop]);
        // 斜上到第一個尾的 top-left（板頂端那層）
        let tailLeftAtTip = mAx + halfPinW_top;
        points.push([tailLeftAtTip, mAy]);
        // 走 N_TAILS 個尾 + 中間 (N_TAILS - 1) 個全銷凹
        for (let i = 0; i < N_TAILS; i++) {
          const tailRightAtTip = tailLeftAtTip + tailW;
          points.push([tailRightAtTip, mAy]); // 尾右頂
          if (i < N_TAILS - 1) {
            // 全銷凹：左斜下、底右行、右斜上
            points.push([tailRightAtTip - offset, mBodyTop]);
            const nextTailLeft = tailRightAtTip + pinW;
            points.push([nextTailLeft + offset, mBodyTop]);
            points.push([nextTailLeft, mAy]);
            tailLeftAtTip = nextTailLeft;
          }
        }
        // 最後一個尾後面是右半銷凹：從尾右斜下到 mBodyTop，然後平行到板右邊
        const lastTailRightAtTip = tailLeftAtTip + tailW;
        points.push([lastTailRightAtTip - offset, mBodyTop]);
        points.push([mAx + pieceLen, mBodyTop]);
        points.push([mAx + pieceLen, mBodyBot]);
        return (
          <g>
            <polygon
              points={points.map((p) => p.join(",")).join(" ")}
              fill={COLOR_MORTISE}
              stroke={COLOR_OUTLINE}
            />
            <text
              x={mAx + pieceLen / 2}
              y={mBodyBot + 14}
              fontSize={9}
              textAnchor="middle"
              fill="#666"
            >
              母件（尾板，{N_TAILS} 個尾 + 兩端半銷凹）
            </text>
            <DimLine
              x1={mAx - 10}
              y1={mAy}
              x2={mAx - 10}
              y2={mBodyTop}
              label={`榫深 ${tl}`}
              side="left"
            />
            <text x={mAx + pieceLen / 2} y={mAy - 6} fontSize={8} fill="#999" textAnchor="middle">
              ↑ 尾頂（端面，板的最上緣）
            </text>
          </g>
        );
      })()}

      {/* CHILD (pin board — drawer front)
          ★ 重要：公件是「從端面看下去」的橫向 cross-section（寬 × 厚），
          不是 face view！鳩尾的角度只在端面這個剖面才看得到（角度方向是
          沿厚度方向斜），所以畫成一個橫的 W×T 矩形，內部有交替的：
            - 銷（▲ 實心）：外窄內寬，是剩下的木料
            - 尾凹（▽ 空切）：外寬內窄，是給對方 tail 嵌入的空槽
          —— FineWoodworking、Wikipedia、Highland Woodworking 共同慣例 */}
      {(() => {
        // 端面剖面：寬 = pieceLen（板的 width）、高 = pieceDepth（= 母件尾深）
        // peH 必須等於 pieceDepth，兩件才會在同一尺度下顯示同樣的斜度
        const peW = pieceLen;
        const peH = pieceDepth;
        const peX = cAx;
        // peY 對齊 mAy，讓公母件的「外面」都在圖的上緣，「內面」都在下緣
        const peY = mAy;
        const offset = dtAngleHOffset;

        return (
          <g>
            {/* 板的端面剖面整片（先填滿銷顏色） */}
            <rect
              x={peX}
              y={peY}
              width={peW}
              height={peH}
              fill={COLOR_TENON}
              stroke={COLOR_OUTLINE}
            />
            {/* 切出 N_TAILS 個尾凹（▽ 形狀）。半銷慣例：第一個 socket 從
                左半銷之後開始（peX + halfPinW_top），兩端留有半銷的木料，
                不會產生「三角碎料」問題。 */}
            {Array.from({ length: N_TAILS }).map((_, i) => {
              // socket 頂部左邊 x（半銷之後、每 tailW+pinW 一個循環）
              const sx = peX + halfPinW_top + i * (tailW + pinW);
              const points = [
                [sx, peY], // top-left（外面，寬）
                [sx + tailW, peY], // top-right
                [sx + tailW - offset, peY + peH], // bottom-right（內面，窄）
                [sx + offset, peY + peH], // bottom-left
              ];
              return (
                <polygon
                  key={i}
                  points={points.map((p) => p.join(",")).join(" ")}
                  fill="white"
                  stroke={COLOR_OUTLINE}
                />
              );
            })}
            <text
              x={peX + peW / 2}
              y={peY + peH + 16}
              fontSize={9}
              textAnchor="middle"
              fill="#666"
            >
              公件（銷板）— 端面剖面看下去：寬 {p.tenonWidth || "—"} × 厚 {ct} mm
            </text>
            <text x={peX + peW / 2} y={peY - 6} fontSize={8} fill="#999" textAnchor="middle">
              ↑ 板外面（銷窄、尾凹寬）
            </text>
            <text x={peX + peW / 2} y={peY + peH + 30} fontSize={8} fill="#999" textAnchor="middle">
              ↓ 板內面（銷寬、尾凹窄）
            </text>
            <DimLine
              x1={peX + peW + 10}
              y1={peY}
              x2={peX + peW + 10}
              y2={peY + peH}
              label={`厚 ${ct}`}
              side="right"
            />
          </g>
        );
      })()}

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

      {/* 角度標註：軟硬木標準角度。畫在分解圖下方一行小字 */}
      <text
        x={mAx}
        y={mBodyBot + 32}
        fontSize={9}
        fill="#0a4d8c"
      >
        標準角度：硬木 1:8（≈7.1°）｜軟木 1:6（≈9.5°）— 軟木角大才不脫
      </text>
    </svg>
  );
}

/* ============================================================
 * 指接榫 finger-joint / box joint
 *   兩塊板端面對端面 L 型接合，方齒交錯。指厚 = 板厚 / 2 是常見比例。
 * ============================================================ */
function FingerJointDetail(p: JoineryDetailParams) {
  const tl = p.tenonLength;
  const ct = p.childThickness ?? p.tenonThickness;
  const N = 5; // 視覺示意，非真實計算

  const w = 720;
  const h = 280;
  const eX = 30;
  const eY = 50;
  const aX = 400;
  const aY = 50;

  const pieceLen = 320;
  const pieceThk = 56;
  const fingerW = pieceLen / (N * 2 - 1);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ maxWidth: "720px" }} className="bg-white">
      <defs>
        <Hatching id="hatch-finger" color="#7a5a2c" />
      </defs>

      <text x={eX} y={20} fontSize={11} fontWeight="bold" fill={COLOR_OUTLINE}>
        分解圖（兩片板端面對端面）
      </text>

      {/* A 件：奇數位指（1, 3, 5）凸出 */}
      {(() => {
        const points: string[] = [`${eX},${eY + pieceThk}`, `${eX},${eY}`];
        for (let i = 0; i < N; i++) {
          const baseX = eX + i * 2 * fingerW;
          // 凸出區（finger）
          points.push(`${baseX + fingerW},${eY}`);
          points.push(`${baseX + fingerW},${eY - tl}`);
          points.push(`${baseX + 2 * fingerW},${eY - tl}`);
          points.push(`${baseX + 2 * fingerW},${eY}`);
        }
        // 最後一個 finger 後沒有凹槽
        points.push(`${eX + pieceLen},${eY}`);
        points.push(`${eX + pieceLen},${eY + pieceThk}`);
        return (
          <g>
            <polygon points={points.join(" ")} fill={COLOR_MORTISE} stroke={COLOR_OUTLINE} />
            <text x={eX + pieceLen / 2} y={eY + pieceThk + 14} fontSize={9} textAnchor="middle" fill="#666">
              A 件（{N} 個指）
            </text>
            <DimLine
              x1={eX + 2 * fingerW}
              y1={eY - tl - 4}
              x2={eX + 3 * fingerW}
              y2={eY - tl - 4}
              label={`指寬 ${Math.round(ct)}`}
              side="top"
            />
            <DimLine
              x1={eX - 10}
              y1={eY - tl}
              x2={eX - 10}
              y2={eY}
              label={`指長 ${tl}`}
              side="left"
            />
          </g>
        );
      })()}

      {/* B 件：偶數位指（2, 4）凸出，畫在下方 */}
      {(() => {
        const bY = eY + pieceThk + 60;
        const points: string[] = [`${eX},${bY - tl + tl}`, `${eX},${bY + pieceThk}`];
        // 起始凹槽（即 A 的指 1 凸出位）
        points.unshift(`${eX + fingerW},${bY}`);
        points.unshift(`${eX + fingerW},${bY - tl}`);
        points.unshift(`${eX},${bY - tl}`);
        // 內部 N-1 個凸出指
        const polyPts: string[] = [`${eX},${bY - tl}`, `${eX + fingerW},${bY - tl}`, `${eX + fingerW},${bY}`];
        for (let i = 0; i < N - 1; i++) {
          const baseX = eX + (i * 2 + 1) * fingerW;
          polyPts.push(`${baseX + fingerW},${bY}`);
          polyPts.push(`${baseX + fingerW},${bY - tl}`);
          polyPts.push(`${baseX + 2 * fingerW},${bY - tl}`);
          polyPts.push(`${baseX + 2 * fingerW},${bY}`);
        }
        polyPts.push(`${eX + pieceLen},${bY}`);
        polyPts.push(`${eX + pieceLen},${bY + pieceThk}`);
        polyPts.push(`${eX},${bY + pieceThk}`);
        return (
          <g>
            <polygon points={polyPts.join(" ")} fill={COLOR_TENON} stroke={COLOR_OUTLINE} />
            <text x={eX + pieceLen / 2} y={bY + pieceThk + 14} fontSize={9} textAnchor="middle" fill="#666">
              B 件（{N - 1} 個指 + 兩端凹）
            </text>
          </g>
        );
      })()}

      {/* 組合：L 型轉角 */}
      <text x={aX} y={20} fontSize={11} fontWeight="bold" fill={COLOR_OUTLINE}>
        組合（L 型轉角）
      </text>
      <g>
        {/* 水平 A 件 */}
        <rect x={aX} y={aY + 60} width={200} height={pieceThk} fill={COLOR_MORTISE} stroke={COLOR_OUTLINE} />
        {/* 垂直 B 件 */}
        <rect
          x={aX + 200}
          y={aY + 60}
          width={pieceThk}
          height={150}
          fill="url(#hatch-finger)"
          stroke={COLOR_OUTLINE}
        />
        {/* 指接縫線 */}
        <g stroke={COLOR_OUTLINE} strokeWidth={0.6} strokeDasharray="2 2">
          {Array.from({ length: N * 2 - 1 }).map((_, i) => {
            const y = aY + 60 + ((i + 1) * pieceThk) / (N * 2);
            return <line key={i} x1={aX + 200} y1={y} x2={aX + 200 + pieceThk} y2={y} />;
          })}
        </g>
        <text x={aX + 100} y={aY + pieceThk + 80} fontSize={9} textAnchor="middle" fill="#666">
          方齒交錯，膠合面積大
        </text>
      </g>

      <text x={eX} y={h - 10} fontSize={9} fill="#0a4d8c">
        指厚常用 = 板厚 1/2（{ct}mm 板 → {Math.round(ct / 2)}mm 指厚），比例 1:1 或 1:2 都可
      </text>
    </svg>
  );
}

/* ============================================================
 * 圓棒榫 dowel
 *   兩件對接，鑽配對孔插入木釘。釘徑 = 板厚 1/3（最大 1/2），
 *   長 = 徑 × 1.5 + 1/16" 餘量。
 * ============================================================ */
function DowelDetail(p: JoineryDetailParams) {
  const tl = p.tenonLength;
  const tt = p.tenonThickness; // 釘徑
  const ct = p.childThickness ?? p.tenonThickness;
  const cw = p.childWidth ?? p.tenonWidth;

  const w = 720;
  const h = 260;

  const eX = 30;
  const eY = 50;
  const aX = 400;
  const aY = 50;

  // 視覺：A 件在左、B 件在右，中間兩根木釘
  const pieceLen = 130;
  const pieceThk = Math.max(36, ct * 1.2);
  const dowelDiamPx = Math.max(8, tt * 0.8);
  const dowelLenPx = Math.max(40, tl * 1.4);

  const dy1 = eY + pieceThk * 0.3;
  const dy2 = eY + pieceThk * 0.7;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ maxWidth: "720px" }} className="bg-white">
      <text x={eX} y={20} fontSize={11} fontWeight="bold" fill={COLOR_OUTLINE}>
        分解圖（兩件 + 木釘）
      </text>
      <text x={eX} y={36} fontSize={9} fill="#888">
        兩件對接面各鑽配對孔（位置誤差 &lt; 0.3mm），插入木釘
      </text>

      {/* A 件 */}
      <rect x={eX} y={eY} width={pieceLen} height={pieceThk} fill={COLOR_MORTISE} stroke={COLOR_OUTLINE} />
      <circle cx={eX + pieceLen - 8} cy={dy1} r={dowelDiamPx / 2} fill="white" stroke={COLOR_OUTLINE} strokeDasharray="2 2" />
      <circle cx={eX + pieceLen - 8} cy={dy2} r={dowelDiamPx / 2} fill="white" stroke={COLOR_OUTLINE} strokeDasharray="2 2" />
      <text x={eX + pieceLen / 2} y={eY + pieceThk + 14} fontSize={9} textAnchor="middle" fill="#666">
        A 件（兩側鑽孔）
      </text>

      {/* 木釘（中央兩根） */}
      <rect
        x={eX + pieceLen + 30}
        y={dy1 - dowelDiamPx / 2}
        width={dowelLenPx}
        height={dowelDiamPx}
        fill={COLOR_TENON}
        stroke={COLOR_OUTLINE}
        rx={dowelDiamPx / 2}
      />
      <rect
        x={eX + pieceLen + 30}
        y={dy2 - dowelDiamPx / 2}
        width={dowelLenPx}
        height={dowelDiamPx}
        fill={COLOR_TENON}
        stroke={COLOR_OUTLINE}
        rx={dowelDiamPx / 2}
      />
      <text
        x={eX + pieceLen + 30 + dowelLenPx / 2}
        y={eY + pieceThk + 14}
        fontSize={9}
        textAnchor="middle"
        fill="#666"
      >
        木釘 × 2
      </text>

      {/* B 件 */}
      <rect
        x={eX + pieceLen + 30 + dowelLenPx + 30}
        y={eY}
        width={pieceLen}
        height={pieceThk}
        fill={COLOR_MORTISE}
        stroke={COLOR_OUTLINE}
      />
      <circle
        cx={eX + pieceLen + 30 + dowelLenPx + 30 + 8}
        cy={dy1}
        r={dowelDiamPx / 2}
        fill="white"
        stroke={COLOR_OUTLINE}
        strokeDasharray="2 2"
      />
      <circle
        cx={eX + pieceLen + 30 + dowelLenPx + 30 + 8}
        cy={dy2}
        r={dowelDiamPx / 2}
        fill="white"
        stroke={COLOR_OUTLINE}
        strokeDasharray="2 2"
      />
      <text
        x={eX + pieceLen + 30 + dowelLenPx + 30 + pieceLen / 2}
        y={eY + pieceThk + 14}
        fontSize={9}
        textAnchor="middle"
        fill="#666"
      >
        B 件（鑽配對孔）
      </text>

      {/* 組合 */}
      <text x={aX} y={120} fontSize={11} fontWeight="bold" fill={COLOR_OUTLINE}>
        組合
      </text>
      <g>
        <rect x={aX} y={aY + 80} width={pieceLen + 40} height={pieceThk} fill={COLOR_MORTISE} stroke={COLOR_OUTLINE} />
        <rect
          x={aX + pieceLen + 40}
          y={aY + 80}
          width={pieceLen + 40}
          height={pieceThk}
          fill={COLOR_MORTISE}
          stroke={COLOR_OUTLINE}
        />
        {/* 木釘埋在交界處（虛線） */}
        <line
          x1={aX + pieceLen + 20}
          y1={aY + 80 + pieceThk * 0.3}
          x2={aX + pieceLen + 60}
          y2={aY + 80 + pieceThk * 0.3}
          stroke="#a85"
          strokeWidth={2}
        />
        <line
          x1={aX + pieceLen + 20}
          y1={aY + 80 + pieceThk * 0.7}
          x2={aX + pieceLen + 60}
          y2={aY + 80 + pieceThk * 0.7}
          stroke="#a85"
          strokeWidth={2}
        />
        <text x={aX + pieceLen + 40} y={aY + 80 + pieceThk + 14} fontSize={9} textAnchor="middle" fill="#666">
          木釘埋於兩件之間，加白膠
        </text>
      </g>

      <text x={eX} y={h - 12} fontSize={9} fill="#0a4d8c">
        釘徑 {tt}mm（建議 = 板厚 1/3，最大 1/2）· 釘長 {tl}mm（建議徑×1.5）· 板寬 {cw}mm
      </text>
    </svg>
  );
}

/* ============================================================
 * 斜接餅乾榫 mitered-spline
 *   兩件 45° 斜接，中間開槽插入餅乾片（biscuit）或薄木條補強。
 * ============================================================ */
function MiteredSplineDetail(p: JoineryDetailParams) {
  const tl = p.tenonLength;
  const ct = p.childThickness ?? p.tenonThickness;

  const w = 720;
  const h = 260;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ maxWidth: "720px" }} className="bg-white">
      <defs>
        <Hatching id="hatch-ms" color="#7a5a2c" />
      </defs>
      <text x={30} y={20} fontSize={11} fontWeight="bold" fill={COLOR_OUTLINE}>
        分解圖（兩件 45° + 餅乾片）
      </text>
      <text x={30} y={36} fontSize={9} fill="#888">
        兩件斜切面對面，中央開弧形槽嵌入餅乾片
      </text>

      {/* A 件：橫向板、右端 45° 斜切 */}
      <polygon
        points={`30,70 220,70 250,110 30,110`}
        fill={COLOR_MORTISE}
        stroke={COLOR_OUTLINE}
      />
      <text x={125} y={130} fontSize={9} textAnchor="middle" fill="#666">
        A 件（右端 45° 斜切）
      </text>
      {/* 餅乾槽（弧形） */}
      <ellipse cx={235} cy={90} rx={14} ry={6} fill="white" stroke={COLOR_OUTLINE} strokeDasharray="3 2" />

      {/* 餅乾片（獨立件） */}
      <ellipse cx={360} cy={95} rx={22} ry={8} fill={COLOR_TENON} stroke={COLOR_OUTLINE} />
      <text x={360} y={130} fontSize={9} textAnchor="middle" fill="#666">
        餅乾片（壓縮木 #0/#10/#20）
      </text>

      {/* B 件：垂直板、左端 45° 斜切 */}
      <polygon
        points={`460,110 490,70 680,70 680,110`}
        fill={COLOR_MORTISE}
        stroke={COLOR_OUTLINE}
      />
      <text x={585} y={130} fontSize={9} textAnchor="middle" fill="#666">
        B 件（左端 45° 斜切）
      </text>
      <ellipse cx={475} cy={90} rx={14} ry={6} fill="white" stroke={COLOR_OUTLINE} strokeDasharray="3 2" />

      {/* 組合：L 型轉角 */}
      <g transform="translate(0, 160)">
        <polygon points={`30,0 270,0 290,20 30,20`} fill="url(#hatch-ms)" stroke={COLOR_OUTLINE} />
        <polygon points={`270,0 290,20 290,80 270,60`} fill={COLOR_TENON} stroke={COLOR_OUTLINE} />
        <text x={200} y={48} fontSize={9} fill="#666">
          45° 接縫平整，餅乾片吸水膨脹自鎖
        </text>
      </g>

      <text x={30} y={h - 8} fontSize={9} fill="#0a4d8c">
        板厚 {ct}mm · 餅乾片長 {tl}mm · 常用於櫃框 / 畫框轉角
      </text>
    </svg>
  );
}

/* ============================================================
 * 口袋孔螺絲 pocket-hole
 *   15° 斜孔器夾具鑽孔，螺絲從隱藏面鎖入，外觀看不到螺絲頭。
 * ============================================================ */
function PocketHoleDetail(p: JoineryDetailParams) {
  const ct = p.childThickness ?? p.tenonThickness;

  const w = 720;
  const h = 280;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ maxWidth: "720px" }} className="bg-white">
      <text x={30} y={20} fontSize={11} fontWeight="bold" fill={COLOR_OUTLINE}>
        剖面圖（15° 斜孔 + 自攻螺絲）
      </text>
      <text x={30} y={36} fontSize={9} fill="#888">
        A 件背面鑽 15° 斜孔，螺絲從隱藏面鎖進 B 件
      </text>

      {/* A 件（水平板）含斜孔 */}
      <rect x={30} y={70} width={280} height={54} fill={COLOR_MORTISE} stroke={COLOR_OUTLINE} />
      {/* 斜孔 (15°) */}
      <polygon
        points={`180,124 210,124 240,78 230,70 200,70`}
        fill="white"
        stroke={COLOR_OUTLINE}
        strokeDasharray="3 2"
      />
      <text x={155} y={140} fontSize={9} textAnchor="middle" fill="#666">
        A 件（背面鑽孔）
      </text>

      {/* B 件（垂直板） */}
      <rect x={300} y={70} width={56} height={180} fill={COLOR_MORTISE} stroke={COLOR_OUTLINE} />
      <text x={328} y={265} fontSize={9} textAnchor="middle" fill="#666">
        B 件
      </text>

      {/* 螺絲（從 A 的斜孔穿進 B） */}
      <g>
        {/* 螺桿 */}
        <line x1={205} y1={105} x2={340} y2={100} stroke="#888" strokeWidth={3} />
        {/* 螺紋 */}
        {Array.from({ length: 8 }).map((_, i) => {
          const t = i / 7;
          const x = 215 + (325 - 215) * t;
          const y = 104 - 2 * t;
          return (
            <line key={i} x1={x - 3} y1={y - 4} x2={x + 3} y2={y + 4} stroke="#666" strokeWidth={0.8} />
          );
        })}
        {/* 螺絲頭（在斜孔袋內） */}
        <rect x={198} y={100} width={14} height={10} fill="#555" stroke={COLOR_OUTLINE} />
      </g>
      <text x={320} y={60} fontSize={9} fill="#a85">
        ← 自攻螺絲（粗牙、尖頭）
      </text>

      {/* 組合結果說明 */}
      <g transform="translate(420, 60)">
        <text fontSize={11} fontWeight="bold" fill={COLOR_OUTLINE}>
          組裝後
        </text>
        <rect x={0} y={20} width={180} height={34} fill={COLOR_MORTISE} stroke={COLOR_OUTLINE} />
        <rect x={180} y={20} width={40} height={140} fill={COLOR_MORTISE} stroke={COLOR_OUTLINE} />
        {/* 斜孔（隱藏面看得到的孔袋） */}
        <polygon
          points={`80,54 100,54 120,40 110,34 90,34`}
          fill="white"
          stroke={COLOR_OUTLINE}
          strokeDasharray="2 2"
        />
        <text x={110} y={88} fontSize={9} fill="#666">
          斜孔在 A 的隱藏面
        </text>
        <text x={110} y={100} fontSize={8} fill="#999">
          可用木塞封口
        </text>
      </g>

      <text x={30} y={h - 8} fontSize={9} fill="#0a4d8c">
        板厚 {ct}mm · 15° 標準角度 · Kreg 斜孔器 / Milescraft 夾具
      </text>
    </svg>
  );
}

/* ============================================================
 * 螺絲 + 白膠 screw
 *   最簡單接合：先鑽先導孔避免劈裂，再鎖螺絲 + 上白膠補強。
 * ============================================================ */
function ScrewDetail(p: JoineryDetailParams) {
  const ct = p.childThickness ?? p.tenonThickness;

  const w = 720;
  const h = 240;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ maxWidth: "720px" }} className="bg-white">
      <text x={30} y={20} fontSize={11} fontWeight="bold" fill={COLOR_OUTLINE}>
        剖面圖（先導孔 + 自攻螺絲 + 白膠）
      </text>
      <text x={30} y={36} fontSize={9} fill="#888">
        硬木務必先鑽先導孔（螺桿徑 × 80%）避免木料劈裂
      </text>

      {/* A 件（上方橫板） */}
      <rect x={30} y={70} width={300} height={40} fill={COLOR_MORTISE} stroke={COLOR_OUTLINE} />
      <text x={180} y={128} fontSize={9} textAnchor="middle" fill="#666">
        A 件（含螺絲埋頭孔 + 先導孔）
      </text>

      {/* B 件（下方直板） */}
      <rect x={30} y={110} width={300} height={90} fill={COLOR_MORTISE} stroke={COLOR_OUTLINE} />
      <text x={180} y={218} fontSize={9} textAnchor="middle" fill="#666">
        B 件（直接鎖入，無先導孔）
      </text>

      {/* 螺絲（垂直） */}
      {[120, 240].map((cx, i) => (
        <g key={i}>
          {/* 埋頭孔（A 件上方） */}
          <polygon
            points={`${cx - 6},70 ${cx + 6},70 ${cx + 3},76 ${cx - 3},76`}
            fill="white"
            stroke={COLOR_OUTLINE}
          />
          {/* 螺桿 */}
          <line x1={cx} y1={76} x2={cx} y2={185} stroke="#888" strokeWidth={2.5} />
          {/* 螺紋（下半段） */}
          {Array.from({ length: 14 }).map((_, j) => {
            const y = 115 + j * 5;
            return <line key={j} x1={cx - 3} y1={y} x2={cx + 3} y2={y - 2} stroke="#666" strokeWidth={0.7} />;
          })}
          {/* 白膠縫（螺絲旁的虛線） */}
          <line x1={cx - 14} y1={110} x2={cx + 14} y2={110} stroke="#e8a" strokeWidth={1} strokeDasharray="2 1.5" />
        </g>
      ))}
      <text x={340} y={110} fontSize={8} fill="#c58">
        ← 白膠塗滿接合面
      </text>
      <text x={340} y={80} fontSize={8} fill="#666">
        ← 螺絲頭埋頭（可用木塞蓋）
      </text>

      <text x={30} y={h - 8} fontSize={9} fill="#0a4d8c">
        板厚 {ct}mm · 螺絲徑 = 板厚 1/4（4mm 常用）· 先導孔 = 螺桿徑 × 80%
      </text>
    </svg>
  );
}

/**
 * Stub joint (整支卡榫 / housing joint)：牙條/橫撐不另做榫，整個端面（全斷面）
 * 卡進母件上挖的同尺寸寬深榫眼。常用於圓腳——圓側面難加工標準肩榫。
 *
 * 視覺差異 vs blind-tenon：
 * - 沒有「肩」（榫頭斷面 = 公件斷面，不縮小）
 * - 母件榫眼斷面 = 公件全斷面（apronWidth × apronThickness）
 * - 圓腳時母件畫圓、榫眼是內接的長方形
 */
function StubJointDetail(p: JoineryDetailParams) {
  const tl = p.tenonLength;
  const cw = p.childWidth ?? p.tenonWidth;
  const ct = p.childThickness ?? p.tenonThickness;
  const mt = p.motherThickness;
  const isRound = p.motherShape === "round";

  const s = fitScale(Math.max(mt, cw + 40, ct + 40, tl * 4) * 1.4, 200);
  const PX = (mm: number) => mm * s;
  const sAsm = Math.max(fitScale(Math.max(mt, tl + cw, cw) * 1.1, 200), 160 / mt);
  const AX = (mm: number) => mm * sAsm;

  const leftPad = 50;

  // EXPLODED: 母件 = 圓 / 方斷面側面（顯示榫眼開口）
  const motherFaceW = isRound ? PX(mt) + 30 : PX(mt) + 30;
  const motherFaceH = PX(cw) + 80;
  const childBodyLen = Math.max(120, PX(cw) * 1.6);
  const expWidth = Math.max(motherFaceW + 100, childBodyLen + PX(tl) + 80);
  const expHeight = motherFaceH + 40 + PX(ct) + 80;

  // ASSEMBLED: 母件 = 圓 (或方)、榫眼 = 整個牙條斷面（cw × ct）
  const asmLegSide = AX(mt);
  const asmApronLen = Math.max(160, AX(cw) * 1.2);
  const asmWidth = asmLegSide + asmApronLen + 130;
  const asmHeight = asmLegSide + 100;

  const w = expWidth + asmWidth + PADDING * 3 + leftPad;
  const h = Math.max(expHeight, asmHeight) + PADDING + 60;

  // 分解圖位置
  const mAx = PADDING + leftPad;
  const mAy = PADDING + 30;
  const mortiseW = PX(ct);
  const mortiseH = PX(cw);
  const mortiseX = mAx + (motherFaceW - mortiseW) / 2;
  const mortiseY = mAy + (motherFaceH - mortiseH) / 2;
  const cAx = PADDING + leftPad;
  const cAy = mAy + motherFaceH + 40;

  // 組合圖位置
  const asmOriginX = PADDING * 2 + expWidth + leftPad;
  const asmLegX = asmOriginX + 20;
  const asmLegY = PADDING + 30;
  const asmCx = asmLegX + asmLegSide / 2;
  const asmCy = asmLegY + asmLegSide / 2;
  const asmR = asmLegSide / 2;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ maxWidth: "720px" }} className="bg-white">
      <defs>
        <Hatching id="hatch-stub" color="#7a5a2c" />
      </defs>

      {/* ========= EXPLODED ========= */}
      <text x={PADDING} y={18} fontSize={11} fontWeight="bold" fill={COLOR_OUTLINE}>
        分解圖
      </text>

      {/* 母件側面（圓腳側面 = 矩形，方腳側面也是矩形，外形相同）+ 寬深榫眼開口 */}
      <g>
        <rect x={mAx} y={mAy} width={motherFaceW} height={motherFaceH} fill={COLOR_MORTISE} stroke={COLOR_OUTLINE} />
        <rect x={mortiseX} y={mortiseY} width={mortiseW} height={mortiseH} fill="#3d2a14" stroke={COLOR_OUTLINE} />
        <text x={mAx + motherFaceW / 2} y={mAy + motherFaceH + 16} fontSize={9} textAnchor="middle" fill="#666">
          母件（{isRound ? "圓腳側面" : "方腳側面"}） — 寬深榫眼 = 公件全斷面
        </text>
      </g>

      {/* 公件 — 整支牙條，端面 = 全斷面（無縮小，無肩） */}
      <g>
        <rect x={cAx} y={cAy} width={childBodyLen} height={PX(ct)} fill={COLOR_TENON} stroke={COLOR_OUTLINE} />
        {/* 凸出的「stub」——其實就是 body 的延伸，沒有縮減 */}
        <rect x={cAx + childBodyLen} y={cAy} width={PX(tl)} height={PX(ct)} fill={COLOR_TENON} stroke={COLOR_OUTLINE} strokeDasharray="2 2" />
        <text x={cAx + childBodyLen / 2} y={cAy + PX(ct) + 14} fontSize={9} textAnchor="middle" fill="#666">
          公件（牙條 / 橫撐）— 整支端面 = 榫，無肩
        </text>
        <DimLine x1={cAx + childBodyLen} y1={cAy + PX(ct) + 4} x2={cAx + childBodyLen + PX(tl)} y2={cAy + PX(ct) + 4} label={`卡入深 ${tl}`} side="bottom" />
      </g>

      {/* ========= ASSEMBLED ========= */}
      <text x={asmOriginX} y={18} fontSize={11} fontWeight="bold" fill={COLOR_OUTLINE}>
        組合剖面（上視切面）
      </text>

      {(() => {
        const mortiseL = AX(tl);
        const mortiseT = AX(ct);
        // 母件外形（圓 vs 方）
        const motherShapeEl = isRound ? (
          <circle cx={asmCx} cy={asmCy} r={asmR} fill="url(#hatch-stub)" stroke={COLOR_OUTLINE} />
        ) : (
          <rect x={asmLegX} y={asmLegY} width={asmLegSide} height={asmLegSide} fill="url(#hatch-stub)" stroke={COLOR_OUTLINE} />
        );
        // 榫眼從母件右邊往內挖（公件斷面卡進去），寬度 = mortiseT (= ct)
        const mortiseTop = asmCy - mortiseT / 2;
        const mortiseLeft = asmLegX + asmLegSide - mortiseL;
        const apronOuterRight = asmLegX + asmLegSide + asmApronLen;
        return (
          <g>
            {motherShapeEl}
            {/* Stub 榫頭（與牙板 body 同斷面，無肩）填入榫眼並延伸出來 */}
            <rect x={mortiseLeft} y={mortiseTop} width={mortiseL + asmApronLen} height={mortiseT} fill={COLOR_TENON} stroke={COLOR_OUTLINE} strokeWidth={0.8} />
            {/* 母件榫眼開口虛線（圓 / 方都標一下） */}
            <rect x={mortiseLeft} y={mortiseTop} width={mortiseL} height={mortiseT} fill="none" stroke="#555" strokeWidth={0.5} strokeDasharray="2 1.5" />
            {/* 標籤 */}
            <text x={asmCx} y={asmLegY - 8} fontSize={9} textAnchor="middle" fill="#5a3f1e" fontWeight="bold">
              母件（{isRound ? "圓腳" : "方腳"}）
            </text>
            <text x={(asmLegX + asmLegSide + apronOuterRight) / 2} y={asmCy - mortiseT / 2 - 10} fontSize={9} textAnchor="middle" fill="#8a6a3a" fontWeight="bold">
              整支牙條（無肩）
            </text>
            <text x={asmLegX + asmLegSide + asmApronLen / 2} y={asmLegY + asmLegSide + 20} fontSize={9} textAnchor="middle" fill="#666">
              整支端面 = 榫，無縮小、無肩
            </text>
            <DimLine x1={asmLegX} y1={asmLegY - 22} x2={asmLegX + asmLegSide} y2={asmLegY - 22} label={`母件${isRound ? "直徑" : "寬"} ${mt}`} side="top" />
            <DimLine x1={mortiseLeft} y1={asmLegY + asmLegSide + 34} x2={asmLegX + asmLegSide} y2={asmLegY + asmLegSide + 34} label={`卡入深 ${tl}`} side="bottom" />
            <DimLine x1={apronOuterRight + 10} y1={mortiseTop} x2={apronOuterRight + 10} y2={mortiseTop + mortiseT} label={`板厚 ${ct}`} side="right" />
          </g>
        );
      })()}
    </svg>
  );
}

const RENDERERS: Partial<
  Record<JoineryType, (p: JoineryDetailParams) => React.ReactElement>
> = {
  "through-tenon": ThroughTenonDetail,
  "blind-tenon": BlindTenonDetail,
  "shouldered-tenon": ShoulderedTenonDetail,
  "stub-joint": StubJointDetail,
  "half-lap": HalfLapDetail,
  "tongue-and-groove": TongueAndGrooveDetail,
  dovetail: DovetailDetail,
  "finger-joint": FingerJointDetail,
  dowel: DowelDetail,
  "mitered-spline": MiteredSplineDetail,
  "pocket-hole": PocketHoleDetail,
  screw: ScrewDetail,
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
  "shouldered-tenon": "帶肩榫（haunched）",
  "stub-joint": "整支卡榫（housing joint）",
  "half-lap": "半搭榫",
  dovetail: "鳩尾榫",
  "finger-joint": "指接榫",
  "tongue-and-groove": "企口榫",
  dowel: "圓棒榫",
  "mitered-spline": "斜接餅乾榫",
  "pocket-hole": "斜孔螺絲（口袋孔）",
  screw: "螺絲 + 白膠",
};

export const JOINERY_DESCRIPTION: Record<JoineryType, string> = {
  "through-tenon": "榫頭穿過母件、可從另一面看到。強度最高，適合椅腳、桌腳重要結構。",
  "blind-tenon": "榫頭藏在母件內、外觀看不到。美觀，適合桌腳橫撐、櫃體等。",
  "shouldered-tenon": "主榫加上方的「肩榫」（haunch），主榫扛拉力、肩榫防旋轉。桌腳↔牙板正規做法。",
  "stub-joint": "牙條/橫撐不另外做榫，整支端面（全斷面）直接卡進母件上挖的同尺寸寬深榫眼。常用於圓腳——曲面難加工標準肩榫，整支卡進去最直接。",
  "half-lap": "兩件各削一半厚度後相疊，搭肩固定。簡單常用於框架交叉。",
  dovetail: "梯形榫頭咬合，抗拉力極強。經典用於抽屜、箱體轉角。",
  "finger-joint": "對稱方齒交錯接合。常用於箱體、托盤轉角。",
  "tongue-and-groove": "一面凸舌、一面凹槽，板材拼寬常用。",
  dowel: "另插入圓棒做接合，工法簡單但強度較低。",
  "mitered-spline": "45° 斜接後插入餅乾片或薄木條補強。",
  "pocket-hole": "用斜孔器夾具鑽 15° 斜孔，再用專用螺絲從隱藏處鎖入。快速、不需榫卯的常見接合方式。",
  screw: "木工白膠 + 木螺絲直鎖。螺絲頭可埋頭並用木塞蓋住，最簡單。",
};
