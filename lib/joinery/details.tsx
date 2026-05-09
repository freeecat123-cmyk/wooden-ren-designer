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
  COLOR,
  STROKE,
  FONT,
  DASH,
  DimLine,
  Hatching,
  fitScale,
  CenterLine,
  SectionMark,
  HiddenEdge,
  GrainArrow,
  TitleBlock,
  IsometricGroup,
  ThreeViewLayout,
  WarningCallout,
} from "./draw-primitives";

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
  /** 公件材料（給燕尾榫決定 1:6 軟木 vs 1:8 硬木 標準斜度） */
  material?: import("@/lib/types").MaterialId;
}

// 顏色常數改為從 draw-primitives 引入後的本地別名（避免改 100+ 處 call site）。
const COLOR_TENON = COLOR.TENON;
const COLOR_MORTISE = COLOR.MORTISE;
const COLOR_OUTLINE = COLOR.OUTLINE;
const COLOR_DIM = COLOR.DIM;
const COLOR_HIDDEN = COLOR.HIDDEN;

/**
 * 燕尾榫斜度標準（per drafting-math.md §B2）：
 *   軟木（密度 < 600 kg/m³）→ 1:6（≈9.46°）
 *   硬木（密度 ≥ 600 kg/m³）→ 1:8（≈7.13°）
 *   板材 / 不確定 → 1:8（保守）
 */
function pickDovetailAngle(materialId?: import("@/lib/types").MaterialId): string {
  if (!materialId) return "1:8 硬木標準";
  // 跟 lib/materials/index.ts 同步維護的軟木清單（density < 600）
  const SOFTWOODS = new Set(["taiwan-cypress", "douglas-fir", "pine", "spruce", "cedar"]);
  if (SOFTWOODS.has(materialId)) return "1:6 軟木標準";
  return "1:8 硬木標準";
}

const PADDING = 30;

// DimLine / Hatching / fitScale 已搬到 ./draw-primitives，這裡保留 import 即可。

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
  const tl = p.tenonLength;
  const tw = p.tenonWidth;          // joint 總寬（沿板寬方向）
  const tt = p.tenonThickness;
  const ct = p.childThickness ?? tt; // 公件板厚
  const mt = p.motherThickness;      // 母件板厚（= tail 深度，through dovetail 時）

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
  // 子件「板厚」右標尺需要 ~50px，原本只給 PADDING(30) 會被組合矩形蓋住 → 補 asmGap
  const asmGap = 60;
  const expW = pieceLen * 2 + gap;
  const asmW = pieceLen * 0.9 + pieceDepth + 30;
  const w = expW + asmW + PADDING * 2 + asmGap + leftPad;
  // h 多預留：頂端 70px 給「尾寬/銷寬」兩條標尺 + 尾頂文字、底端 +50 給「板寬」標尺與標準角度文字
  const h = pieceDepth + bodyExt + 140;

  // Mother = TAIL board (left)
  const mAx = PADDING + leftPad;
  const mAy = PADDING + 70; // 上推給標尺 + 尾頂文字空間
  const mBodyTop = mAy + pieceDepth;
  const mBodyBot = mBodyTop + bodyExt;

  // Child = PIN board (right)
  const cAx = mAx + pieceLen + gap;
  const cAy = mAy;
  void cAy;

  const asmX = mAx + expW + PADDING + asmGap;
  const asmY = mAy;

  return (
    <>
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
              母件（尾板，板厚 {mt}mm，{N_TAILS} 個尾 + 兩端半銷凹）
            </text>
            {/* 標尺：榫深（垂直）+ 板寬（水平）+ 尾寬 + 銷寬 */}
            <DimLine
              x1={mAx - 10}
              y1={mAy}
              x2={mAx - 10}
              y2={mBodyTop}
              label={`榫深 ${tl}mm`}
              side="left"
            />
            <DimLine
              x1={mAx}
              y1={mBodyBot + 36}
              x2={mAx + pieceLen}
              y2={mBodyBot + 36}
              label={`板寬 ${tw || "—"}mm`}
              side="bottom"
            />
            {/* 尾寬與銷寬（單一標註，避免擠）*/}
            {(() => {
              const firstTailLeft = mAx + halfPinW_top;
              const firstTailRight = firstTailLeft + tailW;
              return (
                <>
                  <DimLine
                    x1={firstTailLeft}
                    y1={mAy - 12}
                    x2={firstTailRight}
                    y2={mAy - 12}
                    label={`尾寬 ≈ ${Math.round((tw || pieceLen) / (N_TAILS * 1.55))}mm`}
                    side="top"
                  />
                  <DimLine
                    x1={firstTailRight}
                    y1={mAy - 28}
                    x2={firstTailRight + pinW}
                    y2={mAy - 28}
                    label={`銷寬 ≈ ${Math.round(((tw || pieceLen) / (N_TAILS * 1.55)) * 0.55)}mm`}
                    side="top"
                  />
                </>
              );
            })()}
            <text x={mAx + pieceLen / 2} y={mAy - 58} fontSize={8} fill="#999" textAnchor="middle">
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
              公件（銷板）— 端面剖面看下去：寬 {tw || "—"} × 厚 {ct}mm
            </text>
            <text x={peX + peW / 2} y={peY - 6} fontSize={8} fill="#999" textAnchor="middle">
              ↑ 板外面（銷窄、尾凹寬）
            </text>
            <text x={peX + peW / 2} y={peY + peH + 30} fontSize={8} fill="#999" textAnchor="middle">
              ↓ 板內面（銷寬、尾凹窄）
            </text>
            {/* 標尺：板厚（剖面高）+ 板寬（剖面寬，跟母件對齊）*/}
            <DimLine
              x1={peX + peW + 10}
              y1={peY}
              x2={peX + peW + 10}
              y2={peY + peH}
              label={`板厚 ${ct}mm`}
              side="right"
            />
            <DimLine
              x1={peX}
              y1={peY + peH + 36}
              x2={peX + peW}
              y2={peY + peH + 36}
              label={`板寬 ${tw || "—"}mm`}
              side="bottom"
            />
            {/* 角度標註（visual exaggerated 1:3，但實際工法是 1:8 硬木 / 1:6 軟木）*/}
            {(() => {
              // 取第一個 socket 的左斜邊做角度標
              const sx = peX + halfPinW_top;
              // 依材料密度決定標準斜度：軟木（< 600 kg/m³）= 1:6，硬木 = 1:8
              const angleLabel = pickDovetailAngle(p.material);
              return (
                <g>
                  <line
                    x1={sx + 2}
                    y1={peY + 4}
                    x2={sx + dtAngleHOffset + 2}
                    y2={peY + peH - 4}
                    stroke="#0a4d8c"
                    strokeWidth={0.6}
                    strokeDasharray="2 2"
                  />
                  <text
                    x={sx + dtAngleHOffset / 2 + 8}
                    y={peY + peH / 2}
                    fontSize={8}
                    fill="#0a4d8c"
                  >
                    {angleLabel}
                  </text>
                </g>
              );
            })()}
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

      {/* 角度標註：軟硬木標準角度（畫在板寬標尺下方）*/}
      <text
        x={mAx}
        y={mBodyBot + 60}
        fontSize={9}
        fill="#0a4d8c"
      >
        標準角度：硬木 1:8（≈7.1°）｜軟木 1:6（≈9.5°）— 軟木角大才不脫
      </text>
    </svg>
    {/* ============================================================
     * 第 4、5 圖：3D 輔助透視（cabinet projection）
     *   4. 鳩尾母件（尾板）axonometric — 看到尾頭立體形狀
     *   5. 組合 L 型轉角 axonometric — 看到兩件咬合
     * ============================================================ */}
    <DovetailAxon3D
      pieceLen={pieceLen}
      pieceDepth={pieceDepth}
      bodyExt={bodyExt}
      tailW={tailW}
      pinW={pinW}
      halfPinW_top={halfPinW_top}
      N_TAILS={N_TAILS}
      mt={mt}
      ct={ct}
      tw={tw}
      tl={tl}
    />
    </>
  );
}

