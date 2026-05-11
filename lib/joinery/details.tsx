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
  IsoCuboid,
  IsoTenon,
  IsoMortise,
  IsoCylinder,
  IsoExplode,
  ISO,
  ISO_FILL,
  ISO_STROKE,
  ISO_DASH,
  isoProject,
  // Phase 4 unified visual spec (Wave 2a)
  CANVAS,
  QUADRANT,
  unifiedFitScale,
  placeInQuadrant,
  safeDimSide,
  MasterDetailLayout,
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

/* === BEGIN through-tenon-detail (owner: agent-A, group: A) === */
/* ============================================================
 * 通榫 — through-tenon
 *   Example: stool leg passing up through a seat panel.
 *   - Mother (seat) is a horizontal panel, thickness=mt, with a hole.
 *   - Child (leg) is a vertical stick passing through, tenon flush
 *     with mother's top face.
 * ============================================================ */
function LegacyThroughTenonDetail(p: JoineryDetailParams) {
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

/**
 * 通榫 — through-tenon（教科書級三視圖 + 等角圖重繪）
 * Layout: front | side / top | iso + TitleBlock。
 * 圓腳 motherShape="round" → 母件畫圓（俯視）+ 公榫變圓榫（直徑 = min(tw,tt)）。
 * 配色保留 wrd 米黃棕；數字綁 props，不 hardcoded。
 */
function LegacyV2ThroughTenonDetail(p: JoineryDetailParams) {
  const tl = p.tenonLength;
  const tw = p.tenonWidth;
  const tt = p.tenonThickness;
  const mt = p.motherThickness;
  const ct = p.childThickness ?? tt;
  const cw = p.childWidth ?? tw;
  const isRound = p.motherShape === "round";
  // 圓榫直徑（圓腳時）— 取 min(tw, tt) 以確保榫頭塞得進圓孔
  const dRound = Math.min(tw, tt);

  // 三視/iso 各自 quadrant 為 ~440×280 (內部 padding 後)
  // 統一比例：用同一個 pxPerMm 跨四象限，這樣三視圖才能對齊老師圖
  const QUAD_W = 440;
  const QUAD_H = 280;
  const innerPad = 30;
  // 視圖最大尺寸：mother 寬約 cw*4（給左右各 1.5*cw 邊木）；高方向約 mt + ct*4 (柱身)
  const maxMm = Math.max(cw * 4, mt + ct * 5, tl * 8);
  const s = (QUAD_H - innerPad * 2) / maxMm;
  const PX = (mm: number) => mm * s;

  // ---------- 共用幾何 ----------
  // mother 在三視中的繪製尺寸：母件呈水平板，板面長 panelW、板厚 mt
  const panelW = Math.min(cw * 4, (QUAD_W - innerPad * 2) / s);
  // 公件柱身延伸長度（畫到比例好看為止）
  const legBody = Math.max(ct * 3.5, mt * 1.2);

  // ============================ FRONT view ============================
  // 視角：從正面看；母件是橫板，公件柱身朝下穿過
  // 中心：象限中央
  const fCx = QUAD_W / 2;
  const fCy = QUAD_H / 2;
  // 母件矩形（板厚方向 = 垂直）
  const fMx = fCx - PX(panelW) / 2;
  const fMy = fCy - PX(mt) / 2 - PX(legBody) / 4; // 略上推給下方柱身
  const fMw = PX(panelW);
  const fMh = PX(mt);
  // 公件柱（寬 = cw, 從母件頂面以下開始畫往下）
  const fLx = fCx - PX(cw) / 2;
  const fLyTop = fMy; // 榫頭頂端與母件頂面齊（through-tenon 慣例）
  const fLh = PX(mt) + PX(legBody);
  // 榫頭可見範圍 = 整個 mt（front view 看到的是 cw 寬的柱、不是 tw 寬的榫；
  // 榫肩 (cw-tw)/2 在母件底面停住——因為 tenon 寬 = tw < cw）
  // 這裡 front view 公榫的「寬度方向」= tw
  const fTenonX = fCx - PX(tw) / 2;
  const fTenonW = PX(tw);
  // 榫頭剛好卡在母件孔內，front view 的榫頭就是 tw × mt 矩形（卡在 mother 中段）

  const front = (
    <g>
      <rect x={5} y={5} width={QUAD_W - 10} height={QUAD_H - 10} fill="white" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
      <text x={QUAD_W / 2} y={20} fontSize={FONT.LABEL} textAnchor="middle" fontWeight="bold" fill={COLOR.OUTLINE}>正視圖（FRONT）</text>

      {/* 母件水平板（剖開到柱中軸，故板內中段見到榫頭） */}
      <rect x={fMx} y={fMy} width={fMw} height={fMh} fill={COLOR.MORTISE} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
      {/* 母件兩側剖面：紅斜線 hatching（剖到木頭實體部分） */}
      <rect x={fMx} y={fMy} width={fTenonX - fMx} height={fMh} fill="url(#hatch-through-new)" stroke="none" />
      <rect x={fTenonX + fTenonW} y={fMy} width={fMx + fMw - (fTenonX + fTenonW)} height={fMh} fill="url(#hatch-through-new)" stroke="none" />
      {/* 母件孔的兩條垂直邊（front view 見的是孔的寬 = tw） */}
      <line x1={fTenonX} y1={fMy} x2={fTenonX} y2={fMy + fMh} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
      <line x1={fTenonX + fTenonW} y1={fMy} x2={fTenonX + fTenonW} y2={fMy + fMh} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
      {/* 柱身（榫頭以下的 cw 寬主體） */}
      <rect x={fLx} y={fMy + fMh} width={PX(cw)} height={PX(legBody)} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
      {/* 榫頭（卡在母件孔中，凸出母件頂面 1mm — 老師慣例） */}
      <rect x={fTenonX} y={fMy - PX(1)} width={fTenonW} height={fMh + PX(1)} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
      {/* 楔片（兩道虛線鋸縫 + 兩個小三角） */}
      {(() => {
        const w1 = fTenonX + fTenonW * 0.28;
        const w2 = fTenonX + fTenonW * 0.72;
        const top = fMy - PX(1);
        const kerfBot = top + fMh * 0.6;
        const wedgeBase = fTenonW * 0.12;
        const wedgeH = 8;
        return (
          <g>
            <HiddenEdge x1={w1} y1={top} x2={w1} y2={kerfBot} />
            <HiddenEdge x1={w2} y1={top} x2={w2} y2={kerfBot} />
            <polygon points={`${w1 - wedgeBase},${top - wedgeH} ${w1 + wedgeBase},${top - wedgeH} ${w1},${top}`} fill="#a85" stroke={COLOR.OUTLINE} strokeWidth={0.5} />
            <polygon points={`${w2 - wedgeBase},${top - wedgeH} ${w2 + wedgeBase},${top - wedgeH} ${w2},${top}`} fill="#a85" stroke={COLOR.OUTLINE} strokeWidth={0.5} />
          </g>
        );
      })()}

      {/* 中心線（母件水平中軸 + 公件垂直中軸） */}
      <CenterLine x1={fMx - 6} y1={fCy - PX(legBody) / 4} x2={fMx + fMw + 6} y2={fCy - PX(legBody) / 4} />
      <CenterLine x1={fCx} y1={fMy - 18} x2={fCx} y2={fMy + fMh + PX(legBody) + 6} />

      {/* 剖面標記 A-A（沿水平母件方向切） */}
      <SectionMark x={fMx - 14} y={fCy - PX(legBody) / 4} label="A" direction="right" />
      <SectionMark x={fMx + fMw + 14} y={fCy - PX(legBody) / 4} label="A" direction="left" />

      {/* 尺寸鏈 */}
      <DimLine x1={fTenonX} y1={fMy - 28} x2={fTenonX + fTenonW} y2={fMy - 28} label={`${tw}`} side="top" />
      <DimLine x1={fLx} y1={fMy + fMh + PX(legBody) + 18} x2={fLx + PX(cw)} y2={fMy + fMh + PX(legBody) + 18} label={`${cw}`} side="bottom" />
      <DimLine x1={fMx + fMw + 14} y1={fMy} x2={fMx + fMw + 14} y2={fMy + fMh} label={`${mt}`} side="right" />

      {/* 木紋方向：母件水平、公件垂直 */}
      <GrainArrow x={fMx + 8} y={fMy + fMh / 2 - 4} length={Math.min(60, fMw - 16)} angle={0} />
      <GrainArrow x={fLx - 14} y={fMy + fMh + 8} length={Math.min(50, PX(legBody) - 16)} angle={90} />

      {/* 工法警示 */}
      <WarningCallout x={5} y={QUAD_H - 18} text={`貫穿端應微凸 1mm 後修平；楔片厚 ≈ ${Math.round(tw * 0.12)}mm`} />
    </g>
  );

  // ============================ SIDE view ============================
  // 視角：從側面看；公件「厚度方向」= ct（窄），可見：肩寬 (cw-tw)/2 在 front 看不到，這個視角看見的是 ct
  const sCx = QUAD_W / 2;
  const sCy = QUAD_H / 2;
  const sMx = sCx - PX(panelW) / 2;
  const sMy = sCy - PX(mt) / 2 - PX(legBody) / 4;
  // 公件側視「寬度」= ct
  const sLx = sCx - PX(ct) / 2;
  // 榫頭側視寬度 = tt
  const sTenonX = sCx - PX(tt) / 2;
  const sTenonW = PX(tt);

  const side = (
    <g>
      <rect x={5} y={5} width={QUAD_W - 10} height={QUAD_H - 10} fill="white" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
      <text x={QUAD_W / 2} y={20} fontSize={FONT.LABEL} textAnchor="middle" fontWeight="bold" fill={COLOR.OUTLINE}>側視圖（SIDE）</text>

      <rect x={sMx} y={sMy} width={PX(panelW)} height={PX(mt)} fill={COLOR.MORTISE} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
      <line x1={sTenonX} y1={sMy} x2={sTenonX} y2={sMy + PX(mt)} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
      <line x1={sTenonX + sTenonW} y1={sMy} x2={sTenonX + sTenonW} y2={sMy + PX(mt)} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
      <rect x={sLx} y={sMy + PX(mt)} width={PX(ct)} height={PX(legBody)} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
      <rect x={sTenonX} y={sMy - PX(1)} width={sTenonW} height={PX(mt) + PX(1)} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />

      {/* 中心線 */}
      <CenterLine x1={sMx - 6} y1={sCy - PX(legBody) / 4} x2={sMx + PX(panelW) + 6} y2={sCy - PX(legBody) / 4} />
      <CenterLine x1={sCx} y1={sMy - 18} x2={sCx} y2={sMy + PX(mt) + PX(legBody) + 6} />

      {/* 尺寸：榫厚 tt + 柱厚 ct + 母件厚 mt */}
      <DimLine x1={sTenonX} y1={sMy - 28} x2={sTenonX + sTenonW} y2={sMy - 28} label={`${tt}`} side="top" />
      <DimLine x1={sLx} y1={sMy + PX(mt) + PX(legBody) + 18} x2={sLx + PX(ct) } y2={sMy + PX(mt) + PX(legBody) + 18} label={`${ct}`} side="bottom" />
      <DimLine x1={sMx + PX(panelW) + 14} y1={sMy} x2={sMx + PX(panelW) + 14} y2={sMy + PX(mt)} label={`${mt}`} side="right" />

      <GrainArrow x={sMx + 8} y={sMy + PX(mt) / 2 - 4} length={Math.min(60, PX(panelW) - 16)} angle={0} />
      <GrainArrow x={sLx - 14} y={sMy + PX(mt) + 8} length={Math.min(50, PX(legBody) - 16)} angle={90} />
    </g>
  );

  // ============================ TOP view ============================
  // 視角：從上方看；母件板面 panelW × ?，圓腳時母件畫圓
  const tCx = QUAD_W / 2;
  const tCy = QUAD_H / 2;
  // top view 母件「縱深」呈現：取 cw*2 作為視覺 panel depth
  const panelD = Math.min(cw * 2.2, (QUAD_H - innerPad * 2 - 60) / s);

  const top = (
    <g>
      <rect x={5} y={5} width={QUAD_W - 10} height={QUAD_H - 10} fill="white" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
      <text x={QUAD_W / 2} y={20} fontSize={FONT.LABEL} textAnchor="middle" fontWeight="bold" fill={COLOR.OUTLINE}>俯視圖（TOP）</text>

      {(() => {
        if (isRound) {
          // 圓腳：母件畫圓 + 圓榫畫圓（同心，dRound 直徑）
          const rOuter = PX(cw) / 2; // 圓腳半徑取 cw/2
          const rTenon = PX(dRound) / 2;
          return (
            <g>
              <circle cx={tCx} cy={tCy} r={rOuter} fill={COLOR.MORTISE} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
              <circle cx={tCx} cy={tCy} r={rTenon} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
              {/* 楔縫俯視（兩條垂直線過榫頭直徑） */}
              <line x1={tCx - rTenon * 0.55} y1={tCy - rTenon} x2={tCx - rTenon * 0.55} y2={tCy + rTenon} stroke={COLOR.OUTLINE} strokeWidth={STROKE.HIDDEN} />
              <line x1={tCx + rTenon * 0.55} y1={tCy - rTenon} x2={tCx + rTenon * 0.55} y2={tCy + rTenon} stroke={COLOR.OUTLINE} strokeWidth={STROKE.HIDDEN} />
              {/* 中心十字 */}
              <CenterLine x1={tCx - rOuter - 12} y1={tCy} x2={tCx + rOuter + 12} y2={tCy} />
              <CenterLine x1={tCx} y1={tCy - rOuter - 12} x2={tCx} y2={tCy + rOuter + 12} />
              <DimLine x1={tCx - rOuter} y1={tCy + rOuter + 16} x2={tCx + rOuter} y2={tCy + rOuter + 16} label={`Ø${cw}`} side="bottom" />
              <DimLine x1={tCx - rTenon} y1={tCy - rOuter - 14} x2={tCx + rTenon} y2={tCy - rOuter - 14} label={`Ø${dRound}`} side="top" />
            </g>
          );
        }
        // 方形母件
        const mx = tCx - PX(panelW) / 2;
        const my = tCy - PX(panelD) / 2;
        // 公件柱端面（top view 看到 cw × ct 矩形）
        const lx = tCx - PX(cw) / 2;
        const ly = tCy - PX(ct) / 2;
        // 榫頭俯視 = tw × tt（柱端面內居中）
        const ttx = tCx - PX(tw) / 2;
        const tty = tCy - PX(tt) / 2;
        return (
          <g>
            {/* 母件板（俯視看到大矩形） */}
            <rect x={mx} y={my} width={PX(panelW)} height={PX(panelD)} fill={COLOR.MORTISE} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
            {/* 柱端面（凸出於板面上方，外緣可見） */}
            <rect x={lx} y={ly} width={PX(cw)} height={PX(ct)} fill="none" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} strokeDasharray={DASH.HIDDEN} />
            {/* 榫頭端面（俯視 = tw × tt 實線，凸出板面） */}
            <rect x={ttx} y={tty} width={PX(tw)} height={PX(tt)} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
            {/* 楔縫俯視（兩條過榫頭的線） */}
            <line x1={ttx + PX(tw) * 0.28} y1={tty} x2={ttx + PX(tw) * 0.28} y2={tty + PX(tt)} stroke={COLOR.OUTLINE} strokeWidth={STROKE.HIDDEN} />
            <line x1={ttx + PX(tw) * 0.72} y1={tty} x2={ttx + PX(tw) * 0.72} y2={tty + PX(tt)} stroke={COLOR.OUTLINE} strokeWidth={STROKE.HIDDEN} />
            {/* 中心十字 */}
            <CenterLine x1={mx - 6} y1={tCy} x2={mx + PX(panelW) + 6} y2={tCy} />
            <CenterLine x1={tCx} y1={my - 6} x2={tCx} y2={my + PX(panelD) + 6} />
            {/* 尺寸 */}
            <DimLine x1={ttx} y1={my - 14} x2={ttx + PX(tw)} y2={my - 14} label={`${tw}`} side="top" />
            <DimLine x1={mx + PX(panelW) + 12} y1={tty} x2={mx + PX(panelW) + 12} y2={tty + PX(tt)} label={`${tt}`} side="right" />
            <DimLine x1={mx} y1={my + PX(panelD) + 18} x2={mx + PX(panelW)} y2={my + PX(panelD) + 18} label={`${Math.round(panelW)}`} side="bottom" />
          </g>
        );
      })()}
    </g>
  );

  // ============================ ISO view ============================
  // Phase 3 (2026-05-09)：cabinet projection 用 helper 6 件套
  // 母件（板）= IsoCuboid + IsoMortise（through=true）；公件（柱）= IsoCuboid + IsoTenon
  // 用 IsoExplode 把公件向下拉開，加箭頭組裝向母件穿孔
  const iso = (() => {
    const isoS = s * 0.55;
    // 母件（板/枋）模型尺寸 (mm)：寬=panelW*0.55、厚=mt、深=panelW*0.45
    const motherW = panelW * 0.55;
    const motherH = mt;
    const motherD = panelW * 0.45;
    // 公件（柱）模型尺寸 (mm)：寬=cw、高=legBody、深=ct
    const childW = cw;
    const childH = legBody;
    const childD = ct;
    // V3 fix D3：spec F.1 老師慣例「柱左下 + 枋右上」（沿榫長方向分開）
    // 母件（枋/板）→ 右上象限；公件（柱）→ 左下象限
    const explodeGap = 80;
    // 公件（柱）→ 左下：x 偏左、y 偏下
    const oxC = QUAD_W / 2 - (childW * isoS) / 2 - 60;
    const oyC = QUAD_H / 2 + 20;
    // 母件（枋/板）→ 右上：x 偏右、y 偏上
    const oxM = QUAD_W / 2 - (motherW * isoS) / 2 + 60;
    const oyM = oyC - (motherH * isoS) - explodeGap;
    return (
      <g>
        <rect x={5} y={5} width={QUAD_W - 10} height={QUAD_H - 10} fill="white" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        <text x={QUAD_W / 2} y={20} fontSize={FONT.LABEL} textAnchor="middle" fontWeight="bold" fill={COLOR.OUTLINE}>等角圖（ISO 30° 拆解）</text>
        {/* 母件（板） — 用 IsoCuboid 強制 3 面 + 後虛線 */}
        <g transform={`translate(${oxM} ${oyM}) scale(${isoS})`}>
          <IsoCuboid
            x={0}
            y={0}
            z={0}
            w={motherW}
            h={motherH}
            d={motherD}
            fillFront={ISO_FILL.MORTISE_FRONT}
            fillTop={ISO_FILL.MORTISE_TOP}
            fillSide={ISO_FILL.MORTISE_SIDE}
            strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / isoS}
          />
          {/* 通榫 — 從頂面挖洞穿到底，看到內壁 + 背面虛線開口 */}
          <IsoMortise
            faceX={motherW / 2}
            faceY={0}
            faceZ={motherD / 2}
            width={tw}
            height={tt}
            depth={mt}
            faceNormal="+y"
            through={true}
            stroke={COLOR.OUTLINE}
            strokeWidth={ISO_STROKE.EDGE_INTERIOR / isoS}
          />
        </g>
        {/* 公件（柱） — IsoCuboid 主體 + IsoTenon 從頂面凸出 */}
        <g transform={`translate(${oxC} ${oyC}) scale(${isoS})`}>
          <IsoCuboid
            x={0}
            y={0}
            z={0}
            w={childW}
            h={childH}
            d={childD}
            fillFront={ISO_FILL.TENON_FRONT}
            fillTop={ISO_FILL.TENON_TOP}
            fillSide={ISO_FILL.TENON_SIDE}
            strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / isoS}
          />
          {/* 榫頭從柱頂面（y=0）向上凸出 tl */}
          {!isRound ? (
            <IsoTenon
              baseX={childW / 2}
              baseY={0}
              baseZ={childD / 2}
              width={tw}
              thickness={tt}
              length={tl}
              direction="-y"
              fillFront={ISO_FILL.TENON_FRONT}
              fillTop={ISO_FILL.TENON_TOP}
              fillSide={ISO_FILL.TENON_SIDE}
              strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / isoS}
              embeddedLength={mt}
            />
          ) : (
            <IsoCylinder
              x={childW / 2}
              y={0}
              z={childD / 2}
              radius={dRound / 2}
              height={tl}
              axis="y"
              fillCap={ISO_FILL.TENON_FRONT}
              fillSide={ISO_FILL.TENON_SIDE}
              strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / isoS}
            />
          )}
        </g>
        {/* 拆解箭頭：母件孔（右上）→ 公件榫頭頂端（左下），含三角箭頭 */}
        {(() => {
          const fromX = oxM + (motherW / 2) * isoS + (motherD / 2) * isoS * ISO.COS30 * ISO.DEPTH_SCALE;
          const fromY = oyM + motherH * isoS + 4;
          const toX = oxC + (childW / 2) * isoS + (childD / 2) * isoS * ISO.COS30 * ISO.DEPTH_SCALE;
          const toY = oyC - tl * isoS - 2;
          const ang = Math.atan2(toY - fromY, toX - fromX);
          const ah = 6;
          const a1x = toX - ah * Math.cos(ang - Math.PI / 6);
          const a1y = toY - ah * Math.sin(ang - Math.PI / 6);
          const a2x = toX - ah * Math.cos(ang + Math.PI / 6);
          const a2y = toY - ah * Math.sin(ang + Math.PI / 6);
          return (
            <g stroke={COLOR.DIM} fill={COLOR.DIM}>
              <line x1={fromX} y1={fromY} x2={toX} y2={toY} strokeWidth={0.9} strokeDasharray="4 3" />
              <polygon points={`${toX},${toY} ${a1x},${a1y} ${a2x},${a2y}`} />
            </g>
          );
        })()}
        <text x={oxM - 6} y={oyM - 4} fontSize={FONT.CALLOUT} fill={COLOR.OUTLINE} textAnchor="start">母件（枋/板）</text>
        <text x={oxC - 6} y={oyC - 4} fontSize={FONT.CALLOUT} fill={COLOR.OUTLINE} textAnchor="start">公件（柱）榫 {tw}×{tt}×{tl}</text>
      </g>
    );
  })();

  return (
    <svg width={960} height={680} viewBox="0 0 960 680" className="bg-white">
      <defs>
        <Hatching id="hatch-through-new" color="#7a5a2c" />
      </defs>
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
            joineryType="through-tenon"
            joineryNameZh={isRound ? "通榫（圓榫變體）" : "通榫"}
            scale="1:1"
            drawnBy="wrd-auto"
            drawingNumber={`TT-${tw}x${tt}x${tl}`}
          />
        }
      />
    </svg>
  );
}
/* === END through-tenon-detail === */

/* === BEGIN blind-tenon-detail (owner: agent-A, group: A) === */
/* ============================================================
 * 半榫 / 盲榫 — blind tenon
 *   Example: apron tenon into leg's side face.
 *   - Mother (leg) is a square cross-section, blind hole in side.
 *   - Child (apron) comes in horizontally with tenon on end.
 * ============================================================ */
function LegacyBlindTenonDetail(p: JoineryDetailParams) {
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

/**
 * 半隱榫（盲榫）— blind-tenon（教科書級三視圖 + 等角圖重繪）
 * 重點：tl 必 < mt（榫長不可超母厚）；本函式渲染前 clamp 並 WarningCallout。
 * 母件內部用 HiddenEdge 虛線示意未貫穿的榫眼底。
 */
function LegacyV2BlindTenonDetail(p: JoineryDetailParams) {
  const tl = p.tenonLength;
  const tw = p.tenonWidth;
  const tt = p.tenonThickness;
  const mt = p.motherThickness;
  const ct = p.childThickness ?? tt;
  const cw = p.childWidth ?? tw;
  // 安全 clamp：榫長必須 ≤ 母厚 - 3mm（留底厚 ≥ 3mm 防穿透）
  const safeTl = Math.min(tl, Math.max(3, mt - 3));
  const wasClamped = safeTl !== tl;
  const baseRest = mt - safeTl; // 留底厚
  const isRound = p.motherShape === "round";

  const QUAD_W = 440;
  const QUAD_H = 280;
  const innerPad = 30;
  // mt 是「母件厚度」(orthogonal to apron)；母件側視就是 mt × ?；
  // 公件牙板長度（畫到視覺好看）
  const apronLen = Math.max(cw * 2.5, mt * 2);
  const maxMm = Math.max(mt * 1.6 + apronLen, cw * 3, tw * 3);
  const s = (QUAD_W - innerPad * 2) / maxMm;
  const PX = (mm: number) => mm * s;

  // ============================ FRONT view ============================
  // 視角：從正面看；母件（腳）為垂直柱，公件（牙板）從右側水平接入
  // mother 顯示為 mt 寬的垂直柱，cw 高（顯示柱身一段）
  const fLegW = PX(mt);
  const fLegH = Math.min(PX(cw * 3.5), QUAD_H - innerPad * 2);
  const fLegX = innerPad + 20;
  const fLegY = (QUAD_H - fLegH) / 2;
  // 牙板從右側接入，水平延伸
  const fApronY = QUAD_H / 2 - PX(cw) / 2;
  const fApronH = PX(cw);
  const fApronX0 = fLegX + fLegW; // 牙板肩起點（緊貼柱右面）
  const fApronW = Math.min(PX(apronLen), QUAD_W - innerPad - fApronX0 - 10);
  // 榫頭埋進母件 safeTl 深；front view 看到的「榫頭寬度」= tw（沿柱垂直方向）
  const fTenonY = QUAD_H / 2 - PX(tw) / 2;
  const fTenonH = PX(tw);
  const fTenonW = PX(safeTl);
  const fTenonX = fLegX + fLegW - fTenonW;

  // BOLD hidden-line styling — 母件深色填充上 COLOR.HIDDEN 太淺看不見
  // 改用紅色（DIM_TICK）+ 加粗 1.6px + 較長 dash，確保在深棕母件上一眼可見
  const HIDDEN_BOLD_COLOR = COLOR.DIM_TICK; // 醒目紅
  const HIDDEN_BOLD_STROKE = 1.6;
  const HIDDEN_BOLD_DASH = "5 3";

  const front = (
    <g>
      <rect x={5} y={5} width={QUAD_W - 10} height={QUAD_H - 10} fill="white" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
      <text x={QUAD_W / 2} y={20} fontSize={FONT.LABEL} textAnchor="middle" fontWeight="bold" fill={COLOR.OUTLINE}>正視圖（FRONT）</text>

      {/* 母件柱（外輪廓實線） */}
      <rect x={fLegX} y={fLegY} width={fLegW} height={fLegH} fill={COLOR.MORTISE} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
      {/* 母件內部榫眼 + 嵌入的公件榫頭 — 完整 4 邊紅虛線矩形（醒目） */}
      <rect
        x={fTenonX}
        y={fTenonY}
        width={fTenonW}
        height={fTenonH}
        fill="none"
        stroke={HIDDEN_BOLD_COLOR}
        strokeWidth={HIDDEN_BOLD_STROKE}
        strokeDasharray={HIDDEN_BOLD_DASH}
      />
      {/* 牙板 body（從柱右側水平延伸） */}
      <rect x={fApronX0} y={fApronY} width={fApronW} height={fApronH} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
      {/* 肩線 */}
      <line x1={fApronX0} y1={fApronY} x2={fApronX0} y2={fApronY + fApronH} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
      {/* 牙板內部：公件榫頭根部延伸（藏在牙板下，shoulders 之間） — 兩條紅虛線水平 */}
      {/* 從肩線延伸進牙板一小段，示意榫頭厚度 tw 的兩個邊界（牙板較寬，shoulder 包夾榫頭） */}
      {fApronH > fTenonH + 4 && (
        <>
          <line
            x1={fApronX0}
            y1={fTenonY}
            x2={fApronX0 + Math.min(fApronW * 0.4, PX(safeTl) * 1.2)}
            y2={fTenonY}
            stroke={HIDDEN_BOLD_COLOR}
            strokeWidth={HIDDEN_BOLD_STROKE}
            strokeDasharray={HIDDEN_BOLD_DASH}
          />
          <line
            x1={fApronX0}
            y1={fTenonY + fTenonH}
            x2={fApronX0 + Math.min(fApronW * 0.4, PX(safeTl) * 1.2)}
            y2={fTenonY + fTenonH}
            stroke={HIDDEN_BOLD_COLOR}
            strokeWidth={HIDDEN_BOLD_STROKE}
            strokeDasharray={HIDDEN_BOLD_DASH}
          />
        </>
      )}

      {/* 中心線 */}
      <CenterLine x1={fLegX - 10} y1={QUAD_H / 2} x2={fLegX + fLegW + fApronW + 10} y2={QUAD_H / 2} />
      <CenterLine x1={fLegX + fLegW / 2} y1={fLegY - 10} x2={fLegX + fLegW / 2} y2={fLegY + fLegH + 10} />

      {/* 剖面標記 A-A（沿水平軸，過榫頭中心） */}
      <SectionMark x={fLegX - 14} y={QUAD_H / 2} label="A" direction="right" />
      <SectionMark x={fApronX0 + fApronW + 14} y={QUAD_H / 2} label="A" direction="left" />

      {/* 榫眼/榫頭文字標註（指向虛線矩形） */}
      <text x={fTenonX + fTenonW / 2} y={fTenonY - 4} fontSize={FONT.CALLOUT} textAnchor="middle" fill={HIDDEN_BOLD_COLOR} fontWeight="bold">
        榫眼/榫頭（隱藏）
      </text>

      {/* 尺寸：榫眼長 tw（沿柱垂直），榫眼深 safeTl，留底厚 baseRest，母件厚 mt */}
      <DimLine x1={fLegX - 14} y1={fTenonY} x2={fLegX - 14} y2={fTenonY + fTenonH} label={`${tw}`} side="left" />
      <DimLine x1={fTenonX} y1={fLegY - 14} x2={fLegX + fLegW} y2={fLegY - 14} label={`${safeTl}`} side="top" />
      <DimLine x1={fLegX} y1={fLegY + fLegH + 14} x2={fLegX + fLegW} y2={fLegY + fLegH + 14} label={`${mt}`} side="bottom" />
      <DimLine x1={fLegX} y1={fLegY + fLegH + 30} x2={fTenonX} y2={fLegY + fLegH + 30} label={`${Math.round(baseRest)}`} side="bottom" />

      {/* 木紋方向 */}
      <GrainArrow x={fLegX + fLegW / 2 - 10} y={fLegY + 8} length={Math.min(60, fLegH - 16)} angle={90} />
      <GrainArrow x={fApronX0 + 8} y={fApronY - 10} length={Math.min(60, fApronW - 16)} angle={0} />

      {/* 工法警示 */}
      {wasClamped ? (
        <WarningCallout x={5} y={QUAD_H - 18} text={`榫長需 ≤ 母厚 - 3mm（已自動 clamp ${tl}→${safeTl}）`} />
      ) : (
        <WarningCallout x={5} y={QUAD_H - 18} text={`白膠須塗滿榫眼底面；留底厚 ≈ ${Math.round(baseRest)}mm`} />
      )}
    </g>
  );

  // ============================ SIDE view ============================
  // 視角：從側面看（沿牙板長軸方向看回去）；可見母件柱的另一面寬度 = mt（同正方腳時），與牙板厚度 ct
  // 此視角看到的是榫眼開口的「短邊」 = tt（沿柱寬橫向）× tw（沿柱高縱向）
  const sLegW = PX(mt);
  const sLegH = Math.min(PX(cw * 3.5), QUAD_H - innerPad * 2);
  const sLegX = (QUAD_W - sLegW) / 2;
  const sLegY = (QUAD_H - sLegH) / 2;
  const sApronY = QUAD_H / 2 - PX(ct) / 2;
  const sApronH = PX(ct);
  // 榫眼/榫頭側視藏在柱內：寬 = tt（橫向），高 = tw（縱向，沿柱高方向）
  const sMortW = PX(tt);
  const sMortH = PX(tw);
  const sMortX = QUAD_W / 2 - sMortW / 2;
  const sMortY = QUAD_H / 2 - sMortH / 2;

  const side = (
    <g>
      <rect x={5} y={5} width={QUAD_W - 10} height={QUAD_H - 10} fill="white" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
      <text x={QUAD_W / 2} y={20} fontSize={FONT.LABEL} textAnchor="middle" fontWeight="bold" fill={COLOR.OUTLINE}>側視圖（SIDE）</text>

      {/* 母件柱 */}
      <rect x={sLegX} y={sLegY} width={sLegW} height={sLegH} fill={COLOR.MORTISE} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />

      {/* 藏在柱內的榫眼/榫頭 — 完整 4 邊紅虛線矩形（tt 寬 × tw 高） */}
      <rect
        x={sMortX}
        y={sMortY}
        width={sMortW}
        height={sMortH}
        fill="none"
        stroke={HIDDEN_BOLD_COLOR}
        strokeWidth={HIDDEN_BOLD_STROKE}
        strokeDasharray={HIDDEN_BOLD_DASH}
      />

      {/* 牙板端面位置示意（ct × cw 端面，藏在柱後方，較淺虛線） */}
      <rect
        x={QUAD_W / 2 - sMortW / 2 - PX(Math.max(0, ct - tt) / 2)}
        y={sApronY}
        width={Math.max(sMortW, PX(ct))}
        height={sApronH}
        fill="none"
        stroke={COLOR.HIDDEN}
        strokeWidth={0.6}
        strokeDasharray="3 2"
      />

      <CenterLine x1={sLegX - 10} y1={QUAD_H / 2} x2={sLegX + sLegW + 10} y2={QUAD_H / 2} />
      <CenterLine x1={sLegX + sLegW / 2} y1={sLegY - 10} x2={sLegX + sLegW / 2} y2={sLegY + sLegH + 10} />

      {/* 榫眼/榫頭文字標註 */}
      <text x={sMortX + sMortW / 2} y={sMortY - 4} fontSize={FONT.CALLOUT} textAnchor="middle" fill={HIDDEN_BOLD_COLOR} fontWeight="bold">
        榫眼/榫頭（隱藏）
      </text>
      {/* 深度提示（側視看不到深度，用文字示意「榫眼往內延伸 safeTl mm」） */}
      <text x={sMortX + sMortW / 2} y={sMortY + sMortH + 14} fontSize={FONT.CALLOUT} textAnchor="middle" fill={HIDDEN_BOLD_COLOR}>
        ⊗ 向內延伸 {safeTl}mm
      </text>

      {/* 尺寸：榫眼厚 tt（橫向）+ 榫眼長 tw（縱向）+ 板厚 ct + 母件寬 mt */}
      <DimLine x1={sMortX} y1={sLegY - 14} x2={sMortX + sMortW} y2={sLegY - 14} label={`${tt}`} side="top" />
      <DimLine x1={sLegX - 14} y1={sMortY} x2={sLegX - 14} y2={sMortY + sMortH} label={`${tw}`} side="left" />
      <DimLine x1={sLegX + sLegW + 14} y1={sApronY} x2={sLegX + sLegW + 14} y2={sApronY + sApronH} label={`${ct}`} side="right" />
      <DimLine x1={sLegX} y1={sLegY + sLegH + 14} x2={sLegX + sLegW} y2={sLegY + sLegH + 14} label={`${mt}`} side="bottom" />

      <GrainArrow x={sLegX + sLegW / 2 - 10} y={sLegY + 8} length={Math.min(60, sLegH - 16)} angle={90} />
    </g>
  );

  // ============================ TOP view ============================
  // 視角：從上方俯瞰（top-down cross-section through the joint）
  // 母件 = mt × mt 方腳（或圓腳）；牙板 = cw × ct；榫頭 = tt × safeTl 矩形 cavity
  const tCx = QUAD_W / 2;
  const tCy = QUAD_H / 2;
  const tLegSide = PX(mt);
  const tLegX = tCx - tLegSide;
  const tLegY = tCy - tLegSide / 2;
  const tApronLen = Math.min(PX(apronLen), QUAD_W - tLegX - tLegSide - innerPad);
  const tApronH = PX(ct);
  const tApronX = tLegX + tLegSide;
  const tApronY = tCy - tApronH / 2;
  // 榫頭埋入母件深 safeTl
  const tTenonW = PX(safeTl);
  const tTenonH = PX(tt);
  const tTenonX = tLegX + tLegSide - tTenonW;
  const tTenonY = tCy - tTenonH / 2;

  const top = (
    <g>
      <rect x={5} y={5} width={QUAD_W - 10} height={QUAD_H - 10} fill="white" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
      <text x={QUAD_W / 2} y={20} fontSize={FONT.LABEL} textAnchor="middle" fontWeight="bold" fill={COLOR.OUTLINE}>俯視圖（TOP，剖面 A-A）</text>

      {(() => {
        if (isRound) {
          const r = tLegSide / 2;
          const cx = tLegX + r;
          const cy = tCy;
          return (
            <g>
              <circle cx={cx} cy={cy} r={r} fill="url(#hatch-blind-new)" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
              {/* 圓榫眼開口（圓形 Forstner 鑽頭打的孔） */}
              <rect x={tTenonX} y={tTenonY} width={tTenonW} height={tTenonH} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
              <rect x={tApronX} y={tApronY} width={tApronLen} height={tApronH} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
              <CenterLine x1={cx - r - 10} y1={cy} x2={tApronX + tApronLen + 10} y2={cy} />
              <CenterLine x1={cx} y1={cy - r - 10} x2={cx} y2={cy + r + 10} />
              <DimLine x1={cx - r} y1={cy - r - 14} x2={cx + r} y2={cy - r - 14} label={`Ø${mt}`} side="top" />
              <DimLine x1={tTenonX} y1={cy + r + 14} x2={cx + r} y2={cy + r + 14} label={`${safeTl}`} side="bottom" />
              <DimLine x1={tApronX + tApronLen + 12} y1={tApronY} x2={tApronX + tApronLen + 12} y2={tApronY + tApronH} label={`${ct}`} side="right" />
            </g>
          );
        }
        // 方形母件 — 用 path 把榫眼挖空 + 用 fill 補榫頭
        const legPath =
          `M${tLegX} ${tLegY} ` +
          `L${tLegX + tLegSide} ${tLegY} ` +
          `L${tLegX + tLegSide} ${tTenonY} ` +
          `L${tTenonX} ${tTenonY} ` +
          `L${tTenonX} ${tTenonY + tTenonH} ` +
          `L${tLegX + tLegSide} ${tTenonY + tTenonH} ` +
          `L${tLegX + tLegSide} ${tLegY + tLegSide} ` +
          `L${tLegX} ${tLegY + tLegSide} Z`;
        return (
          <g>
            {/* 母件（剖面 hatching） */}
            <path d={legPath} fill="url(#hatch-blind-new)" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
            {/* 榫頭（公件填滿榫眼） */}
            <rect x={tTenonX} y={tTenonY} width={tTenonW} height={tTenonH} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
            {/* 牙板 body 從柱右側水平延伸 */}
            <rect x={tApronX} y={tApronY} width={tApronLen} height={tApronH} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
            {/* 公件牙板實際寬度（cw）的隱藏輪廓 — 牙板上下兩側被柱遮住的部分用紅虛線示意 */}
            {cw > ct && (() => {
              const tApronFullH = Math.min(PX(cw), tLegSide); // 牙板實寬投影（限制在柱範圍內）
              const tApronFullY = tCy - tApronFullH / 2;
              return (
                <>
                  {/* 牙板實寬上邊界（在柱頂之下，被柱遮住） */}
                  <line
                    x1={tLegX}
                    y1={tApronFullY}
                    x2={tLegX + tLegSide}
                    y2={tApronFullY}
                    stroke={HIDDEN_BOLD_COLOR}
                    strokeWidth={HIDDEN_BOLD_STROKE * 0.7}
                    strokeDasharray={HIDDEN_BOLD_DASH}
                  />
                  {/* 牙板實寬下邊界 */}
                  <line
                    x1={tLegX}
                    y1={tApronFullY + tApronFullH}
                    x2={tLegX + tLegSide}
                    y2={tApronFullY + tApronFullH}
                    stroke={HIDDEN_BOLD_COLOR}
                    strokeWidth={HIDDEN_BOLD_STROKE * 0.7}
                    strokeDasharray={HIDDEN_BOLD_DASH}
                  />
                </>
              );
            })()}
            {/* 榫眼底部標註（指向榫頭末端 = 榫眼最深處） */}
            <text x={tTenonX - 4} y={tTenonY - 4} fontSize={FONT.CALLOUT} textAnchor="end" fill={HIDDEN_BOLD_COLOR} fontWeight="bold">
              榫眼底
            </text>
            {/* 中心線 */}
            <CenterLine x1={tLegX - 10} y1={tCy} x2={tApronX + tApronLen + 10} y2={tCy} />
            <CenterLine x1={tLegX + tLegSide / 2} y1={tLegY - 10} x2={tLegX + tLegSide / 2} y2={tLegY + tLegSide + 10} />
            {/* 尺寸 */}
            <DimLine x1={tLegX} y1={tLegY - 14} x2={tLegX + tLegSide} y2={tLegY - 14} label={`${mt}`} side="top" />
            <DimLine x1={tTenonX} y1={tLegY + tLegSide + 14} x2={tLegX + tLegSide} y2={tLegY + tLegSide + 14} label={`${safeTl}`} side="bottom" />
            <DimLine x1={tApronX + tApronLen + 12} y1={tApronY} x2={tApronX + tApronLen + 12} y2={tApronY + tApronH} label={`${ct}`} side="right" />
            <DimLine x1={tLegX - 14} y1={tTenonY} x2={tLegX - 14} y2={tTenonY + tTenonH} label={`${tt}`} side="left" />
          </g>
        );
      })()}
    </g>
  );

  // ============================ ISO view ============================
  const iso = (() => {
    // Phase 3 (2026-05-09)：cabinet projection 用 helper 6 件套
    // 公母比例倒置 fix：母件柱寬一定 = mt（粗），公件牙板寬 = cw（細）
    // 盲榫：IsoMortise(through=false) 內壁深色填充 + 4 條深度線
    const isoS = s * 0.5;
    // 母件（柱）模型尺寸：寬=mt、高=cw*2.5、深=mt
    const motherW = mt;
    const motherH = cw * 2.5;
    const motherD = mt;
    const oxM = 50;
    const oyM = 80;
    // 公件（牙板）模型：寬=cw（高度方向）、長=cw*2.0、深=ct
    // F: 強制 childLen 不小於 safeTl*4，防止 coat-rack 等小料 tenon 看不見
    const childLen = Math.max(cw * 2.0, safeTl * 4);
    const childH = cw;
    const childD = ct;
    // 公件 explode 在母件右側（沿 +x 拉開）
    const explodeGap = (motherW + safeTl + 30) * isoS + 20;
    const oxC = oxM + motherW * isoS + explodeGap;
    const oyC = oyM + (motherH - childH) / 2 * isoS;
    return (
      <g>
        <rect x={5} y={5} width={QUAD_W - 10} height={QUAD_H - 10} fill="white" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        <text x={QUAD_W / 2} y={20} fontSize={FONT.LABEL} textAnchor="middle" fontWeight="bold" fill={COLOR.OUTLINE}>等角圖（ISO 30°，盲榫拆解）</text>
        {/* 母件（柱）— 圓 or 方 */}
        <g transform={`translate(${oxM} ${oyM}) scale(${isoS})`}>
          {!isRound ? (
            <IsoCuboid
              x={0}
              y={0}
              z={0}
              w={motherW}
              h={motherH}
              d={motherD}
              fillFront={ISO_FILL.MORTISE_FRONT}
              fillTop={ISO_FILL.MORTISE_TOP}
              fillSide={ISO_FILL.MORTISE_SIDE}
              strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / isoS}
            />
          ) : (
            <IsoCylinder
              x={motherW / 2}
              y={0}
              z={motherW / 2}
              radius={motherW / 2}
              height={motherH}
              axis="y"
              fillSide={ISO_FILL.MORTISE_FRONT}
              fillCap={ISO_FILL.MORTISE_TOP}
              strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / isoS}
            />
          )}
          {/* 盲榫眼（在母件右面 +x） — 內壁深度線（凹陷感） */}
          {/* faceNormal="+x"：width 沿 z 軸（深度=榫厚 tt）、height 沿 y 軸（垂直=榫寬 tw） */}
          <IsoMortise
            faceX={motherW}
            faceY={motherH / 2}
            faceZ={motherD / 2}
            width={tt}
            height={tw}
            depth={safeTl}
            faceNormal="+x"
            through={false}
            stroke={COLOR.OUTLINE}
            strokeWidth={ISO_STROKE.EDGE_INTERIOR / isoS}
          />
          {/* 圓腳：母件呈現為圓柱時，榫眼仍畫在 +x 面上（簡化為平面投影） */}
          {isRound && (
            <text x={motherW + 4} y={-8} fontSize={FONT.CALLOUT} fill={COLOR.DIM_TICK}>
              圓腳柱面挖榫眼（簡化平面顯示）
            </text>
          )}
        </g>
        {/* 公件（牙板）— IsoCuboid + IsoTenon 從左端凸出 */}
        <g transform={`translate(${oxC} ${oyC}) scale(${isoS})`}>
          <IsoCuboid
            x={0}
            y={0}
            z={0}
            w={childLen}
            h={childH}
            d={childD}
            fillFront={ISO_FILL.TENON_FRONT}
            fillTop={ISO_FILL.TENON_TOP}
            fillSide={ISO_FILL.TENON_SIDE}
            strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / isoS}
          />
          {/* 榫頭從牙板左端 (-x) 凸出。direction=-x：width 沿 z（深度=榫厚 tt）、thickness 沿 y（垂直=榫寬 tw） */}
          <IsoTenon
            baseX={0}
            baseY={childH / 2}
            baseZ={childD / 2}
            width={tt}
            thickness={tw}
            length={safeTl}
            direction="-x"
            fillFront={ISO_FILL.TENON_FRONT}
            fillTop={ISO_FILL.TENON_TOP}
            fillSide={ISO_FILL.TENON_SIDE}
            strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / isoS}
            embeddedLength={safeTl}
          />
        </g>
        {/* 拆解箭頭 */}
        <line
          x1={oxC - 4}
          y1={oyC + (childH / 2) * isoS}
          x2={oxM + motherW * isoS + 4}
          y2={oyM + (motherH / 2) * isoS}
          stroke={COLOR.DIM}
          strokeWidth={0.8}
          strokeDasharray="4 3"
        />
        <text x={oxM} y={oyM - 4} fontSize={FONT.CALLOUT} fill={COLOR.OUTLINE}>母件 {isRound ? "（圓腳）" : "（方柱 {mt})"}</text>
        <text x={oxC} y={oyC - 4} fontSize={FONT.CALLOUT} fill={COLOR.OUTLINE}>公件（牙板/橫撐）</text>
        <text x={oxC - 4} y={oyC + (childH + 12) * isoS + 8} fontSize={FONT.CALLOUT} fill={COLOR.OUTLINE}>盲榫 {tw}×{tt}×{safeTl}（榫底留 {Math.max(0, mt - safeTl)}mm）</text>
      </g>
    );
  })();

  return (
    <svg width={960} height={680} viewBox="0 0 960 680" className="bg-white">
      <defs>
        <Hatching id="hatch-blind-new" color="#7a5a2c" />
      </defs>
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
            joineryType="blind-tenon"
            joineryNameZh={isRound ? "盲榫（圓腳變體）" : "半隱榫（盲榫）"}
            scale="1:1"
            drawnBy="wrd-auto"
            drawingNumber={`BT-${tw}x${tt}x${safeTl}`}
          />
        }
      />
    </svg>
  );
}
/* === END blind-tenon-detail === */

/* === BEGIN half-lap-detail (owner: agent-B, group: B) === */
/* ============================================================
 * 半搭榫 — half-lap (two pieces each cut halfway and lapped)
 * ============================================================ */
function LegacyHalfLapDetail(p: JoineryDetailParams) {
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

/* ----------------------------------------------------------------
 * 半搭榫 教科書級重繪（三視圖 + 等角圖 + 剖面 + 切刀位）
 *   形態自動推：cw≈mt ⇒ 十字搭、相差大 ⇒ T 字搭、邊角 ⇒ L 字搭。
 *   削厚 = ct/2、搭長 = tl，俯視畫切刀位置。
 * ---------------------------------------------------------------- */
function LegacyV2HalfLapDetail(p: JoineryDetailParams) {
  const tl = p.tenonLength;
  const mt = p.motherThickness;
  const ct = p.childThickness ?? mt;
  const cw = p.childWidth ?? mt * 4;

  // 自動推搭接型態
  const ratio = cw / Math.max(1, mt);
  const lapForm: "cross" | "tee" | "ell" =
    ratio < 0.6 ? "ell" : Math.abs(ratio - 1) < 0.35 ? "cross" : "tee";
  const lapFormZh = lapForm === "cross" ? "十字搭" : lapForm === "tee" ? "T 字搭" : "L 字搭";

  // 削厚（每件削一半）
  const cutDepthA = mt / 2;       // A 件被削掉的厚度
  const cutDepthB = ct / 2;       // B 件被削掉的厚度

  // 視圖內部空間（依 ThreeViewLayout：(960-10)/2 = 475 寬，(660-10-50)/2 = 300 高）
  const QW = 475;
  const QH = 300;

  // 用一致 scale：取最大 mm，留 padding
  const maxMm = Math.max(tl * 5, mt * 4, cw + tl * 2);
  const s = fitScale(maxMm, Math.min(QW, QH) - 80);
  const PX = (mm: number) => mm * s;

  // ===== 正視圖 (Front)：A 件水平、B 件交疊 =====
  const frontPieceLen = Math.max(PX(tl) * 4, 200);
  const frontA_x = (QW - frontPieceLen) / 2;
  const frontA_y = QH / 2 - PX(mt) / 2;
  const lapStartX = frontA_x + frontPieceLen - PX(tl); // 搭接區左緣
  const lapEndX = frontA_x + frontPieceLen;
  const front = (
    <g>
      <text x={QW / 2} y={14} fontSize={FONT.LABEL} fontWeight="bold" textAnchor="middle">
        正視圖（{lapFormZh}）
      </text>
      <rect x={4} y={20} width={QW - 8} height={QH - 28} fill="white" stroke={COLOR.OUTLINE} strokeWidth={0.4} />
      {/* A 件本體（被削去上半的搭區） */}
      <path
        d={`M${frontA_x} ${frontA_y} L${lapStartX} ${frontA_y} L${lapStartX} ${frontA_y + cutDepthA * s} L${lapEndX} ${frontA_y + cutDepthA * s} L${lapEndX} ${frontA_y + PX(mt)} L${frontA_x} ${frontA_y + PX(mt)} Z`}
        fill={COLOR.MORTISE}
        stroke={COLOR.OUTLINE}
        strokeWidth={STROKE.OUTLINE}
      />
      {/* A 件未削區段剖面：紅斜線 hatching */}
      <rect
        x={frontA_x}
        y={frontA_y}
        width={lapStartX - frontA_x}
        height={PX(mt)}
        fill="url(#hatch-halflap)"
        stroke="none"
      />
      {/* B 件（同位置疊上：填上半搭區、實邊框＋外凸尾）*/}
      <rect
        x={lapStartX}
        y={frontA_y - PX(mt) + cutDepthA * s}
        width={PX(tl)}
        height={PX(mt) - cutDepthA * s + cutDepthB * s}
        fill={COLOR.TENON}
        stroke={COLOR.OUTLINE}
        strokeWidth={STROKE.OUTLINE}
      />
      {/* 搭接接合線（隱藏邊：B 件下半在 A 件內部） — 紅虛線醒目（A/B 介面被 B 遮住） */}
      <line
        x1={lapStartX}
        y1={frontA_y + cutDepthA * s}
        x2={lapEndX}
        y2={frontA_y + cutDepthA * s}
        stroke={COLOR.DIM_TICK}
        strokeWidth={1.6}
        strokeDasharray="5 3"
        fill="none"
      />
      {/* B 件下緣藏在 A 件內：下緣 y = frontA_y + cutDepthB*s（搭區內被 A 遮的 B 件下緣） */}
      {cutDepthB * s < PX(mt) && (
        <line
          x1={lapStartX}
          y1={frontA_y + cutDepthB * s}
          x2={lapEndX}
          y2={frontA_y + cutDepthB * s}
          stroke={COLOR.DIM_TICK}
          strokeWidth={1.6}
          strokeDasharray="5 3"
          fill="none"
        />
      )}
      {/* 隱藏線標籤 */}
      <text
        x={(lapStartX + lapEndX) / 2}
        y={frontA_y + cutDepthA * s - 4}
        fontSize={FONT.CALLOUT}
        textAnchor="middle"
        fill={COLOR.DIM_TICK}
        fontWeight="bold"
      >
        搭接介面（隱藏）
      </text>
      {/* 中心線：水平軸 */}
      <CenterLine x1={frontA_x - 10} y1={frontA_y + PX(mt) / 2} x2={lapEndX + 10} y2={frontA_y + PX(mt) / 2} />
      {/* 木紋（A 件水平方向） */}
      <GrainArrow x={frontA_x + 6} y={frontA_y - 12} length={Math.min(60, frontPieceLen / 3)} angle={0} />
      {/* 剖面標記 A-A：在搭接中央切一刀 */}
      <SectionMark x={(lapStartX + lapEndX) / 2} y={frontA_y - 16} label="A" direction="down" />
      <SectionMark x={(lapStartX + lapEndX) / 2} y={frontA_y + PX(mt) + 16} label="A" direction="up" />
      {/* 尺寸：搭長 tl */}
      <DimLine
        x1={lapStartX}
        y1={frontA_y + PX(mt) + 22}
        x2={lapEndX}
        y2={frontA_y + PX(mt) + 22}
        label={`搭長 ${tl}`}
        side="bottom"
      />
      {/* 尺寸：板厚 mt */}
      <DimLine
        x1={frontA_x - 14}
        y1={frontA_y}
        x2={frontA_x - 14}
        y2={frontA_y + PX(mt)}
        label={`板厚 ${mt}`}
        side="left"
      />
      {/* 削厚 */}
      <DimLine
        x1={lapEndX + 14}
        y1={frontA_y - PX(mt) + cutDepthA * s}
        x2={lapEndX + 14}
        y2={frontA_y + cutDepthA * s}
        label={`削厚 ${Math.round(cutDepthB)}`}
        side="right"
      />
    </g>
  );

  // ===== 側視圖 (Side)：B 件穿過 A 件（從另一軸看） =====
  // 對 cross：兩件等寬交叉；對 tee/ell：B 接到 A 邊
  const sideA_h = PX(mt);
  const sideB_w = PX(ct);
  const side = (
    <g>
      <text x={QW / 2} y={14} fontSize={FONT.LABEL} fontWeight="bold" textAnchor="middle">
        側視圖（B 件斷面）
      </text>
      <rect x={4} y={20} width={QW - 8} height={QH - 28} fill="white" stroke={COLOR.OUTLINE} strokeWidth={0.4} />
      {(() => {
        const aLen = PX(cw); // A 在側視圖的寬即 child 寬度
        const aX = (QW - aLen) / 2;
        const aY = QH / 2 - sideA_h / 2;
        const bX = aX + aLen / 2 - sideB_w / 2;
        const bTop = aY - PX(mt) * 0.6;
        const bBottom = aY + sideA_h + PX(mt) * 0.6;
        return (
          <>
            {/* A 件斷面（看成一條長矩形） */}
            <rect x={aX} y={aY} width={aLen} height={sideA_h} fill={COLOR.MORTISE} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
            {/* B 件斷面（垂直穿過） */}
            <rect x={bX} y={bTop} width={sideB_w} height={bBottom - bTop} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
            {/* 搭接區：B 件在 A 件內被削去下半（虛線） */}
            <HiddenEdge x1={bX} y1={aY + cutDepthA * s} x2={bX + sideB_w} y2={aY + cutDepthA * s} />
            {/* 中心線：兩軸 */}
            <CenterLine x1={aX - 10} y1={aY + sideA_h / 2} x2={aX + aLen + 10} y2={aY + sideA_h / 2} />
            <CenterLine x1={bX + sideB_w / 2} y1={bTop - 10} x2={bX + sideB_w / 2} y2={bBottom + 10} />
            {/* 木紋（B 件垂直方向） */}
            <GrainArrow x={bX + sideB_w + 8} y={bTop + 4} length={Math.min(60, bBottom - bTop - 8)} angle={90} />
            {/* 尺寸：A 件寬 cw */}
            <DimLine x1={aX} y1={aY + sideA_h + 22} x2={aX + aLen} y2={aY + sideA_h + 22} label={`板寬 ${cw}`} side="bottom" />
            {/* 尺寸：B 件厚 ct */}
            <DimLine x1={bX} y1={bTop - 14} x2={bX + sideB_w} y2={bTop - 14} label={`B 厚 ${ct}`} side="top" />
          </>
        );
      })()}
    </g>
  );

  // ===== 俯視圖 (Top)：A、B 各自（分解）+ 切刀位 =====
  const top = (
    <g>
      <text x={QW / 2} y={14} fontSize={FONT.LABEL} fontWeight="bold" textAnchor="middle">
        俯視圖（分解 + 切刀位）
      </text>
      <rect x={4} y={20} width={QW - 8} height={QH - 28} fill="white" stroke={COLOR.OUTLINE} strokeWidth={0.4} />
      {(() => {
        const tlPx = PX(tl);
        const aWide = PX(cw);
        const aLen = Math.max(PX(tl) * 4, 180);
        const ax = (QW - aLen) / 2;
        const ay = 40;
        // B 件畫在下方
        const bWide = PX(ct);
        const bx = ax + aLen / 2 - bWide / 2;
        const by = ay + aWide + 30;
        return (
          <>
            {/* A 件俯視（被削去搭接區） */}
            <rect x={ax} y={ay} width={aLen} height={aWide} fill={COLOR.MORTISE} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
            {/* 切刀位：A 件搭接窗口（中央方框，依形態） */}
            {(() => {
              const slotW = lapForm === "cross" ? bWide : tlPx;
              const slotH = lapForm === "cross" ? bWide : aWide;
              const slotX = lapForm === "ell" ? ax + aLen - slotW : ax + aLen / 2 - slotW / 2;
              const slotY = lapForm === "cross" || lapForm === "tee" ? ay + aWide / 2 - slotH / 2 : ay;
              return (
                <>
                  <rect x={slotX} y={slotY} width={slotW} height={slotH} fill="white" stroke={COLOR.DIM_TICK} strokeDasharray={DASH.AUX} strokeWidth={0.7} />
                  <text x={slotX + slotW / 2} y={slotY - 4} fontSize={FONT.CALLOUT} fill={COLOR.DIM_TICK} textAnchor="middle">
                    切刀位
                  </text>
                </>
              );
            })()}
            <text x={ax + aLen / 2} y={ay - 6} fontSize={FONT.DIM} textAnchor="middle" fill="#666">A 件</text>
            {/* B 件俯視 — 高度 clamp 防止超出 quadrant */}
            <rect x={bx} y={by} width={bWide} height={Math.min(QH - by - 50, Math.max(PX(tl) * 4, 120))} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
            <text x={bx + bWide / 2} y={by - 6} fontSize={FONT.DIM} textAnchor="middle" fill="#666">B 件</text>
            {/* 中心線 */}
            <CenterLine x1={ax - 10} y1={ay + aWide / 2} x2={ax + aLen + 10} y2={ay + aWide / 2} />
            {/* 尺寸：A 件總長 */}
            <DimLine x1={ax} y1={ay - 18} x2={ax + aLen} y2={ay - 18} label={`A 長 ${cw}`} side="top" />
          </>
        );
      })()}
    </g>
  );

  // ===== 等角圖 =====
  // E: 強制最小 isoScale，nightstand (mt=14, ct=12, tl=7) 等案例 mm 太小時 iso 看不清
  // 核心約束：搭接 iso 場景視覺寬度 ≥ 100px，反推 isoScale = 100 / aTotalLenMm
  const _isoLapLenMm = Math.max(tl, mt * 1.4);
  const _isoTailLenMm = Math.max(mt * 2, _isoLapLenMm * 1.2);
  const _isoTotalLenMm = _isoLapLenMm + _isoTailLenMm;
  const isoScale = Math.max(
    Math.min(2.0, 100 / Math.max(1, _isoTotalLenMm)),
    Math.min(0.9, s * 0.55),
  );
  const iso = (
    <g>
      <text x={QW / 2} y={14} fontSize={FONT.LABEL} fontWeight="bold" textAnchor="middle">
        等角圖
      </text>
      <rect x={4} y={20} width={QW - 8} height={QH - 28} fill="white" stroke={COLOR.OUTLINE} strokeWidth={0.4} />
      {/* 2026-05-09 fix（木頭仁 review）：長軸轉 90° 變上下擺
          做法：iso 內部模型空間維持原樣（避開 IsoCuboid w/h 內部語意不對稱問題），
          外層 wrap rotate(-90, cx, cy)，文字 label 個別 rotate(90) 反轉回正向 */}
      <g transform={`rotate(-90 ${QW / 2} ${QH / 2 + 10})`}>
      <IsometricGroup originX={QW / 2} originY={QH / 2 + 10} scale={isoScale}>
        {(() => {
          // Phase 4 (2026-05-09 V3 fix D1)：兩件各畫「L 形」立體（全厚段 + 半厚搭接段），
          // 並用紅色斜線 hatching 標出「被削掉的一半」+ 文字 label，人類能立刻看出「半搭」
          //
          // 模型空間座標：
          //   x: 沿件 A 長軸（左右）；y: 厚度方向（上=負 y）；z: 深度方向
          //   件 A 水平擺放，搭接區在 x ∈ [-lapHalf, +lapHalf]，y 削上半 → 厚度從 [0, mt] 變 [halfMt, mt]
          //   件 B 旋轉 90° 沿 z 軸俯視（即垂直擺放，搭接區同位置但削下半）
          //   爆炸：B 整體上移 explodeGap
          //   ⟶ 外層 rotate(-90) 把整張圖在螢幕上轉成「長軸上下」
          const halfMt = mt / 2;
          const halfCt = ct / 2;
          const lapLen = Math.max(tl, mt * 1.4);  // 搭接區長度
          const tailLen = Math.max(mt * 2, lapLen * 1.2);  // 搭接外的延伸段
          const aTotalLen = lapLen + tailLen;
          const bTotalLen = lapLen + tailLen;
          const explodeGap = mt * 2.4;
          const aDepth = mt;  // 件 A 深度（z 方向）
          const bDepth = ct;  // 件 B 深度

          // 件 A（米色 / 母件色）：水平擺，左半全厚、右半（搭接區）只有下半厚（上半被削）
          // x 從 -aTotalLen/2 到 +aTotalLen/2
          // tail：x ∈ [-aTotalLen/2, -aTotalLen/2 + tailLen]，全厚 [0, mt]
          // lap： x ∈ [-aTotalLen/2 + tailLen, +aTotalLen/2]，半厚 [halfMt, mt]
          const aTailX = -aTotalLen / 2;
          const aLapX = aTailX + tailLen;
          // 件 B（柱色）：搭在 A 上方（爆炸位移後），方向相同（簡化視覺）
          // tail 全厚 [0, ct]，lap 半厚 [0, halfCt]（保留上半，下半被削）
          const bTailX = -bTotalLen / 2;
          const bLapX = bTailX + tailLen;
          const bYOffset = -explodeGap;

          return (
            <g>
              {/* ==================== 件 A（下件，米色） ==================== */}
              {/* 全厚 tail 段 */}
              <IsoCuboid
                x={aTailX}
                y={0}
                z={-aDepth / 2}
                w={tailLen}
                h={mt}
                d={aDepth}
                fillFront={ISO_FILL.MORTISE_FRONT}
                fillTop={ISO_FILL.MORTISE_TOP}
                fillSide={ISO_FILL.MORTISE_SIDE}
                strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / isoScale}
                showHiddenBackEdges={false}
              />
              {/* 半厚 lap 段（下半保留 → y ∈ [halfMt, mt]） */}
              <IsoCuboid
                x={aLapX}
                y={halfMt}
                z={-aDepth / 2}
                w={lapLen}
                h={halfMt}
                d={aDepth}
                fillFront={ISO_FILL.MORTISE_FRONT}
                fillTop={ISO_FILL.MORTISE_TOP}
                fillSide={ISO_FILL.MORTISE_SIDE}
                strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / isoScale}
                showHiddenBackEdges={false}
              />
              {/* 件 A 被削掉的上半（虛線 ghost + 紅斜線 hatching） */}
              {(() => {
                // ghost 是 cuboid 在 lap 區段、y ∈ [0, halfMt]
                const g0 = isoProject(aLapX, 0, -aDepth / 2);
                const g1 = isoProject(aLapX + lapLen, 0, -aDepth / 2);
                const g2 = isoProject(aLapX + lapLen, halfMt, -aDepth / 2);
                const g3 = isoProject(aLapX, halfMt, -aDepth / 2);
                const g0b = isoProject(aLapX, 0, aDepth / 2);
                const g1b = isoProject(aLapX + lapLen, 0, aDepth / 2);
                const g2b = isoProject(aLapX + lapLen, halfMt, aDepth / 2);
                const g3b = isoProject(aLapX, halfMt, aDepth / 2);
                const front = `${g0[0]},${g0[1]} ${g1[0]},${g1[1]} ${g2[0]},${g2[1]} ${g3[0]},${g3[1]}`;
                const top = `${g3[0]},${g3[1]} ${g2[0]},${g2[1]} ${g2b[0]},${g2b[1]} ${g3b[0]},${g3b[1]}`;
                const side = `${g1[0]},${g1[1]} ${g1b[0]},${g1b[1]} ${g2b[0]},${g2b[1]} ${g2[0]},${g2[1]}`;
                return (
                  <g>
                    <polygon
                      points={front}
                      fill="url(#hatch-halflap)"
                      stroke={COLOR.HIDDEN}
                      strokeWidth={ISO_STROKE.HIDDEN_DASHED / isoScale}
                      strokeDasharray={ISO_DASH.HIDDEN}
                    />
                    <polygon
                      points={top}
                      fill="none"
                      stroke={COLOR.HIDDEN}
                      strokeWidth={ISO_STROKE.HIDDEN_DASHED / isoScale}
                      strokeDasharray={ISO_DASH.HIDDEN}
                    />
                    <polygon
                      points={side}
                      fill="none"
                      stroke={COLOR.HIDDEN}
                      strokeWidth={ISO_STROKE.HIDDEN_DASHED / isoScale}
                      strokeDasharray={ISO_DASH.HIDDEN}
                    />
                  </g>
                );
              })()}

              {/* ==================== 件 B（上件，公色，爆炸位移） ==================== */}
              <g transform={`translate(0 ${bYOffset})`}>
                {/* 全厚 tail 段 */}
                <IsoCuboid
                  x={bTailX}
                  y={0}
                  z={-bDepth / 2}
                  w={tailLen}
                  h={ct}
                  d={bDepth}
                  fillFront={ISO_FILL.TENON_FRONT}
                  fillTop={ISO_FILL.TENON_TOP}
                  fillSide={ISO_FILL.TENON_SIDE}
                  strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / isoScale}
                  showHiddenBackEdges={false}
                />
                {/* 半厚 lap 段（上半保留 → y ∈ [0, halfCt]） */}
                <IsoCuboid
                  x={bLapX}
                  y={0}
                  z={-bDepth / 2}
                  w={lapLen}
                  h={halfCt}
                  d={bDepth}
                  fillFront={ISO_FILL.TENON_FRONT}
                  fillTop={ISO_FILL.TENON_TOP}
                  fillSide={ISO_FILL.TENON_SIDE}
                  strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / isoScale}
                  showHiddenBackEdges={false}
                />
                {/* 件 B 被削掉的下半（虛線 ghost + 紅斜線 hatching） */}
                {(() => {
                  const g0 = isoProject(bLapX, halfCt, -bDepth / 2);
                  const g1 = isoProject(bLapX + lapLen, halfCt, -bDepth / 2);
                  const g2 = isoProject(bLapX + lapLen, ct, -bDepth / 2);
                  const g3 = isoProject(bLapX, ct, -bDepth / 2);
                  const g2b = isoProject(bLapX + lapLen, ct, bDepth / 2);
                  const g3b = isoProject(bLapX, ct, bDepth / 2);
                  const g1b = isoProject(bLapX + lapLen, halfCt, bDepth / 2);
                  const front = `${g0[0]},${g0[1]} ${g1[0]},${g1[1]} ${g2[0]},${g2[1]} ${g3[0]},${g3[1]}`;
                  const bottom = `${g3[0]},${g3[1]} ${g2[0]},${g2[1]} ${g2b[0]},${g2b[1]} ${g3b[0]},${g3b[1]}`;
                  const side = `${g1[0]},${g1[1]} ${g1b[0]},${g1b[1]} ${g2b[0]},${g2b[1]} ${g2[0]},${g2[1]}`;
                  return (
                    <g>
                      <polygon
                        points={front}
                        fill="url(#hatch-halflap)"
                        stroke={COLOR.HIDDEN}
                        strokeWidth={ISO_STROKE.HIDDEN_DASHED / isoScale}
                        strokeDasharray={ISO_DASH.HIDDEN}
                      />
                      <polygon
                        points={bottom}
                        fill="none"
                        stroke={COLOR.HIDDEN}
                        strokeWidth={ISO_STROKE.HIDDEN_DASHED / isoScale}
                        strokeDasharray={ISO_DASH.HIDDEN}
                      />
                      <polygon
                        points={side}
                        fill="none"
                        stroke={COLOR.HIDDEN}
                        strokeWidth={ISO_STROKE.HIDDEN_DASHED / isoScale}
                        strokeDasharray={ISO_DASH.HIDDEN}
                      />
                    </g>
                  );
                })()}
              </g>

              {/* ==================== 組裝箭頭（B → A 往下，搭接區中央） ==================== */}
              {(() => {
                const arrTop = isoProject(0, bYOffset + halfCt + 2, 0);
                const arrBot = isoProject(0, -2, 0);
                return (
                  <g>
                    <line
                      x1={arrTop[0]}
                      y1={arrTop[1]}
                      x2={arrBot[0]}
                      y2={arrBot[1]}
                      stroke={COLOR.DIM}
                      strokeWidth={1 / isoScale}
                      strokeDasharray={ISO_DASH.ARROW}
                    />
                    {/* 箭頭三角 */}
                    <polygon
                      points={`${arrBot[0]},${arrBot[1]} ${arrBot[0] - 4 / isoScale},${arrBot[1] - 6 / isoScale} ${arrBot[0] + 4 / isoScale},${arrBot[1] - 6 / isoScale}`}
                      fill={COLOR.DIM}
                    />
                  </g>
                );
              })()}

              {/* ==================== 文字 label：標明削半厚 ====================
                  外層 rotate(-90) 後 label 會躺，要逐字 rotate(90 cx cy) 反轉回正向 */}
              {(() => {
                const labA = isoProject(aLapX + lapLen / 2, halfMt - 2, -aDepth / 2);
                const ax = labA[0];
                const ay = labA[1] - 2 / isoScale;
                return (
                  <text
                    x={ax}
                    y={ay}
                    fontSize={9 / isoScale}
                    fill={COLOR.SECTION_HATCH}
                    textAnchor="middle"
                    transform={`rotate(90 ${ax} ${ay})`}
                  >
                    ← A 件削上半 {Math.round(halfMt)}mm
                  </text>
                );
              })()}
              {/* B 件 label（在 translate 外固定算） */}
              {(() => {
                const labB = isoProject(bLapX + lapLen / 2, bYOffset + halfCt + 4, -bDepth / 2);
                const bx = labB[0];
                const by = labB[1];
                return (
                  <text
                    x={bx}
                    y={by}
                    fontSize={9 / isoScale}
                    fill={COLOR.SECTION_HATCH}
                    textAnchor="middle"
                    transform={`rotate(90 ${bx} ${by})`}
                  >
                    → B 件削下半 {Math.round(halfCt)}mm
                  </text>
                );
              })()}
            </g>
          );
        })()}
      </IsometricGroup>
      </g>
      <WarningCallout x={20} y={QH - 30} text={`兩件各削一半（A 上半 ${Math.round(mt/2)}mm + B 下半 ${Math.round(ct/2)}mm），咬合後總厚=板厚`} />
    </g>
  );

  return (
    <svg
      viewBox={`0 0 960 720`}
      width="100%"
      style={{ maxWidth: "960px" }}
      className="bg-white"
    >
      <defs>
        <Hatching id="hatch-halflap" color={COLOR.SECTION_HATCH} />
      </defs>
      <ThreeViewLayout
        width={960}
        height={660}
        front={front}
        side={side}
        top={top}
        iso={iso}
        titleBlock={
          <TitleBlock
            x={0}
            y={0}
            width={960}
            joineryType="half-lap"
            joineryNameZh={`半搭榫（${lapFormZh}）`}
            scale="1:1"
            drawingNumber={`HL-${ct}-${cw}-${mt}`}
          />
        }
      />
    </svg>
  );
}
/* === END half-lap-detail === */

/* === BEGIN tongue-and-groove-detail (owner: agent-B, group: B) === */
/* ============================================================
 * 企口榫 — tongue-and-groove (panel edge into grooved rail)
 * ============================================================ */
function LegacyTongueAndGrooveDetail(p: JoineryDetailParams) {
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

/* ----------------------------------------------------------------
 * 企口榫 教科書級重繪（三視圖 + 等角圖 + 多片拼接）
 *   舌厚 tt 預設 = mt/3；槽深 = 舌長 + 1mm 漲縮餘量；
 *   俯視畫多片拼接示意（3 片條板拼面板）。
 * ---------------------------------------------------------------- */
function LegacyV2TongueAndGrooveDetail(p: JoineryDetailParams) {
  const mt = p.motherThickness;
  const tt = p.tenonThickness ?? Math.max(3, Math.round(mt / 3));
  const tl = p.tenonLength;
  const ct = p.childThickness ?? tt;
  // 槽深 = 舌長 + 1mm 漲縮餘量
  const grooveDepth = tl + 1;
  const shoulderThickness = Math.max(0, (mt - tt) / 2); // 舌肩留厚

  const QW = 475;
  const QH = 300;
  const maxMm = Math.max(mt * 4, tl * 6, grooveDepth * 6);
  const s = fitScale(maxMm, Math.min(QW, QH) - 80);
  const PX = (mm: number) => mm * s;

  // ===== 正視圖（端面剖面：母件凹槽 + 公件出舌橫向組合）=====
  const front = (
    <g>
      <text x={QW / 2} y={14} fontSize={FONT.LABEL} fontWeight="bold" textAnchor="middle">
        正視圖（橫向斷面：母在左、公在右）
      </text>
      <rect x={4} y={20} width={QW - 8} height={QH - 28} fill="white" stroke={COLOR.OUTLINE} strokeWidth={0.4} />
      {(() => {
        const pieceLen = Math.max(PX(mt) * 2.2, 90);
        const motherX = (QW - pieceLen * 2 - 30) / 2;
        const motherY = QH / 2 - PX(mt) / 2;
        const childX = motherX + pieceLen + 30;
        const childY = QH / 2 - PX(ct) / 2;
        const grooveX = motherX + pieceLen - PX(grooveDepth);
        const grooveY = motherY + PX(mt) / 2 - PX(tt) / 2;
        const tongueX = childX;
        const tongueY = childY + PX(ct) / 2 - PX(tt) / 2;
        return (
          <>
            {/* 母件本體 */}
            <rect x={motherX} y={motherY} width={pieceLen} height={PX(mt)} fill={COLOR.MORTISE} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
            {/* 母件剖面：紅斜線 hatching（去除凹槽範圍） */}
            <rect x={motherX} y={motherY} width={pieceLen - PX(grooveDepth)} height={PX(mt)} fill="url(#hatch-tg-new)" stroke="none" />
            <rect x={motherX} y={motherY} width={pieceLen} height={Math.max(0, grooveY - motherY)} fill="url(#hatch-tg-new)" stroke="none" />
            <rect x={motherX} y={grooveY + PX(tt)} width={pieceLen} height={Math.max(0, motherY + PX(mt) - (grooveY + PX(tt)))} fill="url(#hatch-tg-new)" stroke="none" />
            {/* 凹槽（白） */}
            <rect x={grooveX} y={grooveY} width={PX(grooveDepth)} height={PX(tt)} fill="white" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
            {/* 公件本體 */}
            <rect x={childX + PX(tl)} y={childY} width={pieceLen - PX(tl)} height={PX(ct)} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
            {/* 舌 */}
            <rect x={tongueX} y={tongueY} width={PX(tl)} height={PX(tt)} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
            {/* 中心線（共用 centreline 顯示對齊） */}
            <CenterLine x1={motherX - 10} y1={motherY + PX(mt) / 2} x2={childX + pieceLen + 10} y2={motherY + PX(mt) / 2} />
            {/* 木紋 */}
            <GrainArrow x={motherX + 4} y={motherY - 12} length={Math.min(50, pieceLen / 2)} angle={0} />
            <GrainArrow x={childX + PX(tl) + 4} y={childY - 12} length={Math.min(50, pieceLen / 2)} angle={0} />
            {/* 剖面標記 A-A */}
            <SectionMark x={grooveX + PX(grooveDepth) / 2} y={motherY - 16} label="A" direction="down" />
            <SectionMark x={grooveX + PX(grooveDepth) / 2} y={motherY + PX(mt) + 16} label="A" direction="up" />
            {/* 尺寸：舌長 / 槽深 / 母厚 / 舌厚 / 舌肩厚（縱向錯開避免重疊） */}
            <DimLine x1={tongueX} y1={tongueY + PX(tt) + 28} x2={tongueX + PX(tl)} y2={tongueY + PX(tt) + 28} label={`舌長 ${tl}`} side="bottom" />
            <DimLine x1={grooveX} y1={grooveY - 18} x2={grooveX + PX(grooveDepth)} y2={grooveY - 18} label={`槽深 ${grooveDepth}`} side="top" />
            <DimLine x1={motherX - 14} y1={motherY} x2={motherX - 14} y2={motherY + PX(mt)} label={`母厚 ${mt}`} side="left" />
            <DimLine x1={tongueX - 18} y1={tongueY} x2={tongueX - 18} y2={tongueY + PX(tt)} label={`舌厚 ${tt}`} side="left" />
            {shoulderThickness > 0 && (
              <DimLine x1={childX + pieceLen + 14} y1={childY} x2={childX + pieceLen + 14} y2={childY + PX(shoulderThickness)} label={`舌肩 ${Math.round(shoulderThickness)}`} side="right" />
            )}
          </>
        );
      })()}
    </g>
  );

  // ===== 側視圖（順紋方向看：兩片板長向延伸）=====
  const side = (
    <g>
      <text x={QW / 2} y={14} fontSize={FONT.LABEL} fontWeight="bold" textAnchor="middle">
        側視圖（順紋向）
      </text>
      <rect x={4} y={20} width={QW - 8} height={QH - 28} fill="white" stroke={COLOR.OUTLINE} strokeWidth={0.4} />
      {(() => {
        const boardLen = QW - 60;
        const motherY = 50;
        const childY = motherY + PX(mt) + 24;
        const motherX = 30;
        const childX = 30;
        return (
          <>
            <rect x={motherX} y={motherY} width={boardLen} height={PX(mt)} fill={COLOR.MORTISE} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
            {/* 槽：在 mother 右邊條形隱藏線（淺示意） */}
            <HiddenEdge x1={motherX} y1={motherY + PX(mt) / 2 - PX(tt) / 2} x2={motherX + boardLen} y2={motherY + PX(mt) / 2 - PX(tt) / 2} />
            <HiddenEdge x1={motherX} y1={motherY + PX(mt) / 2 + PX(tt) / 2} x2={motherX + boardLen} y2={motherY + PX(mt) / 2 + PX(tt) / 2} />
            {/* 凹槽紅虛線輪廓（深色母件內看不見的槽，舌厚 tt × 槽深 grooveDepth）— 醒目 */}
            <rect
              x={motherX + boardLen - PX(grooveDepth)}
              y={motherY + PX(mt) / 2 - PX(tt) / 2}
              width={PX(grooveDepth)}
              height={PX(tt)}
              fill="none"
              stroke={COLOR.DIM_TICK}
              strokeWidth={1.6}
              strokeDasharray="5 3"
            />
            <text
              x={motherX + boardLen - PX(grooveDepth) / 2}
              y={motherY + PX(mt) / 2 - PX(tt) / 2 - 4}
              fontSize={FONT.CALLOUT}
              textAnchor="middle"
              fill={COLOR.DIM_TICK}
              fontWeight="bold"
            >
              凹槽（隱藏）
            </text>
            <text x={motherX + boardLen / 2} y={motherY - 4} fontSize={FONT.DIM} fill="#666" textAnchor="middle">母件（凹槽連續）</text>
            <rect x={childX} y={childY} width={boardLen} height={PX(ct)} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
            {/* 舌：在 child 上邊小凸出（虛線俯瞰想像） */}
            <HiddenEdge x1={childX} y1={childY + PX(ct) / 2 - PX(tt) / 2} x2={childX + boardLen} y2={childY + PX(ct) / 2 - PX(tt) / 2} />
            {/* 公件舌頭紅虛線輪廓（沿板長方向連續，舌厚 tt） — 醒目 */}
            <rect
              x={childX}
              y={childY + PX(ct) / 2 - PX(tt) / 2}
              width={boardLen}
              height={PX(tt)}
              fill="none"
              stroke={COLOR.DIM_TICK}
              strokeWidth={1.6}
              strokeDasharray="5 3"
            />
            <text
              x={childX + boardLen - 30}
              y={childY + PX(ct) / 2 + PX(tt) / 2 + 12}
              fontSize={FONT.CALLOUT}
              textAnchor="middle"
              fill={COLOR.DIM_TICK}
              fontWeight="bold"
            >
              舌頭（隱藏）
            </text>
            <text x={childX + boardLen / 2} y={childY + PX(ct) + 14} fontSize={FONT.DIM} fill="#666" textAnchor="middle">公件（舌連續）</text>
            <CenterLine x1={motherX - 10} y1={motherY + PX(mt) / 2} x2={motherX + boardLen + 10} y2={motherY + PX(mt) / 2} />
            <GrainArrow x={motherX + 4} y={motherY - 14} length={Math.min(80, boardLen - 10)} angle={0} />
            <DimLine x1={motherX - 14} y1={motherY} x2={motherX - 14} y2={motherY + PX(mt)} label={`母厚 ${mt}`} side="left" />
            <DimLine x1={childX - 14} y1={childY} x2={childX - 14} y2={childY + PX(ct)} label={`公厚 ${ct}`} side="left" />
          </>
        );
      })()}
    </g>
  );

  // ===== 俯視圖（多片拼接示意：3 片條板）=====
  const top = (
    <g>
      <text x={QW / 2} y={14} fontSize={FONT.LABEL} fontWeight="bold" textAnchor="middle">
        俯視圖（多片拼接成面板）
      </text>
      <rect x={4} y={20} width={QW - 8} height={QH - 28} fill="white" stroke={COLOR.OUTLINE} strokeWidth={0.4} />
      {(() => {
        const stripLen = QW - 110;
        const stripH = Math.max(PX(mt), 24);
        const startX = 60;
        const startY = 50;
        const strips = 3;
        const totalWidthMm = strips * mt;
        const boardLenMm = Math.round(stripLen / Math.max(s, 0.001));
        const groovePxLen = PX(grooveDepth);
        return (
          <>
            {[0, 1, 2].map((i) => {
              const y = startY + i * (stripH + 4);
              const fill = i % 2 === 0 ? COLOR.MORTISE : COLOR.TENON;
              const seamY = y + stripH;
              const halfTongue = PX(tl / 2);
              return (
                <g key={i}>
                  <rect x={startX} y={y} width={stripLen} height={stripH} fill={fill} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
                  {/* 接縫位置（隱藏舌槽輪廓） */}
                  {i < strips - 1 && (
                    <line x1={startX} y1={seamY} x2={startX + stripLen} y2={seamY} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
                  )}
                  {/* 顯示舌的長度（隱藏）：在右端寫一段虛線示意舌穿過 */}
                  {i < strips - 1 && (
                    <HiddenEdge x1={startX + stripLen - groovePxLen} y1={seamY} x2={startX + stripLen} y2={seamY} />
                  )}
                  {/* 接縫上下 ±舌長/2 處紅虛線標示舌頭實際嵌入位置（橫貫整片板長） */}
                  {i < strips - 1 && (
                    <>
                      <line
                        x1={startX}
                        y1={seamY - halfTongue}
                        x2={startX + stripLen}
                        y2={seamY - halfTongue}
                        stroke={COLOR.DIM_TICK}
                        strokeWidth={1.6}
                        strokeDasharray="5 3"
                      />
                      <line
                        x1={startX}
                        y1={seamY + halfTongue}
                        x2={startX + stripLen}
                        y2={seamY + halfTongue}
                        stroke={COLOR.DIM_TICK}
                        strokeWidth={1.6}
                        strokeDasharray="5 3"
                      />
                    </>
                  )}
                  <text x={startX - 4} y={y + stripH / 2 + 3} fontSize={FONT.DIM} fill="#666" textAnchor="end">板 {i + 1}</text>
                </g>
              );
            })}
            {/* 標籤：紅虛線 = 舌頭嵌入範圍 */}
            <text
              x={startX + stripLen + 8}
              y={startY + stripH + 4}
              fontSize={FONT.CALLOUT}
              fill={COLOR.DIM_TICK}
              fontWeight="bold"
            >
              ← 舌頭嵌入位（隱藏）
            </text>
            {/* 木紋方向（每片同向） */}
            <GrainArrow x={startX + 8} y={startY - 12} length={Math.min(80, stripLen - 12)} angle={0} />
            {/* 尺寸：拼接寬 */}
            <DimLine x1={startX - 14} y1={startY} x2={startX - 14} y2={startY + strips * stripH + (strips - 1) * 4} label={`拼板總寬 ${totalWidthMm}`} side="left" />
            <DimLine x1={startX} y1={startY + strips * stripH + (strips - 1) * 4 + 14} x2={startX + stripLen} y2={startY + strips * stripH + (strips - 1) * 4 + 14} label={`板長 ${boardLenMm}`} side="bottom" />
          </>
        );
      })()}
    </g>
  );

  // ===== 等角圖 =====
  const isoScale = Math.min(0.85, s * 0.55);
  const iso = (
    <g>
      <text x={QW / 2} y={14} fontSize={FONT.LABEL} fontWeight="bold" textAnchor="middle">
        等角圖（兩片接合）
      </text>
      <rect x={4} y={20} width={QW - 8} height={QH - 28} fill="white" stroke={COLOR.OUTLINE} strokeWidth={0.4} />
      <IsometricGroup originX={QW / 2} originY={QH / 2 + 10} scale={isoScale}>
        {(() => {
          // Phase 3 (2026-05-09)：板放厚 + 舌頭加長 + 槽用 IsoMortise 內壁線
          // 兩塊板拼寬（沿 z 深度方向），板厚 mt 是「高度」。
          const pieceLenMm = Math.max(mt * 3, tl * 5, 80);
          // 視覺：板的 depth（沿 z）= 80mm，板厚 mt 沿 y。長度沿 x。
          const boardDepth = Math.max(80, pieceLenMm * 0.5);
          // 母件（左板）：x=[-pieceLenMm, 0], y=[-mt/2, mt/2], z=[0, boardDepth]
          // 公件（右板，含舌）：x=[tl, tl+pieceLenMm], y=[-mt/2, mt/2], z=[0, boardDepth]
          // 舌頭：從公件左端 -x 凸出 tl 長，厚 tt（中央），深 boardDepth
          const explodeGap = tl + 8;
          return (
            <g>
              {/* 母件（左板） */}
              <IsoCuboid
                x={-pieceLenMm}
                y={-mt / 2}
                z={0}
                w={pieceLenMm}
                h={mt}
                d={boardDepth}
                fillFront={ISO_FILL.MORTISE_FRONT}
                fillTop={ISO_FILL.MORTISE_TOP}
                fillSide={ISO_FILL.MORTISE_SIDE}
                strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / isoScale}
              />
              {/* 母件凹槽（在右面 +x 開口） */}
              <IsoMortise
                faceX={0}
                faceY={0}
                faceZ={boardDepth / 2}
                width={boardDepth}
                height={tt}
                depth={grooveDepth}
                faceNormal="+x"
                through={false}
                stroke={COLOR.OUTLINE}
                strokeWidth={ISO_STROKE.EDGE_INTERIOR / isoScale}
              />
              {/* 公件（右板，explode 沿 +x） */}
              <g transform={`translate(${explodeGap} 0)`}>
                <IsoCuboid
                  x={tl}
                  y={-mt / 2}
                  z={0}
                  w={pieceLenMm}
                  h={mt}
                  d={boardDepth}
                  fillFront={ISO_FILL.TENON_FRONT}
                  fillTop={ISO_FILL.TENON_TOP}
                  fillSide={ISO_FILL.TENON_SIDE}
                  strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / isoScale}
                />
                {/* 舌頭：從公件左端 -x 凸出 tl 長，寬=boardDepth、厚=tt */}
                <IsoTenon
                  baseX={tl}
                  baseY={0}
                  baseZ={boardDepth / 2}
                  width={boardDepth}
                  thickness={tt}
                  length={tl}
                  direction="-x"
                  fillFront={ISO_FILL.TENON_FRONT}
                  fillTop={ISO_FILL.TENON_TOP}
                  fillSide={ISO_FILL.TENON_SIDE}
                  strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / isoScale}
                  embeddedLength={tl}
                />
              </g>
              {/* 拆解箭頭：舌頭 → 凹槽 */}
              <line
                x1={tl + explodeGap - 4}
                y1={0}
                x2={4}
                y2={0}
                stroke={COLOR.DIM}
                strokeWidth={0.8 / isoScale}
                strokeDasharray={ISO_DASH.ARROW}
              />
            </g>
          );
        })()}
      </IsometricGroup>
      <WarningCallout x={20} y={QH - 30} text={`凹槽深 = 舌長 + 1mm（漲縮餘量 ${grooveDepth}mm）`} />
    </g>
  );

  return (
    <svg
      viewBox={`0 0 960 720`}
      width="100%"
      style={{ maxWidth: "960px" }}
      className="bg-white"
    >
      <defs>
        <Hatching id="hatch-tg-new" color={COLOR.SECTION_HATCH} />
      </defs>
      <ThreeViewLayout
        width={960}
        height={660}
        front={front}
        side={side}
        top={top}
        iso={iso}
        titleBlock={
          <TitleBlock
            x={0}
            y={0}
            width={960}
            joineryType="tongue-and-groove"
            joineryNameZh="企口榫（舌槽接）"
            scale="1:1"
            drawingNumber={`TG-${tt}-${tl}-${mt}`}
          />
        }
      />
    </svg>
  );
}
/* === END tongue-and-groove-detail === */

/* === BEGIN shouldered-tenon-detail (owner: agent-B, group: B) === */
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
function LegacyShoulderedTenonDetail(p: JoineryDetailParams) {
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

/* ----------------------------------------------------------------
 * 帶肩榫 教科書級重繪（三視圖 + 等角圖 + 端面剖面）
 *
 *   Layout：左上=正視（牙板側面端視）/ 右上=側視（牙板斷面 + 雙肩）
 *           左下=俯視（裝合斷面：牙板入柱）/ 右下=等角圖
 *           底部=標題欄
 *
 *   Fallback：cw ≤ tw 時退回純通榫並 callout 警示。
 *   雙肩榫：肩寬 = (cw - tw) / 2，雙邊各標。
 * ---------------------------------------------------------------- */
function LegacyV2ShoulderedTenonDetail(p: JoineryDetailParams) {
  const tl = p.tenonLength;
  const tw = p.tenonWidth;
  const tt = p.tenonThickness;
  const mt = p.motherThickness;
  const ct = p.childThickness ?? tt;
  const cw = p.childWidth ?? tw;

  // Fallback：公件斷面太窄無法做肩
  const noShoulder = cw <= tw + 1; // 留 1mm tolerance
  const shoulderW = noShoulder ? 0 : (cw - tw) / 2;
  const haunchLen = Math.max(4, Math.round(tl / 3));

  const QW = 475;
  const QH = 300;
  const maxMm = Math.max(cw + 60, mt * 3 + tl * 2, tw + tl * 2);
  const s = fitScale(maxMm, Math.min(QW, QH) - 80);
  const PX = (mm: number) => mm * s;

  // ===== 正視圖：牙板從側面看（榫頭水平伸向右） =====
  const front = (
    <g>
      <text x={QW / 2} y={14} fontSize={FONT.LABEL} fontWeight="bold" textAnchor="middle">
        正視圖（牙板側面：露榫頭）
      </text>
      <rect x={4} y={20} width={QW - 8} height={QH - 28} fill="white" stroke={COLOR.OUTLINE} strokeWidth={0.4} />
      {(() => {
        const apronBodyLen = Math.max(PX(ct) * 5, 140);
        const apronH = PX(cw);
        const ax = (QW - apronBodyLen - PX(tl) - 60) / 2;
        const ay = (QH - apronH) / 2 + 10;
        const tenonY = ay + PX(shoulderW);
        const tenonH = PX(tw);
        const tenonX = ax + apronBodyLen;
        const tenonRight = tenonX + PX(tl);
        return (
          <>
            {/* 牙板本體 */}
            <rect x={ax} y={ay} width={apronBodyLen} height={apronH} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
            {/* 主榫 */}
            <rect x={tenonX} y={tenonY} width={PX(tl)} height={tenonH} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
            {/* 肩線 (vertical at body→tenon transition) */}
            <line x1={tenonX} y1={ay} x2={tenonX} y2={ay + apronH} stroke={COLOR.OUTLINE} strokeWidth={0.8} />
            {/* 組裝後榫頭藏入柱身（虛線輪廓 + 深度標示） */}
            {(() => {
              const colX = tenonRight + 18; // 柱身位置（在榫尾右側留間隔）
              const colW = PX(mt);
              const colH = Math.max(apronH * 1.4, PX(mt));
              const colY = ay + apronH / 2 - colH / 2;
              return (
                <>
                  {/* 柱身輪廓（淺示意，淡灰實線） */}
                  <rect
                    x={colX}
                    y={colY}
                    width={colW}
                    height={colH}
                    fill="#e8d8b8"
                    stroke={COLOR.OUTLINE}
                    strokeWidth={STROKE.OUTLINE}
                    opacity={0.7}
                  />
                  {/* 榫頭藏入柱身的紅虛線輪廓（tw × tl，從柱身左緣往內 PX(tl)） */}
                  <rect
                    x={colX}
                    y={tenonY}
                    width={PX(tl)}
                    height={tenonH}
                    fill="none"
                    stroke={COLOR.DIM_TICK}
                    strokeWidth={1.6}
                    strokeDasharray="5 3"
                  />
                  {/* 榫頭深度線（從柱身左緣到榫尾） */}
                  <line
                    x1={colX}
                    y1={tenonY + tenonH / 2}
                    x2={colX + PX(tl)}
                    y2={tenonY + tenonH / 2}
                    stroke={COLOR.DIM_TICK}
                    strokeWidth={1.6}
                    strokeDasharray="5 3"
                  />
                  {/* 拆解箭頭：榫尾 → 柱身左緣 */}
                  <line
                    x1={tenonRight + 2}
                    y1={tenonY + tenonH / 2}
                    x2={colX - 2}
                    y2={tenonY + tenonH / 2}
                    stroke={COLOR.DIM}
                    strokeWidth={0.6}
                    strokeDasharray="2 2"
                  />
                  {/* 標籤 */}
                  <text
                    x={colX + PX(tl) / 2}
                    y={tenonY - 4}
                    fontSize={FONT.CALLOUT}
                    textAnchor="middle"
                    fill={COLOR.DIM_TICK}
                    fontWeight="bold"
                  >
                    榫頭（隱藏）
                  </text>
                  <text
                    x={colX + colW / 2}
                    y={colY + colH + 12}
                    fontSize={FONT.CALLOUT}
                    textAnchor="middle"
                    fill="#666"
                  >
                    柱身
                  </text>
                </>
              );
            })()}
            {/* 中心線 */}
            <CenterLine x1={ax - 10} y1={ay + apronH / 2} x2={tenonRight + 10} y2={ay + apronH / 2} />
            {/* 木紋 */}
            <GrainArrow x={ax + 6} y={ay - 12} length={Math.min(70, apronBodyLen / 2)} angle={0} />
            {/* 剖面 A-A：在榫的中段切 */}
            <SectionMark x={tenonX + PX(tl) / 2} y={ay - 18} label="A" direction="down" />
            <SectionMark x={tenonX + PX(tl) / 2} y={ay + apronH + 18} label="A" direction="up" />
            {/* 尺寸：榫長 / 榫寬 / 板寬 / 上下肩寬 */}
            <DimLine x1={tenonX} y1={tenonY + tenonH + 18} x2={tenonRight} y2={tenonY + tenonH + 18} label={`榫長 ${tl}`} side="bottom" />
            <DimLine x1={tenonRight + 14} y1={tenonY} x2={tenonRight + 14} y2={tenonY + tenonH} label={`榫寬 ${tw}`} side="right" />
            <DimLine x1={ax - 14} y1={ay} x2={ax - 14} y2={ay + apronH} label={`板寬 ${cw}`} side="left" />
            {!noShoulder && (
              <>
                <DimLine x1={tenonRight + 30} y1={ay} x2={tenonRight + 30} y2={tenonY} label={`上肩 ${Math.round(shoulderW)}`} side="right" />
                <DimLine x1={tenonRight + 30} y1={tenonY + tenonH} x2={tenonRight + 30} y2={ay + apronH} label={`下肩 ${Math.round(shoulderW)}`} side="right" />
              </>
            )}
          </>
        );
      })()}
    </g>
  );

  // ===== 側視圖：牙板端面剖面（看到榫的厚度+雙肩） =====
  const side = (
    <g>
      <text x={QW / 2} y={14} fontSize={FONT.LABEL} fontWeight="bold" textAnchor="middle">
        側視圖（牙板端面剖面）
      </text>
      <rect x={4} y={20} width={QW - 8} height={QH - 28} fill="white" stroke={COLOR.OUTLINE} strokeWidth={0.4} />
      {(() => {
        // 牙板斷面 = ct (寬，水平) × cw (高，垂直)；榫斷面在中央 = tt × tw
        const xsCw = PX(ct);
        const xsCh = PX(cw);
        const xsX = (QW - xsCw) / 2;
        const xsY = (QH - xsCh) / 2 + 10;
        const tenonW = PX(tt);
        const tenonH = PX(tw);
        const tenonX = xsX + (xsCw - tenonW) / 2;
        const tenonY = xsY + PX(shoulderW);
        return (
          <>
            {/* 板斷面（虛線輪廓 + 紅斜線剖面）*/}
            <rect x={xsX} y={xsY} width={xsCw} height={xsCh} fill="url(#hatch-shoulder-new)" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
            {/* 主榫斷面（公榫實心） */}
            <rect x={tenonX} y={tenonY} width={tenonW} height={tenonH} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
            {/* 中心線 */}
            <CenterLine x1={xsX - 8} y1={xsY + xsCh / 2} x2={xsX + xsCw + 8} y2={xsY + xsCh / 2} />
            <CenterLine x1={xsX + xsCw / 2} y1={xsY - 8} x2={xsX + xsCw / 2} y2={xsY + xsCh + 8} />
            {/* 木紋（垂直於頁面，標符號） */}
            <text x={xsX + 4} y={xsY + 12} fontSize={FONT.CALLOUT} fill={COLOR.GRAIN}>⊙ 木紋</text>
            {/* 尺寸 */}
            <DimLine x1={xsX} y1={xsY + xsCh + 14} x2={xsX + xsCw} y2={xsY + xsCh + 14} label={`板厚 ${ct}`} side="bottom" />
            <DimLine x1={tenonX} y1={tenonY - 6} x2={tenonX + tenonW} y2={tenonY - 6} label={`榫厚 ${tt}`} side="top" />
            <DimLine x1={xsX - 14} y1={xsY} x2={xsX - 14} y2={xsY + xsCh} label={`板寬 ${cw}`} side="left" />
            {!noShoulder && (
              <>
                <DimLine x1={xsX + xsCw + 14} y1={xsY} x2={xsX + xsCw + 14} y2={tenonY} label={`上肩 ${Math.round(shoulderW)}`} side="right" />
                <DimLine x1={xsX + xsCw + 14} y1={tenonY + tenonH} x2={xsX + xsCw + 14} y2={xsY + xsCh} label={`下肩 ${Math.round(shoulderW)}`} side="right" />
              </>
            )}
            {noShoulder && <WarningCallout x={xsX - 30} y={xsY + xsCh + 32} text="公件斷面太窄無法做帶肩，已轉純通榫" />}
          </>
        );
      })()}
    </g>
  );

  // ===== 俯視圖（裝合剖面：牙板入柱腳，從上面切一刀看） =====
  const top = (
    <g>
      <text x={QW / 2} y={14} fontSize={FONT.LABEL} fontWeight="bold" textAnchor="middle">
        俯視圖（裝合剖面：牙板入柱）
      </text>
      <rect x={4} y={20} width={QW - 8} height={QH - 28} fill="white" stroke={COLOR.OUTLINE} strokeWidth={0.4} />
      {(() => {
        const isRound = p.motherShape === "round";
        const legW = PX(mt);
        const legH = PX(mt);
        const legX = QW / 2 - legW;
        const legY = QH / 2 - legH / 2;
        const tenonY = legY + legH / 2 - PX(tt) / 2;
        const tenonX = legX + legW - PX(tl);
        const apronY = legY + legH / 2 - PX(ct) / 2;
        const apronX = legX + legW;
        const apronLen = Math.max(PX(ct) * 5, 100);
        return (
          <>
            {/* 柱腳（紅斜線剖面） */}
            {isRound ? (
              <circle cx={legX + legW / 2} cy={legY + legH / 2} r={legW / 2} fill="url(#hatch-shoulder-new)" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
            ) : (
              <rect x={legX} y={legY} width={legW} height={legH} fill="url(#hatch-shoulder-new)" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
            )}
            {/* 榫頭（藏入柱腳） */}
            <rect x={tenonX} y={tenonY} width={PX(tl)} height={PX(tt)} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
            {/* 牙板 */}
            <rect x={apronX} y={apronY} width={apronLen} height={PX(ct)} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
            {/* 肩面（垂直線：apron 端面接觸柱腳的線） */}
            <line x1={apronX} y1={apronY - PX(shoulderW)} x2={apronX} y2={apronY + PX(ct) + PX(shoulderW)} stroke={COLOR.OUTLINE} strokeWidth={1.0} />
            {/* 中心線 */}
            <CenterLine x1={legX - 10} y1={legY + legH / 2} x2={apronX + apronLen + 10} y2={legY + legH / 2} />
            {/* 隱藏線：榫尾在柱腳內 */}
            <HiddenEdge x1={tenonX} y1={tenonY} x2={legX} y2={tenonY} />
            <HiddenEdge x1={tenonX} y1={tenonY + PX(tt)} x2={legX} y2={tenonY + PX(tt)} />
            {/* 尺寸 */}
            <DimLine x1={tenonX} y1={tenonY + PX(tt) + 10} x2={tenonX + PX(tl)} y2={tenonY + PX(tt) + 10} label={`榫長 ${tl}`} side="bottom" />
            <DimLine x1={legX} y1={legY - 14} x2={legX + legW} y2={legY - 14} label={`柱寬 ${mt}`} side="top" />
            <text x={apronX + 4} y={apronY - PX(shoulderW) - 4} fontSize={FONT.CALLOUT} fill={COLOR.DIM_TICK}>← 肩面（承力）</text>
          </>
        );
      })()}
    </g>
  );

  // ===== 等角圖 =====
  // F: 強制最小 isoScale 0.5，防止 nightstand 等案例細節太小看不清
  const isoScale = Math.max(0.5, Math.min(0.85, s * 0.5));
  const isRound = p.motherShape === "round";
  const iso = (
    <g>
      <text x={QW / 2} y={14} fontSize={FONT.LABEL} fontWeight="bold" textAnchor="middle">
        等角圖（柱腳 + 牙板帶肩榫）
      </text>
      <rect x={4} y={20} width={QW - 8} height={QH - 28} fill="white" stroke={COLOR.OUTLINE} strokeWidth={0.4} />
      <IsometricGroup originX={QW / 2 - 30} originY={QH / 2 + 10} scale={isoScale}>
        {(() => {
          // Phase 3 (2026-05-09)：柱腳完整 3 面 + IsoMortise 內壁 + IsoTenon showShoulder
          // D: 圓腳 fallback：仍用 IsoCuboid 但 width=height=mt，並加 callout 註明簡化
          const apronLenMm = Math.max(ct * 4, cw + 20);
          const explodeGap = tl + 10;
          return (
            <g>
              {/* 柱腳：origin (-mt/2, -mt, -mt/2)，寬=mt 高=mt*2 深=mt */}
              <IsoCuboid
                x={-mt / 2}
                y={-mt}
                z={-mt / 2}
                w={mt}
                h={mt * 2}
                d={mt}
                fillFront={ISO_FILL.MORTISE_FRONT}
                fillTop={ISO_FILL.MORTISE_TOP}
                fillSide={ISO_FILL.MORTISE_SIDE}
                strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / isoScale}
              />
              {isRound && (
                <text x={-mt / 2} y={mt + 14} fontSize={FONT.CALLOUT} fill={COLOR.DIM_TICK}>
                  圓腳柱簡化為方柱顯示（直徑 = {mt}mm）
                </text>
              )}
              {/* 榫眼（柱腳右面 +x，盲榫深 tl） */}
              {/* faceNormal="+x"：width 沿 z 軸（深度=榫厚 tt）、height 沿 y 軸（垂直=榫寬 tw） */}
              <IsoMortise
                faceX={mt / 2}
                faceY={0}
                faceZ={0}
                width={tt}
                height={tw}
                depth={tl}
                faceNormal="+x"
                through={false}
                stroke={COLOR.OUTLINE}
                strokeWidth={ISO_STROKE.EDGE_INTERIOR / isoScale}
              />
              {/* 牙板（含主榫 + 肩） — explode 在柱腳右側 */}
              <g transform={`translate(${explodeGap * 1.5} 0)`}>
                <IsoCuboid
                  x={mt / 2}
                  y={-cw / 2}
                  z={-ct / 2}
                  w={apronLenMm}
                  h={cw}
                  d={ct}
                  fillFront={ISO_FILL.TENON_FRONT}
                  fillTop={ISO_FILL.TENON_TOP}
                  fillSide={ISO_FILL.TENON_SIDE}
                  strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / isoScale}
                />
                {/* 主榫頭 — 從牙板左端 -x 凸出 tl。direction=-x：width 沿 z（深度=榫厚 tt）、thickness 沿 y（垂直=榫寬 tw） */}
                <IsoTenon
                  baseX={mt / 2}
                  baseY={0}
                  baseZ={0}
                  width={tt}
                  thickness={tw}
                  length={tl}
                  direction="-x"
                  fillFront={ISO_FILL.TENON_FRONT}
                  fillTop={ISO_FILL.TENON_TOP}
                  fillSide={ISO_FILL.TENON_SIDE}
                  strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / isoScale}
                  showShoulder={!noShoulder}
                  embeddedLength={tl}
                />
              </g>
              {/* 拆解箭頭：榫頭 → 榫眼 */}
              <line
                x1={mt / 2 + explodeGap * 1.5 - 4}
                y1={0}
                x2={mt / 2 + 4}
                y2={0}
                stroke={COLOR.DIM}
                strokeWidth={0.8 / isoScale}
                strokeDasharray={ISO_DASH.ARROW}
              />
            </g>
          );
        })()}
      </IsometricGroup>
      {!noShoulder ? (
        <WarningCallout x={20} y={QH - 30} text={`肩面為主要承力面（上下肩各 ${Math.round(shoulderW)}mm）`} />
      ) : (
        <WarningCallout x={20} y={QH - 30} text={`公件 ${cw}mm ≤ 榫寬 ${tw}mm，已退回純通榫`} />
      )}
    </g>
  );

  return (
    <svg
      viewBox={`0 0 960 720`}
      width="100%"
      style={{ maxWidth: "960px" }}
      className="bg-white"
    >
      <defs>
        <Hatching id="hatch-shoulder-new" color={COLOR.SECTION_HATCH} />
      </defs>
      <ThreeViewLayout
        width={960}
        height={660}
        front={front}
        side={side}
        top={top}
        iso={iso}
        titleBlock={
          <TitleBlock
            x={0}
            y={0}
            width={960}
            joineryType="shouldered-tenon"
            joineryNameZh={noShoulder ? "帶肩榫（fallback：純通榫）" : "帶肩榫（雙肩防扭）"}
            scale="1:1"
            drawingNumber={`ST-${tw}x${tt}-${cw}`}
          />
        }
      />
    </svg>
  );
}
/* === END shouldered-tenon-detail === */

/* === BEGIN through-tenon-detail v2 (Wave 2b Group A) === */
function ThroughTenonDetail(p: JoineryDetailParams) {
  const tl = p.tenonLength;
  const tw = p.tenonWidth;
  const tt = p.tenonThickness;
  const mt = p.motherThickness;
  const ct = p.childThickness ?? tt;
  const cw = p.childWidth ?? tw;
  const isRound = p.motherShape === "round";
  const dRound = Math.min(tw, tt);

  // 三視共用 bbox：母件水平板 panelW × mt + 公件柱身延伸
  const panelWMm = cw * 4;
  const legBodyMm = Math.max(ct * 3.5, mt * 1.2);
  const sharedBbox = { w: panelWMm, h: mt + legBodyMm };
  const s = unifiedFitScale(sharedBbox);
  const PX = (mm: number) => mm * s;

  const qBounds = { x: 0, y: 0, w: QUADRANT.W, h: QUADRANT.H - QUADRANT.HEADER_H };

  const hatchId = "hatch-through-v2";

  // ============================ FRONT view ============================
  const front = (() => {
    const objW = PX(panelWMm);
    const objH = PX(mt + legBodyMm);
    const place = placeInQuadrant({ w: objW, h: objH });
    const fCx = place.x + objW / 2;
    const fMx = place.x;
    const fMy = place.y;
    const fMw = objW;
    const fMh = PX(mt);
    const fLx = fCx - PX(cw) / 2;
    const fTenonX = fCx - PX(tw) / 2;
    const fTenonW = PX(tw);

    return (
      <g>
        <defs>
          <Hatching id={hatchId} color="#7a5a2c" />
        </defs>
        <rect x={fMx} y={fMy} width={fMw} height={fMh} fill={COLOR.MORTISE} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        <rect x={fMx} y={fMy} width={fTenonX - fMx} height={fMh} fill={`url(#${hatchId})`} stroke="none" />
        <rect x={fTenonX + fTenonW} y={fMy} width={fMx + fMw - (fTenonX + fTenonW)} height={fMh} fill={`url(#${hatchId})`} stroke="none" />
        <line x1={fTenonX} y1={fMy} x2={fTenonX} y2={fMy + fMh} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        <line x1={fTenonX + fTenonW} y1={fMy} x2={fTenonX + fTenonW} y2={fMy + fMh} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        <rect x={fLx} y={fMy + fMh} width={PX(cw)} height={PX(legBodyMm)} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        <rect x={fTenonX} y={fMy - PX(1)} width={fTenonW} height={fMh + PX(1)} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        {/* 楔片 */}
        {(() => {
          const w1 = fTenonX + fTenonW * 0.28;
          const w2 = fTenonX + fTenonW * 0.72;
          const top = fMy - PX(1);
          const kerfBot = top + fMh * 0.6;
          const wedgeBase = fTenonW * 0.12;
          const wedgeH = 8;
          return (
            <g>
              <HiddenEdge x1={w1} y1={top} x2={w1} y2={kerfBot} />
              <HiddenEdge x1={w2} y1={top} x2={w2} y2={kerfBot} />
              <polygon points={`${w1 - wedgeBase},${top - wedgeH} ${w1 + wedgeBase},${top - wedgeH} ${w1},${top}`} fill="#a85" stroke={COLOR.OUTLINE} strokeWidth={STROKE.HIDDEN} />
              <polygon points={`${w2 - wedgeBase},${top - wedgeH} ${w2 + wedgeBase},${top - wedgeH} ${w2},${top}`} fill="#a85" stroke={COLOR.OUTLINE} strokeWidth={STROKE.HIDDEN} />
            </g>
          );
        })()}
        <CenterLine x1={fMx - 6} y1={fMy + fMh / 2} x2={fMx + fMw + 6} y2={fMy + fMh / 2} />
        <CenterLine x1={fCx} y1={fMy - 12} x2={fCx} y2={fMy + fMh + PX(legBodyMm) + 6} />
        <SectionMark x={fMx - 14} y={fMy + fMh / 2} label="A" direction="right" />
        <SectionMark x={fMx + fMw + 14} y={fMy + fMh / 2} label="A" direction="left" />
        <DimLine x1={fTenonX} y1={fMy} x2={fTenonX + fTenonW} y2={fMy} label={`${tw}`}
          side={safeDimSide("top", `${tw}`, { x: fTenonX + fTenonW / 2, y: fMy }, qBounds)} />
        <DimLine x1={fLx} y1={fMy + fMh + PX(legBodyMm)} x2={fLx + PX(cw)} y2={fMy + fMh + PX(legBodyMm)} label={`${cw}`}
          side={safeDimSide("bottom", `${cw}`, { x: fLx + PX(cw) / 2, y: fMy + fMh + PX(legBodyMm) }, qBounds)} />
        <DimLine x1={fMx + fMw} y1={fMy} x2={fMx + fMw} y2={fMy + fMh} label={`${mt}`}
          side={safeDimSide("right", `${mt}`, { x: fMx + fMw, y: fMy + fMh / 2 }, qBounds)} />
        <GrainArrow x={fMx + 8} y={fMy + fMh / 2 - 4} length={Math.min(60, fMw - 16)} angle={0} />
        <GrainArrow x={fLx - 14} y={fMy + fMh + 8} length={Math.min(50, PX(legBodyMm) - 16)} angle={90} />
      </g>
    );
  })();

  // ============================ SIDE view ============================
  const side = (() => {
    const objW = PX(panelWMm);
    const objH = PX(mt + legBodyMm);
    const place = placeInQuadrant({ w: objW, h: objH });
    const sCx = place.x + objW / 2;
    const sMx = place.x;
    const sMy = place.y;
    const sLx = sCx - PX(ct) / 2;
    const sTenonX = sCx - PX(tt) / 2;
    const sTenonW = PX(tt);

    return (
      <g>
        <rect x={sMx} y={sMy} width={objW} height={PX(mt)} fill={COLOR.MORTISE} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        <line x1={sTenonX} y1={sMy} x2={sTenonX} y2={sMy + PX(mt)} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        <line x1={sTenonX + sTenonW} y1={sMy} x2={sTenonX + sTenonW} y2={sMy + PX(mt)} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        <rect x={sLx} y={sMy + PX(mt)} width={PX(ct)} height={PX(legBodyMm)} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        <rect x={sTenonX} y={sMy - PX(1)} width={sTenonW} height={PX(mt) + PX(1)} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        <CenterLine x1={sMx - 6} y1={sMy + PX(mt) / 2} x2={sMx + objW + 6} y2={sMy + PX(mt) / 2} />
        <CenterLine x1={sCx} y1={sMy - 12} x2={sCx} y2={sMy + PX(mt) + PX(legBodyMm) + 6} />
        <DimLine x1={sTenonX} y1={sMy} x2={sTenonX + sTenonW} y2={sMy} label={`${tt}`}
          side={safeDimSide("top", `${tt}`, { x: sTenonX + sTenonW / 2, y: sMy }, qBounds)} />
        <DimLine x1={sLx} y1={sMy + PX(mt) + PX(legBodyMm)} x2={sLx + PX(ct)} y2={sMy + PX(mt) + PX(legBodyMm)} label={`${ct}`}
          side={safeDimSide("bottom", `${ct}`, { x: sLx + PX(ct) / 2, y: sMy + PX(mt) + PX(legBodyMm) }, qBounds)} />
        <DimLine x1={sMx + objW} y1={sMy} x2={sMx + objW} y2={sMy + PX(mt)} label={`${mt}`}
          side={safeDimSide("right", `${mt}`, { x: sMx + objW, y: sMy + PX(mt) / 2 }, qBounds)} />
        <GrainArrow x={sMx + 8} y={sMy + PX(mt) / 2 - 4} length={Math.min(60, objW - 16)} angle={0} />
        <GrainArrow x={sLx - 14} y={sMy + PX(mt) + 8} length={Math.min(50, PX(legBodyMm) - 16)} angle={90} />
      </g>
    );
  })();

  // ============================ TOP view ============================
  const top = (() => {
    const panelDMm = cw * 2.2;
    const tBbox = { w: panelWMm, h: panelDMm };
    const ts = unifiedFitScale(tBbox);
    const TPX = (mm: number) => mm * ts;
    const objW = TPX(panelWMm);
    const objH = TPX(panelDMm);
    const place = placeInQuadrant({ w: objW, h: objH });
    const tCx = place.x + objW / 2;
    const tCy = place.y + objH / 2;

    return (
      <g>
        {(() => {
          if (isRound) {
            const rOuter = TPX(cw) / 2;
            const rTenon = TPX(dRound) / 2;
            return (
              <g>
                <circle cx={tCx} cy={tCy} r={rOuter} fill={COLOR.MORTISE} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
                <circle cx={tCx} cy={tCy} r={rTenon} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
                <line x1={tCx - rTenon * 0.55} y1={tCy - rTenon} x2={tCx - rTenon * 0.55} y2={tCy + rTenon} stroke={COLOR.OUTLINE} strokeWidth={STROKE.HIDDEN} />
                <line x1={tCx + rTenon * 0.55} y1={tCy - rTenon} x2={tCx + rTenon * 0.55} y2={tCy + rTenon} stroke={COLOR.OUTLINE} strokeWidth={STROKE.HIDDEN} />
                <CenterLine x1={tCx - rOuter - 12} y1={tCy} x2={tCx + rOuter + 12} y2={tCy} />
                <CenterLine x1={tCx} y1={tCy - rOuter - 12} x2={tCx} y2={tCy + rOuter + 12} />
                <DimLine x1={tCx - rOuter} y1={tCy + rOuter} x2={tCx + rOuter} y2={tCy + rOuter} label={`Ø${cw}`}
                  side={safeDimSide("bottom", `Ø${cw}`, { x: tCx, y: tCy + rOuter }, qBounds)} />
                <DimLine x1={tCx - rTenon} y1={tCy - rOuter} x2={tCx + rTenon} y2={tCy - rOuter} label={`Ø${dRound}`}
                  side={safeDimSide("top", `Ø${dRound}`, { x: tCx, y: tCy - rOuter }, qBounds)} />
              </g>
            );
          }
          const mx = place.x;
          const my = place.y;
          const lx = tCx - TPX(cw) / 2;
          const ly = tCy - TPX(ct) / 2;
          const ttx = tCx - TPX(tw) / 2;
          const tty = tCy - TPX(tt) / 2;
          return (
            <g>
              <rect x={mx} y={my} width={objW} height={objH} fill={COLOR.MORTISE} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
              <rect x={lx} y={ly} width={TPX(cw)} height={TPX(ct)} fill="none" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} strokeDasharray={DASH.HIDDEN} />
              <rect x={ttx} y={tty} width={TPX(tw)} height={TPX(tt)} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
              <line x1={ttx + TPX(tw) * 0.28} y1={tty} x2={ttx + TPX(tw) * 0.28} y2={tty + TPX(tt)} stroke={COLOR.OUTLINE} strokeWidth={STROKE.HIDDEN} />
              <line x1={ttx + TPX(tw) * 0.72} y1={tty} x2={ttx + TPX(tw) * 0.72} y2={tty + TPX(tt)} stroke={COLOR.OUTLINE} strokeWidth={STROKE.HIDDEN} />
              <CenterLine x1={mx - 6} y1={tCy} x2={mx + objW + 6} y2={tCy} />
              <CenterLine x1={tCx} y1={my - 6} x2={tCx} y2={my + objH + 6} />
              <DimLine x1={ttx} y1={my} x2={ttx + TPX(tw)} y2={my} label={`${tw}`}
                side={safeDimSide("top", `${tw}`, { x: ttx + TPX(tw) / 2, y: my }, qBounds)} />
              <DimLine x1={mx + objW} y1={tty} x2={mx + objW} y2={tty + TPX(tt)} label={`${tt}`}
                side={safeDimSide("right", `${tt}`, { x: mx + objW, y: tty + TPX(tt) / 2 }, qBounds)} />
              <DimLine x1={mx} y1={my + objH} x2={mx + objW} y2={my + objH} label={`${Math.round(panelWMm)}`}
                side={safeDimSide("bottom", `${Math.round(panelWMm)}`, { x: mx + objW / 2, y: my + objH }, qBounds)} />
            </g>
          );
        })()}
      </g>
    );
  })();

  // ============================ ISO view ============================
  const iso = (() => {
    const motherW = panelWMm * 0.55;
    const motherH = mt;
    const motherD = panelWMm * 0.45;
    const childW = cw;
    const childH = legBodyMm;
    const childD = ct;
    const isoBbox = { w: motherW + childW, h: motherH + childH + 80, d: Math.max(motherD, childD) };
    const isoS = unifiedFitScale(isoBbox, { targetUsage: 0.65 });
    const center = { x: QUADRANT.W / 2, y: (QUADRANT.H - QUADRANT.HEADER_H) / 2 };
    const explodeGap = 80;
    const oxC = center.x - (childW * isoS) / 2 - 60;
    const oyC = center.y + 20;
    const oxM = center.x - (motherW * isoS) / 2 + 60;
    const oyM = oyC - (motherH * isoS) - explodeGap;

    return (
      <g>
        <g transform={`translate(${oxM} ${oyM}) scale(${isoS})`}>
          <IsoCuboid x={0} y={0} z={0} w={motherW} h={motherH} d={motherD}
            fillFront={ISO_FILL.MORTISE_FRONT} fillTop={ISO_FILL.MORTISE_TOP} fillSide={ISO_FILL.MORTISE_SIDE}
            strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / Math.max(0.4, isoS)} />
          <IsoMortise faceX={motherW / 2} faceY={0} faceZ={motherD / 2}
            width={tw} height={tt} depth={mt} faceNormal="+y" through={true}
            stroke={COLOR.OUTLINE} strokeWidth={ISO_STROKE.EDGE_INTERIOR / Math.max(0.4, isoS)} />
        </g>
        <g transform={`translate(${oxC} ${oyC}) scale(${isoS})`}>
          <IsoCuboid x={0} y={0} z={0} w={childW} h={childH} d={childD}
            fillFront={ISO_FILL.TENON_FRONT} fillTop={ISO_FILL.TENON_TOP} fillSide={ISO_FILL.TENON_SIDE}
            strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / Math.max(0.4, isoS)} />
          {!isRound ? (
            <IsoTenon baseX={childW / 2} baseY={0} baseZ={childD / 2}
              width={tw} thickness={tt} length={tl} direction="-y"
              fillFront={ISO_FILL.TENON_FRONT} fillTop={ISO_FILL.TENON_TOP} fillSide={ISO_FILL.TENON_SIDE}
              strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / Math.max(0.4, isoS)}
              embeddedLength={mt} />
          ) : (
            <IsoCylinder x={childW / 2} y={0} z={childD / 2}
              radius={dRound / 2} height={tl} axis="y"
              fillCap={ISO_FILL.TENON_FRONT} fillSide={ISO_FILL.TENON_SIDE}
              strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / Math.max(0.4, isoS)} />
          )}
        </g>
        {/* 拆解箭頭 */}
        {(() => {
          const fromX = oxM + (motherW / 2) * isoS + (motherD / 2) * isoS * ISO.COS30 * ISO.DEPTH_SCALE;
          const fromY = oyM + motherH * isoS + 4;
          const toX = oxC + (childW / 2) * isoS + (childD / 2) * isoS * ISO.COS30 * ISO.DEPTH_SCALE;
          const toY = oyC - tl * isoS - 2;
          const ang = Math.atan2(toY - fromY, toX - fromX);
          const ah = 6;
          const a1x = toX - ah * Math.cos(ang - Math.PI / 6);
          const a1y = toY - ah * Math.sin(ang - Math.PI / 6);
          const a2x = toX - ah * Math.cos(ang + Math.PI / 6);
          const a2y = toY - ah * Math.sin(ang + Math.PI / 6);
          return (
            <g stroke={COLOR.DIM} fill={COLOR.DIM}>
              <line x1={fromX} y1={fromY} x2={toX} y2={toY} strokeWidth={STROKE.HIDDEN} strokeDasharray={ISO_DASH.HIDDEN} />
              <polygon points={`${toX},${toY} ${a1x},${a1y} ${a2x},${a2y}`} />
            </g>
          );
        })()}
      </g>
    );
  })();

  const scaleStr = s >= 1 ? `${Math.round(s)}:1` : `1:${Math.max(1, Math.round(1 / s))}`;

  return (
    <MasterDetailLayout
      type="through-tenon"
      joineryNameZh={isRound ? "通榫（圓榫變體）" : "通榫"}
      drawingNumber={`TT-${tw}x${tt}x${tl}`}
      scale={scaleStr}
      frontView={front}
      sideView={side}
      topView={top}
      isoView={iso}
      warnings={[
        `貫穿端應微凸 1mm 後修平`,
        `楔片厚 ≈ ${Math.round(tw * 0.12)}mm`,
      ]}
    />
  );
}
/* === END through-tenon-detail v2 === */

/* === BEGIN blind-tenon-detail v2 (Wave 2b Group A) === */
function BlindTenonDetail(p: JoineryDetailParams) {
  const tl = p.tenonLength;
  const tw = p.tenonWidth;
  const tt = p.tenonThickness;
  const mt = p.motherThickness;
  const ct = p.childThickness ?? tt;
  const cw = p.childWidth ?? tw;
  const safeTl = Math.min(tl, Math.max(3, mt - 3));
  const wasClamped = safeTl !== tl;
  const baseRest = mt - safeTl;
  const isRound = p.motherShape === "round";

  const apronLenMm = Math.max(cw * 2.5, mt * 2);
  const sharedBbox = { w: mt + apronLenMm, h: Math.max(cw * 3.5, mt * 1.5) };
  const s = unifiedFitScale(sharedBbox);
  const PX = (mm: number) => mm * s;

  const qBounds = { x: 0, y: 0, w: QUADRANT.W, h: QUADRANT.H - QUADRANT.HEADER_H };
  const HIDDEN_BOLD_COLOR = COLOR.DIM_TICK;
  const HIDDEN_BOLD_STROKE = 1.6;
  const HIDDEN_BOLD_DASH = "5 3";
  const hatchId = "hatch-blind-v2";

  // ============================ FRONT view ============================
  const front = (() => {
    const objW = PX(mt + apronLenMm);
    const objH = PX(Math.min(cw * 3.5, sharedBbox.h));
    const place = placeInQuadrant({ w: objW, h: objH });
    const fLegX = place.x + 4;
    const fLegW = PX(mt);
    const fLegH = objH;
    const fLegY = place.y;
    const fApronY = fLegY + fLegH / 2 - PX(cw) / 2;
    const fApronH = PX(cw);
    const fApronX0 = fLegX + fLegW;
    const fApronW = PX(apronLenMm);
    const fTenonY = fLegY + fLegH / 2 - PX(tw) / 2;
    const fTenonH = PX(tw);
    const fTenonW = PX(safeTl);
    const fTenonX = fLegX + fLegW - fTenonW;

    return (
      <g>
        <defs>
          <Hatching id={hatchId} color="#7a5a2c" />
        </defs>
        <rect x={fLegX} y={fLegY} width={fLegW} height={fLegH} fill={COLOR.MORTISE} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        <rect x={fTenonX} y={fTenonY} width={fTenonW} height={fTenonH}
          fill="none" stroke={HIDDEN_BOLD_COLOR} strokeWidth={HIDDEN_BOLD_STROKE} strokeDasharray={HIDDEN_BOLD_DASH} />
        <rect x={fApronX0} y={fApronY} width={fApronW} height={fApronH} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        <line x1={fApronX0} y1={fApronY} x2={fApronX0} y2={fApronY + fApronH} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        {fApronH > fTenonH + 4 && (
          <>
            <line x1={fApronX0} y1={fTenonY} x2={fApronX0 + Math.min(fApronW * 0.4, PX(safeTl) * 1.2)} y2={fTenonY}
              stroke={HIDDEN_BOLD_COLOR} strokeWidth={HIDDEN_BOLD_STROKE} strokeDasharray={HIDDEN_BOLD_DASH} />
            <line x1={fApronX0} y1={fTenonY + fTenonH} x2={fApronX0 + Math.min(fApronW * 0.4, PX(safeTl) * 1.2)} y2={fTenonY + fTenonH}
              stroke={HIDDEN_BOLD_COLOR} strokeWidth={HIDDEN_BOLD_STROKE} strokeDasharray={HIDDEN_BOLD_DASH} />
          </>
        )}
        <CenterLine x1={fLegX - 10} y1={fLegY + fLegH / 2} x2={fApronX0 + fApronW + 10} y2={fLegY + fLegH / 2} />
        <CenterLine x1={fLegX + fLegW / 2} y1={fLegY - 10} x2={fLegX + fLegW / 2} y2={fLegY + fLegH + 10} />
        <SectionMark x={fLegX - 14} y={fLegY + fLegH / 2} label="A" direction="right" />
        <SectionMark x={fApronX0 + fApronW + 14} y={fLegY + fLegH / 2} label="A" direction="left" />
        <text x={fTenonX + fTenonW / 2} y={fTenonY - 4} fontSize={FONT.CALLOUT} textAnchor="middle" fill={HIDDEN_BOLD_COLOR} fontWeight="bold">
          榫眼/榫頭（隱藏）
        </text>
        <DimLine x1={fLegX} y1={fTenonY} x2={fLegX} y2={fTenonY + fTenonH} label={`${tw}`}
          side={safeDimSide("left", `${tw}`, { x: fLegX, y: fTenonY + fTenonH / 2 }, qBounds)} />
        <DimLine x1={fTenonX} y1={fLegY} x2={fLegX + fLegW} y2={fLegY} label={`${safeTl}`}
          side={safeDimSide("top", `${safeTl}`, { x: (fTenonX + fLegX + fLegW) / 2, y: fLegY }, qBounds)} />
        <DimLine x1={fLegX} y1={fLegY + fLegH} x2={fLegX + fLegW} y2={fLegY + fLegH} label={`${mt}`}
          side={safeDimSide("bottom", `${mt}`, { x: fLegX + fLegW / 2, y: fLegY + fLegH }, qBounds)} />
        <GrainArrow x={fLegX + fLegW / 2 - 10} y={fLegY + 8} length={Math.min(60, fLegH - 16)} angle={90} />
        <GrainArrow x={fApronX0 + 8} y={fApronY - 10} length={Math.min(60, fApronW - 16)} angle={0} />
      </g>
    );
  })();

  // ============================ SIDE view ============================
  const side = (() => {
    const objW = PX(mt);
    const objH = PX(Math.min(cw * 3.5, sharedBbox.h));
    const place = placeInQuadrant({ w: objW, h: objH });
    const sLegX = place.x;
    const sLegY = place.y;
    const sLegW = objW;
    const sLegH = objH;
    const sMortW = PX(tt);
    const sMortH = PX(tw);
    const sMortX = sLegX + sLegW / 2 - sMortW / 2;
    const sMortY = sLegY + sLegH / 2 - sMortH / 2;
    const sApronY = sLegY + sLegH / 2 - PX(ct) / 2;
    const sApronH = PX(ct);

    return (
      <g>
        <rect x={sLegX} y={sLegY} width={sLegW} height={sLegH} fill={COLOR.MORTISE} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        <rect x={sMortX} y={sMortY} width={sMortW} height={sMortH}
          fill="none" stroke={HIDDEN_BOLD_COLOR} strokeWidth={HIDDEN_BOLD_STROKE} strokeDasharray={HIDDEN_BOLD_DASH} />
        <rect x={sLegX + sLegW / 2 - sMortW / 2 - PX(Math.max(0, ct - tt) / 2)} y={sApronY}
          width={Math.max(sMortW, PX(ct))} height={sApronH}
          fill="none" stroke={COLOR.HIDDEN} strokeWidth={STROKE.HIDDEN} strokeDasharray="3 2" />
        <CenterLine x1={sLegX - 10} y1={sLegY + sLegH / 2} x2={sLegX + sLegW + 10} y2={sLegY + sLegH / 2} />
        <CenterLine x1={sLegX + sLegW / 2} y1={sLegY - 10} x2={sLegX + sLegW / 2} y2={sLegY + sLegH + 10} />
        <text x={sMortX + sMortW / 2} y={sMortY - 4} fontSize={FONT.CALLOUT} textAnchor="middle" fill={HIDDEN_BOLD_COLOR} fontWeight="bold">
          榫眼/榫頭（隱藏）
        </text>
        <text x={sMortX + sMortW / 2} y={sMortY + sMortH + 14} fontSize={FONT.CALLOUT} textAnchor="middle" fill={HIDDEN_BOLD_COLOR}>
          ⊗ 向內延伸 {safeTl}mm
        </text>
        <DimLine x1={sMortX} y1={sLegY} x2={sMortX + sMortW} y2={sLegY} label={`${tt}`}
          side={safeDimSide("top", `${tt}`, { x: sMortX + sMortW / 2, y: sLegY }, qBounds)} />
        <DimLine x1={sLegX} y1={sMortY} x2={sLegX} y2={sMortY + sMortH} label={`${tw}`}
          side={safeDimSide("left", `${tw}`, { x: sLegX, y: sMortY + sMortH / 2 }, qBounds)} />
        <DimLine x1={sLegX + sLegW} y1={sApronY} x2={sLegX + sLegW} y2={sApronY + sApronH} label={`${ct}`}
          side={safeDimSide("right", `${ct}`, { x: sLegX + sLegW, y: sApronY + sApronH / 2 }, qBounds)} />
        <DimLine x1={sLegX} y1={sLegY + sLegH} x2={sLegX + sLegW} y2={sLegY + sLegH} label={`${mt}`}
          side={safeDimSide("bottom", `${mt}`, { x: sLegX + sLegW / 2, y: sLegY + sLegH }, qBounds)} />
        <GrainArrow x={sLegX + sLegW / 2 - 10} y={sLegY + 8} length={Math.min(60, sLegH - 16)} angle={90} />
      </g>
    );
  })();

  // ============================ TOP view ============================
  const top = (() => {
    const tBbox = { w: mt + apronLenMm, h: Math.max(mt, ct) };
    const ts = unifiedFitScale(tBbox);
    const TPX = (mm: number) => mm * ts;
    const objW = TPX(tBbox.w);
    const objH = TPX(mt);
    const place = placeInQuadrant({ w: objW, h: objH });
    const tLegSide = TPX(mt);
    const tLegX = place.x;
    const tCy = place.y + objH / 2;
    const tLegY = tCy - tLegSide / 2;
    const tApronX = tLegX + tLegSide;
    const tApronLen = TPX(apronLenMm);
    const tApronH = TPX(ct);
    const tApronY = tCy - tApronH / 2;
    const tTenonW = TPX(safeTl);
    const tTenonH = TPX(tt);
    const tTenonX = tLegX + tLegSide - tTenonW;
    const tTenonY = tCy - tTenonH / 2;

    return (
      <g>
        {(() => {
          if (isRound) {
            const r = tLegSide / 2;
            const cx = tLegX + r;
            return (
              <g>
                <circle cx={cx} cy={tCy} r={r} fill={`url(#${hatchId})`} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
                <rect x={tTenonX} y={tTenonY} width={tTenonW} height={tTenonH} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
                <rect x={tApronX} y={tApronY} width={tApronLen} height={tApronH} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
                <CenterLine x1={cx - r - 10} y1={tCy} x2={tApronX + tApronLen + 10} y2={tCy} />
                <CenterLine x1={cx} y1={tCy - r - 10} x2={cx} y2={tCy + r + 10} />
                <DimLine x1={cx - r} y1={tCy - r} x2={cx + r} y2={tCy - r} label={`Ø${mt}`}
                  side={safeDimSide("top", `Ø${mt}`, { x: cx, y: tCy - r }, qBounds)} />
                <DimLine x1={tTenonX} y1={tCy + r} x2={cx + r} y2={tCy + r} label={`${safeTl}`}
                  side={safeDimSide("bottom", `${safeTl}`, { x: (tTenonX + cx + r) / 2, y: tCy + r }, qBounds)} />
                <DimLine x1={tApronX + tApronLen} y1={tApronY} x2={tApronX + tApronLen} y2={tApronY + tApronH} label={`${ct}`}
                  side={safeDimSide("right", `${ct}`, { x: tApronX + tApronLen, y: tApronY + tApronH / 2 }, qBounds)} />
              </g>
            );
          }
          const legPath =
            `M${tLegX} ${tLegY} ` +
            `L${tLegX + tLegSide} ${tLegY} ` +
            `L${tLegX + tLegSide} ${tTenonY} ` +
            `L${tTenonX} ${tTenonY} ` +
            `L${tTenonX} ${tTenonY + tTenonH} ` +
            `L${tLegX + tLegSide} ${tTenonY + tTenonH} ` +
            `L${tLegX + tLegSide} ${tLegY + tLegSide} ` +
            `L${tLegX} ${tLegY + tLegSide} Z`;
          return (
            <g>
              <path d={legPath} fill={`url(#${hatchId})`} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
              <rect x={tTenonX} y={tTenonY} width={tTenonW} height={tTenonH} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
              <rect x={tApronX} y={tApronY} width={tApronLen} height={tApronH} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
              <text x={tTenonX - 4} y={tTenonY - 4} fontSize={FONT.CALLOUT} textAnchor="end" fill={HIDDEN_BOLD_COLOR} fontWeight="bold">
                榫眼底
              </text>
              <CenterLine x1={tLegX - 10} y1={tCy} x2={tApronX + tApronLen + 10} y2={tCy} />
              <CenterLine x1={tLegX + tLegSide / 2} y1={tLegY - 10} x2={tLegX + tLegSide / 2} y2={tLegY + tLegSide + 10} />
              <DimLine x1={tLegX} y1={tLegY} x2={tLegX + tLegSide} y2={tLegY} label={`${mt}`}
                side={safeDimSide("top", `${mt}`, { x: tLegX + tLegSide / 2, y: tLegY }, qBounds)} />
              <DimLine x1={tTenonX} y1={tLegY + tLegSide} x2={tLegX + tLegSide} y2={tLegY + tLegSide} label={`${safeTl}`}
                side={safeDimSide("bottom", `${safeTl}`, { x: (tTenonX + tLegX + tLegSide) / 2, y: tLegY + tLegSide }, qBounds)} />
              <DimLine x1={tApronX + tApronLen} y1={tApronY} x2={tApronX + tApronLen} y2={tApronY + tApronH} label={`${ct}`}
                side={safeDimSide("right", `${ct}`, { x: tApronX + tApronLen, y: tApronY + tApronH / 2 }, qBounds)} />
              <DimLine x1={tLegX} y1={tTenonY} x2={tLegX} y2={tTenonY + tTenonH} label={`${tt}`}
                side={safeDimSide("left", `${tt}`, { x: tLegX, y: tTenonY + tTenonH / 2 }, qBounds)} />
            </g>
          );
        })()}
      </g>
    );
  })();

  // ============================ ISO view ============================
  const iso = (() => {
    const motherW = mt;
    const motherH = cw * 2.5;
    const motherD = mt;
    const childLen = Math.max(cw * 2.0, safeTl * 4);
    const childH = cw;
    const childD = ct;
    const isoBbox = { w: motherW + childLen, h: motherH, d: Math.max(motherD, childD) };
    const isoS = unifiedFitScale(isoBbox, { targetUsage: 0.6 });
    const center = { x: QUADRANT.W / 2, y: (QUADRANT.H - QUADRANT.HEADER_H) / 2 };
    const oxM = center.x - ((motherW + childLen) * isoS) / 2 - 20;
    const oyM = center.y - (motherH * isoS) / 2;
    const explodeGap = (motherW + safeTl + 30) * isoS + 20;
    const oxC = oxM + motherW * isoS + explodeGap;
    const oyC = oyM + ((motherH - childH) / 2) * isoS;

    return (
      <g>
        <g transform={`translate(${oxM} ${oyM}) scale(${isoS})`}>
          {!isRound ? (
            <IsoCuboid x={0} y={0} z={0} w={motherW} h={motherH} d={motherD}
              fillFront={ISO_FILL.MORTISE_FRONT} fillTop={ISO_FILL.MORTISE_TOP} fillSide={ISO_FILL.MORTISE_SIDE}
              strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / Math.max(0.4, isoS)} />
          ) : (
            <IsoCylinder x={motherW / 2} y={0} z={motherW / 2}
              radius={motherW / 2} height={motherH} axis="y"
              fillSide={ISO_FILL.MORTISE_FRONT} fillCap={ISO_FILL.MORTISE_TOP}
              strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / Math.max(0.4, isoS)} />
          )}
          <IsoMortise faceX={motherW} faceY={motherH / 2} faceZ={motherD / 2}
            width={tt} height={tw} depth={safeTl} faceNormal="+x" through={false}
            stroke={COLOR.OUTLINE} strokeWidth={ISO_STROKE.EDGE_INTERIOR / Math.max(0.4, isoS)} />
        </g>
        <g transform={`translate(${oxC} ${oyC}) scale(${isoS})`}>
          <IsoCuboid x={0} y={0} z={0} w={childLen} h={childH} d={childD}
            fillFront={ISO_FILL.TENON_FRONT} fillTop={ISO_FILL.TENON_TOP} fillSide={ISO_FILL.TENON_SIDE}
            strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / Math.max(0.4, isoS)} />
          <IsoTenon baseX={0} baseY={childH / 2} baseZ={childD / 2}
            width={tt} thickness={tw} length={safeTl} direction="-x"
            fillFront={ISO_FILL.TENON_FRONT} fillTop={ISO_FILL.TENON_TOP} fillSide={ISO_FILL.TENON_SIDE}
            strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / Math.max(0.4, isoS)}
            embeddedLength={safeTl} />
        </g>
        <line x1={oxC - 4} y1={oyC + (childH / 2) * isoS}
          x2={oxM + motherW * isoS + 4} y2={oyM + (motherH / 2) * isoS}
          stroke={COLOR.DIM} strokeWidth={STROKE.DIM} strokeDasharray="4 3" />
      </g>
    );
  })();

  const scaleStr = s >= 1 ? `${Math.round(s)}:1` : `1:${Math.max(1, Math.round(1 / s))}`;

  return (
    <MasterDetailLayout
      type="blind-tenon"
      joineryNameZh={isRound ? "盲榫（圓腳變體）" : "半隱榫（盲榫）"}
      drawingNumber={`BT-${tw}x${tt}x${safeTl}`}
      scale={scaleStr}
      frontView={front}
      sideView={side}
      topView={top}
      isoView={iso}
      warnings={
        wasClamped
          ? [`榫長需 ≤ 母厚 - 3mm（已自動 clamp ${tl}→${safeTl}）`, `留底厚 ${baseRest}mm`]
          : [`白膠須塗滿榫眼底面`, `留底厚 ≈ ${Math.round(baseRest)}mm`]
      }
    />
  );
}
/* === END blind-tenon-detail v2 === */

/* === BEGIN half-lap-detail v2 (Wave 2b Group A) === */
function HalfLapDetail(p: JoineryDetailParams) {
  const tl = p.tenonLength;
  const mt = p.motherThickness;
  const ct = p.childThickness ?? mt;
  const cw = p.childWidth ?? mt * 4;

  const ratio = cw / Math.max(1, mt);
  const lapForm: "cross" | "tee" | "ell" =
    ratio < 0.6 ? "ell" : Math.abs(ratio - 1) < 0.35 ? "cross" : "tee";
  const lapFormZh = lapForm === "cross" ? "十字搭" : lapForm === "tee" ? "T 字搭" : "L 字搭";

  const cutDepthA = mt / 2;
  const cutDepthB = ct / 2;

  const sharedBbox = { w: cw + tl * 2, h: Math.max(mt, tl) * 3 };
  const s = unifiedFitScale(sharedBbox);
  const PX = (mm: number) => mm * s;

  const qBounds = { x: 0, y: 0, w: QUADRANT.W, h: QUADRANT.H - QUADRANT.HEADER_H };
  const hatchId = "hatch-halflap-v2";

  // ===== FRONT view =====
  const front = (() => {
    const frontPieceLenMm = Math.max(tl * 4, mt * 4);
    const fBbox = { w: frontPieceLenMm, h: mt };
    const fs = unifiedFitScale(fBbox);
    const FPX = (mm: number) => mm * fs;
    const objW = FPX(frontPieceLenMm);
    const objH = FPX(mt);
    const place = placeInQuadrant({ w: objW, h: objH * 2.5 });
    const frontA_x = place.x;
    const frontA_y = place.y + objH;
    const lapStartX = frontA_x + objW - FPX(tl);
    const lapEndX = frontA_x + objW;

    return (
      <g>
        <defs>
          <Hatching id={hatchId} color={COLOR.SECTION_HATCH} />
        </defs>
        <path
          d={`M${frontA_x} ${frontA_y} L${lapStartX} ${frontA_y} L${lapStartX} ${frontA_y + cutDepthA * fs} L${lapEndX} ${frontA_y + cutDepthA * fs} L${lapEndX} ${frontA_y + FPX(mt)} L${frontA_x} ${frontA_y + FPX(mt)} Z`}
          fill={COLOR.MORTISE} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        <rect x={frontA_x} y={frontA_y} width={lapStartX - frontA_x} height={FPX(mt)} fill={`url(#${hatchId})`} stroke="none" />
        <rect x={lapStartX} y={frontA_y - FPX(mt) + cutDepthA * fs} width={FPX(tl)}
          height={FPX(mt) - cutDepthA * fs + cutDepthB * fs}
          fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        <line x1={lapStartX} y1={frontA_y + cutDepthA * fs} x2={lapEndX} y2={frontA_y + cutDepthA * fs}
          stroke={COLOR.DIM_TICK} strokeWidth={1.6} strokeDasharray="5 3" fill="none" />
        {cutDepthB * fs < FPX(mt) && (
          <line x1={lapStartX} y1={frontA_y + cutDepthB * fs} x2={lapEndX} y2={frontA_y + cutDepthB * fs}
            stroke={COLOR.DIM_TICK} strokeWidth={1.6} strokeDasharray="5 3" fill="none" />
        )}
        <text x={(lapStartX + lapEndX) / 2} y={frontA_y + cutDepthA * fs - 4}
          fontSize={FONT.CALLOUT} textAnchor="middle" fill={COLOR.DIM_TICK} fontWeight="bold">
          搭接介面（隱藏）
        </text>
        <CenterLine x1={frontA_x - 10} y1={frontA_y + FPX(mt) / 2} x2={lapEndX + 10} y2={frontA_y + FPX(mt) / 2} />
        <GrainArrow x={frontA_x + 6} y={frontA_y - 12} length={Math.min(60, objW / 3)} angle={0} />
        <SectionMark x={(lapStartX + lapEndX) / 2} y={frontA_y - 16} label="A" direction="down" />
        <SectionMark x={(lapStartX + lapEndX) / 2} y={frontA_y + FPX(mt) + 16} label="A" direction="up" />
        <DimLine x1={lapStartX} y1={frontA_y + FPX(mt)} x2={lapEndX} y2={frontA_y + FPX(mt)} label={`搭長 ${tl}`}
          side={safeDimSide("bottom", `搭長 ${tl}`, { x: (lapStartX + lapEndX) / 2, y: frontA_y + FPX(mt) }, qBounds)} />
        <DimLine x1={frontA_x} y1={frontA_y} x2={frontA_x} y2={frontA_y + FPX(mt)} label={`板厚 ${mt}`}
          side={safeDimSide("left", `板厚 ${mt}`, { x: frontA_x, y: frontA_y + FPX(mt) / 2 }, qBounds)} />
        <DimLine x1={lapEndX} y1={frontA_y - FPX(mt) + cutDepthA * fs} x2={lapEndX} y2={frontA_y + cutDepthA * fs}
          label={`削厚 ${Math.round(cutDepthB)}`}
          side={safeDimSide("right", `削厚 ${Math.round(cutDepthB)}`, { x: lapEndX, y: frontA_y - FPX(mt) / 2 + cutDepthA * fs }, qBounds)} />
      </g>
    );
  })();

  // ===== SIDE view =====
  const side = (() => {
    const sBbox = { w: cw, h: mt * 3 };
    const ss = unifiedFitScale(sBbox);
    const SPX = (mm: number) => mm * ss;
    const aLen = SPX(cw);
    const sideA_h = SPX(mt);
    const sideB_w = SPX(ct);
    const place = placeInQuadrant({ w: aLen, h: SPX(mt) * 3 });
    const aX = place.x;
    const aY = place.y + sideA_h;
    const bX = aX + aLen / 2 - sideB_w / 2;
    const bTop = aY - SPX(mt) * 0.6;
    const bBottom = aY + sideA_h + SPX(mt) * 0.6;

    return (
      <g>
        <rect x={aX} y={aY} width={aLen} height={sideA_h} fill={COLOR.MORTISE} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        <rect x={bX} y={bTop} width={sideB_w} height={bBottom - bTop} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        <HiddenEdge x1={bX} y1={aY + cutDepthA * ss} x2={bX + sideB_w} y2={aY + cutDepthA * ss} />
        <CenterLine x1={aX - 10} y1={aY + sideA_h / 2} x2={aX + aLen + 10} y2={aY + sideA_h / 2} />
        <CenterLine x1={bX + sideB_w / 2} y1={bTop - 10} x2={bX + sideB_w / 2} y2={bBottom + 10} />
        <GrainArrow x={bX + sideB_w + 8} y={bTop + 4} length={Math.min(60, bBottom - bTop - 8)} angle={90} />
        <DimLine x1={aX} y1={aY + sideA_h} x2={aX + aLen} y2={aY + sideA_h} label={`板寬 ${cw}`}
          side={safeDimSide("bottom", `板寬 ${cw}`, { x: aX + aLen / 2, y: aY + sideA_h }, qBounds)} />
        <DimLine x1={bX} y1={bTop} x2={bX + sideB_w} y2={bTop} label={`B 厚 ${ct}`}
          side={safeDimSide("top", `B 厚 ${ct}`, { x: bX + sideB_w / 2, y: bTop }, qBounds)} />
      </g>
    );
  })();

  // ===== TOP view =====
  const top = (() => {
    const tBbox = { w: Math.max(tl * 4, cw), h: cw + mt * 3 };
    const ts = unifiedFitScale(tBbox);
    const TPX = (mm: number) => mm * ts;
    const tlPx = TPX(tl);
    const aWide = TPX(cw);
    const aLen = TPX(Math.max(tl * 4, cw));
    const bWide = TPX(ct);
    const objH = aWide + 30 + Math.max(tlPx * 4, 60);
    const place = placeInQuadrant({ w: aLen, h: objH });
    const ax = place.x;
    const ay = place.y;
    const bx = ax + aLen / 2 - bWide / 2;
    const by = ay + aWide + 30;

    return (
      <g>
        <rect x={ax} y={ay} width={aLen} height={aWide} fill={COLOR.MORTISE} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        {(() => {
          const slotW = lapForm === "cross" ? bWide : tlPx;
          const slotH = lapForm === "cross" ? bWide : aWide;
          const slotX = lapForm === "ell" ? ax + aLen - slotW : ax + aLen / 2 - slotW / 2;
          const slotY = lapForm === "cross" || lapForm === "tee" ? ay + aWide / 2 - slotH / 2 : ay;
          return (
            <g>
              <rect x={slotX} y={slotY} width={slotW} height={slotH} fill="white" stroke={COLOR.DIM_TICK} strokeDasharray={DASH.AUX} strokeWidth={STROKE.HIDDEN} />
              <text x={slotX + slotW / 2} y={slotY - 4} fontSize={FONT.CALLOUT} fill={COLOR.DIM_TICK} textAnchor="middle">
                切刀位
              </text>
            </g>
          );
        })()}
        <text x={ax + aLen / 2} y={ay - 6} fontSize={FONT.DIM} textAnchor="middle" fill="#666">A 件</text>
        <rect x={bx} y={by} width={bWide} height={Math.min(QUADRANT.H - QUADRANT.HEADER_H - by - 30, Math.max(tlPx * 4, 80))}
          fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        <text x={bx + bWide / 2} y={by - 6} fontSize={FONT.DIM} textAnchor="middle" fill="#666">B 件</text>
        <CenterLine x1={ax - 10} y1={ay + aWide / 2} x2={ax + aLen + 10} y2={ay + aWide / 2} />
        <DimLine x1={ax} y1={ay} x2={ax + aLen} y2={ay} label={`A 長 ${cw}`}
          side={safeDimSide("top", `A 長 ${cw}`, { x: ax + aLen / 2, y: ay }, qBounds)} />
      </g>
    );
  })();

  // ===== ISO view =====
  const iso = (() => {
    const _lapLenMm = Math.max(tl, mt * 1.4);
    const _tailLenMm = Math.max(mt * 2, _lapLenMm * 1.2);
    const _totalLenMm = _lapLenMm + _tailLenMm;
    const isoBbox = { w: _totalLenMm, h: mt * 6, d: Math.max(mt, ct) };
    const isoS = unifiedFitScale(isoBbox, { targetUsage: 0.6 });
    const center = { x: QUADRANT.W / 2, y: (QUADRANT.H - QUADRANT.HEADER_H) / 2 };

    return (
      <g>
        <g transform={`rotate(-90 ${center.x} ${center.y})`}>
          <IsometricGroup originX={center.x} originY={center.y} scale={isoS}>
            {(() => {
              const halfMt = mt / 2;
              const halfCt = ct / 2;
              const lapLen = Math.max(tl, mt * 1.4);
              const tailLen = Math.max(mt * 2, lapLen * 1.2);
              const aTotalLen = lapLen + tailLen;
              const bTotalLen = lapLen + tailLen;
              const explodeGap = mt * 2.4;
              const aDepth = mt;
              const bDepth = ct;
              const aTailX = -aTotalLen / 2;
              const aLapX = aTailX + tailLen;
              const bTailX = -bTotalLen / 2;
              const bLapX = bTailX + tailLen;
              const bYOffset = -explodeGap;

              return (
                <g>
                  <IsoCuboid x={aTailX} y={0} z={-aDepth / 2}
                    w={tailLen} h={mt} d={aDepth}
                    fillFront={ISO_FILL.MORTISE_FRONT} fillTop={ISO_FILL.MORTISE_TOP} fillSide={ISO_FILL.MORTISE_SIDE}
                    strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / Math.max(0.4, isoS)} showHiddenBackEdges={false} />
                  <IsoCuboid x={aLapX} y={halfMt} z={-aDepth / 2}
                    w={lapLen} h={halfMt} d={aDepth}
                    fillFront={ISO_FILL.MORTISE_FRONT} fillTop={ISO_FILL.MORTISE_TOP} fillSide={ISO_FILL.MORTISE_SIDE}
                    strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / Math.max(0.4, isoS)} showHiddenBackEdges={false} />
                  {(() => {
                    const g0 = isoProject(aLapX, 0, -aDepth / 2);
                    const g1 = isoProject(aLapX + lapLen, 0, -aDepth / 2);
                    const g2 = isoProject(aLapX + lapLen, halfMt, -aDepth / 2);
                    const g3 = isoProject(aLapX, halfMt, -aDepth / 2);
                    const g0b = isoProject(aLapX, 0, aDepth / 2);
                    const g1b = isoProject(aLapX + lapLen, 0, aDepth / 2);
                    const g2b = isoProject(aLapX + lapLen, halfMt, aDepth / 2);
                    const g3b = isoProject(aLapX, halfMt, aDepth / 2);
                    void g0b;
                    const f = `${g0[0]},${g0[1]} ${g1[0]},${g1[1]} ${g2[0]},${g2[1]} ${g3[0]},${g3[1]}`;
                    const t = `${g3[0]},${g3[1]} ${g2[0]},${g2[1]} ${g2b[0]},${g2b[1]} ${g3b[0]},${g3b[1]}`;
                    const sd = `${g1[0]},${g1[1]} ${g1b[0]},${g1b[1]} ${g2b[0]},${g2b[1]} ${g2[0]},${g2[1]}`;
                    return (
                      <g>
                        <polygon points={f} fill={`url(#${hatchId})`} stroke={COLOR.HIDDEN}
                          strokeWidth={ISO_STROKE.HIDDEN_DASHED / Math.max(0.4, isoS)} strokeDasharray={ISO_DASH.HIDDEN} />
                        <polygon points={t} fill="none" stroke={COLOR.HIDDEN}
                          strokeWidth={ISO_STROKE.HIDDEN_DASHED / Math.max(0.4, isoS)} strokeDasharray={ISO_DASH.HIDDEN} />
                        <polygon points={sd} fill="none" stroke={COLOR.HIDDEN}
                          strokeWidth={ISO_STROKE.HIDDEN_DASHED / Math.max(0.4, isoS)} strokeDasharray={ISO_DASH.HIDDEN} />
                      </g>
                    );
                  })()}
                  <g transform={`translate(0 ${bYOffset})`}>
                    <IsoCuboid x={bTailX} y={0} z={-bDepth / 2}
                      w={tailLen} h={ct} d={bDepth}
                      fillFront={ISO_FILL.TENON_FRONT} fillTop={ISO_FILL.TENON_TOP} fillSide={ISO_FILL.TENON_SIDE}
                      strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / Math.max(0.4, isoS)} showHiddenBackEdges={false} />
                    <IsoCuboid x={bLapX} y={0} z={-bDepth / 2}
                      w={lapLen} h={halfCt} d={bDepth}
                      fillFront={ISO_FILL.TENON_FRONT} fillTop={ISO_FILL.TENON_TOP} fillSide={ISO_FILL.TENON_SIDE}
                      strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / Math.max(0.4, isoS)} showHiddenBackEdges={false} />
                  </g>
                  {(() => {
                    const arrTop = isoProject(0, bYOffset + halfCt + 2, 0);
                    const arrBot = isoProject(0, -2, 0);
                    return (
                      <g>
                        <line x1={arrTop[0]} y1={arrTop[1]} x2={arrBot[0]} y2={arrBot[1]}
                          stroke={COLOR.DIM} strokeWidth={STROKE.OUTLINE / Math.max(0.4, isoS)} strokeDasharray={ISO_DASH.ARROW} />
                        <polygon points={`${arrBot[0]},${arrBot[1]} ${arrBot[0] - 4 / Math.max(0.4, isoS)},${arrBot[1] - 6 / Math.max(0.4, isoS)} ${arrBot[0] + 4 / Math.max(0.4, isoS)},${arrBot[1] - 6 / Math.max(0.4, isoS)}`} fill={COLOR.DIM} />
                      </g>
                    );
                  })()}
                  <g transform="translate(0 0)">
                    {(() => { void aTotalLen; void bTotalLen; return null; })()}
                  </g>
                </g>
              );
            })()}
          </IsometricGroup>
        </g>
      </g>
    );
  })();

  const scaleStr = s >= 1 ? `${Math.round(s)}:1` : `1:${Math.max(1, Math.round(1 / s))}`;

  return (
    <MasterDetailLayout
      type="half-lap"
      joineryNameZh={`半搭榫（${lapFormZh}）`}
      drawingNumber={`HL-${ct}-${cw}-${mt}`}
      scale={scaleStr}
      frontView={front}
      sideView={side}
      topView={top}
      isoView={iso}
      warnings={[
        `兩件各削一半（A 上半 ${Math.round(mt / 2)}mm + B 下半 ${Math.round(ct / 2)}mm）`,
        `咬合後總厚 = 板厚`,
      ]}
    />
  );
}
/* === END half-lap-detail v2 === */

/* === BEGIN tongue-and-groove-detail v2 (Wave 2b Group A) === */
function TongueAndGrooveDetail(p: JoineryDetailParams) {
  const mt = p.motherThickness;
  const tt = p.tenonThickness ?? Math.max(3, Math.round(mt / 3));
  const tl = p.tenonLength;
  const ct = p.childThickness ?? tt;
  const grooveDepth = tl + 1;
  const shoulderThickness = Math.max(0, (mt - tt) / 2);

  const sharedBbox = { w: mt * 5 + tl * 2, h: mt * 2 + tl };
  const s = unifiedFitScale(sharedBbox);
  const PX = (mm: number) => mm * s;

  const qBounds = { x: 0, y: 0, w: QUADRANT.W, h: QUADRANT.H - QUADRANT.HEADER_H };
  const hatchId = "hatch-tg-v2";

  // ===== FRONT view =====
  const front = (() => {
    const pieceLenMm = mt * 2.2;
    const fBbox = { w: pieceLenMm * 2 + 30 / s, h: mt };
    const fs = unifiedFitScale(fBbox);
    const FPX = (mm: number) => mm * fs;
    const pieceLen = Math.max(FPX(pieceLenMm), 90);
    const objW = pieceLen * 2 + 30;
    const objH = FPX(mt);
    const place = placeInQuadrant({ w: objW, h: objH * 2 });
    const motherX = place.x;
    const motherY = place.y + objH / 2;
    const childX = motherX + pieceLen + 30;
    const childY = motherY + FPX(mt) / 2 - FPX(ct) / 2;
    const grooveX = motherX + pieceLen - FPX(grooveDepth);
    const grooveY = motherY + FPX(mt) / 2 - FPX(tt) / 2;
    const tongueX = childX;
    const tongueY = childY + FPX(ct) / 2 - FPX(tt) / 2;

    return (
      <g>
        <defs>
          <Hatching id={hatchId} color={COLOR.SECTION_HATCH} />
        </defs>
        <rect x={motherX} y={motherY} width={pieceLen} height={FPX(mt)} fill={COLOR.MORTISE} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        <rect x={motherX} y={motherY} width={pieceLen - FPX(grooveDepth)} height={FPX(mt)} fill={`url(#${hatchId})`} stroke="none" />
        <rect x={motherX} y={motherY} width={pieceLen} height={Math.max(0, grooveY - motherY)} fill={`url(#${hatchId})`} stroke="none" />
        <rect x={motherX} y={grooveY + FPX(tt)} width={pieceLen} height={Math.max(0, motherY + FPX(mt) - (grooveY + FPX(tt)))} fill={`url(#${hatchId})`} stroke="none" />
        <rect x={grooveX} y={grooveY} width={FPX(grooveDepth)} height={FPX(tt)} fill="white" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        <rect x={childX + FPX(tl)} y={childY} width={pieceLen - FPX(tl)} height={FPX(ct)} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        <rect x={tongueX} y={tongueY} width={FPX(tl)} height={FPX(tt)} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        <CenterLine x1={motherX - 10} y1={motherY + FPX(mt) / 2} x2={childX + pieceLen + 10} y2={motherY + FPX(mt) / 2} />
        <GrainArrow x={motherX + 4} y={motherY - 12} length={Math.min(50, pieceLen / 2)} angle={0} />
        <GrainArrow x={childX + FPX(tl) + 4} y={childY - 12} length={Math.min(50, pieceLen / 2)} angle={0} />
        <SectionMark x={grooveX + FPX(grooveDepth) / 2} y={motherY - 16} label="A" direction="down" />
        <SectionMark x={grooveX + FPX(grooveDepth) / 2} y={motherY + FPX(mt) + 16} label="A" direction="up" />
        <DimLine x1={tongueX} y1={tongueY + FPX(tt)} x2={tongueX + FPX(tl)} y2={tongueY + FPX(tt)} label={`舌長 ${tl}`}
          side={safeDimSide("bottom", `舌長 ${tl}`, { x: tongueX + FPX(tl) / 2, y: tongueY + FPX(tt) }, qBounds)} />
        <DimLine x1={grooveX} y1={grooveY} x2={grooveX + FPX(grooveDepth)} y2={grooveY} label={`槽深 ${grooveDepth}`}
          side={safeDimSide("top", `槽深 ${grooveDepth}`, { x: grooveX + FPX(grooveDepth) / 2, y: grooveY }, qBounds)} />
        <DimLine x1={motherX} y1={motherY} x2={motherX} y2={motherY + FPX(mt)} label={`母厚 ${mt}`}
          side={safeDimSide("left", `母厚 ${mt}`, { x: motherX, y: motherY + FPX(mt) / 2 }, qBounds)} />
        <DimLine x1={tongueX} y1={tongueY} x2={tongueX} y2={tongueY + FPX(tt)} label={`舌厚 ${tt}`}
          side={safeDimSide("left", `舌厚 ${tt}`, { x: tongueX, y: tongueY + FPX(tt) / 2 }, qBounds)} />
        {shoulderThickness > 0 && (
          <DimLine x1={childX + pieceLen} y1={childY} x2={childX + pieceLen} y2={childY + FPX(shoulderThickness)} label={`舌肩 ${Math.round(shoulderThickness)}`}
            side={safeDimSide("right", `舌肩 ${Math.round(shoulderThickness)}`, { x: childX + pieceLen, y: childY + FPX(shoulderThickness) / 2 }, qBounds)} />
        )}
      </g>
    );
  })();

  // ===== SIDE view =====
  const side = (() => {
    const boardLen = QUADRANT.W - 60;
    const sBbox = { w: boardLen / s, h: mt * 4 };
    const ss = unifiedFitScale({ w: sBbox.w, h: sBbox.h });
    const SPX = (mm: number) => mm * ss;
    const motherY = 50;
    const childY = motherY + SPX(mt) + 24;
    const motherX = 30;
    const childX = 30;
    const actualBoardLen = QUADRANT.W - 60;

    return (
      <g>
        <rect x={motherX} y={motherY} width={actualBoardLen} height={SPX(mt)} fill={COLOR.MORTISE} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        <HiddenEdge x1={motherX} y1={motherY + SPX(mt) / 2 - SPX(tt) / 2} x2={motherX + actualBoardLen} y2={motherY + SPX(mt) / 2 - SPX(tt) / 2} />
        <HiddenEdge x1={motherX} y1={motherY + SPX(mt) / 2 + SPX(tt) / 2} x2={motherX + actualBoardLen} y2={motherY + SPX(mt) / 2 + SPX(tt) / 2} />
        <rect x={motherX + actualBoardLen - SPX(grooveDepth)} y={motherY + SPX(mt) / 2 - SPX(tt) / 2}
          width={SPX(grooveDepth)} height={SPX(tt)}
          fill="none" stroke={COLOR.DIM_TICK} strokeWidth={1.6} strokeDasharray="5 3" />
        <text x={motherX + actualBoardLen - SPX(grooveDepth) / 2} y={motherY + SPX(mt) / 2 - SPX(tt) / 2 - 4}
          fontSize={FONT.CALLOUT} textAnchor="middle" fill={COLOR.DIM_TICK} fontWeight="bold">
          凹槽（隱藏）
        </text>
        <text x={motherX + actualBoardLen / 2} y={motherY - 4} fontSize={FONT.DIM} fill="#666" textAnchor="middle">母件（凹槽連續）</text>
        <rect x={childX} y={childY} width={actualBoardLen} height={SPX(ct)} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        <HiddenEdge x1={childX} y1={childY + SPX(ct) / 2 - SPX(tt) / 2} x2={childX + actualBoardLen} y2={childY + SPX(ct) / 2 - SPX(tt) / 2} />
        <rect x={childX} y={childY + SPX(ct) / 2 - SPX(tt) / 2} width={actualBoardLen} height={SPX(tt)}
          fill="none" stroke={COLOR.DIM_TICK} strokeWidth={1.6} strokeDasharray="5 3" />
        <text x={childX + actualBoardLen - 30} y={childY + SPX(ct) / 2 + SPX(tt) / 2 + 12}
          fontSize={FONT.CALLOUT} textAnchor="middle" fill={COLOR.DIM_TICK} fontWeight="bold">
          舌頭（隱藏）
        </text>
        <text x={childX + actualBoardLen / 2} y={childY + SPX(ct) + 14} fontSize={FONT.DIM} fill="#666" textAnchor="middle">公件（舌連續）</text>
        <CenterLine x1={motherX - 10} y1={motherY + SPX(mt) / 2} x2={motherX + actualBoardLen + 10} y2={motherY + SPX(mt) / 2} />
        <GrainArrow x={motherX + 4} y={motherY - 14} length={Math.min(80, actualBoardLen - 10)} angle={0} />
        <DimLine x1={motherX} y1={motherY} x2={motherX} y2={motherY + SPX(mt)} label={`母厚 ${mt}`}
          side={safeDimSide("left", `母厚 ${mt}`, { x: motherX, y: motherY + SPX(mt) / 2 }, qBounds)} />
        <DimLine x1={childX} y1={childY} x2={childX} y2={childY + SPX(ct)} label={`公厚 ${ct}`}
          side={safeDimSide("left", `公厚 ${ct}`, { x: childX, y: childY + SPX(ct) / 2 }, qBounds)} />
      </g>
    );
  })();

  // ===== TOP view =====
  const top = (() => {
    const stripLenPx = QUADRANT.W - 110;
    const stripH = Math.max(PX(mt), 24);
    const startX = 60;
    const startY = 40;
    const strips = 3;
    const totalWidthMm = strips * mt;
    const boardLenMm = Math.round(stripLenPx / Math.max(s, 0.001));
    const groovePxLen = PX(grooveDepth);

    return (
      <g>
        {[0, 1, 2].map((i) => {
          const y = startY + i * (stripH + 4);
          const fill = i % 2 === 0 ? COLOR.MORTISE : COLOR.TENON;
          const seamY = y + stripH;
          const halfTongue = PX(tl / 2);
          return (
            <g key={i}>
              <rect x={startX} y={y} width={stripLenPx} height={stripH} fill={fill} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
              {i < strips - 1 && (
                <line x1={startX} y1={seamY} x2={startX + stripLenPx} y2={seamY} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
              )}
              {i < strips - 1 && (
                <HiddenEdge x1={startX + stripLenPx - groovePxLen} y1={seamY} x2={startX + stripLenPx} y2={seamY} />
              )}
              {i < strips - 1 && (
                <>
                  <line x1={startX} y1={seamY - halfTongue} x2={startX + stripLenPx} y2={seamY - halfTongue}
                    stroke={COLOR.DIM_TICK} strokeWidth={1.6} strokeDasharray="5 3" />
                  <line x1={startX} y1={seamY + halfTongue} x2={startX + stripLenPx} y2={seamY + halfTongue}
                    stroke={COLOR.DIM_TICK} strokeWidth={1.6} strokeDasharray="5 3" />
                </>
              )}
              <text x={startX - 4} y={y + stripH / 2 + 3} fontSize={FONT.DIM} fill="#666" textAnchor="end">板 {i + 1}</text>
            </g>
          );
        })}
        <text x={startX + stripLenPx + 8} y={startY + stripH + 4}
          fontSize={FONT.CALLOUT} fill={COLOR.DIM_TICK} fontWeight="bold">
          ← 舌頭嵌入位（隱藏）
        </text>
        <GrainArrow x={startX + 8} y={startY - 12} length={Math.min(80, stripLenPx - 12)} angle={0} />
        <DimLine x1={startX} y1={startY} x2={startX} y2={startY + strips * stripH + (strips - 1) * 4}
          label={`拼板總寬 ${totalWidthMm}`}
          side={safeDimSide("left", `拼板總寬 ${totalWidthMm}`, { x: startX, y: startY + (strips * stripH) / 2 }, qBounds)} />
        <DimLine x1={startX} y1={startY + strips * stripH + (strips - 1) * 4} x2={startX + stripLenPx} y2={startY + strips * stripH + (strips - 1) * 4}
          label={`板長 ${boardLenMm}`}
          side={safeDimSide("bottom", `板長 ${boardLenMm}`, { x: startX + stripLenPx / 2, y: startY + strips * stripH + (strips - 1) * 4 }, qBounds)} />
      </g>
    );
  })();

  // ===== ISO view =====
  const iso = (() => {
    const pieceLenMm = Math.max(mt * 3, tl * 5, 80);
    const boardDepth = Math.max(80, pieceLenMm * 0.5);
    const isoBbox = { w: pieceLenMm * 2 + tl, h: mt + 20, d: boardDepth };
    const isoS = unifiedFitScale(isoBbox, { targetUsage: 0.6 });
    const center = { x: QUADRANT.W / 2, y: (QUADRANT.H - QUADRANT.HEADER_H) / 2 };

    return (
      <g>
        <IsometricGroup originX={center.x} originY={center.y + 10} scale={isoS}>
          {(() => {
            const explodeGap = tl + 8;
            return (
              <g>
                <IsoCuboid x={-pieceLenMm} y={-mt / 2} z={0}
                  w={pieceLenMm} h={mt} d={boardDepth}
                  fillFront={ISO_FILL.MORTISE_FRONT} fillTop={ISO_FILL.MORTISE_TOP} fillSide={ISO_FILL.MORTISE_SIDE}
                  strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / Math.max(0.4, isoS)} />
                <IsoMortise faceX={0} faceY={0} faceZ={boardDepth / 2}
                  width={boardDepth} height={tt} depth={grooveDepth} faceNormal="+x" through={false}
                  stroke={COLOR.OUTLINE} strokeWidth={ISO_STROKE.EDGE_INTERIOR / Math.max(0.4, isoS)} />
                <g transform={`translate(${explodeGap} 0)`}>
                  <IsoCuboid x={tl} y={-mt / 2} z={0}
                    w={pieceLenMm} h={mt} d={boardDepth}
                    fillFront={ISO_FILL.TENON_FRONT} fillTop={ISO_FILL.TENON_TOP} fillSide={ISO_FILL.TENON_SIDE}
                    strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / Math.max(0.4, isoS)} />
                  <IsoTenon baseX={tl} baseY={0} baseZ={boardDepth / 2}
                    width={boardDepth} thickness={tt} length={tl} direction="-x"
                    fillFront={ISO_FILL.TENON_FRONT} fillTop={ISO_FILL.TENON_TOP} fillSide={ISO_FILL.TENON_SIDE}
                    strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / Math.max(0.4, isoS)} embeddedLength={tl} />
                </g>
                <line x1={tl + explodeGap - 4} y1={0} x2={4} y2={0}
                  stroke={COLOR.DIM} strokeWidth={STROKE.OUTLINE / Math.max(0.4, isoS)} strokeDasharray={ISO_DASH.ARROW} />
              </g>
            );
          })()}
        </IsometricGroup>
      </g>
    );
  })();

  const scaleStr = s >= 1 ? `${Math.round(s)}:1` : `1:${Math.max(1, Math.round(1 / s))}`;

  return (
    <MasterDetailLayout
      type="tongue-and-groove"
      joineryNameZh="企口榫（舌槽接）"
      drawingNumber={`TG-${tt}-${tl}-${mt}`}
      scale={scaleStr}
      frontView={front}
      sideView={side}
      topView={top}
      isoView={iso}
      warnings={[
        `凹槽深 = 舌長 + 1mm（漲縮餘量 ${grooveDepth}mm）`,
        `舌厚 ≈ 母厚 1/3 = ${tt}mm`,
      ]}
    />
  );
}
/* === END tongue-and-groove-detail v2 === */

/* === BEGIN shouldered-tenon-detail v2 (Wave 2b Group A) === */
function ShoulderedTenonDetail(p: JoineryDetailParams) {
  const tl = p.tenonLength;
  const tw = p.tenonWidth;
  const tt = p.tenonThickness;
  const mt = p.motherThickness;
  const ct = p.childThickness ?? tt;
  const cw = p.childWidth ?? tw;
  const isRound = p.motherShape === "round";

  const noShoulder = cw <= tw + 1;
  const shoulderW = noShoulder ? 0 : (cw - tw) / 2;
  const haunchLen = Math.max(4, Math.round(tl / 3));
  void haunchLen;

  const sharedBbox = { w: cw * 2 + tl * 2 + mt * 1.5, h: cw + 40 };
  const s = unifiedFitScale(sharedBbox);
  const PX = (mm: number) => mm * s;

  const qBounds = { x: 0, y: 0, w: QUADRANT.W, h: QUADRANT.H - QUADRANT.HEADER_H };
  const hatchId = "hatch-shoulder-v2";

  // ===== FRONT view =====
  const front = (() => {
    const apronBodyLenMm = Math.max(ct * 5, mt * 2);
    const fBbox = { w: apronBodyLenMm + tl + mt + 30 / s, h: cw };
    const fs = unifiedFitScale(fBbox);
    const FPX = (mm: number) => mm * fs;
    const apronBodyLen = Math.max(FPX(apronBodyLenMm), 100);
    const apronH = FPX(cw);
    const objW = apronBodyLen + FPX(tl) + FPX(mt) + 30;
    const objH = Math.max(apronH * 1.4, FPX(mt));
    const place = placeInQuadrant({ w: objW, h: objH });
    const ax = place.x;
    const ay = place.y + (objH - apronH) / 2;
    const tenonY = ay + FPX(shoulderW);
    const tenonH = FPX(tw);
    const tenonX = ax + apronBodyLen;
    const tenonRight = tenonX + FPX(tl);

    return (
      <g>
        <defs>
          <Hatching id={hatchId} color={COLOR.SECTION_HATCH} />
        </defs>
        <rect x={ax} y={ay} width={apronBodyLen} height={apronH} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        <rect x={tenonX} y={tenonY} width={FPX(tl)} height={tenonH} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        <line x1={tenonX} y1={ay} x2={tenonX} y2={ay + apronH} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        {(() => {
          const colX = tenonRight + 18;
          const colW = FPX(mt);
          const colH = Math.max(apronH * 1.4, FPX(mt));
          const colY = ay + apronH / 2 - colH / 2;
          return (
            <g>
              <rect x={colX} y={colY} width={colW} height={colH}
                fill="#e8d8b8" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} opacity={0.7} />
              <rect x={colX} y={tenonY} width={FPX(tl)} height={tenonH}
                fill="none" stroke={COLOR.DIM_TICK} strokeWidth={1.6} strokeDasharray="5 3" />
              <line x1={colX} y1={tenonY + tenonH / 2} x2={colX + FPX(tl)} y2={tenonY + tenonH / 2}
                stroke={COLOR.DIM_TICK} strokeWidth={1.6} strokeDasharray="5 3" />
              <line x1={tenonRight + 2} y1={tenonY + tenonH / 2} x2={colX - 2} y2={tenonY + tenonH / 2}
                stroke={COLOR.DIM} strokeWidth={STROKE.HIDDEN} strokeDasharray="2 2" />
              <text x={colX + FPX(tl) / 2} y={tenonY - 4} fontSize={FONT.CALLOUT}
                textAnchor="middle" fill={COLOR.DIM_TICK} fontWeight="bold">
                榫頭（隱藏）
              </text>
              <text x={colX + colW / 2} y={colY + colH + 12} fontSize={FONT.CALLOUT}
                textAnchor="middle" fill="#666">
                柱身
              </text>
            </g>
          );
        })()}
        <CenterLine x1={ax - 10} y1={ay + apronH / 2} x2={tenonRight + 10} y2={ay + apronH / 2} />
        <GrainArrow x={ax + 6} y={ay - 12} length={Math.min(70, apronBodyLen / 2)} angle={0} />
        <SectionMark x={tenonX + FPX(tl) / 2} y={ay - 18} label="A" direction="down" />
        <SectionMark x={tenonX + FPX(tl) / 2} y={ay + apronH + 18} label="A" direction="up" />
        <DimLine x1={tenonX} y1={tenonY + tenonH} x2={tenonRight} y2={tenonY + tenonH} label={`榫長 ${tl}`}
          side={safeDimSide("bottom", `榫長 ${tl}`, { x: tenonX + FPX(tl) / 2, y: tenonY + tenonH }, qBounds)} />
        <DimLine x1={tenonRight} y1={tenonY} x2={tenonRight} y2={tenonY + tenonH} label={`榫寬 ${tw}`}
          side={safeDimSide("right", `榫寬 ${tw}`, { x: tenonRight, y: tenonY + tenonH / 2 }, qBounds)} />
        <DimLine x1={ax} y1={ay} x2={ax} y2={ay + apronH} label={`板寬 ${cw}`}
          side={safeDimSide("left", `板寬 ${cw}`, { x: ax, y: ay + apronH / 2 }, qBounds)} />
      </g>
    );
  })();

  // ===== SIDE view =====
  const side = (() => {
    const sBbox = { w: ct * 3, h: cw + 20 };
    const ss = unifiedFitScale(sBbox);
    const SPX = (mm: number) => mm * ss;
    const xsCw = SPX(ct);
    const xsCh = SPX(cw);
    const place = placeInQuadrant({ w: xsCw, h: xsCh });
    const xsX = place.x;
    const xsY = place.y;
    const tenonW = SPX(tt);
    const tenonH = SPX(tw);
    const tenonX = xsX + (xsCw - tenonW) / 2;
    const tenonY = xsY + SPX(shoulderW);

    return (
      <g>
        <rect x={xsX} y={xsY} width={xsCw} height={xsCh} fill={`url(#${hatchId})`} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        <rect x={tenonX} y={tenonY} width={tenonW} height={tenonH} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        <CenterLine x1={xsX - 8} y1={xsY + xsCh / 2} x2={xsX + xsCw + 8} y2={xsY + xsCh / 2} />
        <CenterLine x1={xsX + xsCw / 2} y1={xsY - 8} x2={xsX + xsCw / 2} y2={xsY + xsCh + 8} />
        <text x={xsX + 4} y={xsY + 12} fontSize={FONT.CALLOUT} fill={COLOR.GRAIN}>⊙ 木紋</text>
        <DimLine x1={xsX} y1={xsY + xsCh} x2={xsX + xsCw} y2={xsY + xsCh} label={`板厚 ${ct}`}
          side={safeDimSide("bottom", `板厚 ${ct}`, { x: xsX + xsCw / 2, y: xsY + xsCh }, qBounds)} />
        <DimLine x1={tenonX} y1={tenonY} x2={tenonX + tenonW} y2={tenonY} label={`榫厚 ${tt}`}
          side={safeDimSide("top", `榫厚 ${tt}`, { x: tenonX + tenonW / 2, y: tenonY }, qBounds)} />
        <DimLine x1={xsX} y1={xsY} x2={xsX} y2={xsY + xsCh} label={`板寬 ${cw}`}
          side={safeDimSide("left", `板寬 ${cw}`, { x: xsX, y: xsY + xsCh / 2 }, qBounds)} />
        {!noShoulder && (
          <>
            <DimLine x1={xsX + xsCw} y1={xsY} x2={xsX + xsCw} y2={tenonY} label={`上肩 ${Math.round(shoulderW)}`}
              side={safeDimSide("right", `上肩 ${Math.round(shoulderW)}`, { x: xsX + xsCw, y: (xsY + tenonY) / 2 }, qBounds)} />
            <DimLine x1={xsX + xsCw} y1={tenonY + tenonH} x2={xsX + xsCw} y2={xsY + xsCh} label={`下肩 ${Math.round(shoulderW)}`}
              side={safeDimSide("right", `下肩 ${Math.round(shoulderW)}`, { x: xsX + xsCw, y: (tenonY + tenonH + xsY + xsCh) / 2 }, qBounds)} />
          </>
        )}
      </g>
    );
  })();

  // ===== TOP view =====
  const top = (() => {
    const tBbox = { w: mt + ct * 5 + tl, h: mt };
    const ts = unifiedFitScale(tBbox);
    const TPX = (mm: number) => mm * ts;
    const legW = TPX(mt);
    const legH = TPX(mt);
    const apronLen = Math.max(TPX(ct) * 5, 100);
    const objW = legW + apronLen;
    const place = placeInQuadrant({ w: objW, h: Math.max(legH, TPX(ct)) });
    const legX = place.x;
    const legY = place.y + (Math.max(legH, TPX(ct)) - legH) / 2;
    const tenonY = legY + legH / 2 - TPX(tt) / 2;
    const tenonX = legX + legW - TPX(tl);
    const apronY = legY + legH / 2 - TPX(ct) / 2;
    const apronX = legX + legW;

    return (
      <g>
        {isRound ? (
          <circle cx={legX + legW / 2} cy={legY + legH / 2} r={legW / 2}
            fill={`url(#${hatchId})`} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        ) : (
          <rect x={legX} y={legY} width={legW} height={legH}
            fill={`url(#${hatchId})`} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        )}
        <rect x={tenonX} y={tenonY} width={TPX(tl)} height={TPX(tt)} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        <rect x={apronX} y={apronY} width={apronLen} height={TPX(ct)} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        <line x1={apronX} y1={apronY - TPX(shoulderW)} x2={apronX} y2={apronY + TPX(ct) + TPX(shoulderW)}
          stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        <CenterLine x1={legX - 10} y1={legY + legH / 2} x2={apronX + apronLen + 10} y2={legY + legH / 2} />
        <HiddenEdge x1={tenonX} y1={tenonY} x2={legX} y2={tenonY} />
        <HiddenEdge x1={tenonX} y1={tenonY + TPX(tt)} x2={legX} y2={tenonY + TPX(tt)} />
        <DimLine x1={tenonX} y1={tenonY + TPX(tt)} x2={tenonX + TPX(tl)} y2={tenonY + TPX(tt)} label={`榫長 ${tl}`}
          side={safeDimSide("bottom", `榫長 ${tl}`, { x: tenonX + TPX(tl) / 2, y: tenonY + TPX(tt) }, qBounds)} />
        <DimLine x1={legX} y1={legY} x2={legX + legW} y2={legY} label={`柱寬 ${mt}`}
          side={safeDimSide("top", `柱寬 ${mt}`, { x: legX + legW / 2, y: legY }, qBounds)} />
        <text x={apronX + 4} y={apronY - TPX(shoulderW) - 4} fontSize={FONT.CALLOUT} fill={COLOR.DIM_TICK}>← 肩面（承力）</text>
      </g>
    );
  })();

  // ===== ISO view =====
  const iso = (() => {
    const apronLenMm = Math.max(ct * 4, cw + 20);
    const isoBbox = { w: mt + apronLenMm + tl, h: Math.max(mt * 2, cw + 20), d: Math.max(mt, ct) };
    const isoS = unifiedFitScale(isoBbox, { targetUsage: 0.6 });
    const center = { x: QUADRANT.W / 2, y: (QUADRANT.H - QUADRANT.HEADER_H) / 2 };
    const explodeGap = tl + 10;

    return (
      <g>
        <IsometricGroup originX={center.x - 30} originY={center.y + 10} scale={isoS}>
          {(() => {
            return (
              <g>
                <IsoCuboid x={-mt / 2} y={-mt} z={-mt / 2}
                  w={mt} h={mt * 2} d={mt}
                  fillFront={ISO_FILL.MORTISE_FRONT} fillTop={ISO_FILL.MORTISE_TOP} fillSide={ISO_FILL.MORTISE_SIDE}
                  strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / Math.max(0.4, isoS)} />
                {isRound && (
                  <text x={-mt / 2} y={mt + 14} fontSize={FONT.CALLOUT} fill={COLOR.DIM_TICK}>
                    圓腳柱簡化為方柱顯示（直徑 = {mt}mm）
                  </text>
                )}
                <IsoMortise faceX={mt / 2} faceY={0} faceZ={0}
                  width={tt} height={tw} depth={tl} faceNormal="+x" through={false}
                  stroke={COLOR.OUTLINE} strokeWidth={ISO_STROKE.EDGE_INTERIOR / Math.max(0.4, isoS)} />
                <g transform={`translate(${explodeGap * 1.5} 0)`}>
                  <IsoCuboid x={mt / 2} y={-cw / 2} z={-ct / 2}
                    w={apronLenMm} h={cw} d={ct}
                    fillFront={ISO_FILL.TENON_FRONT} fillTop={ISO_FILL.TENON_TOP} fillSide={ISO_FILL.TENON_SIDE}
                    strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / Math.max(0.4, isoS)} />
                  <IsoTenon baseX={mt / 2} baseY={0} baseZ={0}
                    width={tt} thickness={tw} length={tl} direction="-x"
                    fillFront={ISO_FILL.TENON_FRONT} fillTop={ISO_FILL.TENON_TOP} fillSide={ISO_FILL.TENON_SIDE}
                    strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / Math.max(0.4, isoS)}
                    showShoulder={!noShoulder} embeddedLength={tl} />
                </g>
                <line x1={mt / 2 + explodeGap * 1.5 - 4} y1={0} x2={mt / 2 + 4} y2={0}
                  stroke={COLOR.DIM} strokeWidth={STROKE.OUTLINE / Math.max(0.4, isoS)} strokeDasharray={ISO_DASH.ARROW} />
              </g>
            );
          })()}
        </IsometricGroup>
      </g>
    );
  })();

  const scaleStr = s >= 1 ? `${Math.round(s)}:1` : `1:${Math.max(1, Math.round(1 / s))}`;

  return (
    <MasterDetailLayout
      type="shouldered-tenon"
      joineryNameZh={noShoulder ? "帶肩榫（fallback：純通榫）" : "帶肩榫（雙肩防扭）"}
      drawingNumber={`ST-${tw}x${tt}-${cw}`}
      scale={scaleStr}
      frontView={front}
      sideView={side}
      topView={top}
      isoView={iso}
      warnings={
        noShoulder
          ? [`公件 ${cw}mm ≤ 榫寬 ${tw}mm，已退回純通榫`]
          : [`肩面為主要承力面（上下肩各 ${Math.round(shoulderW)}mm）`, `榫頭 ${tw}×${tt}×${tl}mm`]
      }
    />
  );
}
/* === END shouldered-tenon-detail v2 === */

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
/* === BEGIN dovetail-detail (owner: agent-A, group: A) === */
function LegacyDovetailDetail(p: JoineryDetailParams) {
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
      <text x={v4_OX + v4_W / 2} y={v4_yBody + Math.abs(v4_dyz) + 36} fontSize={FONT.CALLOUT} textAnchor="middle" fill="#666">
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
      <text x={v5_OX + (topLen + tt) / 2} y={v5_OY + sideH + tt + Math.abs(depth * DZ_Y) + 36} fontSize={FONT.CALLOUT} textAnchor="middle" fill="#666">
        梯形 = 頂板長纖（tail）；斜紋區 = 側板從上看是 endgrain（pin）
      </text>
    </svg>
  );
}

/**
 * 鳩尾榫 — dovetail（教科書級三視圖 + 等角圖重繪）
 * 重點：
 *   - 用 pickDovetailAngle(material) 決定 1:6 / 1:8 標準斜度
 *   - 依 cw 算可排尾數：minSpacing = tw * 1.5 → nTails = max(2, floor(cw / minSpacing))
 *   - iso 區塊複用既有 DovetailAxon3D 的視覺幾何（包進 IsometricGroup wrapper）
 *   - 三視圖採 L 型轉角構圖：tail board（母件）+ pin board（公件）端面對端面
 */
function LegacyV2DovetailDetail(p: JoineryDetailParams) {
  const tl = p.tenonLength;
  const tw = p.tenonWidth;          // joint 總寬（沿板寬方向）
  const tt = p.tenonThickness;
  const ct = p.childThickness ?? tt; // 公件板厚 (pin board 厚度)
  const mt = p.motherThickness;      // 母件板厚 (tail board 厚度)
  const cw = p.childWidth ?? tw;     // 公件板寬 = joint 沿銷方向的板寬

  // 依 cw 算可排尾數（最小間距 = tw * 1.5）
  const minSpacing = Math.max(tw * 1.5, 8);
  const nTails = Math.max(2, Math.min(8, Math.floor(cw / minSpacing)));
  const nPins = nTails + 1;
  const angleLabel = pickDovetailAngle(p.material);

  const QUAD_W = 440;
  const QUAD_H = 280;
  const innerPad = 30;

  // 三視圖共用比例
  const maxMm = Math.max(cw * 1.2, mt * 8, tl * 6);
  const s = (QUAD_W - innerPad * 2) / maxMm;
  const PX = (mm: number) => mm * s;

  // ======== FRONT: tail board face view（看尾頭從板端伸出，cw × mt+tl 區） ========
  // tail board 平放，板寬 cw 沿 X，板厚 mt 沿 Y（板身在下，尾頭朝上）
  const fBoardW = PX(cw);
  const fBoardH = PX(mt) + PX(tl); // 板身 mt + 尾頭凸出 tl
  const fBoardX = (QUAD_W - fBoardW) / 2;
  const fBoardY = (QUAD_H - fBoardH) / 2 + 10;
  const fTailRowY0 = fBoardY;                  // 尾頂端
  const fTailRowY1 = fBoardY + PX(tl);         // 尾根（與板身交界）
  const fBodyY1 = fBoardY + fBoardH;           // 板身底
  // 半銷 + nTails + (nTails-1) 全銷 + 半銷
  // tailW = boardW / (nTails * 1.55) ， pinW = tailW * 0.55
  const tailW = fBoardW / (nTails * 1.55);
  const pinW = tailW * 0.55;
  const halfP = pinW / 2;
  const dtOffset = PX(tl) * 0.32; // exaggerated taper for visual

  // 構建 tail board 鋸齒輪廓（從左半銷凹起，至右半銷凹）
  const buildTailFace = (
    xL: number,
    yEdge: number,
    yMid: number,
    yBody: number,
    totalW: number,
  ): Array<[number, number]> => {
    const pts: Array<[number, number]> = [];
    pts.push([xL, yBody]);
    pts.push([xL, yMid]);
    pts.push([xL + halfP + dtOffset, yMid]);
    let tL = xL + halfP;
    pts.push([tL, yEdge]);
    for (let i = 0; i < nTails; i++) {
      const tR = tL + tailW;
      pts.push([tR, yEdge]);
      if (i < nTails - 1) {
        pts.push([tR - dtOffset, yMid]);
        const nL = tR + pinW;
        pts.push([nL + dtOffset, yMid]);
        pts.push([nL, yEdge]);
        tL = nL;
      }
    }
    const lastTR = tL + tailW;
    pts.push([lastTR - dtOffset, yMid]);
    pts.push([xL + totalW, yMid]);
    pts.push([xL + totalW, yBody]);
    return pts;
  };

  const tailPoints = buildTailFace(fBoardX, fTailRowY0, fTailRowY1, fBodyY1, fBoardW);

  const front = (
    <g>
      <rect x={5} y={5} width={QUAD_W - 10} height={QUAD_H - 10} fill="white" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
      <text x={QUAD_W / 2} y={20} fontSize={FONT.LABEL} textAnchor="middle" fontWeight="bold" fill={COLOR.OUTLINE}>正視圖（FRONT — 母件尾板 face）</text>

      {/* tail board 鋸齒外形 */}
      <polygon points={tailPoints.map((pt) => pt.join(",")).join(" ")} fill={COLOR.MORTISE} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />

      {/* 中心線（板身水平軸 + 板寬中心） */}
      <CenterLine x1={fBoardX - 6} y1={fTailRowY1 + (fBodyY1 - fTailRowY1) / 2} x2={fBoardX + fBoardW + 6} y2={fTailRowY1 + (fBodyY1 - fTailRowY1) / 2} />
      <CenterLine x1={fBoardX + fBoardW / 2} y1={fBoardY - 8} x2={fBoardX + fBoardW / 2} y2={fBodyY1 + 8} />

      {/* 剖面標記 A-A（沿尾根橫向） */}
      <SectionMark x={fBoardX - 14} y={fTailRowY1} label="A" direction="right" />
      <SectionMark x={fBoardX + fBoardW + 14} y={fTailRowY1} label="A" direction="left" />

      {/* 尺寸 */}
      <DimLine x1={fBoardX} y1={fBodyY1 + 14} x2={fBoardX + fBoardW} y2={fBodyY1 + 14} label={`${cw}`} side="bottom" />
      <DimLine x1={fBoardX - 14} y1={fTailRowY0} x2={fBoardX - 14} y2={fTailRowY1} label={`${tl}`} side="left" />
      <DimLine x1={fBoardX - 14} y1={fTailRowY1} x2={fBoardX - 14} y2={fBodyY1} label={`${mt}`} side="left" />
      {/* 尾寬 + 銷寬 */}
      {(() => {
        const t1L = fBoardX + halfP;
        const t1R = t1L + tailW;
        return (
          <g>
            <DimLine x1={t1L} y1={fTailRowY0 - 12} x2={t1R} y2={fTailRowY0 - 12} label={`${Math.round(cw / (nTails * 1.55))}`} side="top" />
            <DimLine x1={t1R} y1={fTailRowY0 - 28} x2={t1R + pinW} y2={fTailRowY0 - 28} label={`${Math.round((cw / (nTails * 1.55)) * 0.55)}`} side="top" />
          </g>
        );
      })()}

      {/* 木紋方向 — tail board 沿板寬 cw 方向 */}
      <GrainArrow x={fBoardX + 8} y={fBodyY1 - 14} length={Math.min(60, fBoardW - 16)} angle={0} />

      {/* 角度標 + 工法警示 */}
      <text x={fBoardX + fBoardW / 2} y={fTailRowY1 - 6} fontSize={FONT.CALLOUT} textAnchor="middle" fill={COLOR.DIM}>{angleLabel}</text>
      <WarningCallout x={5} y={QUAD_H - 18} text={`順紋切尾、橫紋切銷；尾數 ${nTails} 個 + 兩端半銷`} />
    </g>
  );

  // ======== SIDE: pin board end-face cross-section（端面剖面，看 cw × ct） ========
  // 從板端看回去：寬 cw，厚 ct；尾凹（給對方 tail 嵌入）為梯形
  const sBoardW = PX(cw);
  const sBoardH = PX(ct);
  const sBoardX = (QUAD_W - sBoardW) / 2;
  const sBoardY = (QUAD_H - sBoardH) / 2 + 10;
  const sOffset = PX(tl) * 0.32; // 沿厚度方向 taper

  const side = (
    <g>
      <rect x={5} y={5} width={QUAD_W - 10} height={QUAD_H - 10} fill="white" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
      <text x={QUAD_W / 2} y={20} fontSize={FONT.LABEL} textAnchor="middle" fontWeight="bold" fill={COLOR.OUTLINE}>側視圖（SIDE — 公件銷板 end-face 剖面）</text>

      {/* pin board 端面整片（先填銷顏色） */}
      <rect x={sBoardX} y={sBoardY} width={sBoardW} height={sBoardH} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
      {/* 切出 nTails 個尾凹（▽）*/}
      {Array.from({ length: nTails }).map((_, i) => {
        const sx = sBoardX + halfP + i * (tailW + pinW);
        const points = [
          [sx, sBoardY],
          [sx + tailW, sBoardY],
          [sx + tailW - sOffset, sBoardY + sBoardH],
          [sx + sOffset, sBoardY + sBoardH],
        ];
        return (
          <polygon key={i} points={points.map((pt) => pt.join(",")).join(" ")} fill="white" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        );
      })}

      <CenterLine x1={sBoardX - 6} y1={sBoardY + sBoardH / 2} x2={sBoardX + sBoardW + 6} y2={sBoardY + sBoardH / 2} />
      <CenterLine x1={sBoardX + sBoardW / 2} y1={sBoardY - 10} x2={sBoardX + sBoardW / 2} y2={sBoardY + sBoardH + 10} />

      {/* 角度斜邊示意 */}
      {(() => {
        const sx = sBoardX + halfP;
        return (
          <g>
            <line x1={sx + 1} y1={sBoardY + 2} x2={sx + sOffset + 1} y2={sBoardY + sBoardH - 2} stroke={COLOR.DIM} strokeWidth={0.6} strokeDasharray="2 2" />
            <text x={sx + sOffset + 6} y={sBoardY + sBoardH / 2} fontSize={FONT.CALLOUT} fill={COLOR.DIM}>{angleLabel}</text>
          </g>
        );
      })()}

      <DimLine x1={sBoardX} y1={sBoardY + sBoardH + 14} x2={sBoardX + sBoardW} y2={sBoardY + sBoardH + 14} label={`${cw}`} side="bottom" />
      <DimLine x1={sBoardX + sBoardW + 12} y1={sBoardY} x2={sBoardX + sBoardW + 12} y2={sBoardY + sBoardH} label={`${ct}`} side="right" />

      <text x={sBoardX + sBoardW / 2} y={sBoardY - 4} fontSize={FONT.CALLOUT} textAnchor="middle" fill="#999">↑ 板外面（銷窄）</text>
      <text x={sBoardX + sBoardW / 2} y={sBoardY + sBoardH + 28} fontSize={FONT.CALLOUT} textAnchor="middle" fill="#999">↓ 板內面（銷寬、尾凹窄）</text>
    </g>
  );

  // ======== TOP: 組合 L 型轉角俯視（剖面 A-A 切面）========
  const tCx = QUAD_W / 2;
  const tCy = QUAD_H / 2;
  const tBoardLen = Math.min(PX(cw * 0.9), QUAD_W / 2 - innerPad - 10);
  const tTailDepth = PX(tl);
  const tPinThk = PX(ct);

  const top = (
    <g>
      <rect x={5} y={5} width={QUAD_W - 10} height={QUAD_H - 10} fill="white" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
      <text x={QUAD_W / 2} y={20} fontSize={FONT.LABEL} textAnchor="middle" fontWeight="bold" fill={COLOR.OUTLINE}>俯視圖（TOP — 組合 L 型轉角剖面）</text>

      {/* 水平 tail board（橫向延伸） */}
      <rect x={tCx - tBoardLen} y={tCy - tTailDepth / 2} width={tBoardLen} height={tTailDepth} fill={COLOR.MORTISE} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
      {/* 垂直 pin board（向下延伸） */}
      <rect x={tCx - tPinThk / 2} y={tCy - tTailDepth / 2} width={tPinThk} height={tBoardLen} fill="url(#hatch-dt-new)" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
      {/* 鳩尾交鎖區（水平段右端進入垂直段內部） */}
      {(() => {
        const interlockX0 = tCx - tPinThk / 2;
        const interlockX1 = tCx + tPinThk / 2;
        const interlockY0 = tCy - tTailDepth / 2;
        const interlockY1 = tCy + tTailDepth / 2;
        // tails 沿 tTailDepth 方向（Y）排
        const slotH = (interlockY1 - interlockY0) / nTails;
        const elements: React.ReactElement[] = [];
        for (let i = 0; i < nTails; i++) {
          const y0 = interlockY0 + slotH * i;
          const y1 = y0 + slotH;
          // 梯形 tail（外大內小，taper 沿 X）
          const off = slotH * 0.18;
          const points = [
            [interlockX0, y0],
            [interlockX1, y0 + off],
            [interlockX1, y1 - off],
            [interlockX0, y1],
          ];
          elements.push(
            <polygon key={i} points={points.map((pt) => pt.join(",")).join(" ")} fill={COLOR.MORTISE} stroke={COLOR.OUTLINE} strokeWidth={0.7} />
          );
        }
        return <g>{elements}</g>;
      })()}

      {/* 中心線 */}
      <CenterLine x1={tCx - tBoardLen - 6} y1={tCy} x2={tCx + tPinThk / 2 + 6} y2={tCy} />
      <CenterLine x1={tCx} y1={tCy - tTailDepth / 2 - 6} x2={tCx} y2={tCy + tBoardLen + 6} />

      {/* 尺寸 */}
      <DimLine x1={tCx - tBoardLen} y1={tCy - tTailDepth / 2 - 14} x2={tCx + tPinThk / 2} y2={tCy - tTailDepth / 2 - 14} label={`${Math.round(cw * 0.9)}`} side="top" />
      <DimLine x1={tCx + tPinThk / 2 + 12} y1={tCy - tTailDepth / 2} x2={tCx + tPinThk / 2 + 12} y2={tCy - tTailDepth / 2 + tTailDepth} label={`${tl}`} side="right" />
      <DimLine x1={tCx + tPinThk / 2 + 28} y1={tCy - tTailDepth / 2} x2={tCx + tPinThk / 2 + 28} y2={tCy + tBoardLen} label={`${Math.round(cw * 0.9)}`} side="right" />

      <text x={tCx - tBoardLen / 2} y={tCy + tTailDepth / 2 + 14} fontSize={FONT.CALLOUT} textAnchor="middle" fill="#666">尾板（橫，板厚 {mt}）</text>
      <text x={tCx + tPinThk / 2 + 4} y={tCy + tBoardLen / 2 + 60} fontSize={FONT.CALLOUT} textAnchor="start" fill="#666">銷板（縱，板厚 {ct}）</text>
    </g>
  );

  // ======== ISO: 用 IsometricGroup 包 DovetailAxon3D 的視覺幾何 ========
  // DovetailAxon3D 內部已是 cabinet projection；這裡用 clipPath 約束到 quadrant 範圍
  // 修法 (2026-05): 加 clipPath + nested svg width/height 寫死，避免跑出框
  const isoClipId = `dovetail-iso-clip-${Math.round(QUAD_W)}x${Math.round(QUAD_H)}`;
  const iso = (
    <g>
      <defs>
        <clipPath id={isoClipId}>
          <rect x={6} y={26} width={QUAD_W - 12} height={QUAD_H - 32} />
        </clipPath>
      </defs>
      <rect x={5} y={5} width={QUAD_W - 10} height={QUAD_H - 10} fill="white" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
      <text x={QUAD_W / 2} y={20} fontSize={FONT.LABEL} textAnchor="middle" fontWeight="bold" fill={COLOR.OUTLINE}>等角圖（ISO 30° — L 型轉角組合）</text>
      {/* 用 nested SVG 把 DovetailAxon3D 縮放置入此 quadrant，並 clip 到 quadrant 範圍 */}
      <g clipPath={`url(#${isoClipId})`}>
        <svg
          x={6}
          y={26}
          width={QUAD_W - 12}
          height={QUAD_H - 32}
          viewBox="0 0 720 360"
          preserveAspectRatio="xMidYMid meet"
        >
          <DovetailAxon3D
            pieceLen={300}
            pieceDepth={PX(tl) * 1.5}
            bodyExt={PX(tl) * 1.5}
            tailW={(300) / (nTails * 1.55)}
            pinW={((300) / (nTails * 1.55)) * 0.55}
            halfPinW_top={((300) / (nTails * 1.55)) * 0.55 / 2}
            N_TAILS={nTails}
            mt={mt}
            ct={ct}
            tw={tw}
            tl={tl}
          />
        </svg>
      </g>
    </g>
  );

  return (
    <svg width={960} height={680} viewBox="0 0 960 680" className="bg-white">
      <defs>
        <Hatching id="hatch-dt-new" color="#7a5a2c" />
      </defs>
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
            joineryType="dovetail"
            joineryNameZh={`鳩尾榫（${nTails} 尾 + 兩端半銷，${angleLabel}）`}
            scale="1:1"
            drawnBy="wrd-auto"
            drawingNumber={`DT-${nTails}T-${tw}x${tl}`}
          />
        }
      />
    </svg>
  );
}
/* === END dovetail-detail (legacy) === */

/* === BEGIN dovetail-detail v2 (Wave 2b Group B) ===
 * 鳩尾榫 dovetail — MasterDetailLayout + 統一 helper
 * iso 用既有 DovetailAxon3D（不重寫 axon 邏輯，包進 nested svg）
 * ============================================================ */
function DovetailDetail(p: JoineryDetailParams) {
  const tl = p.tenonLength;
  const tw = p.tenonWidth;
  const tt = p.tenonThickness;
  const ct = p.childThickness ?? tt;
  const mt = p.motherThickness;
  const cw = p.childWidth ?? tw;

  const minSpacing = Math.max(tw * 1.5, 8);
  const nTails = Math.max(2, Math.min(8, Math.floor(cw / minSpacing)));
  const angleLabel = pickDovetailAngle(p.material);

  // ===== Q1 正視圖：tail board face view =====
  const front = (() => {
    const bbox = { w: cw, h: mt + tl };
    const s = unifiedFitScale(bbox);
    const PX = (mm: number) => mm * s;
    const objW = PX(bbox.w);
    const objH = PX(bbox.h);
    const place = placeInQuadrant({ w: objW, h: objH });
    const fBoardX = place.x;
    const fBoardY = place.y;
    const fBoardW = PX(cw);
    const fTailRowY0 = fBoardY;
    const fTailRowY1 = fBoardY + PX(tl);
    const fBodyY1 = fBoardY + objH;
    const tailW = fBoardW / (nTails * 1.55);
    const pinW = tailW * 0.55;
    const halfP = pinW / 2;
    const dtOffset = PX(tl) * 0.32;
    const qBounds = { x: 0, y: 0, w: QUADRANT.W, h: QUADRANT.H - QUADRANT.HEADER_H };

    const buildTailFace = (xL: number, yEdge: number, yMid: number, yBody: number, totalW: number): Array<[number, number]> => {
      const pts: Array<[number, number]> = [];
      pts.push([xL, yBody]);
      pts.push([xL, yMid]);
      pts.push([xL + halfP + dtOffset, yMid]);
      let tL = xL + halfP;
      pts.push([tL, yEdge]);
      for (let i = 0; i < nTails; i++) {
        const tR = tL + tailW;
        pts.push([tR, yEdge]);
        if (i < nTails - 1) {
          pts.push([tR - dtOffset, yMid]);
          const nL = tR + pinW;
          pts.push([nL + dtOffset, yMid]);
          pts.push([nL, yEdge]);
          tL = nL;
        }
      }
      const lastTR = tL + tailW;
      pts.push([lastTR - dtOffset, yMid]);
      pts.push([xL + totalW, yMid]);
      pts.push([xL + totalW, yBody]);
      return pts;
    };

    const tailPoints = buildTailFace(fBoardX, fTailRowY0, fTailRowY1, fBodyY1, fBoardW);

    return (
      <g>
        <polygon points={tailPoints.map((pt) => pt.join(",")).join(" ")}
          fill={COLOR.MORTISE} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        {/* 中心線 */}
        <CenterLine x1={fBoardX - 6} y1={fTailRowY1 + (fBodyY1 - fTailRowY1) / 2} x2={fBoardX + fBoardW + 6} y2={fTailRowY1 + (fBodyY1 - fTailRowY1) / 2} />
        <CenterLine x1={fBoardX + fBoardW / 2} y1={fBoardY - 8} x2={fBoardX + fBoardW / 2} y2={fBodyY1 + 8} />
        {/* 剖面 A-A */}
        <SectionMark x={fBoardX - 14} y={fTailRowY1} label="A" direction="right" />
        <SectionMark x={fBoardX + fBoardW + 14} y={fTailRowY1} label="A" direction="left" />
        {/* 尺寸 */}
        <DimLine x1={fBoardX} y1={fBodyY1} x2={fBoardX + fBoardW} y2={fBodyY1}
          label={`${cw}`}
          side={safeDimSide("bottom", `${cw}`, { x: fBoardX + fBoardW / 2, y: fBodyY1 }, qBounds)} />
        <DimLine x1={fBoardX} y1={fTailRowY0} x2={fBoardX} y2={fTailRowY1}
          label={`${tl}`}
          side={safeDimSide("left", `${tl}`, { x: fBoardX, y: (fTailRowY0 + fTailRowY1) / 2 }, qBounds)} />
        <DimLine x1={fBoardX} y1={fTailRowY1} x2={fBoardX} y2={fBodyY1}
          label={`${mt}`}
          side={safeDimSide("left", `${mt}`, { x: fBoardX, y: (fTailRowY1 + fBodyY1) / 2 }, qBounds)} />
        {/* 尾寬 */}
        {(() => {
          const t1L = fBoardX + halfP;
          const t1R = t1L + tailW;
          return (
            <DimLine x1={t1L} y1={fTailRowY0} x2={t1R} y2={fTailRowY0}
              label={`${Math.round(cw / (nTails * 1.55))}`}
              side={safeDimSide("top", `${Math.round(cw / (nTails * 1.55))}`, { x: (t1L + t1R) / 2, y: fTailRowY0 }, qBounds)} />
          );
        })()}
        <GrainArrow x={fBoardX + 8} y={fBodyY1 - 14} length={Math.min(60, fBoardW - 16)} angle={0} />
        <text x={fBoardX + fBoardW / 2} y={fTailRowY1 - 6} fontSize={FONT.CALLOUT} textAnchor="middle" fill={COLOR.DIM}>{angleLabel}</text>
      </g>
    );
  })();

  // ===== Q2 側視圖：pin board end-face cross-section =====
  const side = (() => {
    const bbox = { w: cw, h: ct };
    const s = unifiedFitScale(bbox);
    const PX = (mm: number) => mm * s;
    const objW = PX(bbox.w);
    const objH = PX(bbox.h);
    const place = placeInQuadrant({ w: objW, h: objH });
    const sBoardX = place.x;
    const sBoardY = place.y;
    const sBoardW = PX(cw);
    const sBoardH = PX(ct);
    const tailW = sBoardW / (nTails * 1.55);
    const pinW = tailW * 0.55;
    const halfP = pinW / 2;
    const sOffset = PX(tl) * 0.32;
    const qBounds = { x: 0, y: 0, w: QUADRANT.W, h: QUADRANT.H - QUADRANT.HEADER_H };

    return (
      <g>
        {/* pin board 端面 */}
        <rect x={sBoardX} y={sBoardY} width={sBoardW} height={sBoardH}
          fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        {/* nTails 個尾凹 */}
        {Array.from({ length: nTails }).map((_, i) => {
          const sx = sBoardX + halfP + i * (tailW + pinW);
          const points = [
            [sx, sBoardY],
            [sx + tailW, sBoardY],
            [sx + tailW - sOffset, sBoardY + sBoardH],
            [sx + sOffset, sBoardY + sBoardH],
          ];
          return (
            <polygon key={i} points={points.map((pt) => pt.join(",")).join(" ")}
              fill="white" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
          );
        })}
        <CenterLine x1={sBoardX - 6} y1={sBoardY + sBoardH / 2} x2={sBoardX + sBoardW + 6} y2={sBoardY + sBoardH / 2} />
        <CenterLine x1={sBoardX + sBoardW / 2} y1={sBoardY - 10} x2={sBoardX + sBoardW / 2} y2={sBoardY + sBoardH + 10} />

        <DimLine x1={sBoardX} y1={sBoardY + sBoardH} x2={sBoardX + sBoardW} y2={sBoardY + sBoardH}
          label={`${cw}`}
          side={safeDimSide("bottom", `${cw}`, { x: sBoardX + sBoardW / 2, y: sBoardY + sBoardH }, qBounds)} />
        <DimLine x1={sBoardX + sBoardW} y1={sBoardY} x2={sBoardX + sBoardW} y2={sBoardY + sBoardH}
          label={`${ct}`}
          side={safeDimSide("right", `${ct}`, { x: sBoardX + sBoardW, y: sBoardY + sBoardH / 2 }, qBounds)} />

        <text x={sBoardX + sBoardW / 2} y={sBoardY + sBoardH + 24}
          fontSize={FONT.CALLOUT} textAnchor="middle" fill={COLOR.OUTLINE}>{angleLabel}</text>
      </g>
    );
  })();

  // ===== Q3 俯視圖：L 型轉角剖面 =====
  const top = (() => {
    const tBoardLenMm = cw * 0.9;
    const bbox = { w: tBoardLenMm + ct, h: tBoardLenMm + tl };
    const s = unifiedFitScale(bbox);
    const PX = (mm: number) => mm * s;
    const objW = PX(bbox.w);
    const objH = PX(bbox.h);
    const place = placeInQuadrant({ w: objW, h: objH });
    const tCx = place.x + PX(tBoardLenMm);
    const tCy = place.y + PX(tl);
    const tBoardLen = PX(tBoardLenMm);
    const tTailDepth = PX(tl);
    const tPinThk = PX(ct);
    const qBounds = { x: 0, y: 0, w: QUADRANT.W, h: QUADRANT.H - QUADRANT.HEADER_H };

    return (
      <g>
        <defs>
          <Hatching id="hatch-dt-v2" color="#7a5a2c" />
        </defs>
        {/* 水平 tail board */}
        <rect x={tCx - tBoardLen} y={tCy - tTailDepth / 2}
          width={tBoardLen} height={tTailDepth}
          fill={COLOR.MORTISE} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        {/* 垂直 pin board */}
        <rect x={tCx - tPinThk / 2} y={tCy - tTailDepth / 2}
          width={tPinThk} height={tBoardLen}
          fill="url(#hatch-dt-v2)" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        {/* 鳩尾交鎖區 */}
        {(() => {
          const interlockX0 = tCx - tPinThk / 2;
          const interlockX1 = tCx + tPinThk / 2;
          const interlockY0 = tCy - tTailDepth / 2;
          const interlockY1 = tCy + tTailDepth / 2;
          const slotH = (interlockY1 - interlockY0) / nTails;
          const elements: React.ReactElement[] = [];
          for (let i = 0; i < nTails; i++) {
            const y0 = interlockY0 + slotH * i;
            const y1 = y0 + slotH;
            const off = slotH * 0.18;
            const points = [
              [interlockX0, y0],
              [interlockX1, y0 + off],
              [interlockX1, y1 - off],
              [interlockX0, y1],
            ];
            elements.push(
              <polygon key={i} points={points.map((pt) => pt.join(",")).join(" ")}
                fill={COLOR.MORTISE} stroke={COLOR.OUTLINE} strokeWidth={STROKE.HIDDEN} />
            );
          }
          return <g>{elements}</g>;
        })()}
        <CenterLine x1={tCx - tBoardLen - 6} y1={tCy} x2={tCx + tPinThk / 2 + 6} y2={tCy} />
        <CenterLine x1={tCx} y1={tCy - tTailDepth / 2 - 6} x2={tCx} y2={tCy + tBoardLen + 6} />

        <DimLine x1={tCx - tBoardLen} y1={tCy - tTailDepth / 2} x2={tCx + tPinThk / 2} y2={tCy - tTailDepth / 2}
          label={`${Math.round(cw * 0.9)}`}
          side={safeDimSide("top", `${Math.round(cw * 0.9)}`, { x: tCx - tBoardLen / 2, y: tCy - tTailDepth / 2 }, qBounds)} />
        <DimLine x1={tCx + tPinThk / 2} y1={tCy - tTailDepth / 2} x2={tCx + tPinThk / 2} y2={tCy + tTailDepth / 2}
          label={`${tl}`}
          side={safeDimSide("right", `${tl}`, { x: tCx + tPinThk / 2, y: tCy }, qBounds)} />
      </g>
    );
  })();

  // ===== Q4 等角圖：DovetailAxon3D（既有元件，nested svg 包進 quadrant）=====
  const isoClipId = `dovetail-iso-clip-v2-${Math.round(QUADRANT.W)}x${Math.round(QUADRANT.H)}`;
  const iso = (() => {
    const innerW = QUADRANT.W - 16;
    const innerH = QUADRANT.H - QUADRANT.HEADER_H - 12;
    return (
      <g>
        <defs>
          <clipPath id={isoClipId}>
            <rect x={8} y={6} width={innerW} height={innerH} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${isoClipId})`}>
          <svg
            x={8}
            y={6}
            width={innerW}
            height={innerH}
            viewBox="0 0 720 360"
            preserveAspectRatio="xMidYMid meet"
          >
            <DovetailAxon3D
              pieceLen={300}
              pieceDepth={tl * 1.5}
              bodyExt={tl * 1.5}
              tailW={300 / (nTails * 1.55)}
              pinW={(300 / (nTails * 1.55)) * 0.55}
              halfPinW_top={((300 / (nTails * 1.55)) * 0.55) / 2}
              N_TAILS={nTails}
              mt={mt}
              ct={ct}
              tw={tw}
              tl={tl}
            />
          </svg>
        </g>
      </g>
    );
  })();

  const sharedScale = unifiedFitScale({ w: cw, h: mt + tl });
  const scaleStr = sharedScale >= 1 ? `${Math.round(sharedScale)}:1` : `1:${Math.max(1, Math.round(1 / sharedScale))}`;

  return (
    <MasterDetailLayout
      type="dovetail"
      joineryNameZh={`鳩尾榫（${nTails} 尾 + 兩端半銷，${angleLabel}）`}
      drawingNumber={`DT-${nTails}T-${tw}x${tl}`}
      scale={scaleStr}
      frontView={front}
      sideView={side}
      topView={top}
      isoView={iso}
      warnings={[
        `順紋切尾、橫紋切銷`,
        `尾數 ${nTails} 個 + 兩端半銷，${angleLabel}`,
      ]}
    />
  );
}
/* === END dovetail-detail v2 === */

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
function LegacyV2FingerJointDetail(p: JoineryDetailParams) {
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

    // aOX 預留左側空間給 DimLine 標籤（mt/fingerLen 數字最大時不被截斷）
    const dimLeftPad = Math.max(28, String(Math.max(mt, fingerLen)).length * 8 + 12);
    const aOX = pad + dimLeftPad;
    const aOY = pad + 12;
    const bOX = pad + dimLeftPad;
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
        <rect x={4} y={20} width={innerW - 8} height={innerH - 28} fill="white" stroke="#999" strokeWidth={0.5} />
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
        <rect x={4} y={20} width={innerW - 8} height={innerH - 28} fill="white" stroke="#999" strokeWidth={0.5} />
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
        <rect x={4} y={20} width={innerW - 8} height={innerH - 28} fill="white" stroke="#999" strokeWidth={0.5} />
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

  // ===== 等角圖（右下）：Phase 3 helper 6 件套，板深度恢復 + IsoTenon 強制 3 面 =====
  const isoOriginX = 200;
  const isoOriginY = 220;
  const iso = (() => {
    const isoScale = Math.min(1.1, 100 / Math.max(1, cw));
    const drawCw = cw;
    const drawCt = ct;
    const drawFL = fingerLen;
    const drawTT = tt;
    const boardBackLen = 40; // 板身延伸長度（不含指齒）
    const bGapMm = drawFL + 20;

    return (
      <g>
        <rect x={4} y={20} width={467} height={302} fill="white" stroke="#999" strokeWidth={0.5} />
        <text x={20} y={14} fontSize={FONT.LABEL} fontWeight="bold" fill={COLOR.OUTLINE}>等角圖（30° 軸測，A/B 兩件互補拆解）</text>
        <text x={20} y={28} fontSize={FONT.CALLOUT} fill="#888">
          指數 = floor({cw}/{tt}) = {fingerCount}，指長 {fingerLen} mm
        </text>
        <IsometricGroup originX={isoOriginX} originY={isoOriginY} scale={isoScale * 1.0} rotation={30}>
          {/* A 件板身（指齒下方延伸） */}
          <IsoCuboid
            x={0}
            y={drawFL}
            z={0}
            w={drawCw}
            h={boardBackLen}
            d={drawCt}
            fillFront={ISO_FILL.TENON_FRONT}
            fillTop={ISO_FILL.TENON_TOP}
            fillSide={ISO_FILL.TENON_SIDE}
            strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / isoScale}
          />
          {/* A 件 N 個指齒（向上 -y 凸出） */}
          {Array.from({ length: fingerCount }).map((_, i) => {
            const x = shoulderEachMm + i * drawTT;
            return (
              <IsoCuboid
                key={`a-${i}`}
                x={x}
                y={0}
                z={0}
                w={drawTT}
                h={drawFL}
                d={drawCt}
                fillFront={ISO_FILL.TENON_FRONT}
                fillTop={ISO_FILL.TENON_TOP}
                fillSide={ISO_FILL.TENON_SIDE}
                strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / isoScale}
                showHiddenBackEdges={false}
              />
            );
          })}
          {/* B 件板身（在 A 上方 explode） */}
          <g transform={`translate(0 ${-bGapMm - drawFL - boardBackLen})`}>
            <IsoCuboid
              x={0}
              y={0}
              z={0}
              w={drawCw}
              h={boardBackLen}
              d={drawCt}
              fillFront={ISO_FILL.MORTISE_FRONT}
              fillTop={ISO_FILL.MORTISE_TOP}
              fillSide={ISO_FILL.MORTISE_SIDE}
              strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / isoScale}
            />
            {/* B 件 N-1 個指齒（向下 +y 凸出） */}
            {Array.from({ length: fingerCount - 1 }).map((_, i) => {
              const x = shoulderEachMm + (i + 1) * drawTT - drawTT / 2 + drawTT / 2;
              return (
                <IsoCuboid
                  key={`b-${i}`}
                  x={shoulderEachMm + (i + 0.5) * drawTT + drawTT / 2 - drawTT / 2}
                  y={boardBackLen}
                  z={0}
                  w={drawTT}
                  h={drawFL}
                  d={drawCt}
                  fillFront={ISO_FILL.MORTISE_FRONT}
                  fillTop={ISO_FILL.MORTISE_TOP}
                  fillSide={ISO_FILL.MORTISE_SIDE}
                  strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / isoScale}
                  showHiddenBackEdges={false}
                />
              );
            })}
          </g>
          {/* 組裝箭頭（B → A 往下） */}
          <line
            x1={drawCw / 2}
            y1={-bGapMm + 2}
            x2={drawCw / 2}
            y2={-2}
            stroke={COLOR.DIM}
            strokeWidth={1 / isoScale}
            strokeDasharray={ISO_DASH.ARROW}
          />
        </IsometricGroup>
        <text x={isoOriginX - 60} y={isoOriginY - 70} fontSize={FONT.CALLOUT} fill={COLOR.OUTLINE}>B 件</text>
        <text x={isoOriginX - 60} y={isoOriginY + 50} fontSize={FONT.CALLOUT} fill={COLOR.OUTLINE}>A 件</text>
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
            drawingNumber={`FJ-${tt}-${cw}-N${fingerCount}`}
          />
        }
      />
      {/* 比例尺與 ScaleBar 放在標題欄上方 */}
      <ScaleBar x={W - 220} y={H - 80} widthMm={Math.max(40, cw * 0.4)} pxPerMm={Math.min(2, 200 / Math.max(20, cw))} segments={4} label="mm" />
    </svg>
  );
}
/* === END finger-joint-detail (legacy) === */

/* === BEGIN finger-joint-detail v2 (Wave 2b Group B) ===
 * 指接榫 finger-joint — MasterDetailLayout + 統一 helper（unified-visual-spec）
 * ============================================================ */
function FingerJointDetail(p: JoineryDetailParams) {
  const tt = p.tenonThickness;
  const mt = p.motherThickness;
  const ct = p.childThickness ?? tt;
  const cw = p.childWidth ?? p.tenonWidth;

  const ttSafe = Math.max(1, tt);
  const fingerCount = Math.max(3, Math.floor(cw / ttSafe));
  const fingerLen = mt;
  const fingersTotalMm = fingerCount * tt;
  const shoulderTotalMm = Math.max(0, cw - fingersTotalMm);
  const shoulderEachMm = shoulderTotalMm / 2;

  // ===== Q1 正視圖：A / B 兩件分解（垂直堆疊）=====
  const front = (() => {
    // bbox：寬 = cw、高 = (mt+fingerLen)*2 + 38（兩件 + 中間 gap）
    const gapMm = Math.max(20, mt * 1.2);
    const bbox = { w: cw, h: (mt + fingerLen) * 2 + gapMm };
    const s = unifiedFitScale(bbox);
    const PX = (mm: number) => mm * s;
    const objW = PX(bbox.w);
    const objH = PX(bbox.h);
    const place = placeInQuadrant({ w: objW, h: objH });
    const aOX = place.x;
    const aOY = place.y;
    const bOX = aOX;
    const bOY = aOY + PX(mt + fingerLen) + PX(gapMm);
    const qBounds = { x: 0, y: 0, w: QUADRANT.W, h: QUADRANT.H - QUADRANT.HEADER_H };

    // A 件鋸齒輪廓（指齒朝上）
    const buildAPoints = (oX: number, oY: number) => {
      const pts: string[] = [`${oX},${oY + PX(fingerLen + mt)}`, `${oX},${oY + PX(fingerLen)}`];
      let cx = oX + PX(shoulderEachMm);
      pts.push(`${cx},${oY + PX(fingerLen)}`);
      for (let i = 0; i < fingerCount; i++) {
        pts.push(`${cx},${oY}`);
        pts.push(`${cx + PX(tt)},${oY}`);
        pts.push(`${cx + PX(tt)},${oY + PX(fingerLen)}`);
        cx += PX(tt);
        if (i < fingerCount - 1) {
          pts.push(`${cx + PX(tt) * 0},${oY + PX(fingerLen)}`);
        }
      }
      pts.push(`${oX + PX(cw)},${oY + PX(fingerLen)}`);
      pts.push(`${oX + PX(cw)},${oY + PX(fingerLen + mt)}`);
      return pts.join(" ");
    };
    // B 件互補鋸齒（指齒朝下）
    const buildBPoints = (oX: number, oY: number) => {
      const pts: string[] = [`${oX},${oY}`, `${oX},${oY + PX(mt)}`];
      let cx = oX + PX(shoulderEachMm);
      pts.push(`${cx},${oY + PX(mt)}`);
      for (let i = 0; i < fingerCount; i++) {
        if (i === 0) {
          pts.push(`${cx + PX(tt)},${oY + PX(mt)}`);
        } else {
          pts.push(`${cx},${oY + PX(mt + fingerLen)}`);
          pts.push(`${cx + PX(tt)},${oY + PX(mt + fingerLen)}`);
          pts.push(`${cx + PX(tt)},${oY + PX(mt)}`);
          pts.push(`${cx + PX(tt) * 2},${oY + PX(mt)}`);
        }
        cx += PX(tt) * (i === 0 ? 1 : 2);
        if (cx >= oX + PX(cw - shoulderEachMm)) break;
      }
      pts.push(`${oX + PX(cw)},${oY + PX(mt)}`);
      pts.push(`${oX + PX(cw)},${oY}`);
      return pts.join(" ");
    };

    return (
      <g>
        {/* A 件（指齒朝上） */}
        <polygon points={buildAPoints(aOX, aOY)} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        <text x={aOX + PX(cw) / 2} y={aOY + PX(fingerLen + mt) + 14} fontSize={FONT.DIM} textAnchor="middle" fill={COLOR.OUTLINE}>
          A 件（{fingerCount} 指）
        </text>
        {/* 板厚 + 指長 dim */}
        <DimLine x1={aOX} y1={aOY} x2={aOX} y2={aOY + PX(fingerLen)}
          label={`${fingerLen}`}
          side={safeDimSide("left", `${fingerLen}`, { x: aOX, y: aOY + PX(fingerLen) / 2 }, qBounds)} />
        <DimLine x1={aOX} y1={aOY + PX(fingerLen)} x2={aOX} y2={aOY + PX(fingerLen + mt)}
          label={`${mt}`}
          side={safeDimSide("left", `${mt}`, { x: aOX, y: aOY + PX(fingerLen + mt / 2) }, qBounds)} />
        {/* 指寬（第一指） */}
        <DimLine x1={aOX + PX(shoulderEachMm)} y1={aOY} x2={aOX + PX(shoulderEachMm + tt)} y2={aOY}
          label={`${tt}`}
          side={safeDimSide("top", `${tt}`, { x: aOX + PX(shoulderEachMm + tt / 2), y: aOY }, qBounds)} />
        {/* 中心線 */}
        <CenterLine x1={aOX + PX(cw) / 2} y1={aOY - 6} x2={aOX + PX(cw) / 2} y2={aOY + PX(fingerLen + mt) + 6} />

        {/* B 件（指齒朝下） */}
        <polygon points={buildBPoints(bOX, bOY)} fill={COLOR.MORTISE} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        <text x={bOX + PX(cw) / 2} y={bOY + PX(mt + fingerLen) + 14} fontSize={FONT.DIM} textAnchor="middle" fill={COLOR.OUTLINE}>
          B 件（互補指齒）
        </text>
        <CenterLine x1={bOX + PX(cw) / 2} y1={bOY - 6} x2={bOX + PX(cw) / 2} y2={bOY + PX(mt + fingerLen) + 6} />

        {/* 木紋方向 */}
        <GrainArrow x={aOX + 8} y={aOY + PX(fingerLen + mt / 2)} length={Math.min(40, PX(cw) * 0.4)} angle={0} />
        <GrainArrow x={bOX + 8} y={bOY + PX(mt / 2)} length={Math.min(40, PX(cw) * 0.4)} angle={0} />

        {/* 剖面 A-A */}
        <SectionMark x={aOX + PX(cw) / 2 - 14} y={aOY - 14} label="A" direction="right" />
        <SectionMark x={aOX + PX(cw) / 2 + 14} y={aOY - 14} label="A" direction="left" />
      </g>
    );
  })();

  // ===== Q2 側視圖：L 型轉角斷面 =====
  const side = (() => {
    const armLen = Math.max(80, mt * 4);
    const bbox = { w: armLen + ct, h: armLen + ct };
    const s = unifiedFitScale(bbox);
    const PX = (mm: number) => mm * s;
    const objW = PX(bbox.w);
    const objH = PX(bbox.h);
    const place = placeInQuadrant({ w: objW, h: objH });
    const oX = place.x;
    const oY = place.y;
    const qBounds = { x: 0, y: 0, w: QUADRANT.W, h: QUADRANT.H - QUADRANT.HEADER_H };
    const hatchId = "hatch-finger-side-v2";

    return (
      <g>
        <defs>
          <Hatching id={hatchId} color={COLOR.SECTION_HATCH} />
        </defs>
        {/* 水平件 A */}
        <rect x={oX} y={oY} width={PX(armLen)} height={PX(ct)} fill={`url(#${hatchId})`} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        <rect x={oX} y={oY} width={PX(armLen)} height={PX(ct)} fill="none" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        {/* 垂直件 B */}
        <rect x={oX + PX(armLen)} y={oY} width={PX(ct)} height={PX(armLen)} fill={`url(#${hatchId})`} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        <rect x={oX + PX(armLen)} y={oY} width={PX(ct)} height={PX(armLen)} fill="none" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />

        {/* 指接縫虛線 */}
        {Array.from({ length: fingerCount * 2 - 1 }).map((_, i) => {
          const segH = PX(ct) / (fingerCount * 2);
          const y = oY + segH * (i + 1);
          return (
            <HiddenEdge key={i} x1={oX + PX(armLen)} y1={y} x2={oX + PX(armLen) + PX(ct)} y2={y} />
          );
        })}

        {/* dim */}
        <DimLine x1={oX + PX(armLen) + PX(ct)} y1={oY} x2={oX + PX(armLen) + PX(ct)} y2={oY + PX(ct)}
          label={`${ct}`}
          side={safeDimSide("right", `${ct}`, { x: oX + PX(armLen) + PX(ct), y: oY + PX(ct) / 2 }, qBounds)} />
        <DimLine x1={oX} y1={oY + PX(ct)} x2={oX + PX(armLen)} y2={oY + PX(ct)}
          label={`${Math.round(armLen)}`}
          side={safeDimSide("bottom", `${Math.round(armLen)}`, { x: oX + PX(armLen / 2), y: oY + PX(ct) }, qBounds)} />
        <text x={oX + PX(armLen) / 2} y={oY + PX(ct) / 2 + 3} fontSize={FONT.DIM} textAnchor="middle" fill={COLOR.OUTLINE}>A 件（剖面）</text>
        <text x={oX + PX(armLen) + PX(ct) / 2} y={oY + PX(armLen) + 12} fontSize={FONT.DIM} textAnchor="middle" fill={COLOR.OUTLINE}>B 件</text>
      </g>
    );
  })();

  // ===== Q3 俯視圖：上方俯瞰指齒交錯 =====
  const top = (() => {
    const bbox = { w: cw, h: ct * 2 + fingerLen * 2 + 30 };
    const s = unifiedFitScale(bbox);
    const PX = (mm: number) => mm * s;
    const objW = PX(bbox.w);
    const objH = PX(bbox.h);
    const place = placeInQuadrant({ w: objW, h: objH });
    const oX = place.x;
    const oY = place.y + PX(fingerLen);
    const rowH = PX(ct);
    const qBounds = { x: 0, y: 0, w: QUADRANT.W, h: QUADRANT.H - QUADRANT.HEADER_H };

    return (
      <g>
        {/* A 件本體 */}
        <rect x={oX} y={oY} width={PX(cw)} height={rowH} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        {/* 端肩 */}
        {shoulderEachMm > 0 && (
          <>
            <rect x={oX} y={oY - PX(fingerLen)} width={PX(shoulderEachMm)} height={PX(fingerLen)} fill="white" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
            <rect x={oX + PX(cw - shoulderEachMm)} y={oY - PX(fingerLen)} width={PX(shoulderEachMm)} height={PX(fingerLen)} fill="white" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
          </>
        )}
        {/* N 個 A 指齒往上凸 */}
        {Array.from({ length: fingerCount }).map((_, i) => (
          <rect key={i} x={oX + PX(shoulderEachMm + i * tt)} y={oY - PX(fingerLen)}
            width={PX(tt)} height={PX(fingerLen)} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        ))}
        <text x={oX + PX(cw) / 2} y={oY + rowH + 12} fontSize={FONT.DIM} textAnchor="middle" fill={COLOR.OUTLINE}>A 件俯視</text>

        {/* B 件 */}
        <g transform={`translate(0,${PX(fingerLen) + rowH + 30})`}>
          <rect x={oX} y={oY} width={PX(cw)} height={rowH} fill={COLOR.MORTISE} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
          {Array.from({ length: fingerCount - 1 }).map((_, i) => (
            <rect key={i}
              x={oX + PX(shoulderEachMm + (i + 0.5) * tt + 0.5 * tt)}
              y={oY - PX(fingerLen)}
              width={PX(tt)} height={PX(fingerLen)}
              fill={COLOR.MORTISE} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
          ))}
          <text x={oX + PX(cw) / 2} y={oY + rowH + 12} fontSize={FONT.DIM} textAnchor="middle" fill={COLOR.OUTLINE}>B 件俯視（互補）</text>
        </g>

        {/* 板寬 dim */}
        <DimLine x1={oX} y1={oY - PX(fingerLen)} x2={oX + PX(cw)} y2={oY - PX(fingerLen)}
          label={`板寬 ${cw}`}
          side={safeDimSide("top", `板寬 ${cw}`, { x: oX + PX(cw) / 2, y: oY - PX(fingerLen) }, qBounds)} />
      </g>
    );
  })();

  // ===== Q4 等角圖：A/B 兩件互補拆解 =====
  const iso = (() => {
    const isoBbox = { w: cw + 40, h: fingerLen * 2 + mt * 2 + 60, d: ct };
    const isoScale = unifiedFitScale(isoBbox, { targetUsage: 0.65 });
    const center = { x: QUADRANT.W / 2, y: (QUADRANT.H - QUADRANT.HEADER_H) / 2 };
    const drawCw = cw;
    const drawCt = ct;
    const drawFL = fingerLen;
    const drawTT = tt;
    const boardBackLen = 40;
    const bGapMm = drawFL + 20;

    return (
      <g>
        <IsometricGroup originX={center.x - (drawCw * isoScale) / 2} originY={center.y + 10} scale={isoScale} rotation={30}>
          {/* A 件板身 */}
          <IsoCuboid x={0} y={drawFL} z={0} w={drawCw} h={boardBackLen} d={drawCt}
            fillFront={ISO_FILL.TENON_FRONT} fillTop={ISO_FILL.TENON_TOP} fillSide={ISO_FILL.TENON_SIDE}
            strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / Math.max(0.4, isoScale)} />
          {/* A 件 N 指齒 */}
          {Array.from({ length: fingerCount }).map((_, i) => (
            <IsoCuboid key={`a-${i}`}
              x={shoulderEachMm + i * drawTT} y={0} z={0}
              w={drawTT} h={drawFL} d={drawCt}
              fillFront={ISO_FILL.TENON_FRONT} fillTop={ISO_FILL.TENON_TOP} fillSide={ISO_FILL.TENON_SIDE}
              strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / Math.max(0.4, isoScale)}
              showHiddenBackEdges={false} />
          ))}
          {/* B 件板身（上方 explode） */}
          <g transform={`translate(0 ${-bGapMm - drawFL - boardBackLen})`}>
            <IsoCuboid x={0} y={0} z={0} w={drawCw} h={boardBackLen} d={drawCt}
              fillFront={ISO_FILL.MORTISE_FRONT} fillTop={ISO_FILL.MORTISE_TOP} fillSide={ISO_FILL.MORTISE_SIDE}
              strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / Math.max(0.4, isoScale)} />
            {Array.from({ length: fingerCount - 1 }).map((_, i) => (
              <IsoCuboid key={`b-${i}`}
                x={shoulderEachMm + (i + 0.5) * drawTT + drawTT / 2 - drawTT / 2}
                y={boardBackLen} z={0}
                w={drawTT} h={drawFL} d={drawCt}
                fillFront={ISO_FILL.MORTISE_FRONT} fillTop={ISO_FILL.MORTISE_TOP} fillSide={ISO_FILL.MORTISE_SIDE}
                strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / Math.max(0.4, isoScale)}
                showHiddenBackEdges={false} />
            ))}
          </g>
          {/* 組裝箭頭 */}
          <line x1={drawCw / 2} y1={-bGapMm + 2} x2={drawCw / 2} y2={-2}
            stroke={COLOR.DIM} strokeWidth={1 / Math.max(0.4, isoScale)} strokeDasharray={ISO_DASH.ARROW} />
        </IsometricGroup>
      </g>
    );
  })();

  const sharedScale = unifiedFitScale({ w: cw, h: (mt + fingerLen) * 2 + Math.max(20, mt * 1.2) });
  const scaleStr = sharedScale >= 1 ? `${Math.round(sharedScale)}:1` : `1:${Math.max(1, Math.round(1 / sharedScale))}`;

  return (
    <MasterDetailLayout
      type="finger-joint"
      joineryNameZh="指接（box joint）"
      drawingNumber={`FJ-${tt}-${cw}-N${fingerCount}`}
      scale={scaleStr}
      frontView={front}
      sideView={side}
      topView={top}
      isoView={iso}
      warnings={[
        `指數 = floor(${cw}/${tt}) = ${fingerCount}`,
        `指齒尖角應磨 R0.5 防爆裂`,
      ]}
    />
  );
}
/* === END finger-joint-detail v2 === */

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
/** Legacy V2（previous unified pre-MasterDetailLayout version, kept as escape hatch for Wave 2a try-water） */
function LegacyV2DowelDetail(p: JoineryDetailParams) {
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
        <rect x={4} y={20} width={innerW - 8} height={innerH - 28} fill="white" stroke="#999" strokeWidth={0.5} />
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
        <rect x={4} y={20} width={innerW - 8} height={innerH - 28} fill="white" stroke="#999" strokeWidth={0.5} />
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

        {/* dim 釘徑 / 板厚 / 板寬 / 間距（縱向錯開避免重疊） */}
        <DimLine x1={oX + PX(ct) + 8} y1={oY + PX(spacing) - PX(tt) / 2} x2={oX + PX(ct) + 8} y2={oY + PX(spacing) + PX(tt) / 2} label={`Ø ${tt}`} side="right" />
        <DimLine x1={oX} y1={oY + PX(cw) + 20} x2={oX + PX(ct)} y2={oY + PX(cw) + 20} label={`板厚 ${ct}`} side="bottom" />
        <DimLine x1={oX - 20} y1={oY} x2={oX - 20} y2={oY + PX(cw)} label={`板寬 ${cw}`} side="left" />
        {dowelCount >= 2 && (
          <DimLine
            x1={oX + PX(ct) + 48}
            y1={oY + PX(spacing)}
            x2={oX + PX(ct) + 48}
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
        <rect x={4} y={20} width={innerW - 8} height={innerH - 28} fill="white" stroke="#999" strokeWidth={0.5} />
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

  // ===== 等角圖（右下）：Phase 3 helper — 兩塊 IsoCuboid + IsoCylinder dowel =====
  const iso = (() => {
    const isoScale = Math.min(1.0, 90 / Math.max(1, mt));
    const drawMt = mt;
    const drawCt = ct;
    const drawTt = tt;
    const drawTl = tl;
    const drawHd = holeDepthSafe;
    const explodeGap = drawTl + 8;

    return (
      <g>
        <rect x={4} y={20} width={467} height={302} fill="white" stroke="#999" strokeWidth={0.5} />
        <text x={20} y={14} fontSize={FONT.LABEL} fontWeight="bold" fill={COLOR.OUTLINE}>等角圖（30° 軸測，木釘陣列拆解）</text>
        <text x={20} y={28} fontSize={FONT.CALLOUT} fill="#888">
          {dowelCount} 釘陣列 · Ø {tt} · 釘長 {tl} (= 兩側孔深 {Math.round(drawHd)} ×2)
        </text>
        <IsometricGroup originX={170} originY={220} scale={isoScale * 1.0} rotation={30}>
          {/* A 件（左板） — IsoCuboid */}
          <IsoCuboid
            x={0}
            y={-drawCt / 2}
            z={0}
            w={drawMt}
            h={drawCt}
            d={drawMt * 0.8}
            fillFront={ISO_FILL.TENON_FRONT}
            fillTop={ISO_FILL.TENON_TOP}
            fillSide={ISO_FILL.TENON_SIDE}
            strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / isoScale}
          />
          {/* B 件（右板，沿 +x explode） — IsoCuboid */}
          <g transform={`translate(${(drawMt + explodeGap) * 1} 0)`}>
            <IsoCuboid
              x={0}
              y={-drawCt / 2}
              z={0}
              w={drawMt}
              h={drawCt}
              d={drawMt * 0.8}
              fillFront={ISO_FILL.MORTISE_FRONT}
              fillTop={ISO_FILL.MORTISE_TOP}
              fillSide={ISO_FILL.MORTISE_SIDE}
              strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / isoScale}
            />
          </g>
          {/* 木釘陣列（沿 z 排列在板厚中央，水平軸 = x 方向）
              我們用 axis="z" 的圓柱沿 x 旋轉 → 改用一個 cuboid 退化（IsoCylinder.x axis 已退化為 cuboid）*/}
          {Array.from({ length: dowelCount }).map((_, i) => {
            const zOff = ((i + 1) * (drawMt * 0.8) / (dowelCount + 1)) - drawMt * 0.4;
            // 釘從 A 件右面 (x=drawMt-drawHd) 凸出 drawTl，axis 沿 +x
            return (
              <g key={i}>
                {/* 突出段 (在 A 件外，可見) */}
                <IsoCuboid
                  x={drawMt - drawHd}
                  y={-drawTt / 2}
                  z={zOff - drawTt / 2}
                  w={drawTl}
                  h={drawTt}
                  d={drawTt}
                  fillFront={ISO_FILL.MORTISE_FRONT}
                  fillTop={ISO_FILL.MORTISE_TOP}
                  fillSide={ISO_FILL.MORTISE_SIDE}
                  strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / isoScale}
                  showHiddenBackEdges={false}
                />
                {/* 端面 — 圓 (橢圓投影) */}
                <IsoCylinder
                  x={drawMt - drawHd + drawTl}
                  y={0}
                  z={zOff}
                  radius={drawTt / 2}
                  height={0.1}
                  axis="z"
                  fillCap={ISO_FILL.TENON_FRONT}
                  fillSide={ISO_FILL.TENON_SIDE}
                  strokeWidth={ISO_STROKE.EDGE_INTERIOR / isoScale}
                />
                {/* 埋入 A 件段 (虛線) */}
                <IsoCuboid
                  x={drawMt - drawHd - drawHd}
                  y={-drawTt / 2}
                  z={zOff - drawTt / 2}
                  w={drawHd}
                  h={drawTt}
                  d={drawTt}
                  fillFront="none"
                  fillTop="none"
                  fillSide="none"
                  hidden={true}
                  strokeWidth={ISO_STROKE.HIDDEN_DASHED / isoScale}
                />
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
            drawingNumber={`DW-Ø${tt}xL${tl}-N${dowelCount}`}
          />
        }
      />
      <ScaleBar x={W - 220} y={H - 80} widthMm={Math.max(40, mt * 0.8)} pxPerMm={Math.min(2, 200 / Math.max(20, mt))} segments={4} label="mm" />
    </svg>
  );
}

/**
 * DowelDetail（Wave 2a unified visual spec 版）—
 * 用 MasterDetailLayout + unifiedFitScale + safeDimSide 重構。
 * 4 quadrant 排列：Q1 正視 / Q2 側視 / Q3 俯視 / Q4 等角，
 * 物件嚴格在 quadrant viewable area 內居中。
 */
function DowelDetail(p: JoineryDetailParams) {
  const tl = p.tenonLength;
  const tt = p.tenonThickness; // 釘徑 Ø
  const mt = p.motherThickness;
  const ct = p.childThickness ?? tt;
  const cw = p.childWidth ?? p.tenonWidth;

  const ttSafe = Math.max(1, tt);
  const dowelCount = Math.max(2, Math.floor(cw / (ttSafe * 4)));
  // 每孔深 = (tl/2) + 0.5mm 餘量；母件厚必須 > 孔深 + 3mm
  const holeDepth = Math.min(mt - 3, tl / 2 + 0.5);
  const holeDepthSafe = Math.max(3, holeDepth);
  const spacing = cw / (dowelCount + 1);

  // ===== Q1 正視圖：兩件對接 + 木釘剖面 =====
  const front = (() => {
    const bbox = { w: mt * 2, h: ct };
    const s = unifiedFitScale(bbox);
    const PX = (mm: number) => mm * s;
    const objW = PX(bbox.w);
    const objH = PX(bbox.h);
    const place = placeInQuadrant({ w: objW, h: objH });
    const oX = place.x;
    const oY = place.y;
    const qBounds = { x: 0, y: 0, w: QUADRANT.W, h: QUADRANT.H - QUADRANT.HEADER_H };

    return (
      <g>
        {/* A 件（左） */}
        <rect x={oX} y={oY} width={PX(mt)} height={PX(ct)} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        {/* B 件（右） */}
        <rect x={oX + PX(mt)} y={oY} width={PX(mt)} height={PX(ct)} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />

        {/* 接縫中軸 */}
        <CenterLine x1={oX + PX(mt)} y1={oY - 8} x2={oX + PX(mt)} y2={oY + PX(ct) + 8} />

        {/* 木釘陣列（剖面：橫躺圓柱 + 兩孔虛線） */}
        {Array.from({ length: dowelCount }).map((_, i) => {
          const dy = oY + PX(spacing * (i + 1));
          if (dy > oY + PX(ct) - PX(tt) / 2) return null;
          return (
            <g key={i}>
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
              <HiddenEdge x1={oX + PX(mt - holeDepthSafe)} y1={dy - PX(tt) / 2} x2={oX + PX(mt + holeDepthSafe)} y2={dy - PX(tt) / 2} />
              <HiddenEdge x1={oX + PX(mt - holeDepthSafe)} y1={dy + PX(tt) / 2} x2={oX + PX(mt + holeDepthSafe)} y2={dy + PX(tt) / 2} />
            </g>
          );
        })}

        {/* 尺寸 */}
        <DimLine
          x1={oX} y1={oY} x2={oX + PX(mt)} y2={oY}
          label={`A厚 ${mt}`}
          side={safeDimSide("top", `A厚 ${mt}`, { x: oX + PX(mt) / 2, y: oY }, qBounds)}
        />
        <DimLine
          x1={oX + PX(mt)} y1={oY} x2={oX + PX(mt * 2)} y2={oY}
          label={`B厚 ${mt}`}
          side={safeDimSide("top", `B厚 ${mt}`, { x: oX + PX(mt * 1.5), y: oY }, qBounds)}
        />
        <DimLine
          x1={oX + PX(mt - holeDepthSafe)} y1={oY + PX(ct)} x2={oX + PX(mt + holeDepthSafe)} y2={oY + PX(ct)}
          label={`釘長 ${tl}`}
          side={safeDimSide("bottom", `釘長 ${tl}`, { x: oX + PX(mt), y: oY + PX(ct) }, qBounds)}
        />
        <DimLine
          x1={oX} y1={oY} x2={oX} y2={oY + PX(ct)}
          label={`板寬 ${ct}`}
          side={safeDimSide("left", `板寬 ${ct}`, { x: oX, y: oY + PX(ct) / 2 }, qBounds)}
        />

        {/* 剖面 A-A（在物件下方） */}
        {oY + PX(ct) + 24 < QUADRANT.H - QUADRANT.HEADER_H && (
          <>
            <SectionMark x={oX + PX(mt) - 14} y={oY + PX(ct) + 22} label="A" direction="right" />
            <SectionMark x={oX + PX(mt) + 14} y={oY + PX(ct) + 22} label="A" direction="left" />
          </>
        )}
      </g>
    );
  })();

  // ===== Q2 側視圖：板斷面 + 鑽孔陣列 =====
  const side = (() => {
    const bbox = { w: ct, h: cw };
    const s = unifiedFitScale(bbox);
    const PX = (mm: number) => mm * s;
    const objW = PX(bbox.w);
    const objH = PX(bbox.h);
    const place = placeInQuadrant({ w: objW, h: objH });
    const oX = place.x;
    const oY = place.y;
    const qBounds = { x: 0, y: 0, w: QUADRANT.W, h: QUADRANT.H - QUADRANT.HEADER_H };

    return (
      <g>
        <defs>
          <Hatching id="hatch-dowel-side-v2" color={COLOR.SECTION_HATCH} />
        </defs>
        <rect x={oX} y={oY} width={PX(ct)} height={PX(cw)} fill="url(#hatch-dowel-side-v2)" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        <rect x={oX} y={oY} width={PX(ct)} height={PX(cw)} fill="none" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />

        {/* 鑽孔 */}
        {Array.from({ length: dowelCount }).map((_, i) => {
          const cy = oY + PX(spacing * (i + 1));
          const cxC = oX + PX(ct / 2);
          return (
            <g key={i}>
              <circle cx={cxC} cy={cy} r={PX(tt) / 2} fill="white" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
              <CenterLine x1={cxC - PX(tt) * 0.7} y1={cy} x2={cxC + PX(tt) * 0.7} y2={cy} />
              <CenterLine x1={cxC} y1={cy - PX(tt) * 0.7} x2={cxC} y2={cy + PX(tt) * 0.7} />
            </g>
          );
        })}

        {/* dim */}
        <DimLine
          x1={oX} y1={oY + PX(cw)} x2={oX + PX(ct)} y2={oY + PX(cw)}
          label={`板厚 ${ct}`}
          side={safeDimSide("bottom", `板厚 ${ct}`, { x: oX + PX(ct) / 2, y: oY + PX(cw) }, qBounds)}
        />
        <DimLine
          x1={oX} y1={oY} x2={oX} y2={oY + PX(cw)}
          label={`板寬 ${cw}`}
          side={safeDimSide("left", `板寬 ${cw}`, { x: oX, y: oY + PX(cw) / 2 }, qBounds)}
        />
        {dowelCount >= 2 && (
          <DimLine
            x1={oX + PX(ct)} y1={oY + PX(spacing)} x2={oX + PX(ct)} y2={oY + PX(spacing * 2)}
            label={`間距 ${Math.round(spacing)}`}
            side={safeDimSide("right", `間距 ${Math.round(spacing)}`, { x: oX + PX(ct), y: oY + PX(spacing * 1.5) }, qBounds)}
          />
        )}
        <DimLine
          x1={oX + PX(ct)} y1={oY + PX(spacing) - PX(tt) / 2} x2={oX + PX(ct)} y2={oY + PX(spacing) + PX(tt) / 2}
          label={`Ø ${tt}`}
          side={safeDimSide("right", `Ø ${tt}`, { x: oX + PX(ct), y: oY + PX(spacing) }, qBounds)}
        />
      </g>
    );
  })();

  // ===== Q3 俯視圖：兩件對接帶白膠塗佈面 =====
  const top = (() => {
    const bbox = { w: mt * 2, h: cw };
    const s = unifiedFitScale(bbox);
    const PX = (mm: number) => mm * s;
    const objW = PX(bbox.w);
    const objH = PX(bbox.h);
    const place = placeInQuadrant({ w: objW, h: objH });
    const oX = place.x;
    const oY = place.y;
    const qBounds = { x: 0, y: 0, w: QUADRANT.W, h: QUADRANT.H - QUADRANT.HEADER_H };

    return (
      <g>
        {/* A 件俯視 */}
        <rect x={oX} y={oY} width={PX(mt)} height={PX(cw)} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        {/* B 件俯視 */}
        <rect x={oX + PX(mt)} y={oY} width={PX(mt)} height={PX(cw)} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />

        {/* 中縫白膠塗佈面 */}
        <rect x={oX + PX(mt) - 2} y={oY} width={4} height={PX(cw)} fill={COLOR.SECTION_HATCH} fillOpacity={0.4} stroke="none" />

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

        {/* dim 孔深 */}
        <DimLine
          x1={oX + PX(mt - holeDepthSafe)} y1={oY + PX(cw)} x2={oX + PX(mt)} y2={oY + PX(cw)}
          label={`孔深 ${Math.round(holeDepthSafe)}`}
          side={safeDimSide("bottom", `孔深 ${Math.round(holeDepthSafe)}`, { x: oX + PX(mt - holeDepthSafe / 2), y: oY + PX(cw) }, qBounds)}
        />
        <DimLine
          x1={oX + PX(mt)} y1={oY + PX(cw)} x2={oX + PX(mt + holeDepthSafe)} y2={oY + PX(cw)}
          label={`孔深 ${Math.round(holeDepthSafe)}`}
          side={safeDimSide("bottom", `孔深 ${Math.round(holeDepthSafe)}`, { x: oX + PX(mt + holeDepthSafe / 2), y: oY + PX(cw) }, qBounds)}
        />
      </g>
    );
  })();

  // ===== Q4 等角圖：兩塊 IsoCuboid + 木釘陣列 =====
  const iso = (() => {
    // bbox 含深度方向（cw 為釘陣列分布長度）
    const explodeGap = tl + 8;
    const isoBbox = { w: mt * 2 + explodeGap, h: ct, d: mt * 0.8 };
    const isoScale = unifiedFitScale(isoBbox, { targetUsage: 0.6 });
    const center = {
      x: QUADRANT.W / 2,
      y: (QUADRANT.H - QUADRANT.HEADER_H) / 2,
    };

    return (
      <g>
        <IsometricGroup originX={center.x - (mt * 2 + explodeGap) * isoScale / 2} originY={center.y} scale={isoScale}>
          {/* A 件（左板） */}
          <IsoCuboid
            x={0}
            y={-ct / 2}
            z={0}
            w={mt}
            h={ct}
            d={mt * 0.8}
            fillFront={ISO_FILL.TENON_FRONT}
            fillTop={ISO_FILL.TENON_TOP}
            fillSide={ISO_FILL.TENON_SIDE}
            strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / Math.max(0.4, isoScale)}
          />
          {/* B 件（右板，沿 +x explode） */}
          <g transform={`translate(${mt + explodeGap} 0)`}>
            <IsoCuboid
              x={0}
              y={-ct / 2}
              z={0}
              w={mt}
              h={ct}
              d={mt * 0.8}
              fillFront={ISO_FILL.MORTISE_FRONT}
              fillTop={ISO_FILL.MORTISE_TOP}
              fillSide={ISO_FILL.MORTISE_SIDE}
              strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / Math.max(0.4, isoScale)}
            />
          </g>
          {/* 木釘陣列 */}
          {Array.from({ length: dowelCount }).map((_, i) => {
            const zOff = ((i + 1) * (mt * 0.8)) / (dowelCount + 1) - mt * 0.4;
            return (
              <g key={i}>
                {/* 突出段（在 A 件外，可見） */}
                <IsoCuboid
                  x={mt - holeDepthSafe}
                  y={-tt / 2}
                  z={zOff - tt / 2}
                  w={tl}
                  h={tt}
                  d={tt}
                  fillFront={ISO_FILL.MORTISE_FRONT}
                  fillTop={ISO_FILL.MORTISE_TOP}
                  fillSide={ISO_FILL.MORTISE_SIDE}
                  strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / Math.max(0.4, isoScale)}
                  showHiddenBackEdges={false}
                />
                {/* 端面圓 */}
                <IsoCylinder
                  x={mt - holeDepthSafe + tl}
                  y={0}
                  z={zOff}
                  radius={tt / 2}
                  height={0.1}
                  axis="z"
                  fillCap={ISO_FILL.TENON_FRONT}
                  fillSide={ISO_FILL.TENON_SIDE}
                  strokeWidth={ISO_STROKE.EDGE_INTERIOR / Math.max(0.4, isoScale)}
                />
                {/* 埋入 A 件段（虛線） */}
                <IsoCuboid
                  x={mt - holeDepthSafe - holeDepthSafe}
                  y={-tt / 2}
                  z={zOff - tt / 2}
                  w={holeDepthSafe}
                  h={tt}
                  d={tt}
                  fillFront="none"
                  fillTop="none"
                  fillSide="none"
                  hidden={true}
                  strokeWidth={ISO_STROKE.HIDDEN_DASHED / Math.max(0.4, isoScale)}
                />
              </g>
            );
          })}
        </IsometricGroup>
      </g>
    );
  })();

  // sharedScale for TitleBlock 比例
  const sharedScale = unifiedFitScale({ w: mt * 2, h: ct });
  const scaleStr = sharedScale >= 1 ? `${Math.round(sharedScale)}:1` : `1:${Math.max(1, Math.round(1 / sharedScale))}`;

  return (
    <MasterDetailLayout
      type="dowel"
      joineryNameZh="木釘（dowel joint）"
      drawingNumber={`DW-Ø${tt}xL${tl}-N${dowelCount}`}
      scale={scaleStr}
      frontView={front}
      sideView={side}
      topView={top}
      isoView={iso}
      warnings={[
        `孔位誤差 <= 0.3mm`,
        `${dowelCount} 釘 × Ø ${tt} mm，間距 ${Math.round(spacing)} mm`,
      ]}
    />
  );
}
/* === END dowel-detail === */

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
/** Legacy V2（previous unified pre-MasterDetailLayout version, kept as escape hatch for Wave 2a try-water） */
function LegacyV2MiteredSplineDetail(p: JoineryDetailParams) {
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
      {/* 餅乾片位置（淺色隱藏線示意短邊） */}
      <HiddenEdge
        d={`M ${fCx + fT * 0.2},${fCy - fT * 0.8} L ${fCx + fT * 1.2},${fCy + fT * 0.2}`}
      />
      <HiddenEdge
        d={`M ${fCx - fT * 0.2},${fCy - fT * 1.2} L ${fCx + fT * 0.8},${fCy - fT * 0.2}`}
      />
      {/* 餅乾片橢圓輪廓（藏在接縫內）— 紅虛線醒目 */}
      {(() => {
        const midX = fCx + fT / 2;
        const midY = fCy - fT / 2;
        const ellipseRX = Math.max(8, PX(tl)); // 半長軸 ≈ 餅深 tl px（橢圓半徑沿接縫方向）
        const ellipseRY = Math.max(2, PX(tt) / 2); // 半短軸 = 餅厚 tt/2 px
        // 槽深線：沿 45° 接縫法線方向（即接縫垂直方向），從接縫往兩側延伸 ms（槽深）
        // 接縫方向 (-1, +1)/√2，法線方向 (1, 1)/√2
        const norm = 1 / Math.SQRT2;
        const dpX = PX(ms) * norm;
        const dpY = PX(ms) * norm;
        return (
          <g>
            {/* 餅乾片橢圓（沿 -45° 方向旋轉，跨接縫對角線） */}
            <ellipse
              cx={midX}
              cy={midY}
              rx={ellipseRX}
              ry={ellipseRY}
              fill="none"
              stroke={COLOR.DIM_TICK}
              strokeWidth={1.6}
              strokeDasharray="5 3"
              transform={`rotate(-45 ${midX} ${midY})`}
            />
            {/* 槽深線：A 件方向（接縫法線往右上） */}
            <line
              x1={midX}
              y1={midY}
              x2={midX + dpX}
              y2={midY - dpY}
              stroke={COLOR.DIM_TICK}
              strokeWidth={1.6}
              strokeDasharray="5 3"
            />
            {/* 槽深線：B 件方向（接縫法線往左下） */}
            <line
              x1={midX}
              y1={midY}
              x2={midX - dpX}
              y2={midY + dpY}
              stroke={COLOR.DIM_TICK}
              strokeWidth={1.6}
              strokeDasharray="5 3"
            />
            {/* 餅乾片標籤 */}
            <text
              x={midX + 22}
              y={midY - 14}
              fontSize={FONT.CALLOUT}
              fill={COLOR.DIM_TICK}
              fontWeight="bold"
            >
              餅乾片（隱藏）
            </text>
          </g>
        );
      })()}

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
      {(() => {
        // Cabinet projection
        const ANG = (30 * Math.PI) / 180;
        const dxz = Math.cos(ANG) * 0.5;
        const dyz = -Math.sin(ANG) * 0.5;
        const aLen = PX(70);
        const bLen = PX(70);
        const t = PX(ct);
        const dep = PX(60); // 深度
        // A 件水平板：x∈[0, aLen], y∈[-t, 0], 深 dep
        const aFront = `M${0},${-t} L${aLen},${-t} L${aLen},${0} L${0},${0} Z`;
        const aTop = `M${0},${-t} L${aLen},${-t} L${aLen + dep * dxz},${-t + dep * dyz} L${0 + dep * dxz},${-t + dep * dyz} Z`;
        const aRight = `M${aLen},${-t} L${aLen + dep * dxz},${-t + dep * dyz} L${aLen + dep * dxz},${0 + dep * dyz} L${aLen},${0} Z`;
        // B 件垂直板：x∈[0, t], y∈[0, bLen], 深 dep
        const bFront = `M${0},${0} L${t},${0} L${t},${bLen} L${0},${bLen} Z`;
        const bTop = `M${0},${0} L${t},${0} L${t + dep * dxz},${0 + dep * dyz} L${0 + dep * dxz},${0 + dep * dyz} Z`;
        const bRight = `M${t},${0} L${t + dep * dxz},${0 + dep * dyz} L${t + dep * dxz},${bLen + dep * dyz} L${t},${bLen} Z`;
        return (
          <>
            <g stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE}>
              {/* A 件水平板 */}
              <path d={aTop} fill="#e8d4a8" />
              <path d={aRight} fill="#b88a4d" />
              <path d={aFront} fill={COLOR.TENON} />
              {/* B 件垂直板 */}
              <path d={bTop} fill="#d8b988" />
              <path d={bRight} fill="#b88a4d" />
              <path d={bFront} fill={COLOR.MORTISE} fillOpacity={0.85} />
              {/* 45° 接縫 */}
              <line x1={0} y1={-t} x2={t} y2={0} stroke={COLOR.OUTLINE} />
              {/* 隱藏餅乾示意 */}
              <ellipse
                cx={t / 2}
                cy={-t / 2}
                rx={PX(tl) * 0.6}
                ry={PX(tt) * 0.4 + 2}
                fill={COLOR.DIM}
                fillOpacity={0.35}
                stroke={COLOR.DIM}
                strokeDasharray={DASH.HIDDEN}
              />
            </g>
            <text x={PX(80)} y={-t - 8} fontSize={FONT.CALLOUT} fill={COLOR.OUTLINE}>
              {/* // @joinery-dim-allow */}
              等角圖（30°）
            </text>
          </>
        );
      })()}
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

/**
 * MiteredSplineDetail（Wave 2a unified visual spec 版）—
 * 解決 inspector 報告的 4 個問題：
 *   1. 沒有 quadrant 4 等分 → 改用 MasterDetailLayout
 *   2. 物件超 viewBox 28px → 用 unifiedFitScale + placeInQuadrant 嚴格 clamp
 *   3. 等角圖溢出 → 改用同 helper 計算 IsometricGroup origin/scale
 *   4. TitleBlock 被等角圖蓋過 → MasterDetailLayout 內部固定 TitleBlock 在 footer 區
 */
function MiteredSplineDetail(p: JoineryDetailParams) {
  const tl = p.tenonLength;        // 餅乾深 (mm)
  const tt = p.tenonThickness;     // 餅乾厚 (mm)
  const ct = p.childThickness ?? p.tenonThickness;
  const ms = Math.max(tl + 1, 1);  // 槽深 = 餅深 + 1mm 漲縮預留

  // ===== Q1 正視圖：L 型轉角組合 + 餅乾片隱藏線 =====
  const front = (() => {
    // 兩塊板各 80mm 長 + ct 厚，組成 L
    const armLen = 80;
    const bbox = { w: armLen + ct, h: armLen + ct };
    const s = unifiedFitScale(bbox);
    const PX = (mm: number) => mm * s;
    const objW = PX(bbox.w);
    const objH = PX(bbox.h);
    const place = placeInQuadrant({ w: objW, h: objH });
    const oX = place.x;
    const oY = place.y;
    const fT = PX(ct);
    const fLenH = PX(armLen);
    const fLenV = PX(armLen);
    // 轉角錨點：A 件水平在頂部往右、B 件垂直在 oX..oX+fT 往下
    const fCx = oX;
    const fCy = oY + fT;
    const qBounds = { x: 0, y: 0, w: QUADRANT.W, h: QUADRANT.H - QUADRANT.HEADER_H };

    return (
      <g>
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
        {/* 餅乾片橢圓輪廓（隱藏紅虛線，跨 -45° 接縫） */}
        {(() => {
          const midX = fCx + fT / 2;
          const midY = fCy - fT / 2;
          const ellipseRX = Math.max(6, Math.min(PX(tl), fT * 1.5));
          const ellipseRY = Math.max(2, PX(tt) / 2);
          const norm = 1 / Math.SQRT2;
          const dpX = Math.min(PX(ms) * norm, fT * 0.8);
          const dpY = Math.min(PX(ms) * norm, fT * 0.8);
          return (
            <g>
              <ellipse
                cx={midX}
                cy={midY}
                rx={ellipseRX}
                ry={ellipseRY}
                fill="none"
                stroke={COLOR.DIM_TICK}
                strokeWidth={1.6}
                strokeDasharray="5 3"
                transform={`rotate(-45 ${midX} ${midY})`}
              />
              {/* 槽深線：兩側對稱 */}
              <line x1={midX} y1={midY} x2={midX + dpX} y2={midY - dpY} stroke={COLOR.DIM_TICK} strokeWidth={1.6} strokeDasharray="5 3" />
              <line x1={midX} y1={midY} x2={midX - dpX} y2={midY + dpY} stroke={COLOR.DIM_TICK} strokeWidth={1.6} strokeDasharray="5 3" />
            </g>
          );
        })()}

        {/* 木紋方向 */}
        <GrainArrow x={fCx + fT + 8} y={fCy - fT - 8} length={Math.max(20, fLenH - fT - 16)} angle={0} />
        <GrainArrow x={fCx + fT + 8} y={fCy + 8} length={Math.max(20, fLenV - 16)} angle={90} />

        {/* 尺寸：B 件厚 (左下) */}
        <DimLine
          x1={fCx} y1={fCy + fLenV} x2={fCx + fT} y2={fCy + fLenV}
          label={`${ct}`}
          side={safeDimSide("bottom", `${ct}`, { x: fCx + fT / 2, y: fCy + fLenV }, qBounds)}
        />
        {/* A 件厚 (右上) */}
        <DimLine
          x1={fCx + fLenH} y1={fCy - fT} x2={fCx + fLenH} y2={fCy}
          label={`${ct}`}
          side={safeDimSide("right", `${ct}`, { x: fCx + fLenH, y: fCy - fT / 2 }, qBounds)}
        />

        {/* 45° 標 */}
        <text x={fCx + fT * 1.6} y={fCy - fT * 0.4} fontSize={FONT.DIM} fill={COLOR.DIM}>
          45°
        </text>
      </g>
    );
  })();

  // ===== Q2 側視圖：A-A 剖面 — 餅乾嵌入接縫 =====
  const side = (() => {
    const boardLen = 100;
    const bbox = { w: boardLen, h: ct * 2 + 4 };
    const s = unifiedFitScale(bbox);
    const PX = (mm: number) => mm * s;
    const objW = PX(bbox.w);
    const objH = PX(bbox.h);
    const place = placeInQuadrant({ w: objW, h: objH });
    const sCx = place.x;
    const sCy = place.y;
    const sBoardLen = PX(boardLen);
    const sBoardT = PX(ct);
    const sBiscuitLen = Math.min(PX(tl * 2), sBoardLen * 0.6);
    const sBiscuitT = PX(tt);
    const hatchId = "hatch-ms-section-v2";
    const qBounds = { x: 0, y: 0, w: QUADRANT.W, h: QUADRANT.H - QUADRANT.HEADER_H };

    return (
      <g>
        <defs>
          <Hatching id={hatchId} color={COLOR.SECTION_HATCH} />
        </defs>
        {/* 上板 */}
        <rect
          x={sCx} y={sCy}
          width={sBoardLen} height={sBoardT}
          fill={`url(#${hatchId})`}
          stroke={COLOR.OUTLINE}
          strokeWidth={STROKE.OUTLINE}
        />
        {/* 下板 */}
        <rect
          x={sCx} y={sCy + sBoardT + 2}
          width={sBoardLen} height={sBoardT}
          fill={`url(#${hatchId})`}
          stroke={COLOR.OUTLINE}
          strokeWidth={STROKE.OUTLINE}
        />
        {/* 接縫中線 */}
        <CenterLine x1={sCx - 4} y1={sCy + sBoardT + 1} x2={sCx + sBoardLen + 4} y2={sCy + sBoardT + 1} />
        {/* 餅乾片 */}
        <ellipse
          cx={sCx + sBoardLen / 2}
          cy={sCy + sBoardT + 1}
          rx={sBiscuitLen / 2}
          ry={sBiscuitT / 2 + 2}
          fill={COLOR.TENON}
          stroke={COLOR.OUTLINE}
          strokeWidth={STROKE.OUTLINE}
        />
        {/* 餅乾槽輪廓（隱藏線） */}
        <HiddenEdge
          d={`M ${sCx + sBoardLen / 2 - sBiscuitLen / 2},${sCy + sBoardT - PX(ms)} L ${sCx + sBoardLen / 2 + sBiscuitLen / 2},${sCy + sBoardT - PX(ms)}`}
        />
        <HiddenEdge
          d={`M ${sCx + sBoardLen / 2 - sBiscuitLen / 2},${sCy + sBoardT + 2 + PX(ms)} L ${sCx + sBoardLen / 2 + sBiscuitLen / 2},${sCy + sBoardT + 2 + PX(ms)}`}
        />

        {/* 尺寸 */}
        <DimLine
          x1={sCx + sBoardLen / 2 - sBiscuitLen / 2} y1={sCy + sBoardT * 2 + 2}
          x2={sCx + sBoardLen / 2 + sBiscuitLen / 2} y2={sCy + sBoardT * 2 + 2}
          label={`餅長 ${tl * 2}`}
          side={safeDimSide("bottom", `餅長 ${tl * 2}`, { x: sCx + sBoardLen / 2, y: sCy + sBoardT * 2 + 2 }, qBounds)}
        />
        <DimLine
          x1={sCx + sBoardLen} y1={sCy + sBoardT - PX(ms)}
          x2={sCx + sBoardLen} y2={sCy + sBoardT}
          label={`槽深 ${ms}`}
          side={safeDimSide("right", `槽深 ${ms}`, { x: sCx + sBoardLen, y: sCy + sBoardT - PX(ms) / 2 }, qBounds)}
        />
        <DimLine
          x1={sCx} y1={sCy} x2={sCx} y2={sCy + sBoardT}
          label={`${ct}`}
          side={safeDimSide("left", `${ct}`, { x: sCx, y: sCy + sBoardT / 2 }, qBounds)}
        />
      </g>
    );
  })();

  // ===== Q3 俯視圖：拆開狀態，兩塊 45° 斜面對切 =====
  const top = (() => {
    const plateW = 70;
    const gap = 30;
    const totalW = plateW * 2 + ct * 2 + gap;
    const bbox = { w: totalW, h: ct };
    const s = unifiedFitScale(bbox);
    const PX = (mm: number) => mm * s;
    const objW = PX(bbox.w);
    const objH = PX(bbox.h);
    const place = placeInQuadrant({ w: objW, h: objH });
    const tCx = place.x;
    const tCy = place.y;
    const tPlateW = PX(plateW);
    const tPlateH = PX(ct);
    const tGap = PX(gap);
    const qBounds = { x: 0, y: 0, w: QUADRANT.W, h: QUADRANT.H - QUADRANT.HEADER_H };

    return (
      <g>
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
          y={tCy - 4}
          fontSize={FONT.CALLOUT}
          textAnchor="middle"
          fill={COLOR.OUTLINE}
        >
          餅乾片
        </text>

        {/* 木紋方向（在 A 件下方） */}
        <GrainArrow x={tCx + 4} y={tCy + tPlateH + 14} length={Math.max(20, tPlateW - 8)} angle={0} />

        {/* 尺寸：板厚 */}
        <DimLine
          x1={tCx} y1={tCy} x2={tCx} y2={tCy + tPlateH}
          label={`${ct}`}
          side={safeDimSide("left", `${ct}`, { x: tCx, y: tCy + tPlateH / 2 }, qBounds)}
        />
      </g>
    );
  })();

  // ===== Q4 等角圖：30° L 型轉角 + 半透明餅乾 =====
  const iso = (() => {
    const armLen = 70;
    const dep = 60;
    // bbox：考慮 cabinet projection 後 x 方向 = armLen + dep*cos30、y 方向 = armLen + dep*sin30
    const ANG = (30 * Math.PI) / 180;
    const dxz = Math.cos(ANG) * 0.5;
    const dyz = Math.sin(ANG) * 0.5;
    const projW = armLen + dep * dxz + ct;
    const projH = armLen + dep * dyz + ct;
    const isoBbox = { w: projW, h: projH };
    const s = unifiedFitScale(isoBbox, { targetUsage: 0.7 });
    const PX = (mm: number) => mm * s;
    const aLen = PX(armLen);
    const bLen = PX(armLen);
    const t = PX(ct);
    const dEff = PX(dep);
    // 整個 iso 物件 bbox（已 px）
    const isoObjW = aLen + dEff * dxz + t;
    const isoObjH = bLen + dEff * dyz + t;
    const place = placeInQuadrant({ w: isoObjW, h: isoObjH });
    // 轉角放在 (place.x, place.y + t + dEff*dyz)；A 件水平往右、B 件垂直往下
    const cornerX = place.x;
    const cornerY = place.y + t + dEff * dyz;

    // path 用相對 corner 座標
    const aFront = `M${0},${-t} L${aLen},${-t} L${aLen},${0} L${0},${0} Z`;
    const aTop = `M${0},${-t} L${aLen},${-t} L${aLen + dEff * dxz},${-t - dEff * dyz} L${0 + dEff * dxz},${-t - dEff * dyz} Z`;
    const aRight = `M${aLen},${-t} L${aLen + dEff * dxz},${-t - dEff * dyz} L${aLen + dEff * dxz},${0 - dEff * dyz} L${aLen},${0} Z`;
    const bFront = `M${0},${0} L${t},${0} L${t},${bLen} L${0},${bLen} Z`;
    const bTop = `M${0},${0} L${t},${0} L${t + dEff * dxz},${0 - dEff * dyz} L${0 + dEff * dxz},${0 - dEff * dyz} Z`;
    const bRight = `M${t},${0} L${t + dEff * dxz},${0 - dEff * dyz} L${t + dEff * dxz},${bLen - dEff * dyz} L${t},${bLen} Z`;

    return (
      <g transform={`translate(${cornerX} ${cornerY})`}>
        <g stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE}>
          {/* A 件水平板 */}
          <path d={aTop} fill="#e8d4a8" />
          <path d={aRight} fill="#b88a4d" />
          <path d={aFront} fill={COLOR.TENON} />
          {/* B 件垂直板 */}
          <path d={bTop} fill="#d8b988" />
          <path d={bRight} fill="#b88a4d" />
          <path d={bFront} fill={COLOR.MORTISE} fillOpacity={0.85} />
          {/* 45° 接縫 */}
          <line x1={0} y1={-t} x2={t} y2={0} stroke={COLOR.OUTLINE} />
          {/* 隱藏餅乾示意 */}
          <ellipse
            cx={t / 2}
            cy={-t / 2}
            rx={Math.min(PX(tl) * 0.6, t * 1.2)}
            ry={Math.min(PX(tt) * 0.4 + 2, t * 0.6)}
            fill={COLOR.DIM}
            fillOpacity={0.35}
            stroke={COLOR.DIM}
            strokeDasharray={DASH.HIDDEN}
          />
        </g>
      </g>
    );
  })();

  const sharedScale = unifiedFitScale({ w: 80 + ct, h: 80 + ct });
  const scaleStr = sharedScale >= 1 ? `${Math.round(sharedScale)}:1` : `1:${Math.max(1, Math.round(1 / sharedScale))}`;

  return (
    <MasterDetailLayout
      type={p.material ? `mitered-spline · ${p.material}` : "mitered-spline"}
      joineryNameZh="斜接餅乾榫"
      drawingNumber={`MS-${ct}-${tl}-${tt}`}
      scale={scaleStr}
      drawnBy="wrd-modern-joinery"
      frontView={front}
      sideView={side}
      topView={top}
      isoView={iso}
      warnings={[
        `45° 切面誤差 ≤ 0.5°`,
        `槽深 ${ms}mm 留 1mm 漲縮`,
        `餅厚 ${tt}mm · 餅深 ${tl}mm`,
      ]}
    />
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
function LegacyV2PocketHoleDetail(p: JoineryDetailParams) {
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

  // ----- 等角圖 (iso)：Phase 3 — T 字組裝用 IsoCuboid 強制 3 面 + 斜孔虛線 -----
  const iso = (
    <IsometricGroup originX={210} originY={155} scale={1.05}>
      {(() => {
        const aL = PX(60) * 2; // A 件長 120mm
        const aD = PX(60); // A 件深 60mm
        const bH = PX(80); // B 件高 80mm
        const bD = aD; // B 件深 60mm
        return (
          <g>
            {/* A 件水平板 */}
            <IsoCuboid
              x={-aL / 2}
              y={-PX(ct)}
              z={0}
              w={aL}
              h={PX(ct)}
              d={aD}
              fillFront={ISO_FILL.TENON_FRONT}
              fillTop={ISO_FILL.TENON_TOP}
              fillSide={ISO_FILL.TENON_SIDE}
              strokeWidth={ISO_STROKE.OUTLINE_VISIBLE}
            />
            {/* B 件垂直板 */}
            <IsoCuboid
              x={-PX(mt) / 2}
              y={0}
              z={0}
              w={PX(mt)}
              h={bH}
              d={bD}
              fillFront={ISO_FILL.MORTISE_FRONT}
              fillTop={ISO_FILL.MORTISE_TOP}
              fillSide={ISO_FILL.MORTISE_SIDE}
              strokeWidth={ISO_STROKE.OUTLINE_VISIBLE}
            />
            {/* 斜孔虛線（15° 從 B 件側面斜入 A 件） */}
            {[-1, 1].map((dir, i) => {
              const ox = dir * PX(pitch / 2);
              return (
                <g key={i}>
                  <line
                    x1={ox}
                    y1={PX(20)}
                    x2={ox + dir * PX(15)}
                    y2={-PX(ct) / 2}
                    stroke={COLOR.HIDDEN}
                    strokeWidth={ISO_STROKE.HIDDEN_DASHED}
                    strokeDasharray={ISO_DASH.HIDDEN}
                  />
                </g>
              );
            })}
            <text x={PX(70)} y={-PX(ct) - 8} fontSize={FONT.CALLOUT} fill={COLOR.OUTLINE}>
              {/* // @joinery-dim-allow */}
              等角圖（30°）— 斜孔 15°
            </text>
          </g>
        );
      })()}
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
/* === END pocket-hole-detail (legacy) === */

/* === BEGIN pocket-hole-detail v2 (Wave 2b Group B) ===
 * 斜孔螺絲 pocket-hole — MasterDetailLayout + 統一 helper
 * dead code（沒模板觸發），仍補完整 4 quadrant + TitleBlock
 * ============================================================ */
function PocketHoleDetail(p: JoineryDetailParams) {
  const ct = p.childThickness ?? p.tenonThickness;
  const mt = p.motherThickness;
  const screwLen = Math.round(ct / 2 + mt - 5);
  const holeDepth = Math.max(ct - 5, 1);
  const edgeOffset = 25;
  const pitch = 60;

  // ===== Q1 正視圖：T 字組裝後從正面看 =====
  const front = (() => {
    const aLen = 150;
    const bH = 120;
    const bbox = { w: aLen, h: ct + bH };
    const s = unifiedFitScale(bbox);
    const PX = (mm: number) => mm * s;
    const objW = PX(bbox.w);
    const objH = PX(bbox.h);
    const place = placeInQuadrant({ w: objW, h: objH });
    const fCx = place.x;
    const fCy = place.y + PX(ct);
    const fAW = PX(aLen);
    const fAT = PX(ct);
    const fBW = PX(mt);
    const fBH = PX(bH);
    const qBounds = { x: 0, y: 0, w: QUADRANT.W, h: QUADRANT.H - QUADRANT.HEADER_H };

    return (
      <g>
        {/* A 件 */}
        <rect x={fCx} y={fCy - fAT} width={fAW} height={fAT}
          fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        {/* B 件 */}
        <rect x={fCx + fAW / 2 - fBW / 2} y={fCy} width={fBW} height={fBH}
          fill={COLOR.MORTISE} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        {/* 兩個隱藏斜孔 */}
        {[-1, 1].map((dir, i) => {
          const cx0 = fCx + fAW / 2 + dir * PX(pitch / 2);
          return (
            <g key={i}>
              <HiddenEdge d={`M ${cx0 - 3},${fCy} L ${cx0 + dir * PX(15)},${fCy + PX(20)}`} />
              <HiddenEdge d={`M ${cx0 + 3},${fCy} L ${cx0 + dir * PX(15) + 4},${fCy + PX(20)}`} />
            </g>
          );
        })}
        {/* 剖面 A-A */}
        <SectionMark x={fCx + fAW / 2 - PX(pitch / 2) - 22} y={fCy - fAT - 8} label="A" direction="down" />
        <SectionMark x={fCx + fAW / 2 - PX(pitch / 2) - 22} y={fCy + fBH - 18} label="A" direction="up" />
        <GrainArrow x={fCx + 8} y={fCy - fAT - 14} length={fAW - 16} angle={0} />
        {/* dim */}
        <DimLine
          x1={fCx + fAW / 2 - PX(pitch / 2)} y1={fCy + fBH}
          x2={fCx + fAW / 2 + PX(pitch / 2)} y2={fCy + fBH}
          label={`孔距 ${pitch}`}
          side={safeDimSide("bottom", `孔距 ${pitch}`, { x: fCx + fAW / 2, y: fCy + fBH }, qBounds)} />
        <DimLine x1={fCx} y1={fCy - fAT} x2={fCx} y2={fCy}
          label={`${ct}`}
          side={safeDimSide("left", `${ct}`, { x: fCx, y: fCy - fAT / 2 }, qBounds)} />
        <DimLine x1={fCx + fAW} y1={fCy} x2={fCx + fAW} y2={fCy + fBH}
          label={`${mt}`}
          side={safeDimSide("right", `${mt}`, { x: fCx + fAW, y: fCy + fBH / 2 }, qBounds)} />
      </g>
    );
  })();

  // ===== Q2 側視圖：A-A 剖面 — 15° 斜孔 + 螺絲穿入 =====
  const side = (() => {
    const aLen = 120;
    const bH = 120;
    const bbox = { w: aLen, h: ct + bH };
    const s = unifiedFitScale(bbox);
    const PX = (mm: number) => mm * s;
    const objW = PX(bbox.w);
    const objH = PX(bbox.h);
    const place = placeInQuadrant({ w: objW, h: objH });
    const sCx = place.x;
    const sCy = place.y;
    const sAW = PX(aLen);
    const sAT = PX(ct);
    const sBT = PX(mt);
    const sBH = PX(bH);
    const hatchId = "hatch-ph-section-v2";
    const qBounds = { x: 0, y: 0, w: QUADRANT.W, h: QUADRANT.H - QUADRANT.HEADER_H };
    const angle15 = (15 * Math.PI) / 180;
    const holeStartX = sCx + sAW / 2 - PX(15);
    const holeStartY = sCy + sAT;
    const screwTipX = sCx + sAW / 2 + PX(8);
    const screwTipY = sCy + sBH * 0.7;

    return (
      <g>
        <defs>
          <Hatching id={hatchId} color={COLOR.SECTION_HATCH} />
        </defs>
        {/* A 件 */}
        <rect x={sCx} y={sCy} width={sAW} height={sAT} fill={`url(#${hatchId})`} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        {/* B 件 */}
        <rect x={sCx + sAW / 2 - sBT / 2} y={sCy + sAT} width={sBT} height={sBH} fill={`url(#${hatchId})`} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        {/* 15° 斜孔 */}
        <line x1={holeStartX - 4} y1={holeStartY}
          x2={holeStartX + Math.sin(angle15) * PX(holeDepth) - 2}
          y2={holeStartY - Math.cos(angle15) * PX(holeDepth)}
          stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        <line x1={holeStartX + 8} y1={holeStartY}
          x2={holeStartX + Math.sin(angle15) * PX(holeDepth) + 6}
          y2={holeStartY - Math.cos(angle15) * PX(holeDepth)}
          stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        <line x1={holeStartX + Math.sin(angle15) * PX(holeDepth) - 2}
          y1={holeStartY - Math.cos(angle15) * PX(holeDepth)}
          x2={holeStartX + Math.sin(angle15) * PX(holeDepth) + 6}
          y2={holeStartY - Math.cos(angle15) * PX(holeDepth)}
          stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        {/* 螺絲：頭 + 桿 + 螺紋 */}
        <g>
          <rect x={holeStartX - 3} y={holeStartY - 4} width={10} height={6}
            fill="#555" stroke={COLOR.OUTLINE} strokeWidth={0.5}
            transform={`rotate(-15 ${holeStartX + 2} ${holeStartY - 1})`} />
          <line x1={holeStartX + 2} y1={holeStartY - 1} x2={screwTipX} y2={screwTipY}
            stroke="#666" strokeWidth={2.5} />
          {Array.from({ length: 10 }).map((_, j) => {
            const t = j / 9;
            const tx = holeStartX + 2 + (screwTipX - holeStartX - 2) * t;
            const ty = holeStartY - 1 + (screwTipY - holeStartY + 1) * t;
            return (
              <line key={j} x1={tx - 2.5} y1={ty - 2} x2={tx + 2.5} y2={ty + 2}
                stroke="#444" strokeWidth={0.6} />
            );
          })}
        </g>
        <CenterLine x1={sCx + sAW / 2} y1={sCy - 6} x2={sCx + sAW / 2} y2={sCy + sAT + sBH + 6} />
        <text x={holeStartX - 28} y={holeStartY + 14} fontSize={FONT.DIM} fill={COLOR.DIM}>15°00′</text>

        <DimLine x1={sCx + sAW} y1={sCy} x2={sCx + sAW} y2={sCy + sAT}
          label={`A=${ct}`}
          side={safeDimSide("right", `A=${ct}`, { x: sCx + sAW, y: sCy + sAT / 2 }, qBounds)} />
        <DimLine x1={sCx + sAW} y1={sCy + sAT} x2={sCx + sAW} y2={sCy + sAT + sBH}
          label={`B=${mt}`}
          side={safeDimSide("right", `B=${mt}`, { x: sCx + sAW, y: sCy + sAT + sBH / 2 }, qBounds)} />
        <DimLine x1={sCx} y1={holeStartY - Math.cos(angle15) * PX(holeDepth)} x2={sCx} y2={holeStartY}
          label={`孔深 ${holeDepth}`}
          side={safeDimSide("left", `孔深 ${holeDepth}`, { x: sCx, y: holeStartY - Math.cos(angle15) * PX(holeDepth) / 2 }, qBounds)} />
      </g>
    );
  })();

  // ===== Q3 俯視圖：A 件背面，露出兩個斜孔 =====
  const top = (() => {
    const bbox = { w: 160, h: 60 };
    const s = unifiedFitScale(bbox);
    const PX = (mm: number) => mm * s;
    const objW = PX(bbox.w);
    const objH = PX(bbox.h);
    const place = placeInQuadrant({ w: objW, h: objH });
    const tCx = place.x;
    const tCy = place.y;
    const tAW = PX(160);
    const tAH = PX(60);
    const tHoleR = Math.max(PX(4), 4);
    const qBounds = { x: 0, y: 0, w: QUADRANT.W, h: QUADRANT.H - QUADRANT.HEADER_H };

    return (
      <g>
        <rect x={tCx} y={tCy} width={tAW} height={tAH}
          fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        {/* 2 個橢圓斜孔 */}
        {[-1, 1].map((dir, i) => {
          const ox = tCx + tAW / 2 + dir * PX(pitch / 2);
          const oy = tCy + tAH * 0.55;
          return (
            <g key={i}>
              <ellipse cx={ox} cy={oy} rx={tHoleR * 1.6} ry={tHoleR * 0.9}
                fill="white" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
              <ellipse cx={ox + 2} cy={oy - 1} rx={tHoleR * 0.8} ry={tHoleR * 0.5} fill="#444" />
            </g>
          );
        })}
        {/* B 件位置投影 */}
        <CenterLine x1={tCx + tAW / 2} y1={tCy - 8} x2={tCx + tAW / 2} y2={tCy + tAH + 8} />
        <HiddenEdge d={`M ${tCx + tAW / 2 - PX(mt / 2)},${tCy} L ${tCx + tAW / 2 - PX(mt / 2)},${tCy + tAH}`} />
        <HiddenEdge d={`M ${tCx + tAW / 2 + PX(mt / 2)},${tCy} L ${tCx + tAW / 2 + PX(mt / 2)},${tCy + tAH}`} />
        <GrainArrow x={tCx + 6} y={tCy + tAH + 18} length={tAW - 12} angle={0} />

        <DimLine x1={tCx + tAW / 2 - PX(pitch / 2)} y1={tCy + tAH} x2={tCx + tAW / 2 + PX(pitch / 2)} y2={tCy + tAH}
          label={`孔距 ${pitch}`}
          side={safeDimSide("bottom", `孔距 ${pitch}`, { x: tCx + tAW / 2, y: tCy + tAH }, qBounds)} />
        <DimLine x1={tCx + tAW / 2 - PX(pitch / 2)} y1={tCy} x2={tCx + tAW / 2 - PX(pitch / 2)} y2={tCy + tAH * 0.55}
          label={`邊距 ${edgeOffset}`}
          side={safeDimSide("left", `邊距 ${edgeOffset}`, { x: tCx + tAW / 2 - PX(pitch / 2), y: tCy + tAH * 0.275 }, qBounds)} />
      </g>
    );
  })();

  // ===== Q4 等角圖：T 字組裝 =====
  const iso = (() => {
    const aLenMm = 120;
    const aDMm = 60;
    const bHMm = 80;
    const isoBbox = { w: aLenMm, h: bHMm + ct + 20, d: aDMm };
    const isoScale = unifiedFitScale(isoBbox, { targetUsage: 0.65 });
    const center = { x: QUADRANT.W / 2, y: (QUADRANT.H - QUADRANT.HEADER_H) / 2 };

    return (
      <g>
        <IsometricGroup originX={center.x} originY={center.y} scale={isoScale}>
          {/* A 件水平板 */}
          <IsoCuboid x={-aLenMm / 2} y={-ct} z={0} w={aLenMm} h={ct} d={aDMm}
            fillFront={ISO_FILL.TENON_FRONT} fillTop={ISO_FILL.TENON_TOP} fillSide={ISO_FILL.TENON_SIDE}
            strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / Math.max(0.4, isoScale)} />
          {/* B 件垂直板 */}
          <IsoCuboid x={-mt / 2} y={0} z={0} w={mt} h={bHMm} d={aDMm}
            fillFront={ISO_FILL.MORTISE_FRONT} fillTop={ISO_FILL.MORTISE_TOP} fillSide={ISO_FILL.MORTISE_SIDE}
            strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / Math.max(0.4, isoScale)} />
          {/* 斜孔虛線 */}
          {[-1, 1].map((dir, i) => {
            const ox = dir * (pitch / 2);
            return (
              <line key={i} x1={ox} y1={20} x2={ox + dir * 15} y2={-ct / 2}
                stroke={COLOR.HIDDEN}
                strokeWidth={ISO_STROKE.HIDDEN_DASHED / Math.max(0.4, isoScale)}
                strokeDasharray={ISO_DASH.HIDDEN} />
            );
          })}
        </IsometricGroup>
      </g>
    );
  })();

  const sharedScale = unifiedFitScale({ w: 150, h: ct + 120 });
  const scaleStr = sharedScale >= 1 ? `${Math.round(sharedScale)}:1` : `1:${Math.max(1, Math.round(1 / sharedScale))}`;

  return (
    <MasterDetailLayout
      type="pocket-hole"
      joineryNameZh="斜孔螺絲（口袋孔）"
      drawingNumber={`PH-${ct}-${mt}-L${screwLen}`}
      scale={scaleStr}
      drawnBy="wrd-modern-joinery"
      frontView={front}
      sideView={side}
      topView={top}
      isoView={iso}
      warnings={[
        `Kreg 標準 15° 斜孔（不可改角度）`,
        `孔距 ${pitch}mm，邊距 ${edgeOffset}mm，螺絲長 ${screwLen}mm`,
      ]}
    />
  );
}
/* === END pocket-hole-detail v2 === */

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
function LegacyV2ScrewDetail(p: JoineryDetailParams) {
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

  // ----- 等角圖 (iso)：Phase 3 — IsoCuboid 強制 3 面 + 螺絲虛線 -----
  const iso = (
    <IsometricGroup originX={210} originY={155} scale={1.05}>
      {(() => {
        const aL = PX(60) * 2;
        const aD = PX(60);
        const bH = PX(70);
        const bD = aD;
        return (
          <g>
            {/* B 件垂直板（先畫，A 蓋在上面） */}
            <IsoCuboid
              x={-PX(mt) / 2}
              y={0}
              z={0}
              w={PX(mt)}
              h={bH}
              d={bD}
              fillFront={ISO_FILL.MORTISE_FRONT}
              fillTop={ISO_FILL.MORTISE_TOP}
              fillSide={ISO_FILL.MORTISE_SIDE}
              strokeWidth={ISO_STROKE.OUTLINE_VISIBLE}
            />
            {/* A 件水平板 */}
            <IsoCuboid
              x={-aL / 2}
              y={-PX(ct)}
              z={0}
              w={aL}
              h={PX(ct)}
              d={aD}
              fillFront={ISO_FILL.TENON_FRONT}
              fillTop={ISO_FILL.TENON_TOP}
              fillSide={ISO_FILL.TENON_SIDE}
              strokeWidth={ISO_STROKE.OUTLINE_VISIBLE}
            />
            {/* 螺絲（從 A 件頂面斜直下） */}
            {[-1, 1].map((dir, i) => (
              <g key={i}>
                <line
                  x1={dir * PX(40)}
                  y1={-PX(ct) - 2}
                  x2={dir * PX(40)}
                  y2={PX(35)}
                  stroke="#444"
                  strokeWidth={1.4}
                  strokeDasharray={ISO_DASH.HIDDEN}
                />
                <circle cx={dir * PX(40)} cy={-PX(ct) - 1} r={PX(csDia) / 2 + 0.5} fill="#555" />
              </g>
            ))}
            <text x={PX(70)} y={-PX(ct) - 8} fontSize={FONT.CALLOUT} fill={COLOR.OUTLINE}>
              {/* // @joinery-dim-allow */}
              等角圖（30°）— 螺絲埋頭
            </text>
          </g>
        );
      })()}
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
/* === END screw-detail (legacy) === */

/* === BEGIN screw-detail v2 (Wave 2b Group B) ===
 * 螺絲 + 白膠 screw — MasterDetailLayout + 統一 helper
 * dead code（沒模板觸發），仍補完整 4 quadrant + TitleBlock
 * ============================================================ */
function ScrewDetail(p: JoineryDetailParams) {
  const tt = p.tenonThickness;
  const tl = p.tenonLength;
  const mt = p.motherThickness;
  const ct = p.childThickness ?? p.tenonThickness;
  const rule = pickPilotHoleRule(p.material);
  const pilot = Math.max(Math.round(tt * rule.ratio), 1);
  const csDepth = Math.max(Math.round(tt * 0.6), 2);
  const csDia = Math.max(Math.round(tt * 1.8), pilot + 2);
  const screwLen = tl > 0 ? tl : Math.max(ct + mt - 5, 8);

  // ===== Q1 正視圖：A 平鎖入 B（螺絲 + 白膠）=====
  const front = (() => {
    const aLen = 140;
    const bH = 110;
    const bbox = { w: aLen, h: ct + bH };
    const s = unifiedFitScale(bbox);
    const PX = (mm: number) => mm * s;
    const objW = PX(bbox.w);
    const objH = PX(bbox.h);
    const place = placeInQuadrant({ w: objW, h: objH });
    const fCx = place.x;
    const fCy = place.y;
    const fAW = PX(aLen);
    const fAT = PX(ct);
    const fBT = PX(mt);
    const fBH = PX(bH);
    const qBounds = { x: 0, y: 0, w: QUADRANT.W, h: QUADRANT.H - QUADRANT.HEADER_H };

    return (
      <g>
        {/* B 件下方直板 */}
        <rect x={fCx + fAW / 2 - fBT / 2} y={fCy + fAT} width={fBT} height={fBH}
          fill={COLOR.MORTISE} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        {/* A 件上方橫板 */}
        <rect x={fCx} y={fCy} width={fAW} height={fAT}
          fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        {/* 兩個螺絲位置 */}
        {[-1, 1].map((dir, i) => {
          const cx0 = fCx + fAW / 2 + dir * PX(40);
          return (
            <g key={i}>
              <polygon
                points={`${cx0 - PX(csDia) / 2},${fCy} ${cx0 + PX(csDia) / 2},${fCy} ${cx0 + PX(pilot) / 2},${fCy + PX(csDepth)} ${cx0 - PX(pilot) / 2},${fCy + PX(csDepth)}`}
                fill="white" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
              <ellipse cx={cx0} cy={fCy + 1} rx={PX(csDia) / 2 + 0.5} ry={1.5} fill="#555" />
              <line x1={cx0} y1={fCy + PX(csDepth)} x2={cx0} y2={fCy + PX(screwLen)}
                stroke="#666" strokeWidth={2} />
              <CenterLine x1={cx0} y1={fCy - 6} x2={cx0} y2={fCy + PX(screwLen) + 6} />
            </g>
          );
        })}
        {/* 白膠縫 */}
        <line x1={fCx} y1={fCy + fAT - 1} x2={fCx + fAW} y2={fCy + fAT - 1}
          stroke="#e8a" strokeWidth={0.8} strokeDasharray="2 1" />
        <text x={fCx + fAW + 4} y={fCy + fAT + 2} fontSize={FONT.CALLOUT} fill="#a36">白膠</text>

        {/* 剖面 A-A */}
        <SectionMark x={fCx + fAW / 2 - PX(40) - 18} y={fCy - 10} label="A" direction="down" />
        <SectionMark x={fCx + fAW / 2 - PX(40) - 18} y={fCy + fAT + fBH + 4} label="A" direction="up" />
        <GrainArrow x={fCx + 8} y={fCy - 12} length={fAW - 16} angle={0} />

        <DimLine x1={fCx} y1={fCy} x2={fCx} y2={fCy + fAT}
          label={`${ct}`}
          side={safeDimSide("left", `${ct}`, { x: fCx, y: fCy + fAT / 2 }, qBounds)} />
        <DimLine x1={fCx + fAW} y1={fCy + fAT} x2={fCx + fAW} y2={fCy + fAT + fBH}
          label={`${mt}`}
          side={safeDimSide("right", `${mt}`, { x: fCx + fAW, y: fCy + fAT + fBH / 2 }, qBounds)} />
      </g>
    );
  })();

  // ===== Q2 側視圖：A-A 剖面 — 埋頭孔 + 先導孔 + 螺絲 + 白膠 =====
  const side = (() => {
    const aLen = 80;
    const bH = 120;
    const bbox = { w: aLen + 30, h: ct + bH };
    const s = unifiedFitScale(bbox);
    const PX = (mm: number) => mm * s;
    const objW = PX(aLen);
    const objH = PX(ct + bH);
    const place = placeInQuadrant({ w: objW, h: objH });
    const sCx = place.x;
    const sCy = place.y;
    const sAW = PX(aLen);
    const sAT = PX(ct);
    const sBT = PX(mt);
    const sBH = PX(bH);
    const hatchId = "hatch-screw-section-v2";
    const screwCx = sCx + sAW / 2;
    const qBounds = { x: 0, y: 0, w: QUADRANT.W, h: QUADRANT.H - QUADRANT.HEADER_H };

    return (
      <g>
        <defs>
          <Hatching id={hatchId} color={COLOR.SECTION_HATCH} />
        </defs>
        {/* A 件 */}
        <rect x={sCx} y={sCy} width={sAW} height={sAT} fill={`url(#${hatchId})`} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        {/* B 件 */}
        <rect x={sCx + sAW / 2 - sBT / 2} y={sCy + sAT + 2} width={sBT} height={sBH} fill={`url(#${hatchId})`} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        {/* 白膠層 */}
        <rect x={sCx + sAW / 2 - sBT / 2} y={sCy + sAT} width={sBT} height={2} fill="#fbb" stroke="#c66" strokeWidth={0.5} />
        {/* 埋頭孔 */}
        <polygon
          points={`${screwCx - PX(csDia) / 2},${sCy} ${screwCx + PX(csDia) / 2},${sCy} ${screwCx + PX(pilot) / 2},${sCy + PX(csDepth)} ${screwCx - PX(pilot) / 2},${sCy + PX(csDepth)}`}
          fill="white" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        {/* 先導孔 */}
        <rect x={screwCx - PX(pilot) / 2} y={sCy + PX(csDepth)}
          width={PX(pilot)} height={Math.max(PX(ct) - PX(csDepth), 1)}
          fill="white" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        {/* 先導孔（B 件，隱藏線）*/}
        <HiddenEdge d={`M ${screwCx - PX(pilot) / 2},${sCy + sAT + 2} L ${screwCx - PX(pilot) / 2},${sCy + PX(screwLen)}`} />
        <HiddenEdge d={`M ${screwCx + PX(pilot) / 2},${sCy + sAT + 2} L ${screwCx + PX(pilot) / 2},${sCy + PX(screwLen)}`} />
        {/* 螺絲 */}
        <g>
          <rect x={screwCx - PX(csDia) / 2 + 1} y={sCy + 1}
            width={PX(csDia) - 2} height={Math.max(PX(csDepth) - 1, 2)}
            fill="#555" stroke={COLOR.OUTLINE} strokeWidth={0.5} />
          <line x1={screwCx} y1={sCy + PX(csDepth)} x2={screwCx} y2={sCy + PX(screwLen)}
            stroke="#444" strokeWidth={2.5} />
          {Array.from({ length: 12 }).map((_, j) => {
            const y = sCy + PX(csDepth) + 4 + j * 4;
            if (y >= sCy + PX(screwLen) - 2) return null;
            return (
              <line key={j} x1={screwCx - 2.5} y1={y} x2={screwCx + 2.5} y2={y - 1.5}
                stroke="#222" strokeWidth={0.5} />
            );
          })}
        </g>
        <CenterLine x1={screwCx} y1={sCy - 6} x2={screwCx} y2={sCy + PX(screwLen) + 8} />

        <DimLine x1={sCx + sAW} y1={sCy} x2={sCx + sAW} y2={sCy + PX(csDepth)}
          label={`埋頭 ${csDepth}`}
          side={safeDimSide("right", `埋頭 ${csDepth}`, { x: sCx + sAW, y: sCy + PX(csDepth) / 2 }, qBounds)} />
        <DimLine x1={sCx + sAW} y1={sCy + sAT + 2} x2={sCx + sAW} y2={sCy + PX(screwLen)}
          label={`螺長 ${screwLen}`}
          side={safeDimSide("right", `螺長 ${screwLen}`, { x: sCx + sAW, y: sCy + sAT + PX(screwLen / 2) }, qBounds)} />
        <DimLine x1={sCx} y1={sCy + sAT + 2} x2={sCx} y2={sCy + sAT + sBH + 2}
          label={`B=${mt}`}
          side={safeDimSide("left", `B=${mt}`, { x: sCx, y: sCy + sAT + sBH / 2 }, qBounds)} />
        <DimLine x1={screwCx - PX(pilot) / 2} y1={sCy + sAT + sBH} x2={screwCx + PX(pilot) / 2} y2={sCy + sAT + sBH}
          label={`Ø${pilot}`}
          side={safeDimSide("bottom", `Ø${pilot}`, { x: screwCx, y: sCy + sAT + sBH }, qBounds)} />
      </g>
    );
  })();

  // ===== Q3 俯視圖：A 件正面，露出 2 個埋頭孔 =====
  const top = (() => {
    const bbox = { w: 160, h: 60 };
    const s = unifiedFitScale(bbox);
    const PX = (mm: number) => mm * s;
    const objW = PX(160);
    const objH = PX(60);
    const place = placeInQuadrant({ w: objW, h: objH });
    const tCx = place.x;
    const tCy = place.y;
    const tAW = PX(160);
    const tAH = PX(60);
    const csR = Math.max(PX(csDia) / 2, 4);
    const qBounds = { x: 0, y: 0, w: QUADRANT.W, h: QUADRANT.H - QUADRANT.HEADER_H };

    return (
      <g>
        <rect x={tCx} y={tCy} width={tAW} height={tAH}
          fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        {[-1, 1].map((dir, i) => {
          const cx0 = tCx + tAW / 2 + dir * PX(40);
          const cy0 = tCy + tAH / 2;
          return (
            <g key={i}>
              <circle cx={cx0} cy={cy0} r={csR} fill="white" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
              <circle cx={cx0} cy={cy0} r={Math.max(PX(pilot) / 2, 1.5)} fill="#444" />
              <CenterLine x1={cx0} y1={cy0 - csR - 4} x2={cx0} y2={cy0 + csR + 4} />
              <CenterLine x1={cx0 - csR - 4} y1={cy0} x2={cx0 + csR + 4} y2={cy0} />
            </g>
          );
        })}
        <HiddenEdge d={`M ${tCx + tAW / 2 - PX(mt) / 2},${tCy} L ${tCx + tAW / 2 - PX(mt) / 2},${tCy + tAH}`} />
        <HiddenEdge d={`M ${tCx + tAW / 2 + PX(mt) / 2},${tCy} L ${tCx + tAW / 2 + PX(mt) / 2},${tCy + tAH}`} />
        <GrainArrow x={tCx + 8} y={tCy + tAH + 18} length={tAW - 16} angle={0} />

        <DimLine x1={tCx + tAW / 2 - PX(40)} y1={tCy + tAH} x2={tCx + tAW / 2 + PX(40)} y2={tCy + tAH}
          label={`孔距 80`}
          side={safeDimSide("bottom", `孔距 80`, { x: tCx + tAW / 2, y: tCy + tAH }, qBounds)} />
      </g>
    );
  })();

  // ===== Q4 等角圖：T 字組裝 =====
  const iso = (() => {
    const aLenMm = 120;
    const aDMm = 60;
    const bHMm = 70;
    const isoBbox = { w: aLenMm, h: bHMm + ct + 20, d: aDMm };
    const isoScale = unifiedFitScale(isoBbox, { targetUsage: 0.65 });
    const center = { x: QUADRANT.W / 2, y: (QUADRANT.H - QUADRANT.HEADER_H) / 2 };

    return (
      <g>
        <IsometricGroup originX={center.x} originY={center.y} scale={isoScale}>
          {/* B 件先畫 */}
          <IsoCuboid x={-mt / 2} y={0} z={0} w={mt} h={bHMm} d={aDMm}
            fillFront={ISO_FILL.MORTISE_FRONT} fillTop={ISO_FILL.MORTISE_TOP} fillSide={ISO_FILL.MORTISE_SIDE}
            strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / Math.max(0.4, isoScale)} />
          {/* A 件 */}
          <IsoCuboid x={-aLenMm / 2} y={-ct} z={0} w={aLenMm} h={ct} d={aDMm}
            fillFront={ISO_FILL.TENON_FRONT} fillTop={ISO_FILL.TENON_TOP} fillSide={ISO_FILL.TENON_SIDE}
            strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / Math.max(0.4, isoScale)} />
          {/* 螺絲（從 A 頂面斜直下） */}
          {[-1, 1].map((dir, i) => (
            <g key={i}>
              <line x1={dir * 40} y1={-ct - 2} x2={dir * 40} y2={35}
                stroke="#444"
                strokeWidth={1.4 / Math.max(0.4, isoScale)}
                strokeDasharray={ISO_DASH.HIDDEN} />
              <circle cx={dir * 40} cy={-ct - 1} r={csDia / 2 + 0.5} fill="#555" />
            </g>
          ))}
        </IsometricGroup>
      </g>
    );
  })();

  const sharedScale = unifiedFitScale({ w: 140, h: ct + 110 });
  const scaleStr = sharedScale >= 1 ? `${Math.round(sharedScale)}:1` : `1:${Math.max(1, Math.round(1 / sharedScale))}`;

  return (
    <MasterDetailLayout
      type={p.material ? `screw · ${p.material}` : "screw"}
      joineryNameZh="螺絲 + 白膠"
      drawingNumber={`SC-${ct}-${mt}-Ø${tt}-L${screwLen}`}
      scale={scaleStr}
      drawnBy="wrd-modern-joinery"
      frontView={front}
      sideView={side}
      topView={top}
      isoView={iso}
      warnings={[
        `先導孔 = 螺桿徑 × ${rule.ratioLabel}（${rule.hardness}）= Ø${pilot}mm`,
        `埋頭孔深 ≥ 螺頭高，可加木塞封口`,
      ]}
    />
  );
}
/* === END screw-detail v2 === */

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
function LegacyV2StubJointDetail(p: JoineryDetailParams) {
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
        <rect x={4} y={20} width={innerW - 8} height={innerH - 28} fill="white" stroke="#999" strokeWidth={0.5} />
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
        {/* 卡槽輪廓（紅虛線醒目）— 凸顯藏在母件內的卡槽 */}
        <rect
          x={oX + motherW - mortiseW}
          y={oY + (motherH - mortiseH) / 2}
          width={mortiseW}
          height={mortiseH}
          fill="none"
          stroke={COLOR.DIM_TICK}
          strokeWidth={1.6}
          strokeDasharray="5 3"
        />
        {/* 卡槽深度示意線（從母件左緣延伸到卡槽底，標示挖入深度方向） */}
        <line
          x1={oX + motherW - mortiseW}
          y1={oY + motherH / 2}
          x2={oX + motherW}
          y2={oY + motherH / 2}
          stroke={COLOR.DIM_TICK}
          strokeWidth={1.6}
          strokeDasharray="5 3"
        />
        {/* 卡槽標籤 */}
        <text
          x={oX + motherW - mortiseW / 2}
          y={oY + (motherH - mortiseH) / 2 - 4}
          fontSize={FONT.CALLOUT}
          textAnchor="middle"
          fill={COLOR.DIM_TICK}
          fontWeight="bold"
        >
          卡槽（隱藏）
        </text>
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
        <rect x={4} y={20} width={innerW - 8} height={innerH - 28} fill="white" stroke="#999" strokeWidth={0.5} />
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
        <rect x={4} y={20} width={innerW - 8} height={innerH - 28} fill="white" stroke="#999" strokeWidth={0.5} />
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

  // ===== 等角圖（右下）：Phase 3 — 母腳 IsoCuboid + 牙條 IsoCuboid 整支端面卡入（無肩） =====
  // V3 fix D2：薄板強制視覺加厚 ≥ 16mm（mm 標註保留原值）+ 強制 explode gap ≥ tl + max(ct,16)
  // 避免「公件壓扁穿透母件」+「插入後狀態」的視覺缺陷
  const iso = (() => {
    // 視覺空間統一用「最大尺寸基準」做 scale，避免薄板場景縮成一條線
    const visMax = Math.max(mt * 4, cw + tl + 20, 80);
    const isoScale = Math.min(1.6, 240 / visMax);
    const drawMt = Math.max(mt, 18); // 太薄母件視覺 padding（≥18mm 看得出立體）
    const drawCt = Math.max(ct, 16); // 太薄公件視覺 padding（≥16mm 不會壓成線）
    const drawCw = Math.max(cw, 30); // 公件最小視覺寬度
    const drawTl = Math.max(tl, 8);  // 卡入深度視覺最小值
    const motherH = Math.max(drawMt * 4, 60); // 母件視覺高度
    const apronExt = drawCw * 1.6; // 牙條伸出母件外的長度
    // explode：強制公母分離 ≥ tl + 公件視覺厚 50%（spec E.4：「公母分離有空隙」）
    const explodeGap = Math.max(drawTl + drawCt * 0.6 + 16, drawTl * 2.5);

    return (
      <g>
        <rect x={4} y={20} width={467} height={302} fill="white" stroke="#999" strokeWidth={0.5} />
        <text x={20} y={14} fontSize={FONT.LABEL} fontWeight="bold" fill={COLOR.OUTLINE}>等角圖（30° 軸測，整支端面卡榫拆解）</text>
        <text x={20} y={28} fontSize={FONT.CALLOUT} fill="#888">
          {isRound ? "圓腳" : "方腳"}：整支端面（無肩）卡入母件深 {Math.round(drawTl)}mm
        </text>
        <IsometricGroup originX={120} originY={170} scale={isoScale * 1.0} rotation={30}>
          {/* 母件（柱腳） */}
          {!isRound ? (
            <IsoCuboid
              x={0}
              y={0}
              z={0}
              w={drawMt}
              h={motherH}
              d={drawMt}
              fillFront={ISO_FILL.MORTISE_FRONT}
              fillTop={ISO_FILL.MORTISE_TOP}
              fillSide={ISO_FILL.MORTISE_SIDE}
              strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / isoScale}
            />
          ) : (
            <IsoCylinder
              x={drawMt / 2}
              y={0}
              z={drawMt / 2}
              radius={drawMt / 2}
              height={motherH}
              axis="y"
              fillSide={ISO_FILL.MORTISE_FRONT}
              fillCap={ISO_FILL.MORTISE_TOP}
              strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / isoScale}
            />
          )}
          {/* 母件榫眼（在右面 +x 上，深 = drawTl，寬 = drawCw、高 = drawCt — 整支斷面卡入） */}
          {!isRound && (
            <IsoMortise
              faceX={drawMt}
              faceY={motherH * 0.5}
              faceZ={drawMt / 2}
              width={drawCw}
              height={drawCt}
              depth={drawTl}
              faceNormal="+x"
              through={false}
              stroke={COLOR.OUTLINE}
              strokeWidth={ISO_STROKE.EDGE_INTERIOR / isoScale}
            />
          )}
          {/* 牙條（整支，往 +x 拉開 explode） */}
          <g transform={`translate(${drawMt + explodeGap} ${motherH * 0.5 - drawCt / 2})`}>
            <IsoCuboid
              x={0}
              y={0}
              z={drawMt / 2 - drawCw / 2}
              w={apronExt + drawTl}
              h={drawCt}
              d={drawCw}
              fillFront={ISO_FILL.TENON_FRONT}
              fillTop={ISO_FILL.TENON_TOP}
              fillSide={ISO_FILL.TENON_SIDE}
              strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / isoScale}
            />
          </g>
          {/* 拆解箭頭：牙條左端 → 母件榫眼（含三角箭頭） */}
          {(() => {
            const fromX = drawMt + explodeGap - 4;
            const toX = drawMt + 4;
            const yMid = motherH * 0.5;
            const ah = 5 / isoScale;
            return (
              <g stroke={COLOR.DIM} fill={COLOR.DIM}>
                <line
                  x1={fromX}
                  y1={yMid}
                  x2={toX}
                  y2={yMid}
                  strokeWidth={1 / isoScale}
                  strokeDasharray={ISO_DASH.ARROW}
                />
                <polygon
                  points={`${toX},${yMid} ${toX + ah},${yMid - ah * 0.6} ${toX + ah},${yMid + ah * 0.6}`}
                />
              </g>
            );
          })()}
        </IsometricGroup>
        {/* 視覺加厚提示：若實際 ct/mt 小於繪圖加厚值，明確標註 */}
        {(ct < drawCt || mt < drawMt) && (
          <text x={20} y={310} fontSize={FONT.CALLOUT} fill="#888">
            ＊薄板場景視覺加厚至 ≥{drawCt}mm（mm 標註以實際值 ct={ct}、mt={mt} 為準）
          </text>
        )}
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
            drawingNumber={`SJ-${cw}x${ct}-${mt}${isRound ? "-R" : ""}`}
          />
        }
      />
      <ScaleBar x={W - 220} y={H - 80} widthMm={Math.max(40, mt * 0.8)} pxPerMm={Math.min(2, 200 / Math.max(20, mt))} segments={4} label="mm" />
    </svg>
  );
}
/* === END stub-joint-detail (legacy) === */

/* === BEGIN stub-joint-detail v2 (Wave 2b Group B) ===
 * 整支卡榫 stub-joint — MasterDetailLayout + 統一 helper
 * ============================================================ */
function StubJointDetail(p: JoineryDetailParams) {
  const tlRaw = p.tenonLength;
  const cw = p.childWidth ?? p.tenonWidth;
  const ct = p.childThickness ?? p.tenonThickness;
  const mt = p.motherThickness;
  const isRound = p.motherShape === "round";
  const tl = Math.max(2, Math.min(tlRaw, Math.min(mt - 3, ct / 2)));

  // ===== Q1 正視圖：母件側面 + 公件分解 =====
  const front = (() => {
    const apronExt = Math.max(cw, 60);
    const gapMm = 20;
    const bbox = { w: mt + gapMm + apronExt, h: cw };
    const s = unifiedFitScale(bbox);
    const PX = (mm: number) => mm * s;
    const objW = PX(bbox.w);
    const objH = PX(bbox.h);
    const place = placeInQuadrant({ w: objW, h: objH });
    const oX = place.x;
    const oY = place.y;
    const motherW = PX(mt);
    const motherH = PX(cw);
    const mortiseW = PX(tl);
    const mortiseH = PX(ct);
    const qBounds = { x: 0, y: 0, w: QUADRANT.W, h: QUADRANT.H - QUADRANT.HEADER_H };

    return (
      <g>
        {/* 母件側面 */}
        {isRound ? (
          <ellipse cx={oX + motherW / 2} cy={oY + motherH / 2} rx={motherW / 2} ry={motherH / 2}
            fill={COLOR.MORTISE} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        ) : (
          <rect x={oX} y={oY} width={motherW} height={motherH}
            fill={COLOR.MORTISE} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        )}
        {/* 榫眼（從右側往內挖） */}
        <rect x={oX + motherW - mortiseW} y={oY + (motherH - mortiseH) / 2}
          width={mortiseW} height={mortiseH}
          fill="#3d2a14" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        {/* 卡槽紅虛線醒目輪廓 */}
        <g strokeWidth={1.6}>
          <rect x={oX + motherW - mortiseW} y={oY + (motherH - mortiseH) / 2}
            width={mortiseW} height={mortiseH} fill="none"
            stroke={COLOR.DIM_TICK} strokeDasharray="5 3" />
        </g>
        {/* 中心線 */}
        <CenterLine x1={oX - 6} y1={oY + motherH / 2} x2={oX + motherW + 6} y2={oY + motherH / 2} />
        <CenterLine x1={oX + motherW / 2} y1={oY - 6} x2={oX + motherW / 2} y2={oY + motherH + 6} />

        {/* 公件 — 分離畫在右側 */}
        <g transform={`translate(${PX(mt + gapMm)},0)`}>
          <rect x={oX} y={oY + (motherH - mortiseH) / 2}
            width={PX(apronExt)} height={mortiseH}
            fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
          {/* 將要插入部分（虛線標示） */}
          <rect x={oX} y={oY + (motherH - mortiseH) / 2}
            width={mortiseW} height={mortiseH}
            fill="none" stroke={COLOR.SECTION_HATCH} strokeWidth={0.8} strokeDasharray={DASH.AUX} />
          <text x={oX + PX(apronExt) / 2} y={oY + motherH + 14}
            fontSize={FONT.CALLOUT} textAnchor="middle" fill={COLOR.OUTLINE}>
            公件（牙條）整支端面 = 榫
          </text>
        </g>

        <text x={oX + motherW / 2} y={oY + motherH + 14}
          fontSize={FONT.CALLOUT} textAnchor="middle" fill={COLOR.OUTLINE}>
          母件（{isRound ? "圓腳" : "方腳"}）
        </text>

        {/* 尺寸 */}
        <DimLine x1={oX} y1={oY} x2={oX + motherW} y2={oY}
          label={`${isRound ? "Ø" : ""}${mt}`}
          side={safeDimSide("top", `${mt}`, { x: oX + motherW / 2, y: oY }, qBounds)} />
        <DimLine x1={oX} y1={oY} x2={oX} y2={oY + motherH}
          label={`${cw}`}
          side={safeDimSide("left", `${cw}`, { x: oX, y: oY + motherH / 2 }, qBounds)} />
        <DimLine x1={oX + motherW - mortiseW} y1={oY + motherH} x2={oX + motherW} y2={oY + motherH}
          label={`卡入 ${Math.round(tl)}`}
          side={safeDimSide("bottom", `卡入 ${Math.round(tl)}`, { x: oX + motherW - mortiseW / 2, y: oY + motherH }, qBounds)} />

        {/* 剖面 A-A */}
        <SectionMark x={oX + motherW / 2 - 14} y={oY - 14} label="A" direction="right" />
        <SectionMark x={oX + motherW / 2 + 14} y={oY - 14} label="A" direction="left" />
      </g>
    );
  })();

  // ===== Q2 側視圖：剖面 + 「無肩 vs 有肩」對比 =====
  const side = (() => {
    const drawW = mt + cw * 0.6;
    const bbox = { w: drawW * 2 + 20, h: ct * 2 + 30 };
    const s = unifiedFitScale(bbox);
    const PX = (mm: number) => mm * s;
    const objW = PX(bbox.w);
    const objH = PX(bbox.h);
    const place = placeInQuadrant({ w: objW, h: objH });
    const eachW = PX(drawW);
    const oY = place.y;
    const qBounds = { x: 0, y: 0, w: QUADRANT.W, h: QUADRANT.H - QUADRANT.HEADER_H };

    const drawDiagram = (oX: number, hasShoulder: boolean, label: string, slug: string) => {
      const motherW = PX(mt);
      const apronLen = PX(cw * 0.6);
      const tenonLen = PX(tl);
      const tenonH = hasShoulder ? PX(ct * 0.6) : PX(ct);
      const apronH = PX(ct);
      const hatchId = `hatch-stub-v2-${slug}`;
      return (
        <g key={slug}>
          <defs>
            <Hatching id={hatchId} color={COLOR.SECTION_HATCH} />
          </defs>
          <rect x={oX} y={oY} width={motherW} height={apronH * 2} fill={`url(#${hatchId})`} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
          <rect x={oX} y={oY} width={motherW} height={apronH * 2} fill="none" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
          <rect x={oX + motherW - tenonLen} y={oY + apronH - tenonH / 2}
            width={tenonLen} height={tenonH} fill="white" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
          <rect x={oX + motherW} y={oY + apronH - apronH / 2}
            width={apronLen} height={apronH} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
          <rect x={oX + motherW - tenonLen} y={oY + apronH - tenonH / 2}
            width={tenonLen} height={tenonH} fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
          <text x={oX + motherW / 2 + apronLen / 2} y={oY - 6}
            fontSize={FONT.LABEL} fontWeight="bold" textAnchor="middle"
            fill={hasShoulder ? COLOR.OUTLINE : COLOR.SECTION_HATCH}>
            {label}
          </text>
          <text x={oX + motherW / 2 + apronLen / 2} y={oY + apronH * 2 + 14}
            fontSize={FONT.CALLOUT} textAnchor="middle" fill={COLOR.OUTLINE}>
            {hasShoulder ? "有肩：肩面承力" : "無肩：整支端面"}
          </text>
        </g>
      );
    };

    return (
      <g>
        {drawDiagram(place.x, false, "無肩 stub", "noshoulder")}
        {drawDiagram(place.x + eachW + PX(20), true, "有肩參考", "withshoulder")}
        {/* dim - 標明卡入深度 */}
        <DimLine
          x1={place.x + PX(mt - tl)} y1={oY + PX(ct * 2) + 12}
          x2={place.x + PX(mt)} y2={oY + PX(ct * 2) + 12}
          label={`卡入深 ${Math.round(tl)}`}
          side={safeDimSide("bottom", `卡入深 ${Math.round(tl)}`, { x: place.x + PX(mt - tl / 2), y: oY + PX(ct * 2) + 12 }, qBounds)} />
      </g>
    );
  })();

  // ===== Q3 俯視圖：上視切面 — 母件 + 牙條卡入 =====
  const top = (() => {
    const apronShow = Math.max(cw, 50);
    const bbox = { w: mt + apronShow + 10, h: Math.max(mt, ct) + 10 };
    const s = unifiedFitScale(bbox);
    const PX = (mm: number) => mm * s;
    const objW = PX(bbox.w);
    const objH = PX(bbox.h);
    const place = placeInQuadrant({ w: objW, h: objH });
    const oX = place.x;
    const oY = place.y;
    const legSide = PX(mt);
    const apronLen = PX(apronShow);
    const tenonLen = PX(tl);
    const tenonT = PX(ct);
    const cx = oX + legSide / 2;
    const cy = oY + legSide / 2;
    const qBounds = { x: 0, y: 0, w: QUADRANT.W, h: QUADRANT.H - QUADRANT.HEADER_H };

    return (
      <g>
        <defs>
          <Hatching id="hatch-stub-top-v2" color={COLOR.SECTION_HATCH} />
        </defs>
        {/* 母件 */}
        {isRound ? (
          <circle cx={cx} cy={cy} r={legSide / 2} fill="url(#hatch-stub-top-v2)" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        ) : (
          <rect x={oX} y={oY} width={legSide} height={legSide} fill="url(#hatch-stub-top-v2)" stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        )}
        {/* 榫眼開口隱藏線 */}
        <HiddenEdge d={`M ${oX + legSide - tenonLen} ${cy - tenonT / 2} h ${tenonLen} v ${tenonT} h ${-tenonLen} z`} />
        {/* 牙條本體 + 榫頭 */}
        <rect x={oX + legSide - tenonLen} y={cy - tenonT / 2}
          width={tenonLen + apronLen} height={tenonT}
          fill={COLOR.TENON} stroke={COLOR.OUTLINE} strokeWidth={STROKE.OUTLINE} />
        {/* 中心線 */}
        <CenterLine x1={oX - 8} y1={cy} x2={oX + legSide + apronLen + 8} y2={cy} />
        {isRound && <CenterLine x1={cx} y1={oY - 6} x2={cx} y2={oY + legSide + 6} />}

        {/* dim */}
        <DimLine x1={oX} y1={oY} x2={oX + legSide} y2={oY}
          label={`${mt}`}
          side={safeDimSide("top", `${mt}`, { x: cx, y: oY }, qBounds)} />
        <DimLine x1={oX + legSide - tenonLen} y1={oY + legSide} x2={oX + legSide} y2={oY + legSide}
          label={`卡入 ${Math.round(tl)}`}
          side={safeDimSide("bottom", `卡入 ${Math.round(tl)}`, { x: oX + legSide - tenonLen / 2, y: oY + legSide }, qBounds)} />
        <DimLine x1={oX + legSide + apronLen} y1={cy - tenonT / 2} x2={oX + legSide + apronLen} y2={cy + tenonT / 2}
          label={`${ct}`}
          side={safeDimSide("right", `${ct}`, { x: oX + legSide + apronLen, y: cy }, qBounds)} />
      </g>
    );
  })();

  // ===== Q4 等角圖 =====
  const iso = (() => {
    const drawMt = Math.max(mt, 18);
    const drawCt = Math.max(ct, 16);
    const drawCw = Math.max(cw, 30);
    const drawTl = Math.max(tl, 8);
    const motherH = Math.max(drawMt * 4, 60);
    const apronExt = drawCw * 1.6;
    const explodeGap = Math.max(drawTl + drawCt * 0.6 + 16, drawTl * 2.5);

    const isoBbox = { w: drawMt + explodeGap + apronExt + drawTl, h: motherH, d: drawMt };
    const isoScale = unifiedFitScale(isoBbox, { targetUsage: 0.6 });
    const center = { x: QUADRANT.W / 2, y: (QUADRANT.H - QUADRANT.HEADER_H) / 2 };

    return (
      <g>
        <IsometricGroup originX={center.x - (drawMt + explodeGap + apronExt) * isoScale / 2} originY={center.y + motherH * isoScale / 2} scale={isoScale} rotation={30}>
          {/* 母件柱腳 */}
          {!isRound ? (
            <IsoCuboid x={0} y={0} z={0} w={drawMt} h={motherH} d={drawMt}
              fillFront={ISO_FILL.MORTISE_FRONT} fillTop={ISO_FILL.MORTISE_TOP} fillSide={ISO_FILL.MORTISE_SIDE}
              strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / Math.max(0.4, isoScale)} />
          ) : (
            <IsoCylinder x={drawMt / 2} y={0} z={drawMt / 2}
              radius={drawMt / 2} height={motherH} axis="y"
              fillSide={ISO_FILL.MORTISE_FRONT} fillCap={ISO_FILL.MORTISE_TOP}
              strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / Math.max(0.4, isoScale)} />
          )}
          {/* 母件榫眼（方腳） */}
          {!isRound && (
            <IsoMortise faceX={drawMt} faceY={motherH * 0.5} faceZ={drawMt / 2}
              width={drawCw} height={drawCt} depth={drawTl}
              faceNormal="+x" through={false}
              stroke={COLOR.OUTLINE}
              strokeWidth={ISO_STROKE.EDGE_INTERIOR / Math.max(0.4, isoScale)} />
          )}
          {/* 牙條（往 +x explode） */}
          <g transform={`translate(${drawMt + explodeGap} ${motherH * 0.5 - drawCt / 2})`}>
            <IsoCuboid x={0} y={0} z={drawMt / 2 - drawCw / 2}
              w={apronExt + drawTl} h={drawCt} d={drawCw}
              fillFront={ISO_FILL.TENON_FRONT} fillTop={ISO_FILL.TENON_TOP} fillSide={ISO_FILL.TENON_SIDE}
              strokeWidth={ISO_STROKE.OUTLINE_VISIBLE / Math.max(0.4, isoScale)} />
          </g>
          {/* 拆解箭頭 */}
          {(() => {
            const fromX = drawMt + explodeGap - 4;
            const toX = drawMt + 4;
            const yMid = motherH * 0.5;
            const ah = 5 / Math.max(0.4, isoScale);
            return (
              <g stroke={COLOR.DIM} fill={COLOR.DIM}>
                <line x1={fromX} y1={yMid} x2={toX} y2={yMid}
                  strokeWidth={1 / Math.max(0.4, isoScale)} strokeDasharray={ISO_DASH.ARROW} />
                <polygon points={`${toX},${yMid} ${toX + ah},${yMid - ah * 0.6} ${toX + ah},${yMid + ah * 0.6}`} />
              </g>
            );
          })()}
        </IsometricGroup>
      </g>
    );
  })();

  const sharedScale = unifiedFitScale({ w: mt + 20 + Math.max(cw, 60), h: cw });
  const scaleStr = sharedScale >= 1 ? `${Math.round(sharedScale)}:1` : `1:${Math.max(1, Math.round(1 / sharedScale))}`;

  return (
    <MasterDetailLayout
      type="stub-joint"
      joineryNameZh={`整支卡榫（housing joint，${isRound ? "圓腳" : "方腳"}）`}
      drawingNumber={`SJ-${cw}x${ct}-${mt}${isRound ? "-R" : ""}`}
      scale={scaleStr}
      frontView={front}
      sideView={side}
      topView={top}
      isoView={iso}
      warnings={[
        `卡入深 ≤ min(母厚-3, 板厚/2) = ${Math.round(tl)}mm`,
        `${isRound ? "圓腳曲面：禁通榫，整支端面卡入" : "方腳：可選整支卡入或加肩"}`,
      ]}
    />
  );
}
/* === END stub-joint-detail v2 === */

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
