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
  ScaleBar,
  TitleBlock,
  DimChain,
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

/* === BEGIN finger-joint-detail (owner: agent-C, group: C) === */
/* ============================================================
 * 指接榫 finger-joint / box joint
 *   兩塊板端面對端面 L 型接合，方齒交錯。指厚 = 板厚 / 2 是常見比例。
 * ============================================================ */
function LegacyFingerJointDetail(p: JoineryDetailParams) {
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

/**
 * 教科書級重繪：指接（finger / box joint）
 *
 * 三視圖 + 等角圖 layout：
 *   - 正視圖：A、B 兩件分解，奇/偶位指交錯
 *   - 側視圖：兩件 L 型組合（俯瞰側面）
 *   - 俯視圖：上方俯瞰指齒交錯排列
 *   - 等角圖：3D 30° 視角單件指齒
 *
 * 指數 = floor(cw / tt)（剩餘均分到兩端肩）；指長 = mt（板厚相當）
 */
function FingerJointDetail(p: JoineryDetailParams) {
  const tl = p.tenonLength;
  const tt = p.tenonThickness;
  const mt = p.motherThickness;
  const ct = p.childThickness ?? tt;
  const cw = p.childWidth ?? p.tenonWidth;

  // 真實指數計算：floor(cw / tt)，最少 3 指；剩餘均分兩端肩
  const ttSafe = Math.max(1, tt);
  const fingerCount = Math.max(3, Math.floor(cw / ttSafe));
  const fingerLen = mt; // 指長 = 板厚相當（教科書慣例）
  const fingersTotalMm = fingerCount * tt;
  const shoulderTotalMm = Math.max(0, cw - fingersTotalMm);
  const shoulderEachMm = shoulderTotalMm / 2;

  const W = 960;
  const H = 720;

  // ===== 正視圖（左上）：A / B 兩件分解 =====
  const front = (() => {
    const innerW = (W - 10) / 2;
    const innerH = (H - 60 - 10) / 2;
    const pad = 26;
    const usableW = innerW - pad * 2;
    const usableH = innerH - pad * 2 - 20;

    // 每片畫得夠大：寬度 = cw（mm），高度 = mt + fingerLen
    const sX = usableW / Math.max(1, cw);
    const sY = (usableH / 2 - 18) / Math.max(1, mt + fingerLen);
    const s = Math.min(sX, sY);
    const PX = (mm: number) => mm * s;

    const aOX = pad;
    const aOY = pad + 12;
    const bOX = pad;
    const bOY = aOY + PX(mt + fingerLen) + 36;

    // A 件：肩 + (指、凹)*N + 肩
    const buildAPoints = (oX: number, oY: number) => {
      const pts: string[] = [`${oX},${oY + PX(fingerLen + mt)}`, `${oX},${oY + PX(fingerLen)}`];
      let cx = oX + PX(shoulderEachMm);
      pts.push(`${cx},${oY + PX(fingerLen)}`);
      for (let i = 0; i < fingerCount; i++) {
        // 指：上凸
        pts.push(`${cx},${oY}`);
        pts.push(`${cx + PX(tt)},${oY}`);
        pts.push(`${cx + PX(tt)},${oY + PX(fingerLen)}`);
        cx += PX(tt);
        // 指間凹槽（不是最後一指才畫平台）
        if (i < fingerCount - 1) {
          pts.push(`${cx + PX(tt) * 0},${oY + PX(fingerLen)}`);
        }
      }
      pts.push(`${oX + PX(cw)},${oY + PX(fingerLen)}`);
      pts.push(`${oX + PX(cw)},${oY + PX(fingerLen + mt)}`);
      return pts.join(" ");
    };
    // B 件：肩端 = 凹（從 0 到第一指 base 是凹）；偶數位反向
    const buildBPoints = (oX: number, oY: number) => {
      // B 凸的位置 = A 凹的位置；A 起始 shoulder 後就是 finger，所以 B 起始 = shoulder 後就是凹
      const pts: string[] = [`${oX},${oY + PX(fingerLen + mt)}`, `${oX},${oY}`];
      let cx = oX + PX(shoulderEachMm);
      pts.push(`${cx},${oY}`);
      // 起始凹（A 第一指位置）
      pts.push(`${cx},${oY + PX(fingerLen)}`);
      for (let i = 0; i < fingerCount; i++) {
        if (i === 0) {
          // A 第一指 → B 第一凹
          pts.push(`${cx + PX(tt)},${oY + PX(fingerLen)}`);
          pts.push(`${cx + PX(tt)},${oY}`);
        } else {
          // 在 A 凹的位置 B 是凸
          pts.push(`${cx + PX(tt)},${oY}`);
          // 接著 A 凸 → B 凹
          pts.push(`${cx + PX(tt)},${oY + PX(fingerLen)}`);
          pts.push(`${cx + PX(tt) * 2},${oY + PX(fingerLen)}`);
          pts.push(`${cx + PX(tt) * 2},${oY}`);
        }
        cx += PX(tt) * (i === 0 ? 1 : 2);
        if (cx >= oX + PX(cw - shoulderEachMm)) break;
      }
      pts.push(`${oX + PX(cw)},${oY}`);
      pts.push(`${oX + PX(cw)},${oY + PX(fingerLen + mt)}`);
      return pts.join(" ");
    };

    return (
      <g>
        <text x={pad} y={14} fontSize={FONT.LABEL} fontWeight="bold" fill={COLOR.OUTLINE}>正視圖（分解 A / B 兩件）</text>
        {/* A 件 */}
        <polygon points={buildAPoints(aOX, aOY)} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        <text x={aOX + PX(cw) / 2} y={aOY + PX(fingerLen + mt) + 14} fontSize={FONT.DIM} textAnchor="middle" fill="#666">
          A 件（{fingerCount} 指）
        </text>
        {/* 指長 dim */}
        <DimLine x1={aOX - 6} y1={aOY} x2={aOX - 6} y2={aOY + PX(fingerLen)} label={`${fingerLen}`} side="left" />
        {/* 板厚 dim */}
        <DimLine x1={aOX - 6} y1={aOY + PX(fingerLen)} x2={aOX - 6} y2={aOY + PX(fingerLen + mt)} label={`${mt}`} side="left" />
        {/* 指寬 dim（第一指） */}
        <DimLine
          x1={aOX + PX(shoulderEachMm)}
          y1={aOY - 4}
          x2={aOX + PX(shoulderEachMm + tt)}
          y2={aOY - 4}
          label={`${tt}`}
          side="top"
        />
        {/* 端肩 dim */}
        {shoulderEachMm > 0 && (
          <DimLine
            x1={aOX}
            y1={aOY - 4}
            x2={aOX + PX(shoulderEachMm)}
            y2={aOY - 4}
            label={`肩 ${Math.round(shoulderEachMm)}`}
            side="top"
          />
        )}
        {/* 中心線 */}
        <CenterLine x1={aOX + PX(cw) / 2} y1={aOY - 14} x2={aOX + PX(cw) / 2} y2={aOY + PX(fingerLen + mt) + 6} />

        {/* B 件 */}
        <polygon points={buildBPoints(bOX, bOY)} fill={COLOR.MORTISE} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        <text x={bOX + PX(cw) / 2} y={bOY + PX(fingerLen + mt) + 14} fontSize={FONT.DIM} textAnchor="middle" fill="#666">
          B 件（互補指齒）
        </text>
        <CenterLine x1={bOX + PX(cw) / 2} y1={bOY - 8} x2={bOX + PX(cw) / 2} y2={bOY + PX(fingerLen + mt) + 6} />

        {/* 木紋方向（沿板長方向） */}
        <GrainArrow x={aOX + PX(cw) + 10} y={aOY + PX(fingerLen + mt / 2)} length={Math.min(40, PX(cw) * 0.4)} angle={0} />
        <GrainArrow x={bOX + PX(cw) + 10} y={bOY + PX(fingerLen + mt / 2)} length={Math.min(40, PX(cw) * 0.4)} angle={0} />

        {/* 剖面標 A-A（沿中軸切） */}
        <SectionMark x={aOX + PX(cw) / 2 - 14} y={aOY - 18} label="A" direction="right" />
        <SectionMark x={aOX + PX(cw) / 2 + 14} y={aOY - 18} label="A" direction="left" />
      </g>
    );
  })();

  // ===== 側視圖（右上）：L 型組合斷面 =====
  const side = (() => {
    const innerW = (W - 10) / 2;
    const innerH = (H - 60 - 10) / 2;
    const pad = 26;
    const usableW = innerW - pad * 2;
    const usableH = innerH - pad * 2 - 20;

    // 兩塊厚度 ct + mt 顯示 L 型
    const totalLen = ct + Math.max(80, mt * 4);
    const sX = usableW / Math.max(1, totalLen + ct);
    const sY = usableH / Math.max(1, totalLen + ct);
    const s = Math.min(sX, sY) * 0.9;
    const PX = (mm: number) => mm * s;

    const armLen = Math.max(80, mt * 4);
    const oX = pad + 10;
    const oY = pad + 14;
    return (
      <g>
        <text x={pad} y={14} fontSize={FONT.LABEL} fontWeight="bold" fill={COLOR.OUTLINE}>側視圖（L 型轉角斷面 A-A）</text>
        <defs>
          <Hatching id="hatch-finger-side" color={COLOR.SECTION_HATCH} />
        </defs>
        {/* 水平件（A） */}
        <rect x={oX} y={oY} width={PX(armLen)} height={PX(ct)} fill="url(#hatch-finger-side)" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        <rect x={oX} y={oY} width={PX(armLen)} height={PX(ct)} fill="none" stroke={COLOR.OUTLINE} />
        {/* 垂直件（B） */}
        <rect x={oX + PX(armLen)} y={oY} width={PX(ct)} height={PX(armLen)} fill="url(#hatch-finger-side)" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        <rect x={oX + PX(armLen)} y={oY} width={PX(ct)} height={PX(armLen)} fill="none" stroke={COLOR.OUTLINE} />

        {/* 指接縫（虛線顯示交錯位置） */}
        <g>
          {Array.from({ length: fingerCount * 2 - 1 }).map((_, i) => {
            const segH = PX(ct) / (fingerCount * 2);
            const y = oY + segH * (i + 1);
            return (
              <HiddenEdge
                key={i}
                x1={oX + PX(armLen)}
                y1={y}
                x2={oX + PX(armLen) + PX(ct)}
                y2={y}
              />
            );
          })}
        </g>
        {/* 板厚 dim */}
        <DimLine x1={oX + PX(armLen) + PX(ct) + 6} y1={oY} x2={oX + PX(armLen) + PX(ct) + 6} y2={oY + PX(ct)} label={`${ct}`} side="right" />
        <DimLine x1={oX} y1={oY + PX(ct) + 6} x2={oX + PX(armLen)} y2={oY + PX(ct) + 6} label={`${Math.round(armLen)}`} side="bottom" />
        <text x={oX + PX(armLen) / 2} y={oY + PX(ct) / 2 + 3} fontSize={FONT.DIM} textAnchor="middle" fill={COLOR.OUTLINE}>A 件（剖面）</text>
        <text x={oX + PX(armLen) + PX(ct) / 2} y={oY + PX(armLen) + 12} fontSize={FONT.DIM} textAnchor="middle" fill={COLOR.OUTLINE}>B 件</text>

        {/* 警示 */}
        <WarningCallout x={pad} y={innerH - 70} text={`指齒尖角應磨 R0.5 防爆裂`} severity="warn" />
      </g>
    );
  })();

  // ===== 俯視圖（左下）：上方俯瞰指齒交錯 =====
  const top = (() => {
    const innerW = (W - 10) / 2;
    const innerH = (H - 60 - 10) / 2;
    const pad = 26;
    const usableW = innerW - pad * 2;
    const usableH = innerH - pad * 2 - 20;

    const sX = usableW / Math.max(1, cw + 20);
    const sY = usableH / Math.max(1, ct * 4 + 60);
    const s = Math.min(sX, sY) * 0.85;
    const PX = (mm: number) => mm * s;

    const oX = pad + 10;
    const oY = pad + 18;
    const rowH = PX(ct);

    return (
      <g>
        <text x={pad} y={14} fontSize={FONT.LABEL} fontWeight="bold" fill={COLOR.OUTLINE}>俯視圖（指齒交錯排列）</text>
        {/* A 件指齒（俯視 = 看到 N 個方齒突出） */}
        <g>
          {/* A 件本體 */}
          <rect x={oX} y={oY} width={PX(cw)} height={rowH} fill={COLOR.TENON} stroke={COLOR.OUTLINE} />
          {/* 端肩 */}
          {shoulderEachMm > 0 && (
            <>
              <rect x={oX} y={oY - PX(fingerLen)} width={PX(shoulderEachMm)} height={PX(fingerLen)} fill="white" stroke={COLOR.OUTLINE} />
              <rect x={oX + PX(cw - shoulderEachMm)} y={oY - PX(fingerLen)} width={PX(shoulderEachMm)} height={PX(fingerLen)} fill="white" stroke={COLOR.OUTLINE} />
            </>
          )}
          {/* N 個指齒往上凸 */}
          {Array.from({ length: fingerCount }).map((_, i) => (
            <rect
              key={i}
              x={oX + PX(shoulderEachMm + i * tt)}
              y={oY - PX(fingerLen)}
              width={PX(tt)}
              height={PX(fingerLen)}
              fill={COLOR.TENON}
              stroke={COLOR.OUTLINE}
              strokeWidth={STROKE.OUTLINE}
            />
          ))}
          <text x={oX + PX(cw) / 2} y={oY + rowH + 12} fontSize={FONT.DIM} textAnchor="middle" fill="#666">A 件俯視</text>
        </g>

        {/* B 件指齒 */}
        <g transform={`translate(0,${PX(fingerLen) + rowH + 50})`}>
          <rect x={oX} y={oY} width={PX(cw)} height={rowH} fill={COLOR.MORTISE} stroke={COLOR.OUTLINE} />
          {/* B 件指齒在 A 凹處（即 shoulder 後 + 奇數位置） */}
          {Array.from({ length: fingerCount - 1 }).map((_, i) => (
            <rect
              key={i}
              x={oX + PX(shoulderEachMm + (i + 0.5) * tt + 0.5 * tt)}
              y={oY - PX(fingerLen)}
              width={PX(tt)}
              height={PX(fingerLen)}
              fill={COLOR.MORTISE}
              stroke={COLOR.OUTLINE}
              strokeWidth={STROKE.OUTLINE}
            />
          ))}
          <text x={oX + PX(cw) / 2} y={oY + rowH + 12} fontSize={FONT.DIM} textAnchor="middle" fill="#666">B 件俯視（互補）</text>
        </g>

        {/* dim chain：兩端肩 + N×指 */}
        <DimLine x1={oX} y1={oY - PX(fingerLen) - 8} x2={oX + PX(cw)} y2={oY - PX(fingerLen) - 8} label={`板寬 ${cw}`} side="top" />
      </g>
    );
  })();

  // ===== 等角圖（右下）：3D 30° 視角單件指齒 =====
  const isoOriginX = 200;
  const isoOriginY = 220;
  const iso = (() => {
    // 為了簡化：在 IsometricGroup 內畫一個 finger-end 立體示意
    // 用 mm-base 座標，IsometricGroup 會 30° 投影
    const isoScale = Math.min(1.1, 100 / Math.max(1, cw));
    const drawCw = cw;
    const drawCt = ct;
    const drawFL = fingerLen;
    const drawTT = tt;

    const elements: ReturnType<typeof FingerIsoElement>[] = [];
    function FingerIsoElement(idx: number) {
      const x = shoulderEachMm + idx * drawTT;
      // 每個 finger 是長方體：x..x+tt, y=0..fingerLen, z=0..ct
      // 在 IsoGroup 內，children 的 (x,y) 已被 30° 旋轉變成 iso；ct 是「Z 深度」我們手畫成 +(-y, +y) offset
      const zOff = drawCt * 0.4; // depth visually
      return (
        <g key={idx}>
          {/* 前面 */}
          <polygon
            points={`${x},${0} ${x + drawTT},${0} ${x + drawTT},${drawFL} ${x},${drawFL}`}
            fill={COLOR.TENON}
            stroke={COLOR.OUTLINE}
            strokeWidth={STROKE.OUTLINE}
          />
          {/* 上面（往後 zOff） */}
          <polygon
            points={`${x},${0} ${x + drawTT},${0} ${x + drawTT - zOff},${-zOff} ${x - zOff},${-zOff}`}
            fill="#f2dba8"
            stroke={COLOR.OUTLINE}
            strokeWidth={STROKE.OUTLINE}
          />
          {/* 側面 */}
          <polygon
            points={`${x + drawTT},${0} ${x + drawTT - zOff},${-zOff} ${x + drawTT - zOff},${drawFL - zOff} ${x + drawTT},${drawFL}`}
            fill="#d6b683"
            stroke={COLOR.OUTLINE}
            strokeWidth={STROKE.OUTLINE}
          />
        </g>
      );
    }
    for (let i = 0; i < fingerCount; i++) elements.push(FingerIsoElement(i));

    // 板身（在 fingers 下方）
    const boardBody = (
      <g>
        <polygon
          points={`${0},${drawFL} ${drawCw},${drawFL} ${drawCw},${drawFL + 30} ${0},${drawFL + 30}`}
          fill={COLOR.TENON}
          stroke={COLOR.OUTLINE}
          strokeWidth={STROKE.OUTLINE}
        />
        <polygon
          points={`${drawCw},${drawFL} ${drawCw - drawCt * 0.4},${drawFL - drawCt * 0.4} ${drawCw - drawCt * 0.4},${drawFL + 30 - drawCt * 0.4} ${drawCw},${drawFL + 30}`}
          fill="#d6b683"
          stroke={COLOR.OUTLINE}
          strokeWidth={STROKE.OUTLINE}
        />
      </g>
    );

    return (
      <g>
        <text x={20} y={14} fontSize={FONT.LABEL} fontWeight="bold" fill={COLOR.OUTLINE}>等角圖（30° 軸測）</text>
        <text x={20} y={28} fontSize={FONT.CALLOUT} fill="#888">
          指數 = floor({cw}/{tt}) = {fingerCount}，指長 {fingerLen} mm
        </text>
        <IsometricGroup originX={isoOriginX} originY={isoOriginY} scale={isoScale * 1.4} rotation={30}>
          {boardBody}
          {elements}
        </IsometricGroup>
      </g>
    );
  })();

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: "960px" }} className="bg-white">
      <ThreeViewLayout
        width={W}
        height={H - 60}
        front={front}
        side={side}
        top={top}
        iso={iso}
        titleBlock={
          <TitleBlock
            x={0}
            y={0}
            width={W}
            joineryType="finger-joint"
            joineryNameZh="指接（box joint）"
            scale="1:1"
          />
        }
      />
      {/* 比例尺與 ScaleBar 放在標題欄上方 */}
      <ScaleBar x={W - 220} y={H - 80} widthMm={Math.max(40, cw * 0.4)} pxPerMm={Math.min(2, 200 / Math.max(20, cw))} segments={4} label="mm" />
    </svg>
  );
}
/* === END finger-joint-detail === */