function DovetailAxon3D({
  pieceLen,
  pieceDepth,
  bodyExt,
  tailW,
  pinW,
  halfPinW_top,
  N_TAILS,
  mt,
  ct,
  tw,
  tl,
}: {
  pieceLen: number;
  pieceDepth: number;
  bodyExt: number;
  tailW: number;
  pinW: number;
  halfPinW_top: number;
  N_TAILS: number;
  mt: number;
  ct: number;
  tw: number;
  tl: number;
}) {
  void ct;
  void pieceLen;
  void pieceDepth;
  void bodyExt;
  void tailW;
  void pinW;
  void halfPinW_top;
  // Cabinet projection：z 軸向右上 30°，深度縮 0.5
  const ANG = (30 * Math.PI) / 180;
  const DZ_X = Math.cos(ANG) * 0.5;
  const DZ_Y = -Math.sin(ANG) * 0.5;

  // ============================================================
  // 共用：建立鳩尾母件 face outline（鋸齒朝某個方向凸出）
  //   - 完全沿用前 3 張 2D 圖的形狀邏輯
  //   - tailDir = "up" 時 tails 朝 -Y（板端在 yTop），body 朝 +Y
  //   - tailDir = "down" 時 tails 朝 +Y（板端在 yBot），body 朝 -Y
  //   回傳 CCW polygon points，face 朝觀眾 (+Z)
  // ============================================================
  const buildToothedOutline = (
    OX: number,
    yBody: number,           // body 那一側的 y（板身較深處）
    yEdge: number,           // 板端（tails 末端那一側）的 y
    yMid: number,            // tail base / body 與 tail 分界
    totalW: number,
    nTails: number,
    tW: number,
    pW: number,
    hP: number,
    off: number,
  ): Array<[number, number]> => {
    const pts: Array<[number, number]> = [];
    // body 角 → body 上緣 → 進入 tail 區
    pts.push([OX, yBody]);
    pts.push([OX, yMid]);
    pts.push([OX + hP + off, yMid]);
    let tL = OX + hP;
    pts.push([tL, yEdge]);
    for (let i = 0; i < nTails; i++) {
      const tR = tL + tW;
      pts.push([tR, yEdge]);
      if (i < nTails - 1) {
        pts.push([tR - off, yMid]);
        const nL = tR + pW;
        pts.push([nL + off, yMid]);
        pts.push([nL, yEdge]);
        tL = nL;
      }
    }
    const lastTR = tL + tW;
    pts.push([lastTR - off, yMid]);
    pts.push([OX + totalW, yMid]);
    pts.push([OX + totalW, yBody]);
    return pts;
  };

  // 建立 pin board face outline：face 是矩形，但靠 mating 邊有 N 個 socket 凹切
  // edgeSide = "top" 表示 sockets 在 yMin 邊；socket mouth 寬、bottom 窄（沿 X 方向 taper）
  const buildPinFaceOutline = (
    OX: number,
    yEdge: number,           // 嵌合邊（sockets 在這條邊）
    yDeep: number,           // socket bottom 的 y（從 edge 進去 tailDepth 深）
    yFar: number,            // 板的另一端（沒嵌合的那邊）
    totalW: number,
    nTails: number,
    tW: number,
    pW: number,
    hP: number,
    off: number,
  ): Array<[number, number]> => {
    const pts: Array<[number, number]> = [];
    pts.push([OX, yEdge]);
    let x = OX + hP;
    pts.push([x, yEdge]);                // 第一個 socket mouth left
    for (let i = 0; i < nTails; i++) {
      pts.push([x + off, yDeep]);        // 斜下到 socket bottom-left
      pts.push([x + tW - off, yDeep]);   // 平到 socket bottom-right
      pts.push([x + tW, yEdge]);         // 斜上到 socket mouth right
      if (i < nTails - 1) {
        const nextL = x + tW + pW;
        pts.push([nextL, yEdge]);
        x = nextL;
      }
    }
    pts.push([OX + totalW, yEdge]);
    pts.push([OX + totalW, yFar]);
    pts.push([OX, yFar]);
    return pts;
  };

  // ============================================================
  // View 4：母件 face outline 沿 Z 方向 extrude
  // ============================================================
  const v4_OX = 30;
  const v4_OY = 50;
  const v4_W = 240;
  const v4_TailH = 32;
  const v4_BodyH = 50;
  const v4_Thk = 28;
  const v4_Off = v4_TailH * 0.35;
  const v4_tW = v4_W / (N_TAILS * 1.55);
  const v4_pW = v4_tW * 0.55;
  const v4_hP = v4_pW / 2;

  const v4_yEdge = v4_OY;                    // 板端（tails 最上緣）
  const v4_yMid = v4_OY + v4_TailH;
  const v4_yBody = v4_OY + v4_TailH + v4_BodyH;

  const v4Outline = buildToothedOutline(
    v4_OX, v4_yBody, v4_yEdge, v4_yMid, v4_W,
    N_TAILS, v4_tW, v4_pW, v4_hP, v4_Off,
  );

  const v4_dxz = v4_Thk * DZ_X;
  const v4_dyz = v4_Thk * DZ_Y;
  const v4OutlineBack = v4Outline.map(([x, y]) => [x + v4_dxz, y + v4_dyz] as [number, number]);

  // 看得見的 side quads：edge 朝上 (dy<0) 或朝右 (dx>0) 才畫
  // outline 為 CCW、face 朝 +Z
  const buildSideQuads = (
    front: Array<[number, number]>,
    back: Array<[number, number]>,
  ): Array<Array<[number, number]>> => {
    const quads: Array<Array<[number, number]>> = [];
    for (let i = 0; i < front.length; i++) {
      const j = (i + 1) % front.length;
      const [x1, y1] = front[i];
      const [x2, y2] = front[j];
      const dx = x2 - x1;
      const dy = y2 - y1;
      if (dy < -0.1 || dx > 0.1) {
        quads.push([front[i], front[j], back[j], back[i]]);
      }
    }
    return quads;
  };
  const v4SideQuads = buildSideQuads(v4Outline, v4OutlineBack);

  // ============================================================
  // View 5：真實 L 型轉角組合（cabinet 投影 3D，兩板實際嵌合）
  //   - 水平頂板（top board）長度沿 +X 方向
  //   - 垂直側板（side board）長度沿 +Y 方向
  //   - 兩板交會於右上角；through dovetail 從上方看到尾頭嵌入
  //   - tails 從頂板末端伸入側板厚度內，taper 沿 Z（深度）方向
  // ============================================================
  const v5_OX = v4_OX + v4_W + 80 + Math.abs(v4_dxz);
  const v5_OY = v4_OY + 10;
  const topLen = 170;          // 頂板長（X）
  const sideH = 130;           // 側板高（Y，含與頂板重疊的 t）
  const tt = 22;               // 兩板厚度
  const depth = 36;            // 板寬 = Z 深度
  const v5N = N_TAILS;
  const tailZw = (depth - 4) / (v5N * 1.55);
  const pinZw = tailZw * 0.55;
  const halfPinZw = pinZw / 2;
  const zOff = tailZw * 0.18;  // tail 在 Z 方向 taper 量

  const v5proj = (x: number, y: number, z: number): [number, number] =>
    [v5_OX + x + z * DZ_X, v5_OY + y + z * DZ_Y];

  // L 前 face（z=0）：頂板 + 側板組成 L 形
  const v5FrontL: Array<[number, number]> = [
    v5proj(0, 0, 0),
    v5proj(topLen + tt, 0, 0),
    v5proj(topLen + tt, sideH + tt, 0),
    v5proj(topLen, sideH + tt, 0),
    v5proj(topLen, tt, 0),
    v5proj(0, tt, 0),
  ];

  // 側板右外面（x = topLen+tt 平面）
  const v5RightFace: Array<[number, number]> = [
    v5proj(topLen + tt, 0, 0),
    v5proj(topLen + tt, sideH + tt, 0),
    v5proj(topLen + tt, sideH + tt, depth),
    v5proj(topLen + tt, 0, depth),
  ];

  // 頂板上面（y=0 平面） — 鳩尾交鎖區域沿 X = [topLen, topLen+tt] 的 Z 方向交替
  // 整片 top face：x ∈ [0, topLen+tt]，z ∈ [0, depth]
  const v5TopFace: Array<[number, number]> = [
    v5proj(0, 0, 0),
    v5proj(topLen + tt, 0, 0),
    v5proj(topLen + tt, 0, depth),
    v5proj(0, 0, depth),
  ];

  // 沿 Z 方向排 N tails，每 tail 在 top face 是個梯形（外緣 z 寬、內緣 z 窄）
  // outer = z 朝前 (z 較小)，inner = z 朝後 (z 較大)；taper 沿 +Y(深) 方向
  const v5Tails: Array<Array<[number, number]>> = [];   // 各 tail 的 polygon
  const v5Pins: Array<Array<[number, number]>> = [];     // 各 pin 的 polygon (hatched)
  // 半銷起始 + 半銷尾，N tails 中間夾 N-1 個整 pin
  const zSeq: Array<{ kind: "pin" | "tail"; z0: number; z1: number }> = [];
  let cursor = 2;
  zSeq.push({ kind: "pin", z0: cursor, z1: cursor + halfPinZw }); cursor += halfPinZw;
  for (let i = 0; i < v5N; i++) {
    zSeq.push({ kind: "tail", z0: cursor, z1: cursor + tailZw }); cursor += tailZw;
    if (i < v5N - 1) {
      zSeq.push({ kind: "pin", z0: cursor, z1: cursor + pinZw }); cursor += pinZw;
    }
  }
  zSeq.push({ kind: "pin", z0: cursor, z1: cursor + halfPinZw });

  for (const seg of zSeq) {
    if (seg.kind === "tail") {
      // tail 在 top face：outer (x=topLen, 板交界) 寬，inner (x=topLen+tt, 通到外側面) 窄
      v5Tails.push([
        v5proj(topLen, 0, seg.z0),
        v5proj(topLen + tt, 0, seg.z0 + zOff),
        v5proj(topLen + tt, 0, seg.z1 - zOff),
        v5proj(topLen, 0, seg.z1),
      ]);
    } else {
      // pin = 側板長纖（從上看是 endgrain），佔 [topLen, topLen+tt] × [z0, z1]，但 tail 邊緣會 taper 進來
      // 為簡單起見，pin 也畫梯形（鏡像 tail），這樣縫合處正好咬合
      v5Pins.push([
        v5proj(topLen, 0, seg.z0),
        v5proj(topLen, 0, seg.z1),
        v5proj(topLen + tt, 0, seg.z1 + zOff),
        v5proj(topLen + tt, 0, seg.z0 - zOff),
      ]);
    }
  }

  // 側板右外面也要看到 tail 端面（through dovetail 視覺）
  // 在 x=topLen+tt 平面、y in [0, tt] 區域，沿 Z 排 N 個 tail 的端面（矩形 Y×Z）
  const v5RightTailEnds: Array<Array<[number, number]>> = [];
  for (const seg of zSeq) {
    if (seg.kind !== "tail") continue;
    v5RightTailEnds.push([
      v5proj(topLen + tt, 0, seg.z0 + zOff),
      v5proj(topLen + tt, 0, seg.z1 - zOff),
      v5proj(topLen + tt, tt, seg.z1 - zOff),
      v5proj(topLen + tt, tt, seg.z0 + zOff),
    ]);
  }

  // ============ Total bounds ============
  const v5MaxX = v5_OX + topLen + tt + Math.abs(depth * DZ_X) + 30;
  const v5MaxY = v5_OY + sideH + tt + Math.abs(depth * DZ_Y) + 50;
  const totalW = Math.max(v4_OX + v4_W + Math.abs(v4_dxz) + 30, v5MaxX);
  const totalH = Math.max(v4_yBody + Math.abs(v4_dyz) + 60, v5MaxY) + 20;

  const polyStr = (pts: Array<[number, number]>) =>
    pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${totalW} ${totalH}`}
      width="100%"
      style={{ maxWidth: "720px", marginTop: 12 }}
      className="bg-white"
    >
      <defs>
        <Hatching id="hatch-dt-3d" color="#7a5a2c" />
      </defs>

      {/* ============ View 4 ============ */}
      <text x={v4_OX} y={v4_OY - 20} fontSize={11} fontWeight="bold" fill={COLOR_OUTLINE}>
        立體圖（母件尾板）— 沿厚度方向 extrude
      </text>
      {/* 後輪廓 */}
      <polygon points={polyStr(v4OutlineBack)} fill="#e8d4a8" stroke={COLOR_OUTLINE} strokeOpacity={0.4} strokeWidth={0.6} />
      {/* 側面 */}
      {v4SideQuads.map((q, i) => (
        <polygon key={`v4s-${i}`} points={polyStr(q)} fill="#c9a472" stroke={COLOR_OUTLINE} strokeWidth={0.5} />
      ))}
      {/* 前 face（鳩尾形狀，跟前 3 圖一致） */}
      <polygon points={polyStr(v4Outline)} fill={COLOR_MORTISE} stroke={COLOR_OUTLINE} strokeWidth={1.2} />

      <text x={v4_OX + v4_W / 2} y={v4_yBody + Math.abs(v4_dyz) + 22} fontSize={9} textAnchor="middle" fill="#666">
        母件 face 形狀同前圖，加 {mt}mm 板厚（Z 軸後縮）
      </text>
      <text x={v4_OX + v4_W / 2} y={v4_yBody + Math.abs(v4_dyz) + 36} fontSize={8} textAnchor="middle" fill="#999">
        參考：板厚 {mt}mm、板寬 {tw || "—"}mm、尾深 {tl}mm
      </text>

      {/* ============ View 5：L 型轉角組合（兩板實際嵌合）============ */}
      <text x={v5_OX} y={v5_OY - 24} fontSize={11} fontWeight="bold" fill={COLOR_OUTLINE}>
        立體圖（L 型轉角組合）— 透視角度看貫穿鳩尾
      </text>
      {/* 1. 側板右外面（最後面，先畫） */}
      <polygon points={polyStr(v5RightFace)} fill="#b88a4d" stroke={COLOR_OUTLINE} strokeWidth={0.8} />
      {/* 2. 側板右外面上 tail 端面（through DT 才會看到） */}
      {v5RightTailEnds.map((p, i) => (
        <polygon key={`v5rt-${i}`} points={polyStr(p)} fill={COLOR_MORTISE} stroke={COLOR_OUTLINE} strokeWidth={0.6} />
      ))}
      {/* 3. 頂板上面整片底色（板長纖部分） */}
      <polygon points={polyStr(v5TopFace)} fill="#d8b988" stroke={COLOR_OUTLINE} strokeWidth={0.8} />
      {/* 4. 接合區的 pin endgrain（hatched，代表側板長纖往上看是 endgrain） */}
      {v5Pins.map((p, i) => (
        <polygon key={`v5pin-${i}`} points={polyStr(p)} fill="url(#hatch-dt-3d)" stroke={COLOR_OUTLINE} strokeWidth={0.5} />
      ))}
      {/* 5. 接合區的 tail（頂板長纖延伸進側板，仍是 top board 的木紋） */}
      {v5Tails.map((p, i) => (
        <polygon key={`v5tail-${i}`} points={polyStr(p)} fill={COLOR_MORTISE} stroke={COLOR_OUTLINE} strokeWidth={0.7} />
      ))}
      {/* 6. 前 face L outline（最前面） */}
      <polygon points={polyStr(v5FrontL)} fill="#cba277" stroke={COLOR_OUTLINE} strokeWidth={1.2} fillOpacity={0.0} />
      <polygon points={polyStr(v5FrontL)} fill="none" stroke={COLOR_OUTLINE} strokeWidth={1.2} />

      <text x={v5_OX + (topLen + tt) / 2} y={v5_OY + sideH + tt + Math.abs(depth * DZ_Y) + 22} fontSize={9} textAnchor="middle" fill="#666">
        頂板尾頭貫穿側板（through DT），上面 + 右外面都看得到尾頭端面
      </text>
      <text x={v5_OX + (topLen + tt) / 2} y={v5_OY + sideH + tt + Math.abs(depth * DZ_Y) + 36} fontSize={8} textAnchor="middle" fill="#999">
        梯形 = 頂板長纖（tail）；斜紋區 = 側板從上看是 endgrain（pin）
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

/* === BEGIN mitered-spline-detail (owner: agent-D, group: D) === */
/* ============================================================
 * 斜接餅乾榫 mitered-spline (Legacy, 保留作 escape hatch)
 * ============================================================ */
function LegacyMiteredSplineDetail(p: JoineryDetailParams) {
  const tl = p.tenonLength;
  const ct = p.childThickness ?? p.tenonThickness;

  const w = 720;
  const h = 260;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ maxWidth: "720px" }} className="bg-white">
      <defs>
        <Hatching id="hatch-ms-legacy" color="#7a5a2c" />
      </defs>
      <text x={30} y={20} fontSize={11} fontWeight="bold" fill={COLOR_OUTLINE}>
        {/* // @joinery-dim-allow */}
        分解圖（兩件 45° + 餅乾片）
      </text>
      <text x={30} y={36} fontSize={9} fill="#888">
        兩件斜切面對面，中央開弧形槽嵌入餅乾片
      </text>
      <polygon points={`30,70 220,70 250,110 30,110`} fill={COLOR_MORTISE} stroke={COLOR_OUTLINE} />
      <text x={125} y={130} fontSize={9} textAnchor="middle" fill="#666">
        {/* // @joinery-dim-allow */}
        A 件（右端 45° 斜切）
      </text>
      <ellipse cx={235} cy={90} rx={14} ry={6} fill="white" stroke={COLOR_OUTLINE} strokeDasharray="3 2" />
      <ellipse cx={360} cy={95} rx={22} ry={8} fill={COLOR_TENON} stroke={COLOR_OUTLINE} />
      <text x={360} y={130} fontSize={9} textAnchor="middle" fill="#666">
        {/* // @joinery-dim-allow */}
        餅乾片（壓縮木 #0/#10/#20）
      </text>
      <polygon points={`460,110 490,70 680,70 680,110`} fill={COLOR_MORTISE} stroke={COLOR_OUTLINE} />
      <text x={585} y={130} fontSize={9} textAnchor="middle" fill="#666">
        {/* // @joinery-dim-allow */}
        B 件（左端 45° 斜切）
      </text>
      <ellipse cx={475} cy={90} rx={14} ry={6} fill="white" stroke={COLOR_OUTLINE} strokeDasharray="3 2" />
      <g transform="translate(0, 160)">
        <polygon points={`30,0 270,0 290,20 30,20`} fill="url(#hatch-ms-legacy)" stroke={COLOR_OUTLINE} />
        <polygon points={`270,0 290,20 290,80 270,60`} fill={COLOR_TENON} stroke={COLOR_OUTLINE} />
        <text x={200} y={48} fontSize={9} fill="#666">
          {/* // @joinery-dim-allow */}
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
 * 斜接餅乾榫 mitered-spline (教科書級三視+等角+剖面 重繪版)
 *
 *   兩塊板（厚 ct）以 45° 互切相接，接縫中央銑出弧形槽，
 *   插入壓縮木餅乾片（biscuit）作為對位 + 自鎖。
 *
 *   - 餅乾片厚 = tt（公榫厚），深 = tl（從接縫面入內）
 *   - 槽深 = 餅深 + 1mm（漲縮預留）
 *   - 45°00′ 切面誤差 ≤ 0.5° 才能無縫接合
 * ============================================================ */
function MiteredSplineDetail(p: JoineryDetailParams) {
  const tl = p.tenonLength;        // 餅乾深 (mm)
  const tt = p.tenonThickness;     // 餅乾厚 (mm)
  const mt = p.motherThickness;    // 母件厚（同 ct，因兩件對等）
  const ct = p.childThickness ?? p.tenonThickness;
  const ms = Math.max(tl + 1, 1);  // 槽深 = 餅深 + 1mm 漲縮預留

  // 視圖佔位
  const VH = 285;

  // 統一比例：以 ct + 餅乾全長 (≈ tl*2) 取最大邊
  const maxMm = Math.max(ct * 4, tl * 2 + 30, mt * 4);
  const s = fitScale(maxMm, 200);
  const PX = (mm: number) => mm * s;

  // ----- 正視圖 (front)：L 型轉角組裝後正面 -----
  const fCx = 90;
  const fCy = 110;
  const fLenH = PX(80);  // 上水平板長
  const fLenV = PX(80);  // 右垂直板長
  const fT = PX(ct);     // 板厚

  const front = (
    <g>
      <text x={10} y={14} fontSize={FONT.LABEL} fontWeight="bold" fill={COLOR.OUTLINE}>
        正視圖（front）— L 型轉角組合
      </text>
      <text x={10} y={28} fontSize={FONT.CALLOUT} fill="#888">
        {/* // @joinery-dim-allow */}
        兩塊板 45° 對切，接縫中央插入餅乾片（隱藏線示意）
      </text>

      {/* A 件（橫板，左端 45° 斜切） */}
      <polygon
        points={`${fCx + fT},${fCy - fT} ${fCx + fLenH},${fCy - fT} ${fCx + fLenH},${fCy} ${fCx},${fCy}`}
        fill={COLOR.TENON}
        stroke={COLOR.OUTLINE}
        strokeWidth={STROKE.OUTLINE}
      />
      {/* B 件（豎板，上端 45° 斜切） */}
      <polygon
        points={`${fCx},${fCy} ${fCx + fT},${fCy} ${fCx + fT},${fCy + fLenV} ${fCx},${fCy + fLenV}`}
        fill={COLOR.TENON}
        stroke={COLOR.OUTLINE}
        strokeWidth={STROKE.OUTLINE}
      />
      {/* 45° 接縫對角線 */}
      <line
        x1={fCx}
        y1={fCy - fT}
        x2={fCx + fT}
        y2={fCy}
        stroke={COLOR.OUTLINE}
        strokeWidth={STROKE.OUTLINE}
      />
      {/* 餅乾片位置（隱藏線） */}
      <HiddenEdge
        d={`M ${fCx + fT * 0.2},${fCy - fT * 0.8} L ${fCx + fT * 1.2},${fCy + fT * 0.2}`}
      />
      <HiddenEdge
        d={`M ${fCx - fT * 0.2},${fCy - fT * 1.2} L ${fCx + fT * 0.8},${fCy - fT * 0.2}`}
      />

      {/* 剖面標記 A-A：穿過接縫 */}
      <SectionMark x={fCx + fT * 0.5 + 14} y={fCy - fT * 0.5 - 14} label="A" direction="down" />
      <SectionMark x={fCx + fT * 0.5 + 14} y={fCy + fLenV - 30} label="A" direction="up" />

      {/* 木紋：A 件水平、B 件垂直 */}
      <GrainArrow x={fCx + 30} y={fCy - fT - 10} length={fLenH - 40} angle={0} />
      <GrainArrow x={fCx + fT + 10} y={fCy + 30} length={fLenV - 40} angle={90} />

      {/* 尺寸 */}
      <DimLine
        x1={fCx}
        y1={fCy + fLenV + 6}
        x2={fCx + fT}
        y2={fCy + fLenV + 6}
        label={`${ct}`}
        side="bottom"
      />
      <DimLine
        x1={fCx + fLenH + 6}
        y1={fCy - fT}
        x2={fCx + fLenH + 6}
        y2={fCy}
        label={`${ct}`}
        side="right"
      />

      {/* 45°00′ 角度標 */}
      <text
        x={fCx + fT * 0.5 + 18}
        y={fCy - fT * 0.5 + 4}
        fontSize={FONT.DIM}
        fill={COLOR.DIM}
      >
        {/* // @joinery-dim-allow */}
        45°00′
      </text>

      <WarningCallout x={10} y={VH - 38} text="45° 切面誤差 ≤ 0.5°" />
      <WarningCallout x={10} y={VH - 22} text="餅片膠合後不需夾具" severity="info" />
    </g>
  );

  // ----- 側視圖 (side)：剖面 A-A — 剖開接縫看餅乾嵌入 -----
  const sCx = 60;
  const sCy = 80;
  const sBoardLen = PX(70);
  const sBoardT = PX(ct);
  const sBiscuitLen = PX(tl * 2);
  const sBiscuitT = PX(tt);
  const hatchId = "hatch-ms-section";

  const side = (
    <g>
      <text x={10} y={14} fontSize={FONT.LABEL} fontWeight="bold" fill={COLOR.OUTLINE}>
        側視圖（side）— A-A 剖面：餅乾嵌入接縫
      </text>
      <text x={10} y={28} fontSize={FONT.CALLOUT} fill="#888">
        {/* // @joinery-dim-allow */}
        紅 45° 斜線 = 剖面切口；橢圓 = 餅乾片
      </text>

      <defs>
        <Hatching id={hatchId} color={COLOR.SECTION_HATCH} />
      </defs>

      {/* 上板（被剖開） */}
      <rect
        x={sCx}
        y={sCy}
        width={sBoardLen}
        height={sBoardT}
        fill={`url(#${hatchId})`}
        stroke={COLOR.OUTLINE}
        strokeWidth={STROKE.OUTLINE}
      />
      {/* 下板（被剖開） */}
      <rect
        x={sCx}
        y={sCy + sBoardT + 2}
        width={sBoardLen}
        height={sBoardT}
        fill={`url(#${hatchId})`}
        stroke={COLOR.OUTLINE}
        strokeWidth={STROKE.OUTLINE}
      />
      {/* 接縫中線 */}
      <CenterLine
        x1={sCx - 4}
        y1={sCy + sBoardT + 1}
        x2={sCx + sBoardLen + 4}
        y2={sCy + sBoardT + 1}
      />

      {/* 餅乾片（橢圓，跨越接縫） */}
      <ellipse
        cx={sCx + sBoardLen / 2}
        cy={sCy + sBoardT + 1}
        rx={sBiscuitLen / 2}
        ry={sBiscuitT / 2 + 2}
        fill={COLOR.TENON}
        stroke={COLOR.OUTLINE}
        strokeWidth={STROKE.OUTLINE}
      />
      {/* 餅乾槽輪廓（隱藏線：板內部開的槽，比餅深多 1mm） */}
      <HiddenEdge
        d={`M ${sCx + sBoardLen / 2 - sBiscuitLen / 2},${sCy + sBoardT - PX(ms)} L ${sCx + sBoardLen / 2 + sBiscuitLen / 2},${sCy + sBoardT - PX(ms)}`}
      />
      <HiddenEdge
        d={`M ${sCx + sBoardLen / 2 - sBiscuitLen / 2},${sCy + sBoardT + 2 + PX(ms)} L ${sCx + sBoardLen / 2 + sBiscuitLen / 2},${sCy + sBoardT + 2 + PX(ms)}`}
      />

      {/* 尺寸鏈 */}
      <DimLine
        x1={sCx + sBoardLen / 2 - sBiscuitLen / 2}
        y1={sCy + sBoardT * 2 + 24}
        x2={sCx + sBoardLen / 2 + sBiscuitLen / 2}
        y2={sCy + sBoardT * 2 + 24}
        label={`餅乾長 ${tl * 2}`}
        side="bottom"
      />
      <DimLine
        x1={sCx + sBoardLen + 18}
        y1={sCy + sBoardT - PX(ms)}
        x2={sCx + sBoardLen + 18}
        y2={sCy + sBoardT}
        label={`槽深 ${ms}`}
        side="right"
      />
      <DimLine
        x1={sCx - 16}
        y1={sCy}
        x2={sCx - 16}
        y2={sCy + sBoardT}
        label={`${ct}`}
        side="left"
      />

      {/* 餅乾規格說明 */}
      <text x={10} y={VH - 50} fontSize={FONT.CALLOUT} fill="#666">
        {/* // @joinery-dim-allow */}
        餅乾規格：#0 / #10 / #20（壓縮木）
      </text>
      <text x={10} y={VH - 36} fontSize={FONT.CALLOUT} fill="#666">
        餅厚 = {tt}mm · 餅深 = {tl}mm · 槽深 = {ms}mm
      </text>
      <WarningCallout x={10} y={VH - 18} text={`槽深 ${ms}mm 留 1mm 漲縮`} severity="info" />
    </g>
  );

  // ----- 俯視圖 (top)：拆開狀態，看兩塊板的 45° 斜面 + 槽 -----
  const tCx = 30;
  const tCy = 70;
  const tPlateW = PX(70);
  const tPlateH = PX(ct);
  const tGap = 36;

  const top = (
    <g>
      <text x={10} y={14} fontSize={FONT.LABEL} fontWeight="bold" fill={COLOR.OUTLINE}>
        {/* // @joinery-dim-allow */}
        俯視圖（top）— 拆開狀態，兩塊 45° 斜面對切
      </text>
      <text x={10} y={28} fontSize={FONT.CALLOUT} fill="#888">
        各板斜面銑出餅乾槽（虛線示意）
      </text>

      {/* A 件（左）：橫板 + 右端 45° 斜切 */}
      <polygon
        points={`${tCx},${tCy} ${tCx + tPlateW},${tCy} ${tCx + tPlateW + tPlateH},${tCy + tPlateH} ${tCx},${tCy + tPlateH}`}
        fill={COLOR.TENON}
        stroke={COLOR.OUTLINE}
        strokeWidth={STROKE.OUTLINE}
      />
      {/* A 件斜面上的餅乾槽 */}
      <ellipse
        cx={tCx + tPlateW + tPlateH / 2}
        cy={tCy + tPlateH / 2}
        rx={Math.min(PX(tl), tPlateH * 0.4)}
        ry={Math.min(PX(tt) / 2 + 1, tPlateH * 0.25)}
        fill="white"
        stroke={COLOR.OUTLINE}
        strokeDasharray={DASH.HIDDEN}
      />

      {/* B 件（右）：橫板 + 左端 45° 斜切 */}
      <polygon
        points={`${tCx + tPlateW + tPlateH + tGap},${tCy + tPlateH} ${tCx + tPlateW + tPlateH + tGap + tPlateH},${tCy} ${tCx + tPlateW * 2 + tPlateH * 2 + tGap},${tCy} ${tCx + tPlateW * 2 + tPlateH * 2 + tGap},${tCy + tPlateH}`}
        fill={COLOR.TENON}
        stroke={COLOR.OUTLINE}
        strokeWidth={STROKE.OUTLINE}
      />
      <ellipse
        cx={tCx + tPlateW + tPlateH + tGap + tPlateH / 2}
        cy={tCy + tPlateH / 2}
        rx={Math.min(PX(tl), tPlateH * 0.4)}
        ry={Math.min(PX(tt) / 2 + 1, tPlateH * 0.25)}
        fill="white"
        stroke={COLOR.OUTLINE}
        strokeDasharray={DASH.HIDDEN}
      />

      {/* 餅乾片（落在中央 gap） */}
      <ellipse
        cx={tCx + tPlateW + tPlateH + tGap / 2}
        cy={tCy + tPlateH / 2}
        rx={Math.min(PX(tl), tGap * 0.45)}
        ry={Math.min(PX(tt) / 2 + 2, tPlateH * 0.32)}
        fill={COLOR.MORTISE}
        stroke={COLOR.OUTLINE}
        strokeWidth={STROKE.OUTLINE}
      />
      <text
        x={tCx + tPlateW + tPlateH + tGap / 2}
        y={tCy - 6}
        fontSize={FONT.CALLOUT}
        textAnchor="middle"
        fill={COLOR.OUTLINE}
      >
        餅乾片
      </text>

      {/* 木紋方向 */}
      <GrainArrow x={tCx + 6} y={tCy + tPlateH + 18} length={tPlateW - 12} angle={0} />

      {/* 尺寸：板厚 */}
      <DimLine
        x1={tCx - 16}
        y1={tCy}
        x2={tCx - 16}
        y2={tCy + tPlateH}
        label={`${ct}`}
        side="left"
      />

      <text x={10} y={VH - 18} fontSize={FONT.CALLOUT} fill={COLOR.DIM}>
        {/* // @joinery-dim-allow */}
        Lamello 餅乾機標準角度 = 45°00′
      </text>
    </g>
  );

  // ----- 等角圖 (iso)：30° 軸測 L 型轉角 + 半透明示餅乾 -----
  const iso = (
    <IsometricGroup originX={210} originY={150} scale={1.1}>
      <g stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE}>
        {/* A 件（水平板） */}
        <rect x={0} y={-PX(ct)} width={PX(70)} height={PX(ct)} fill={COLOR.TENON} />
        {/* B 件（垂直板） */}
        <rect x={0} y={0} width={PX(ct)} height={PX(70)} fill={COLOR.MORTISE} fillOpacity={0.85} />
        {/* 45° 接縫 */}
        <line x1={0} y1={-PX(ct)} x2={PX(ct)} y2={0} stroke={COLOR.OUTLINE} />
        {/* 隱藏餅乾示意 */}
        <ellipse
          cx={PX(ct) / 2}
          cy={-PX(ct) / 2}
          rx={PX(tl) * 0.6}
          ry={PX(tt) * 0.4 + 2}
          fill={COLOR.DIM}
          fillOpacity={0.35}
          stroke={COLOR.DIM}
          strokeDasharray={DASH.HIDDEN}
        />
      </g>
      <text x={PX(80)} y={-PX(ct) - 8} fontSize={FONT.CALLOUT} fill={COLOR.OUTLINE}>
        {/* // @joinery-dim-allow */}
        等角圖（30°）
      </text>
    </IsometricGroup>
  );

  return (
    <svg width={960} height={680} viewBox="0 0 960 680" className="bg-white">
      <ThreeViewLayout
        width={960}
        height={620}
        front={front}
        side={side}
        top={top}
        iso={iso}
        titleBlock={
          <TitleBlock
            x={0}
            y={0}
            width={960}
            joineryType={p.material ? `mitered-spline · ${p.material}` : "mitered-spline"}
            joineryNameZh="斜接餅乾榫"
            scale="1:1"
            drawnBy="wrd-modern-joinery"
            drawingNumber={`MS-${ct}-${tl}-${tt}`}
          />
        }
      />
    </svg>
  );
}
/* === END mitered-spline-detail === */

/* === BEGIN pocket-hole-detail (owner: agent-D, group: D) === */
/* ============================================================
 * 口袋孔螺絲 pocket-hole (Legacy, 保留作 escape hatch)
 * ============================================================ */
function LegacyPocketHoleDetail(p: JoineryDetailParams) {
  const ct = p.childThickness ?? p.tenonThickness;

  const w = 720;
  const h = 280;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ maxWidth: "720px" }} className="bg-white">
      <text x={30} y={20} fontSize={11} fontWeight="bold" fill={COLOR_OUTLINE}>
        {/* // @joinery-dim-allow */}
        剖面圖（15° 斜孔 + 自攻螺絲）
      </text>
      <rect x={30} y={70} width={280} height={54} fill={COLOR_MORTISE} stroke={COLOR_OUTLINE} />
      <polygon points={`180,124 210,124 240,78 230,70 200,70`} fill="white" stroke={COLOR_OUTLINE} strokeDasharray="3 2" />
      <rect x={300} y={70} width={56} height={180} fill={COLOR_MORTISE} stroke={COLOR_OUTLINE} />
      <line x1={205} y1={105} x2={340} y2={100} stroke="#888" strokeWidth={3} />
      <text x={30} y={h - 8} fontSize={9} fill="#0a4d8c">
        {/* // @joinery-dim-allow */}
        板厚 {ct}mm · 15° 標準角度
      </text>
    </svg>
  );
}