/* === BEGIN dowel-detail (owner: agent-C, group: C) === */
/* ============================================================
 * 圓棒榫 dowel
 *   兩件對接，鑽配對孔插入木釘。釘徑 = 板厚 1/3（最大 1/2），
 *   長 = 徑 × 1.5 + 1/16" 餘量。
 * ============================================================ */
function LegacyDowelDetail(p: JoineryDetailParams) {
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

/**
 * 教科書級重繪：木釘（dowel joint）
 *
 * 三視圖 + 等角圖 layout：
 *   - 正視圖：兩件對接 + 中間木釘（剖面看孔深）
 *   - 側視圖：板厚方向看孔位
 *   - 俯視圖：圓孔陣列（A 件孔 vs B 件孔）
 *   - 等角圖：圓柱木釘 + 板內圓孔
 *
 * 圓釘直徑 Ø = tt（既有慣例）；釘數 = max(2, floor(cw / (Ø*4)))
 */
function DowelDetail(p: JoineryDetailParams) {
  const tl = p.tenonLength;
  const tt = p.tenonThickness; // 釘徑 Ø
  const mt = p.motherThickness;
  const ct = p.childThickness ?? tt;
  const cw = p.childWidth ?? p.tenonWidth;

  const ttSafe = Math.max(1, tt);
  const dowelCount = Math.max(2, Math.floor(cw / (ttSafe * 4)));
  // 每孔深 = (tl / 2) + 0.5mm 餘量（兩件平分）；母件厚必須 > 孔深 + 3mm
  const holeDepth = Math.min(mt - 3, tl / 2 + 0.5);
  const holeDepthSafe = Math.max(3, holeDepth);
  // 釘間距 = cw / (dowelCount + 1)
  const spacing = cw / (dowelCount + 1);

  const W = 960;
  const H = 720;

  // ===== 正視圖（左上）：兩件對接 + 木釘 =====
  const front = (() => {
    const innerW = (W - 10) / 2;
    const innerH = (H - 60 - 10) / 2;
    const pad = 26;
    const usableW = innerW - pad * 2;
    const usableH = innerH - pad * 2 - 30;

    const totalLen = mt * 2 + tl;
    const sX = usableW / Math.max(1, totalLen + 30);
    const sY = usableH / Math.max(1, ct + 50);
    const s = Math.min(sX, sY) * 0.9;
    const PX = (mm: number) => mm * s;

    const oX = pad + 10;
    const oY = pad + 30;

    return (
      <g>
        <text x={pad} y={14} fontSize={FONT.LABEL} fontWeight="bold" fill={COLOR.OUTLINE}>正視圖（對接 + 木釘剖面）</text>

        {/* A 件（左） */}
        <rect x={oX} y={oY} width={PX(mt)} height={PX(ct)} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        {/* B 件（右） */}
        <rect x={oX + PX(mt)} y={oY} width={PX(mt)} height={PX(ct)} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />

        {/* 接縫中軸（CenterLine） */}
        <CenterLine x1={oX + PX(mt)} y1={oY - 10} x2={oX + PX(mt)} y2={oY + PX(ct) + 10} />

        {/* 木釘（剖面圓 + 兩孔深虛線） */}
        {Array.from({ length: dowelCount }).map((_, i) => {
          const dy = oY + PX(spacing * (i + 1));
          if (dy > oY + PX(ct) - PX(tt) / 2) return null;
          return (
            <g key={i}>
              {/* 木釘 body：橫躺圓柱 */}
              <rect
                x={oX + PX(mt - holeDepthSafe)}
                y={dy - PX(tt) / 2}
                width={PX(holeDepthSafe * 2)}
                height={PX(tt)}
                fill={COLOR.MORTISE}
                stroke={COLOR.OUTLINE}
                strokeWidth={STROKE.OUTLINE}
                rx={PX(tt) / 2}
              />
              {/* 孔輪廓虛線（A、B 件內） */}
              <HiddenEdge x1={oX + PX(mt - holeDepthSafe)} y1={dy - PX(tt) / 2} x2={oX + PX(mt + holeDepthSafe)} y2={dy - PX(tt) / 2} />
              <HiddenEdge x1={oX + PX(mt - holeDepthSafe)} y1={dy + PX(tt) / 2} x2={oX + PX(mt + holeDepthSafe)} y2={dy + PX(tt) / 2} />
            </g>
          );
        })}

        {/* 尺寸 */}
        <DimLine x1={oX} y1={oY - 8} x2={oX + PX(mt)} y2={oY - 8} label={`A厚 ${mt}`} side="top" />
        <DimLine x1={oX + PX(mt)} y1={oY - 8} x2={oX + PX(mt * 2)} y2={oY - 8} label={`B厚 ${mt}`} side="top" />
        <DimLine x1={oX + PX(mt - holeDepthSafe)} y1={oY + PX(ct) + 8} x2={oX + PX(mt + holeDepthSafe)} y2={oY + PX(ct) + 8} label={`釘長 ${tl}`} side="bottom" />
        <DimLine x1={oX - 8} y1={oY} x2={oX - 8} y2={oY + PX(ct)} label={`板寬 ${ct}`} side="left" />

        {/* 剖面 A-A */}
        <SectionMark x={oX + PX(mt) - 14} y={oY + PX(ct) + 30} label="A" direction="right" />
        <SectionMark x={oX + PX(mt) + 14} y={oY + PX(ct) + 30} label="A" direction="left" />

        {/* 木紋 */}
        <GrainArrow x={oX} y={oY + PX(ct) + 22} length={Math.min(40, PX(mt) * 0.6)} angle={0} />
      </g>
    );
  })();

  // ===== 側視圖（右上）：板厚方向看孔位 =====
  const side = (() => {
    const innerW = (W - 10) / 2;
    const innerH = (H - 60 - 10) / 2;
    const pad = 26;
    const usableW = innerW - pad * 2;
    const usableH = innerH - pad * 2 - 30;

    // 顯示 B 件斷面：寬 ct × 高 cw，內含 dowelCount 個圓孔
    const sX = usableW / Math.max(1, ct + 30);
    const sY = usableH / Math.max(1, cw + 30);
    const s = Math.min(sX, sY) * 0.85;
    const PX = (mm: number) => mm * s;
    const oX = pad + 30;
    const oY = pad + 24;

    return (
      <g>
        <text x={pad} y={14} fontSize={FONT.LABEL} fontWeight="bold" fill={COLOR.OUTLINE}>側視圖（端面孔位）</text>
        <defs>
          <Hatching id="hatch-dowel-side" color={COLOR.SECTION_HATCH} />
        </defs>
        {/* 板斷面（端視 = 寬 × 高） */}
        <rect x={oX} y={oY} width={PX(ct)} height={PX(cw)} fill="url(#hatch-dowel-side)" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        <rect x={oX} y={oY} width={PX(ct)} height={PX(cw)} fill="none" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />

        {/* 鑽孔陣列 */}
        {Array.from({ length: dowelCount }).map((_, i) => {
          const cy = oY + PX(spacing * (i + 1));
          const cxC = oX + PX(ct / 2);
          return (
            <g key={i}>
              <circle cx={cxC} cy={cy} r={PX(tt) / 2} fill="white" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
              {/* 孔中心十字 */}
              <CenterLine x1={cxC - PX(tt) * 0.7} y1={cy} x2={cxC + PX(tt) * 0.7} y2={cy} />
              <CenterLine x1={cxC} y1={cy - PX(tt) * 0.7} x2={cxC} y2={cy + PX(tt) * 0.7} />
            </g>
          );
        })}

        {/* dim 釘徑 */}
        <DimLine x1={oX + PX(ct) + 8} y1={oY + PX(spacing) - PX(tt) / 2} x2={oX + PX(ct) + 8} y2={oY + PX(spacing) + PX(tt) / 2} label={`Ø ${tt}`} side="right" />
        <DimLine x1={oX} y1={oY + PX(cw) + 8} x2={oX + PX(ct)} y2={oY + PX(cw) + 8} label={`板厚 ${ct}`} side="bottom" />
        <DimLine x1={oX - 8} y1={oY} x2={oX - 8} y2={oY + PX(cw)} label={`板寬 ${cw}`} side="left" />
        {dowelCount >= 2 && (
          <DimLine
            x1={oX + PX(ct) + 28}
            y1={oY + PX(spacing)}
            x2={oX + PX(ct) + 28}
            y2={oY + PX(spacing * 2)}
            label={`間距 ${Math.round(spacing)}`}
            side="right"
          />
        )}

        <WarningCallout x={pad} y={innerH - 60} text={`孔位誤差 <= 0.3mm`} severity="warn" />
      </g>
    );
  })();

  // ===== 俯視圖（左下）：上方看 — 兩件對接帶白膠塗佈面 =====
  const top = (() => {
    const innerW = (W - 10) / 2;
    const innerH = (H - 60 - 10) / 2;
    const pad = 26;
    const usableW = innerW - pad * 2;
    const usableH = innerH - pad * 2 - 30;

    const totalLen = mt * 2;
    const sX = usableW / Math.max(1, totalLen + 30);
    const sY = usableH / Math.max(1, cw + 30);
    const s = Math.min(sX, sY) * 0.85;
    const PX = (mm: number) => mm * s;
    const oX = pad + 10;
    const oY = pad + 24;

    return (
      <g>
        <text x={pad} y={14} fontSize={FONT.LABEL} fontWeight="bold" fill={COLOR.OUTLINE}>俯視圖（孔位 + 白膠塗佈面）</text>
        {/* A 件俯視 */}
        <rect x={oX} y={oY} width={PX(mt)} height={PX(cw)} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        {/* B 件俯視 */}
        <rect x={oX + PX(mt)} y={oY} width={PX(mt)} height={PX(cw)} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />

        {/* 中縫白膠塗佈面 */}
        <rect x={oX + PX(mt) - 2} y={oY} width={4} height={PX(cw)} fill={COLOR.SECTION_HATCH} fillOpacity={0.4} stroke="none" />
        <text x={oX + PX(mt) + 30} y={oY - 4} fontSize={FONT.CALLOUT} fill={COLOR.SECTION_HATCH}>
          白膠塗佈面（接縫全長）
        </text>

        {/* 圓孔（兩側對稱） */}
        {Array.from({ length: dowelCount }).map((_, i) => {
          const cy = oY + PX(spacing * (i + 1));
          const cxA = oX + PX(mt - holeDepthSafe / 2);
          const cxB = oX + PX(mt + holeDepthSafe / 2);
          return (
            <g key={i}>
              <circle cx={cxA} cy={cy} r={PX(tt) / 2} fill="white" stroke={COLOR.OUTLINE} strokeDasharray={DASH.HIDDEN} />
              <circle cx={cxB} cy={cy} r={PX(tt) / 2} fill="white" stroke={COLOR.OUTLINE} strokeDasharray={DASH.HIDDEN} />
              <CenterLine x1={cxA - PX(tt)} y1={cy} x2={cxB + PX(tt)} y2={cy} />
            </g>
          );
        })}

        {/* dim 孔深兩側 */}
        <DimLine
          x1={oX + PX(mt - holeDepthSafe)}
          y1={oY + PX(cw) + 8}
          x2={oX + PX(mt)}
          y2={oY + PX(cw) + 8}
          label={`孔深 ${Math.round(holeDepthSafe)}`}
          side="bottom"
        />
        <DimLine
          x1={oX + PX(mt)}
          y1={oY + PX(cw) + 8}
          x2={oX + PX(mt + holeDepthSafe)}
          y2={oY + PX(cw) + 8}
          label={`孔深 ${Math.round(holeDepthSafe)}`}
          side="bottom"
        />

        <text x={oX + PX(mt)} y={oY + PX(cw) + 32} fontSize={FONT.DIM} textAnchor="middle" fill="#666">
          {dowelCount} 釘 × Ø {tt} mm，間距 {Math.round(spacing)} mm
        </text>
      </g>
    );
  })();

  // ===== 等角圖（右下）：3D 30° 木釘 + 板 =====
  const iso = (() => {
    const isoScale = Math.min(1.0, 90 / Math.max(1, mt));
    const drawMt = mt;
    const drawCt = ct;
    const drawTt = tt;
    const drawHd = holeDepthSafe;

    return (
      <g>
        <text x={20} y={14} fontSize={FONT.LABEL} fontWeight="bold" fill={COLOR.OUTLINE}>等角圖（30° 軸測）</text>
        <text x={20} y={28} fontSize={FONT.CALLOUT} fill="#888">
          {dowelCount} 釘陣列 · Ø {tt} · 釘長 {tl} (= 兩側孔深 {Math.round(drawHd)} ×2)
        </text>
        <IsometricGroup originX={170} originY={220} scale={isoScale * 1.4} rotation={30}>
          {/* B 件本體（cube） */}
          <g>
            {/* 前面 */}
            <polygon
              points={`${0},${0} ${drawMt},${0} ${drawMt},${drawCt} ${0},${drawCt}`}
              fill={COLOR.TENON}
              stroke={COLOR.OUTLINE}
              strokeWidth={STROKE.OUTLINE}
            />
            {/* 上面 */}
            <polygon
              points={`${0},${0} ${drawMt},${0} ${drawMt - drawCt * 0.4},${-drawCt * 0.4} ${-drawCt * 0.4},${-drawCt * 0.4}`}
              fill="#f2dba8"
              stroke={COLOR.OUTLINE}
              strokeWidth={STROKE.OUTLINE}
            />
            {/* 側面 */}
            <polygon
              points={`${drawMt},${0} ${drawMt - drawCt * 0.4},${-drawCt * 0.4} ${drawMt - drawCt * 0.4},${drawCt - drawCt * 0.4} ${drawMt},${drawCt}`}
              fill="#d6b683"
              stroke={COLOR.OUTLINE}
              strokeWidth={STROKE.OUTLINE}
            />
          </g>
          {/* 木釘 = 圓柱（用橢圓 + 矩形示意） */}
          {Array.from({ length: dowelCount }).map((_, i) => {
            const cy = (i + 1) * (drawCt / (dowelCount + 1));
            return (
              <g key={i}>
                {/* 圓柱主體 */}
                <rect
                  x={drawMt - drawHd}
                  y={cy - drawTt / 2}
                  width={drawHd * 2 + drawCt * 0.2}
                  height={drawTt}
                  fill={COLOR.MORTISE}
                  stroke={COLOR.OUTLINE}
                  strokeWidth={STROKE.OUTLINE}
                  rx={drawTt / 2}
                />
                {/* 端面圓（橢圓示意） */}
                <ellipse cx={drawMt + drawHd + drawCt * 0.1} cy={cy} rx={drawTt * 0.25} ry={drawTt / 2} fill="#c89c5d" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
              </g>
            );
          })}
        </IsometricGroup>
      </g>
    );
  })();

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: "960px" }} className="bg-white">
      <ThreeViewLayout
        width={W}
        height={H - 60}
        front={front}
        side={side}
        top={top}
        iso={iso}
        titleBlock={
          <TitleBlock
            x={0}
            y={0}
            width={W}
            joineryType="dowel"
            joineryNameZh="木釘（dowel joint）"
            scale="1:1"
          />
        }
      />
      <ScaleBar x={W - 220} y={H - 80} widthMm={Math.max(40, mt * 0.8)} pxPerMm={Math.min(2, 200 / Math.max(20, mt))} segments={4} label="mm" />
    </svg>
  );
}
/* === END dowel-detail === */

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