/* ============================================================
 * 口袋孔螺絲 pocket-hole (教科書級 三視+等角+剖面 重繪版)
 *
 *   Kreg / Milescraft 夾具導引、15° 斜孔、隱藏面下螺。
 *   - 鑽頭角度：15° (硬編碼，業界標準)
 *   - 螺絲長 = ct/2 + mt - 5（穿過 A 半、進 B 留底 5mm）
 *   - 孔深 = ct - 5 (保留底面 5mm，避免穿出 A 件)
 *   - 孔距：邊緣起 25mm，中段 50-75mm
 *
 *   注：傳統中式無此工法，老師圖庫無 ref，純 wrd 自繪。
 * ============================================================ */
function PocketHoleDetail(p: JoineryDetailParams) {
  const ct = p.childThickness ?? p.tenonThickness;   // A 件厚（鑽斜孔的板）
  const mt = p.motherThickness;                       // B 件厚（被鎖入的板）
  const screwLen = Math.round(ct / 2 + mt - 5);       // 螺絲長 (mm)
  const holeDepth = Math.max(ct - 5, 1);              // 孔深 (mm)
  const edgeOffset = 25;                              // 邊距 (mm) — 標準
  const pitch = 60;                                    // 孔距 (mm) — 50-75 中位

  const VH = 285;

  // 統一比例
  const maxMm = Math.max(ct * 6, mt * 6, screwLen * 2);
  const s = fitScale(maxMm, 200);
  const PX = (mm: number) => mm * s;

  // ----- 正視圖 (front)：T 字組裝後 (A 平放、B 立) 從正面看 -----
  const fCx = 70;
  const fCy = 90;
  const fAW = PX(150);
  const fAT = PX(ct);
  const fBW = PX(mt);
  const fBH = PX(120);

  const front = (
    <g>
      <text x={10} y={14} fontSize={FONT.LABEL} fontWeight="bold" fill={COLOR.OUTLINE}>
        正視圖（front）— T 字組裝（隱藏面在 A 件背側）
      </text>
      <text x={10} y={28} fontSize={FONT.CALLOUT} fill="#888">
        外觀看不到螺絲頭，斜孔開在 A 件背面（隱藏面）
      </text>

      {/* A 件（橫板） */}
      <rect
        x={fCx}
        y={fCy - fAT}
        width={fAW}
        height={fAT}
        fill={COLOR.TENON}
        stroke={COLOR.OUTLINE}
        strokeWidth={STROKE.OUTLINE}
      />
      {/* B 件（豎板：T 字立中央） */}
      <rect
        x={fCx + fAW / 2 - fBW / 2}
        y={fCy}
        width={fBW}
        height={fBH}
        fill={COLOR.MORTISE}
        stroke={COLOR.OUTLINE}
        strokeWidth={STROKE.OUTLINE}
      />

      {/* 兩個隱藏斜孔（虛線，沿 15° 角延伸進 B 件） */}
      {[-1, 1].map((dir, i) => {
        const cx0 = fCx + fAW / 2 + dir * PX(pitch / 2);
        return (
          <g key={i}>
            <HiddenEdge
              d={`M ${cx0 - 3},${fCy} L ${cx0 + dir * PX(15)},${fCy + PX(20)}`}
            />
            <HiddenEdge
              d={`M ${cx0 + 3},${fCy} L ${cx0 + dir * PX(15) + 4},${fCy + PX(20)}`}
            />
          </g>
        );
      })}

      {/* 剖面標記 A-A */}
      <SectionMark x={fCx + fAW / 2 - PX(pitch / 2) - 22} y={fCy - fAT - 8} label="A" direction="down" />
      <SectionMark x={fCx + fAW / 2 - PX(pitch / 2) - 22} y={fCy + fBH - 18} label="A" direction="up" />

      {/* 木紋 */}
      <GrainArrow x={fCx + 8} y={fCy - fAT - 14} length={fAW - 16} angle={0} />

      {/* 尺寸：A 厚 / 孔距 / B 厚 */}
      <DimLine
        x1={fCx + fAW / 2 - PX(pitch / 2)}
        y1={fCy + fBH + 16}
        x2={fCx + fAW / 2 + PX(pitch / 2)}
        y2={fCy + fBH + 16}
        label={`孔距 ${pitch}`}
        side="bottom"
      />
      <DimLine
        x1={fCx - 16}
        y1={fCy - fAT}
        x2={fCx - 16}
        y2={fCy}
        label={`${ct}`}
        side="left"
      />
      <DimLine
        x1={fCx + fAW + 16}
        y1={fCy}
        x2={fCx + fAW + 16}
        y2={fCy + fBH}
        label={`${mt}`}
        side="right"
      />

      <WarningCallout x={10} y={VH - 18} text={`孔距 50-75mm，邊距 ${edgeOffset}mm`} severity="info" />
    </g>
  );

  // ----- 側視圖 (side)：剖面 A-A — 看到 15° 斜孔內部 + 螺絲 + B 件 -----
  const sCx = 60;
  const sCy = 60;
  const sAW = PX(120);
  const sAT = PX(ct);
  const sBT = PX(mt);
  const sBH = PX(120);
  const hatchId = "hatch-ph-section";

  // 15° 斜孔幾何
  const angle15 = (15 * Math.PI) / 180;
  const holeStartX = sCx + sAW / 2 - PX(15);
  const holeStartY = sCy + sAT;
  // 螺絲尖端進入 B 件
  const screwTipX = sCx + sAW / 2 + PX(8);
  const screwTipY = sCy + sBH * 0.7;

  const side = (
    <g>
      <text x={10} y={14} fontSize={FONT.LABEL} fontWeight="bold" fill={COLOR.OUTLINE}>
        {/* // @joinery-dim-allow */}
        側視圖（side）— A-A 剖面：15° 斜孔 + 自攻螺絲穿入 B
      </text>
      <text x={10} y={28} fontSize={FONT.CALLOUT} fill="#888">
        紅色 hatching = A 與 B 的剖切面；灰色 = 螺絲
      </text>

      <defs>
        <Hatching id={hatchId} color={COLOR.SECTION_HATCH} />
      </defs>

      {/* A 件（剖面） */}
      <rect
        x={sCx}
        y={sCy}
        width={sAW}
        height={sAT}
        fill={`url(#${hatchId})`}
        stroke={COLOR.OUTLINE}
        strokeWidth={STROKE.OUTLINE}
      />
      {/* B 件（剖面） */}
      <rect
        x={sCx + sAW / 2 - sBT / 2}
        y={sCy + sAT}
        width={sBT}
        height={sBH}
        fill={`url(#${hatchId})`}
        stroke={COLOR.OUTLINE}
        strokeWidth={STROKE.OUTLINE}
      />

      {/* 15° 斜孔（兩條線界定孔壁） */}
      <line
        x1={holeStartX - 4}
        y1={holeStartY}
        x2={holeStartX + Math.sin(angle15) * PX(holeDepth) - 2}
        y2={holeStartY - Math.cos(angle15) * PX(holeDepth)}
        stroke={COLOR.OUTLINE}
        strokeWidth={STROKE.OUTLINE}
      />
      <line
        x1={holeStartX + 8}
        y1={holeStartY}
        x2={holeStartX + Math.sin(angle15) * PX(holeDepth) + 6}
        y2={holeStartY - Math.cos(angle15) * PX(holeDepth)}
        stroke={COLOR.OUTLINE}
        strokeWidth={STROKE.OUTLINE}
      />
      {/* 孔底 */}
      <line
        x1={holeStartX + Math.sin(angle15) * PX(holeDepth) - 2}
        y1={holeStartY - Math.cos(angle15) * PX(holeDepth)}
        x2={holeStartX + Math.sin(angle15) * PX(holeDepth) + 6}
        y2={holeStartY - Math.cos(angle15) * PX(holeDepth)}
        stroke={COLOR.OUTLINE}
        strokeWidth={STROKE.OUTLINE}
      />

      {/* 螺絲：頭 + 桿 + 螺紋 */}
      <g>
        <rect
          x={holeStartX - 3}
          y={holeStartY - 4}
          width={10}
          height={6}
          fill="#555"
          stroke={COLOR.OUTLINE}
          strokeWidth={0.5}
          transform={`rotate(-15 ${holeStartX + 2} ${holeStartY - 1})`}
        />
        <line
          x1={holeStartX + 2}
          y1={holeStartY - 1}
          x2={screwTipX}
          y2={screwTipY}
          stroke="#666"
          strokeWidth={2.5}
        />
        {Array.from({ length: 10 }).map((_, j) => {
          const t = j / 9;
          const tx = holeStartX + 2 + (screwTipX - holeStartX - 2) * t;
          const ty = holeStartY - 1 + (screwTipY - holeStartY + 1) * t;
          return (
            <line
              key={j}
              x1={tx - 2.5}
              y1={ty - 2}
              x2={tx + 2.5}
              y2={ty + 2}
              stroke="#444"
              strokeWidth={0.6}
            />
          );
        })}
      </g>

      {/* 中心線（B 件中軸） */}
      <CenterLine
        x1={sCx + sAW / 2}
        y1={sCy - 6}
        x2={sCx + sAW / 2}
        y2={sCy + sAT + sBH + 6}
      />

      {/* 15° 角度標 */}
      <text x={holeStartX - 28} y={holeStartY + 14} fontSize={FONT.DIM} fill={COLOR.DIM}>
        {/* // @joinery-dim-allow */}
        15°00′
      </text>

      {/* 尺寸：A厚、B厚、孔深 */}
      <DimLine
        x1={sCx + sAW + 14}
        y1={sCy}
        x2={sCx + sAW + 14}
        y2={sCy + sAT}
        label={`A=${ct}`}
        side="right"
      />
      <DimLine
        x1={sCx + sAW + 14}
        y1={sCy + sAT}
        x2={sCx + sAW + 14}
        y2={sCy + sAT + sBH}
        label={`B=${mt}`}
        side="right"
      />
      <DimLine
        x1={sCx - 16}
        y1={holeStartY - Math.cos(angle15) * PX(holeDepth)}
        x2={sCx - 16}
        y2={holeStartY}
        label={`孔深 ${holeDepth}`}
        side="left"
      />

      <text x={10} y={VH - 50} fontSize={FONT.CALLOUT} fill={COLOR.DIM}>
        {/* // @joinery-dim-allow */}
        螺絲長 = A/2 + B − 5 = {screwLen}mm（Kreg 自攻）
      </text>
      <WarningCallout x={10} y={VH - 32} text={`孔深 = 板厚 − 5mm 保留底面`} />
      <WarningCallout x={10} y={VH - 16} text="自攻螺絲粗牙、尖頭、不需先導孔" severity="info" />
    </g>
  );

  // ----- 俯視圖 (top)：A 件背面，露出兩個斜孔 + 邊距標 -----
  const tCx = 50;
  const tCy = 60;
  const tAW = PX(160);
  const tAH = PX(60);
  const tHoleR = Math.max(PX(4), 4);

  const top = (
    <g>
      <text x={10} y={14} fontSize={FONT.LABEL} fontWeight="bold" fill={COLOR.OUTLINE}>
        {/* // @joinery-dim-allow */}
        俯視圖（top）— A 件背面（隱藏面），開 2 個 15° 斜孔
      </text>
      <text x={10} y={28} fontSize={FONT.CALLOUT} fill="#888">
        {/* // @joinery-dim-allow */}
        Kreg 夾具定位：邊距 25mm，孔距 50-75mm
      </text>

      {/* A 件背面 */}
      <rect
        x={tCx}
        y={tCy}
        width={tAW}
        height={tAH}
        fill={COLOR.TENON}
        stroke={COLOR.OUTLINE}
        strokeWidth={STROKE.OUTLINE}
      />

      {/* 2 個橢圓斜孔（俯視看是橢圓） */}
      {[-1, 1].map((dir, i) => {
        const ox = tCx + tAW / 2 + dir * PX(pitch / 2);
        const oy = tCy + tAH * 0.55;
        return (
          <g key={i}>
            <ellipse
              cx={ox}
              cy={oy}
              rx={tHoleR * 1.6}
              ry={tHoleR * 0.9}
              fill="white"
              stroke={COLOR.OUTLINE}
              strokeWidth={STROKE.OUTLINE}
            />
            <ellipse
              cx={ox + 2}
              cy={oy - 1}
              rx={tHoleR * 0.8}
              ry={tHoleR * 0.5}
              fill="#444"
            />
          </g>
        );
      })}

      {/* B 件位置投影 */}
      <CenterLine
        x1={tCx + tAW / 2}
        y1={tCy - 8}
        x2={tCx + tAW / 2}
        y2={tCy + tAH + 8}
      />
      <HiddenEdge
        d={`M ${tCx + tAW / 2 - PX(mt / 2)},${tCy} L ${tCx + tAW / 2 - PX(mt / 2)},${tCy + tAH}`}
      />
      <HiddenEdge
        d={`M ${tCx + tAW / 2 + PX(mt / 2)},${tCy} L ${tCx + tAW / 2 + PX(mt / 2)},${tCy + tAH}`}
      />

      {/* 木紋 */}
      <GrainArrow x={tCx + 6} y={tCy + tAH + 18} length={tAW - 12} angle={0} />

      {/* 尺寸：孔距、邊距 */}
      <DimLine
        x1={tCx + tAW / 2 - PX(pitch / 2)}
        y1={tCy + tAH + 36}
        x2={tCx + tAW / 2 + PX(pitch / 2)}
        y2={tCy + tAH + 36}
        label={`孔距 ${pitch}`}
        side="bottom"
      />
      <DimLine
        x1={tCx + tAW / 2 - PX(pitch / 2)}
        y1={tCy - 12}
        x2={tCx + tAW / 2 - PX(pitch / 2)}
        y2={tCy + tAH * 0.55}
        label={`邊距 ${edgeOffset}`}
        side="left"
      />

      <text x={10} y={VH - 18} fontSize={FONT.CALLOUT} fill={COLOR.DIM}>
        {/* // @joinery-dim-allow */}
        Kreg / Milescraft 夾具標準 15° 斜孔（不可改角度）
      </text>
    </g>
  );

  // ----- 等角圖 (iso)：T 字組裝 + 半透明顯示斜孔 -----
  const iso = (
    <IsometricGroup originX={210} originY={155} scale={1.05}>
      <g stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE}>
        <rect x={-PX(60)} y={-PX(ct)} width={PX(120)} height={PX(ct)} fill={COLOR.TENON} />
        <rect x={-PX(mt) / 2} y={0} width={PX(mt)} height={PX(80)} fill={COLOR.MORTISE} fillOpacity={0.85} />
        {[-1, 1].map((dir, i) => {
          const ox = dir * PX(pitch / 2);
          return (
            <g key={i}>
              <line
                x1={ox - 3}
                y1={0}
                x2={ox + dir * PX(8)}
                y2={PX(15)}
                stroke={COLOR.DIM}
                strokeWidth={1}
                strokeDasharray={DASH.HIDDEN}
              />
              <line
                x1={ox + 3}
                y1={0}
                x2={ox + dir * PX(8) + 5}
                y2={PX(15)}
                stroke={COLOR.DIM}
                strokeWidth={1}
                strokeDasharray={DASH.HIDDEN}
              />
            </g>
          );
        })}
      </g>
      <text x={PX(70)} y={-PX(ct) - 8} fontSize={FONT.CALLOUT} fill={COLOR.OUTLINE}>
        {/* // @joinery-dim-allow */}
        等角圖（30°）
      </text>
    </IsometricGroup>
  );

  return (
    <svg width={960} height={680} viewBox="0 0 960 680" className="bg-white">
      <ThreeViewLayout
        width={960}
        height={620}
        front={front}
        side={side}
        top={top}
        iso={iso}
        titleBlock={
          <TitleBlock
            x={0}
            y={0}
            width={960}
            joineryType="pocket-hole"
            joineryNameZh="斜孔螺絲（口袋孔）"
            scale="1:1"
            drawnBy="wrd-modern-joinery"
            drawingNumber={`PH-${ct}-${mt}-L${screwLen}`}
          />
        }
      />
    </svg>
  );
}
/* === END pocket-hole-detail === */