/* === BEGIN stub-joint-detail (owner: agent-C, group: C) === */
/**
 * Stub joint (整支卡榫 / housing joint)：牙條/橫撐不另做榫，整個端面（全斷面）
 * 卡進母件上挖的同尺寸寬深榫眼。常用於圓腳——圓側面難加工標準肩榫。
 *
 * 視覺差異 vs blind-tenon：
 * - 沒有「肩」（榫頭斷面 = 公件斷面，不縮小）
 * - 母件榫眼斷面 = 公件全斷面（apronWidth × apronThickness）
 * - 圓腳時母件畫圓、榫眼是內接的長方形
 */
function LegacyStubJointDetail(p: JoineryDetailParams) {
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

/**
 * 教科書級重繪：整支卡榫（stub joint / housing）
 *
 * 三視圖 + 等角圖 layout：
 *   - 正視圖：母件側面 + 榫眼開口 + 公件分解
 *   - 側視圖：剖面顯示卡入深、無肩 vs 有肩對比
 *   - 俯視圖：上視切面看母件+牙條的卡入位置
 *   - 等角圖：3D 30° 母件（含圓腳特例）+ 牙條進入
 *
 * 強制：tl ≤ min(mt - 3, ct / 2)；圓腳 motherShape="round" 保留圓畫法
 */
function StubJointDetail(p: JoineryDetailParams) {
  const tlRaw = p.tenonLength;
  const cw = p.childWidth ?? p.tenonWidth;
  const ct = p.childThickness ?? p.tenonThickness;
  const mt = p.motherThickness;
  const isRound = p.motherShape === "round";
  // 強制 tl 安全上限：≤ min(mt-3, ct/2)
  const tl = Math.max(2, Math.min(tlRaw, Math.min(mt - 3, ct / 2)));

  const W = 960;
  const H = 720;

  // ===== 正視圖（左上）：母件側面 + 公件分解 =====
  const front = (() => {
    const innerW = (W - 10) / 2;
    const innerH = (H - 60 - 10) / 2;
    const pad = 26;
    const usableW = innerW - pad * 2;
    const usableH = innerH - pad * 2 - 20;

    const sX = usableW / Math.max(1, mt + cw + 80);
    const sY = usableH / Math.max(1, Math.max(cw, ct) * 2 + 60);
    const s = Math.min(sX, sY) * 0.85;
    const PX = (mm: number) => mm * s;

    const oX = pad + 10;
    const oY = pad + 24;

    // 母件側面 = 寬 mt × 高 cw（顯示榫眼開口）
    const motherW = PX(mt);
    const motherH = PX(cw);
    const mortiseW = PX(tl); // 榫眼深度 = tl
    const mortiseH = PX(ct); // 榫眼寬度 = 公件厚

    return (
      <g>
        <text x={pad} y={14} fontSize={FONT.LABEL} fontWeight="bold" fill={COLOR.OUTLINE}>正視圖（母件側面 + 公件分解）</text>

        {/* 母件側面 */}
        {isRound ? (
          <ellipse cx={oX + motherW / 2} cy={oY + motherH / 2} rx={motherW / 2} ry={motherH / 2} fill={COLOR.MORTISE} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        ) : (
          <rect x={oX} y={oY} width={motherW} height={motherH} fill={COLOR.MORTISE} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        )}
        {/* 榫眼（從右側往內挖） */}
        <rect
          x={oX + motherW - mortiseW}
          y={oY + (motherH - mortiseH) / 2}
          width={mortiseW}
          height={mortiseH}
          fill="#3d2a14"
          stroke={COLOR.OUTLINE}
          strokeWidth={STROKE.OUTLINE}
        />
        {/* 中心線 */}
        <CenterLine x1={oX - 6} y1={oY + motherH / 2} x2={oX + motherW + 6} y2={oY + motherH / 2} />
        <CenterLine x1={oX + motherW / 2} y1={oY - 6} x2={oX + motherW / 2} y2={oY + motherH + 6} />

        {/* 公件 — 與母件分離畫在右側 */}
        <g transform={`translate(${motherW + 50},0)`}>
          <rect x={oX} y={oY + (motherH - mortiseH) / 2} width={PX(cw)} height={mortiseH} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
          {/* 強調：「整支端面 = 榫」用虛線標出將要插入部分 */}
          <rect
            x={oX}
            y={oY + (motherH - mortiseH) / 2}
            width={mortiseW}
            height={mortiseH}
            fill="none"
            stroke={COLOR.SECTION_HATCH}
            strokeWidth={0.8}
            strokeDasharray={DASH.AUX}
          />
          <text x={oX + PX(cw) / 2} y={oY + motherH + 14} fontSize={FONT.DIM} textAnchor="middle" fill="#666">
            公件（牙條/橫撐）整支端面 = 榫，無肩
          </text>
        </g>

        {/* 標籤 */}
        <text x={oX + motherW / 2} y={oY + motherH + 14} fontSize={FONT.DIM} textAnchor="middle" fill="#666">
          母件（{isRound ? "圓腳側面" : "方腳側面"}）
        </text>

        {/* 尺寸 */}
        <DimLine x1={oX} y1={oY - 8} x2={oX + motherW} y2={oY - 8} label={`母件${isRound ? "直徑" : "寬"} ${mt}`} side="top" />
        <DimLine x1={oX - 8} y1={oY} x2={oX - 8} y2={oY + motherH} label={`${cw}`} side="left" />
        <DimLine
          x1={oX + motherW - mortiseW}
          y1={oY + motherH + 30}
          x2={oX + motherW}
          y2={oY + motherH + 30}
          label={`卡入深 ${Math.round(tl)}`}
          side="bottom"
        />

        {/* 剖面 A-A */}
        <SectionMark x={oX + motherW / 2 - 14} y={oY - 22} label="A" direction="right" />
        <SectionMark x={oX + motherW / 2 + 14} y={oY - 22} label="A" direction="left" />

        {/* 木紋 */}
        <GrainArrow x={oX + motherW + 50 + oX} y={oY + motherH + 24} length={Math.min(60, PX(cw) * 0.5)} angle={0} />
      </g>
    );
  })();

  // ===== 側視圖（右上）：剖面 + 「無肩 vs 有肩」對比 =====
  const side = (() => {
    const innerW = (W - 10) / 2;
    const innerH = (H - 60 - 10) / 2;
    const pad = 26;
    const usableW = innerW - pad * 2;
    const usableH = innerH - pad * 2 - 20;

    // 兩個並排的小圖：左 = 無肩（stub），右 = 有肩對比示意
    const eachW = usableW / 2 - 10;
    const sX = eachW / Math.max(1, tl + cw * 0.6);
    const sY = (usableH - 40) / Math.max(1, ct + 40);
    const s = Math.min(sX, sY) * 0.7;
    const PX = (mm: number) => mm * s;

    const drawDiagram = (oX: number, oY: number, hasShoulder: boolean, label: string, slug: string) => {
      const motherW = PX(mt);
      const apronLen = PX(cw * 0.6);
      const tenonLen = PX(tl);
      const tenonH = hasShoulder ? PX(ct * 0.6) : PX(ct);
      const apronH = PX(ct);
      const hatchId = `hatch-stub-${slug}`;
      return (
        <g key={slug}>
          <defs>
            <Hatching id={hatchId} color={COLOR.SECTION_HATCH} />
          </defs>
          {/* 母件 */}
          <rect x={oX} y={oY} width={motherW} height={apronH * 2} fill={`url(#${hatchId})`} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
          <rect x={oX} y={oY} width={motherW} height={apronH * 2} fill="none" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
          {/* 榫眼 */}
          <rect x={oX + motherW - tenonLen} y={oY + apronH - tenonH / 2} width={tenonLen} height={tenonH} fill="white" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
          {/* 公件主體 */}
          <rect x={oX + motherW} y={oY + apronH - apronH / 2} width={apronLen} height={apronH} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
          {/* 榫頭（卡入榫眼） */}
          <rect x={oX + motherW - tenonLen} y={oY + apronH - tenonH / 2} width={tenonLen} height={tenonH} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
          {/* 標籤 */}
          <text x={oX + motherW / 2 + apronLen / 2} y={oY - 6} fontSize={FONT.LABEL} fontWeight="bold" textAnchor="middle" fill={hasShoulder ? COLOR.OUTLINE : COLOR.SECTION_HATCH}>
            {label}
          </text>
          <text x={oX + motherW / 2 + apronLen / 2} y={oY + apronH * 2 + 14} fontSize={FONT.CALLOUT} textAnchor="middle" fill="#666">
            {hasShoulder ? "有肩：榫頭縮小、肩面承力" : "無肩：整支端面 = 榫"}
          </text>
        </g>
      );
    };

    return (
      <g>
        <text x={pad} y={14} fontSize={FONT.LABEL} fontWeight="bold" fill={COLOR.OUTLINE}>側視圖（剖面 A-A，並排對比「無肩 vs 有肩」）</text>
        {drawDiagram(pad + 6, pad + 38, false, "無肩 stub", "noshoulder")}
        {drawDiagram(pad + 6 + eachW + 20, pad + 38, true, "有肩參考", "withshoulder")}
        <WarningCallout x={pad} y={innerH - 60} text={`卡入深 <= min(母厚-3, 板厚/2) = ${Math.round(tl)} mm`} severity="warn" />
      </g>
    );
  })();

  // ===== 俯視圖（左下）：上視切面 — 母件 + 牙條卡入位置 =====
  const top = (() => {
    const innerW = (W - 10) / 2;
    const innerH = (H - 60 - 10) / 2;
    const pad = 26;
    const usableW = innerW - pad * 2;
    const usableH = innerH - pad * 2 - 30;

    const sX = usableW / Math.max(1, mt + cw + 30);
    const sY = usableH / Math.max(1, Math.max(mt, ct) + 60);
    const s = Math.min(sX, sY) * 0.9;
    const PX = (mm: number) => mm * s;

    const oX = pad + 10;
    const oY = pad + 30;
    const legSide = PX(mt);
    const apronLen = PX(cw);
    const tenonLen = PX(tl);
    const tenonT = PX(ct);

    const cx = oX + legSide / 2;
    const cy = oY + legSide / 2;

    return (
      <g>
        <text x={pad} y={14} fontSize={FONT.LABEL} fontWeight="bold" fill={COLOR.OUTLINE}>俯視圖（上視切面）</text>
        <defs>
          <Hatching id="hatch-stub-top" color={COLOR.SECTION_HATCH} />
        </defs>
        {/* 母件（圓 / 方） */}
        {isRound ? (
          <circle cx={cx} cy={cy} r={legSide / 2} fill="url(#hatch-stub-top)" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        ) : (
          <rect x={oX} y={oY} width={legSide} height={legSide} fill="url(#hatch-stub-top)" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        )}
        {/* 榫眼開口（隱藏邊） */}
        <HiddenEdge
          d={`M ${oX + legSide - tenonLen} ${cy - tenonT / 2} h ${tenonLen} v ${tenonT} h ${-tenonLen} z`}
        />
        {/* 牙條本體 + 榫頭（連續一段） */}
        <rect
          x={oX + legSide - tenonLen}
          y={cy - tenonT / 2}
          width={tenonLen + apronLen}
          height={tenonT}
          fill={COLOR.TENON}
          stroke={COLOR.OUTLINE}
          strokeWidth={STROKE.OUTLINE}
        />
        {/* 中心線（穿過母件） */}
        <CenterLine x1={oX - 8} y1={cy} x2={oX + legSide + apronLen + 8} y2={cy} />
        {isRound && <CenterLine x1={cx} y1={oY - 6} x2={cx} y2={oY + legSide + 6} />}

        {/* 標籤 */}
        <text x={cx} y={oY - 6} fontSize={FONT.DIM} textAnchor="middle" fill="#5a3f1e" fontWeight="bold">
          母件（{isRound ? "圓腳" : "方腳"}）
        </text>
        <text
          x={oX + legSide + apronLen / 2}
          y={cy - tenonT / 2 - 6}
          fontSize={FONT.DIM}
          textAnchor="middle"
          fill="#8a6a3a"
          fontWeight="bold"
        >
          整支牙條（無肩）
        </text>

        {/* 尺寸 */}
        <DimLine x1={oX} y1={oY - 22} x2={oX + legSide} y2={oY - 22} label={`${mt}`} side="top" />
        <DimLine x1={oX + legSide - tenonLen} y1={oY + legSide + 10} x2={oX + legSide} y2={oY + legSide + 10} label={`卡入 ${Math.round(tl)}`} side="bottom" />
        <DimLine x1={oX + legSide + apronLen + 10} y1={cy - tenonT / 2} x2={oX + legSide + apronLen + 10} y2={cy + tenonT / 2} label={`板厚 ${ct}`} side="right" />
      </g>
    );
  })();

  // ===== 等角圖（右下）：3D 30° 母件 + 牙條卡入 =====
  const iso = (() => {
    const isoScale = Math.min(1.0, 90 / Math.max(1, mt));
    const drawMt = mt;
    const drawCt = ct;
    const drawCw = cw * 0.6;
    const drawTl = tl;
    const depth = drawCt * 0.4; // 視覺深度

    // 母件方/圓
    const motherIso = isRound ? (
      <g>
        {/* 圓柱：正面圓 + 上方橢圓 + 側方矩形 */}
        <ellipse cx={drawMt / 2} cy={drawMt / 2} rx={drawMt / 2} ry={drawMt / 2} fill={COLOR.MORTISE} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        <ellipse cx={drawMt / 2 - depth / 2} cy={drawMt / 2 - depth / 2} rx={drawMt / 2} ry={drawMt / 2 * 0.3} fill="#a37c40" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
      </g>
    ) : (
      <g>
        <rect x={0} y={0} width={drawMt} height={drawMt} fill={COLOR.MORTISE} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        <polygon points={`${0},${0} ${drawMt},${0} ${drawMt - depth},${-depth} ${-depth},${-depth}`} fill="#a37c40" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        <polygon points={`${drawMt},${0} ${drawMt - depth},${-depth} ${drawMt - depth},${drawMt - depth} ${drawMt},${drawMt}`} fill="#7c5a2c" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
      </g>
    );

    return (
      <g>
        <text x={20} y={14} fontSize={FONT.LABEL} fontWeight="bold" fill={COLOR.OUTLINE}>等角圖（30° 軸測）</text>
        <text x={20} y={28} fontSize={FONT.CALLOUT} fill="#888">
          {isRound ? "圓腳" : "方腳"}：整支端面卡入榫眼，無肩
        </text>
        <IsometricGroup originX={170} originY={220} scale={isoScale * 1.5} rotation={30}>
          {motherIso}
          {/* 牙條（橫向往右伸出，部分插入母件） */}
          <g transform={`translate(${drawMt - drawTl},${drawMt / 2 - drawCt / 2})`}>
            <rect x={0} y={0} width={drawTl + drawCw} height={drawCt} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
            {/* 上面 */}
            <polygon points={`${0},${0} ${drawTl + drawCw},${0} ${drawTl + drawCw - depth},${-depth} ${-depth},${-depth}`} fill="#f2dba8" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
            {/* 右側面 */}
            <polygon points={`${drawTl + drawCw},${0} ${drawTl + drawCw - depth},${-depth} ${drawTl + drawCw - depth},${drawCt - depth} ${drawTl + drawCw},${drawCt}`} fill="#d6b683" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
          </g>
        </IsometricGroup>
      </g>
    );
  })();

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: "960px" }} className="bg-white">
      <ThreeViewLayout
        width={W}
        height={H - 60}
        front={front}
        side={side}
        top={top}
        iso={iso}
        titleBlock={
          <TitleBlock
            x={0}
            y={0}
            width={W}
            joineryType="stub-joint"
            joineryNameZh={`整支卡榫（housing joint，${isRound ? "圓腳" : "方腳"}）`}
            scale="1:1"
          />
        }
      />
      <ScaleBar x={W - 220} y={H - 80} widthMm={Math.max(40, mt * 0.8)} pxPerMm={Math.min(2, 200 / Math.max(20, mt))} segments={4} label="mm" />
    </svg>
  );
}
/* === END stub-joint-detail === */

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