/* === BEGIN screw-detail (owner: agent-D, group: D) === */
/* ============================================================
 * 螺絲 + 白膠 screw (Legacy, 保留作 escape hatch)
 * ============================================================ */
function LegacyScrewDetail(p: JoineryDetailParams) {
  const ct = p.childThickness ?? p.tenonThickness;

  const w = 720;
  const h = 240;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ maxWidth: "720px" }} className="bg-white">
      <text x={30} y={20} fontSize={11} fontWeight="bold" fill={COLOR_OUTLINE}>
        剖面圖（先導孔 + 自攻螺絲 + 白膠）
      </text>
      <rect x={30} y={70} width={300} height={40} fill={COLOR_MORTISE} stroke={COLOR_OUTLINE} />
      <rect x={30} y={110} width={300} height={90} fill={COLOR_MORTISE} stroke={COLOR_OUTLINE} />
      <text x={30} y={h - 8} fontSize={9} fill="#0a4d8c">
        板厚 {ct}mm
      </text>
    </svg>
  );
}

/**
 * 軟硬木判斷（與 pickDovetailAngle 同步維護）
 * 軟木 → 先導孔 = 螺桿徑 × 70%
 * 硬木 → 先導孔 = 螺桿徑 × 80%（防劈裂）
 */
function pickPilotHoleRule(materialId?: import("@/lib/types").MaterialId): {
  ratio: number;
  ratioLabel: string;
  hardness: "軟木" | "硬木";
} {
  const SOFTWOODS = new Set(["taiwan-cypress", "douglas-fir", "pine", "spruce", "cedar"]);
  if (materialId && SOFTWOODS.has(materialId)) {
    return { ratio: 0.7, ratioLabel: "70%", hardness: "軟木" };
  }
  return { ratio: 0.8, ratioLabel: "80%", hardness: "硬木" };
}

/* ============================================================
 * 螺絲 + 白膠 screw (教科書級 三視+等角+剖面 重繪版)
 *
 *   最簡單、最普及的接合：
 *   - 先導孔 (pilot hole) Ø = tt × 70~80% (依材質)
 *   - 埋頭孔 (countersink) Ø ≈ 螺頭徑 + 1mm
 *   - 螺絲長 = ct + mt − 5mm 留底
 *   - 接合面塗白膠 (PVAc 或 Titebond)
 *
 *   注：傳統中式無此工法，老師圖庫無 ref，純 wrd 自繪。
 * ============================================================ */
function ScrewDetail(p: JoineryDetailParams) {
  const tt = p.tenonThickness;                     // 螺桿徑示意 (mm)
  const tl = p.tenonLength;                        // 螺絲全長 (mm)
  const mt = p.motherThickness;                    // 母件 (B 件) 厚 mm
  const ct = p.childThickness ?? p.tenonThickness; // 子件 (A 件) 厚 mm
  const rule = pickPilotHoleRule(p.material);
  const pilot = Math.max(Math.round(tt * rule.ratio), 1); // 先導孔 Ø
  const csDepth = Math.max(Math.round(tt * 0.6), 2);       // 埋頭孔深 ≈ 螺頭高
  const csDia = Math.max(Math.round(tt * 1.8), pilot + 2); // 埋頭孔徑
  const screwLen = tl > 0 ? tl : Math.max(ct + mt - 5, 8);

  const VH = 285;

  const maxMm = Math.max(ct * 6, mt * 4, screwLen * 2);
  const s = fitScale(maxMm, 200);
  const PX = (mm: number) => mm * s;

  // ----- 正視圖 (front)：A 件疊在 B 件上，螺絲從 A 上方鎖入 -----
  const fCx = 80;
  const fCy = 80;
  const fAW = PX(140);
  const fAT = PX(ct);
  const fBT = PX(mt);
  const fBH = PX(110);

  const front = (
    <g>
      <text x={10} y={14} fontSize={FONT.LABEL} fontWeight="bold" fill={COLOR.OUTLINE}>
        正視圖（front）— A 平鎖入 B（螺絲 + 白膠）
      </text>
      <text x={10} y={28} fontSize={FONT.CALLOUT} fill="#888">
        埋頭孔可加木塞封口；接合面塗白膠補強
      </text>

      {/* B 件（下方直板） */}
      <rect
        x={fCx + fAW / 2 - fBT / 2}
        y={fCy + fAT}
        width={fBT}
        height={fBH}
        fill={COLOR.MORTISE}
        stroke={COLOR.OUTLINE}
        strokeWidth={STROKE.OUTLINE}
      />
      {/* A 件（上方橫板） */}
      <rect
        x={fCx}
        y={fCy}
        width={fAW}
        height={fAT}
        fill={COLOR.TENON}
        stroke={COLOR.OUTLINE}
        strokeWidth={STROKE.OUTLINE}
      />

      {/* 兩個螺絲位置 */}
      {[-1, 1].map((dir, i) => {
        const cx0 = fCx + fAW / 2 + dir * PX(40);
        return (
          <g key={i}>
            {/* 埋頭孔（漏斗） */}
            <polygon
              points={`${cx0 - PX(csDia) / 2},${fCy} ${cx0 + PX(csDia) / 2},${fCy} ${cx0 + PX(pilot) / 2},${fCy + PX(csDepth)} ${cx0 - PX(pilot) / 2},${fCy + PX(csDepth)}`}
              fill="white"
              stroke={COLOR.OUTLINE}
              strokeWidth={STROKE.OUTLINE}
            />
            {/* 螺絲頭 */}
            <ellipse cx={cx0} cy={fCy + 1} rx={PX(csDia) / 2 + 0.5} ry={1.5} fill="#555" />
            {/* 螺桿 */}
            <line
              x1={cx0}
              y1={fCy + PX(csDepth)}
              x2={cx0}
              y2={fCy + PX(screwLen)}
              stroke="#666"
              strokeWidth={2}
            />
            {/* 中心線 */}
            <CenterLine
              x1={cx0}
              y1={fCy - 6}
              x2={cx0}
              y2={fCy + PX(screwLen) + 6}
            />
          </g>
        );
      })}

      {/* 白膠縫 */}
      <line
        x1={fCx}
        y1={fCy + fAT - 1}
        x2={fCx + fAW}
        y2={fCy + fAT - 1}
        stroke="#e8a"
        strokeWidth={0.8}
        strokeDasharray="2 1"
      />
      <text x={fCx + fAW + 4} y={fCy + fAT + 2} fontSize={FONT.CALLOUT} fill="#a36">
        白膠
      </text>

      {/* 剖面標記 */}
      <SectionMark x={fCx + fAW / 2 - PX(40) - 18} y={fCy - 10} label="A" direction="down" />
      <SectionMark x={fCx + fAW / 2 - PX(40) - 18} y={fCy + fAT + fBH + 4} label="A" direction="up" />

      {/* 木紋 */}
      <GrainArrow x={fCx + 8} y={fCy - 12} length={fAW - 16} angle={0} />

      {/* 尺寸 */}
      <DimLine
        x1={fCx - 16}
        y1={fCy}
        x2={fCx - 16}
        y2={fCy + fAT}
        label={`${ct}`}
        side="left"
      />
      <DimLine
        x1={fCx + fAW + 30}
        y1={fCy + fAT}
        x2={fCx + fAW + 30}
        y2={fCy + fAT + fBH}
        label={`${mt}`}
        side="right"
      />

      <WarningCallout x={10} y={VH - 18} text={`先導孔 = 螺桿徑 × ${rule.ratioLabel}（${rule.hardness}）`} />
    </g>
  );

  // ----- 側視圖 (side)：剖面 A-A — 看到埋頭孔 + 先導孔 + 螺絲 + 白膠層 -----
  const sCx = 70;
  const sCy = 60;
  const sAW = PX(80);
  const sAT = PX(ct);
  const sBT = PX(mt);
  const sBH = PX(120);
  const hatchId = "hatch-screw-section";
  const screwCx = sCx + sAW / 2;

  const side = (
    <g>
      <text x={10} y={14} fontSize={FONT.LABEL} fontWeight="bold" fill={COLOR.OUTLINE}>
        側視圖（side）— A-A 剖面：埋頭 + 先導孔 + 白膠
      </text>
      <text x={10} y={28} fontSize={FONT.CALLOUT} fill="#888">
        紅 hatching = 剖切；粉色細線 = 白膠塗布層
      </text>

      <defs>
        <Hatching id={hatchId} color={COLOR.SECTION_HATCH} />
      </defs>

      {/* A 件（剖面） */}
      <rect
        x={sCx}
        y={sCy}
        width={sAW}
        height={sAT}
        fill={`url(#${hatchId})`}
        stroke={COLOR.OUTLINE}
        strokeWidth={STROKE.OUTLINE}
      />
      {/* B 件（剖面） */}
      <rect
        x={sCx + sAW / 2 - sBT / 2}
        y={sCy + sAT + 2}
        width={sBT}
        height={sBH}
        fill={`url(#${hatchId})`}
        stroke={COLOR.OUTLINE}
        strokeWidth={STROKE.OUTLINE}
      />

      {/* 白膠層（接合面、放大示意） */}
      <rect
        x={sCx + sAW / 2 - sBT / 2}
        y={sCy + sAT}
        width={sBT}
        height={2}
        fill="#fbb"
        stroke="#c66"
        strokeWidth={0.5}
      />

      {/* 埋頭孔（漏斗形） */}
      <polygon
        points={`${screwCx - PX(csDia) / 2},${sCy} ${screwCx + PX(csDia) / 2},${sCy} ${screwCx + PX(pilot) / 2},${sCy + PX(csDepth)} ${screwCx - PX(pilot) / 2},${sCy + PX(csDepth)}`}
        fill="white"
        stroke={COLOR.OUTLINE}
        strokeWidth={STROKE.OUTLINE}
      />
      {/* 先導孔（A 件下半段） */}
      <rect
        x={screwCx - PX(pilot) / 2}
        y={sCy + PX(csDepth)}
        width={PX(pilot)}
        height={Math.max(PX(ct) - PX(csDepth), 1)}
        fill="white"
        stroke={COLOR.OUTLINE}
        strokeWidth={STROKE.OUTLINE}
      />
      {/* 先導孔在 B 件內（隱藏線） */}
      <HiddenEdge
        d={`M ${screwCx - PX(pilot) / 2},${sCy + sAT + 2} L ${screwCx - PX(pilot) / 2},${sCy + PX(screwLen)}`}
      />
      <HiddenEdge
        d={`M ${screwCx + PX(pilot) / 2},${sCy + sAT + 2} L ${screwCx + PX(pilot) / 2},${sCy + PX(screwLen)}`}
      />

      {/* 螺絲：頭 + 桿 + 螺紋 */}
      <g>
        <rect
          x={screwCx - PX(csDia) / 2 + 1}
          y={sCy + 1}
          width={PX(csDia) - 2}
          height={Math.max(PX(csDepth) - 1, 2)}
          fill="#555"
          stroke={COLOR.OUTLINE}
          strokeWidth={0.5}
        />
        <line
          x1={screwCx}
          y1={sCy + PX(csDepth)}
          x2={screwCx}
          y2={sCy + PX(screwLen)}
          stroke="#444"
          strokeWidth={2.5}
        />
        {Array.from({ length: 12 }).map((_, j) => {
          const y = sCy + PX(csDepth) + 4 + j * 4;
          if (y >= sCy + PX(screwLen) - 2) return null;
          return (
            <line
              key={j}
              x1={screwCx - 2.5}
              y1={y}
              x2={screwCx + 2.5}
              y2={y - 1.5}
              stroke="#222"
              strokeWidth={0.5}
            />
          );
        })}
      </g>

      {/* 中心線 */}
      <CenterLine x1={screwCx} y1={sCy - 6} x2={screwCx} y2={sCy + PX(screwLen) + 8} />

      {/* 尺寸 */}
      <DimLine
        x1={sCx + sAW + 10}
        y1={sCy}
        x2={sCx + sAW + 10}
        y2={sCy + PX(csDepth)}
        label={`埋頭 ${csDepth}`}
        side="right"
      />
      <DimLine
        x1={sCx + sAW + 36}
        y1={sCy}
        x2={sCx + sAW + 36}
        y2={sCy + sAT}
        label={`A=${ct}`}
        side="right"
      />
      <DimLine
        x1={sCx + sAW + 36}
        y1={sCy + sAT + 2}
        x2={sCx + sAW + 36}
        y2={sCy + PX(screwLen)}
        label={`螺長 ${screwLen}`}
        side="right"
      />
      <DimLine
        x1={sCx - 16}
        y1={sCy + sAT + 2}
        x2={sCx - 16}
        y2={sCy + sAT + sBH + 2}
        label={`B=${mt}`}
        side="left"
      />
      <DimLine
        x1={screwCx - PX(pilot) / 2}
        y1={sCy + sAT + sBH + 18}
        x2={screwCx + PX(pilot) / 2}
        y2={sCy + sAT + sBH + 18}
        label={`Ø${pilot}`}
        side="bottom"
      />

      <text x={10} y={VH - 50} fontSize={FONT.CALLOUT} fill={COLOR.DIM}>
        {rule.hardness}：先導孔 Ø = {tt} × {rule.ratioLabel} = {pilot}mm
      </text>
      <text x={10} y={VH - 36} fontSize={FONT.CALLOUT} fill={COLOR.DIM}>
        {/* // @joinery-dim-allow */}
        螺絲長 = A + B − 5 = {screwLen}mm｜埋頭孔 Ø = {csDia}mm
      </text>
      <WarningCallout x={10} y={VH - 18} text="埋頭孔深 ≥ 螺頭高，可加木塞封口" severity="info" />
    </g>
  );

  // ----- 俯視圖 (top)：A 件正面，露出 2 個埋頭孔 -----
  const tCx = 50;
  const tCy = 60;
  const tAW = PX(160);
  const tAH = PX(60);
  const csR = Math.max(PX(csDia) / 2, 4);

  const top = (
    <g>
      <text x={10} y={14} fontSize={FONT.LABEL} fontWeight="bold" fill={COLOR.OUTLINE}>
        {/* // @joinery-dim-allow */}
        俯視圖（top）— A 件正面，2 個埋頭孔（可加木塞）
      </text>
      <text x={10} y={28} fontSize={FONT.CALLOUT} fill="#888">
        孔位中心線投影 B 件（虛線示意）
      </text>

      {/* A 件 */}
      <rect
        x={tCx}
        y={tCy}
        width={tAW}
        height={tAH}
        fill={COLOR.TENON}
        stroke={COLOR.OUTLINE}
        strokeWidth={STROKE.OUTLINE}
      />

      {/* 2 個埋頭孔（同心圓） */}
      {[-1, 1].map((dir, i) => {
        const cx0 = tCx + tAW / 2 + dir * PX(40);
        const cy0 = tCy + tAH / 2;
        return (
          <g key={i}>
            <circle
              cx={cx0}
              cy={cy0}
              r={csR}
              fill="white"
              stroke={COLOR.OUTLINE}
              strokeWidth={STROKE.OUTLINE}
            />
            <circle
              cx={cx0}
              cy={cy0}
              r={Math.max(PX(pilot) / 2, 1.5)}
              fill="#444"
            />
            <CenterLine x1={cx0} y1={cy0 - csR - 4} x2={cx0} y2={cy0 + csR + 4} />
            <CenterLine x1={cx0 - csR - 4} y1={cy0} x2={cx0 + csR + 4} y2={cy0} />
          </g>
        );
      })}

      {/* B 件位置投影 */}
      <HiddenEdge
        d={`M ${tCx + tAW / 2 - PX(mt) / 2},${tCy} L ${tCx + tAW / 2 - PX(mt) / 2},${tCy + tAH}`}
      />
      <HiddenEdge
        d={`M ${tCx + tAW / 2 + PX(mt) / 2},${tCy} L ${tCx + tAW / 2 + PX(mt) / 2},${tCy + tAH}`}
      />

      {/* 木紋 */}
      <GrainArrow x={tCx + 8} y={tCy + tAH + 18} length={tAW - 16} angle={0} />

      {/* 尺寸：孔距 */}
      <DimLine
        x1={tCx + tAW / 2 - PX(40)}
        y1={tCy + tAH + 36}
        x2={tCx + tAW / 2 + PX(40)}
        y2={tCy + tAH + 36}
        label={`孔距 80`}
        side="bottom"
      />

      <text x={10} y={VH - 18} fontSize={FONT.CALLOUT} fill={COLOR.DIM}>
        埋頭孔 Ø{csDia}mm｜先導孔 Ø{pilot}mm｜兩孔均勻分散
      </text>
    </g>
  );

  // ----- 等角圖 (iso) -----
  const iso = (
    <IsometricGroup originX={210} originY={155} scale={1.05}>
      <g stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE}>
        <rect x={-PX(mt) / 2} y={0} width={PX(mt)} height={PX(70)} fill={COLOR.MORTISE} fillOpacity={0.85} />
        <rect x={-PX(60)} y={-PX(ct)} width={PX(120)} height={PX(ct)} fill={COLOR.TENON} />
        {[-1, 1].map((dir, i) => (
          <g key={i}>
            <line
              x1={dir * PX(40)}
              y1={-PX(ct) - 2}
              x2={dir * PX(40)}
              y2={PX(35)}
              stroke="#444"
              strokeWidth={1.4}
              strokeDasharray={DASH.HIDDEN}
            />
            <circle cx={dir * PX(40)} cy={-PX(ct) - 1} r={PX(csDia) / 2 + 0.5} fill="#555" />
          </g>
        ))}
      </g>
      <text x={PX(70)} y={-PX(ct) - 8} fontSize={FONT.CALLOUT} fill={COLOR.OUTLINE}>
        {/* // @joinery-dim-allow */}
        等角圖（30°）
      </text>
    </IsometricGroup>
  );

  return (
    <svg width={960} height={680} viewBox="0 0 960 680" className="bg-white">
      <ThreeViewLayout
        width={960}
        height={620}
        front={front}
        side={side}
        top={top}
        iso={iso}
        titleBlock={
          <TitleBlock
            x={0}
            y={0}
            width={960}
            joineryType={p.material ? `screw · ${p.material}` : "screw"}
            joineryNameZh="螺絲 + 白膠"
            scale="1:1"
            drawnBy="wrd-modern-joinery"
            drawingNumber={`SC-${ct}-${mt}-Ø${tt}-L${screwLen}`}
          />
        }
      />
    </svg>
  );
}
/* === END screw-detail === */

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
