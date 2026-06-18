/**
 * <T1Dimensions> + <T1DimensionsRow> — 零件圖 T1 整體尺寸標註
 *
 * 第三角投影慣例（與 OrthoView 一致）：
 *   front view: 水平 = length（長），垂直 = thickness（厚）
 *   top view:   水平 = length（長），垂直 = width（寬）
 *   side view:  水平 = width（寬），  垂直 = thickness（厚）
 *
 * Phase 1：以 text row 形式輸出在每張 OrthoView 下方（穩、無對位風險）。
 * Phase 2：T1Dimensions 升級成 SVG overlay，透過 OrthoView.overlayContent slot
 * 注入；T1DimensionsRow 仍保留 export 作為印製預覽或 fallback 用。
 *
 * Spec: docs/superpowers/specs/2026-05-17-part-drawings-phase-2-design.md §1
 */

import React from "react";
import type { FurnitureDesign, Mortise, Part, Tenon } from "@/lib/types";
import {
  DimensionLine,
  VerticalDimensionLine,
  LATHE_SEG,
  mortiseLocalBox,
  tenonLocalBox,
  type OrthoViewBoxCtx,
} from "@/lib/render/svg-views";
import { worldExtents } from "@/lib/render/geometry";
const round1 = (n: number) => Math.round(n * 10) / 10;

export type PartView = "front" | "side" | "top" | "bottom";

/**
 * 取得單一 view 在第三角法下的水平/垂直 mm 尺寸。
 *
 * 標籤語意（長/寬/厚）依「mm 大小排序」而非 Cartesian L/W/T：
 *   - 最大 → 長
 *   - 次大 → 寬
 *   - 最小 → 厚
 *
 * 這樣腳（visible.thickness=425, length=35）「425 = 長」、板（length=100,
 * thickness=10）「100 = 長」，跟木匠直覺一致。
 */
export function getT1ForView(part: Part, view: PartView): {
  horiz: number;
  vert: number;
  horizLabel: string;
  vertLabel: string;
} {
  const L = round1(part.visible.length);
  const W = round1(part.visible.width);
  const T = round1(part.visible.thickness);
  const horiz = view === "side" ? W : L;
  const vert = view === "top" ? W : T;
  // 按 mm 大小排序給語意標籤
  const sorted = (
    [
      { mm: L, axis: "L" as const },
      { mm: W, axis: "W" as const },
      { mm: T, axis: "T" as const },
    ] as const
  )
    .slice()
    .sort((a, b) => b.mm - a.mm);
  const semanticLabel: Record<"L" | "W" | "T", string> = {
    L: "",
    W: "",
    T: "",
  };
  semanticLabel[sorted[0].axis] = "長";
  semanticLabel[sorted[1].axis] = "寬";
  semanticLabel[sorted[2].axis] = "厚";
  const horizAxis = view === "side" ? "W" : "L";
  const vertAxis = view === "top" ? "W" : "T";
  return {
    horiz,
    vert,
    horizLabel: semanticLabel[horizAxis],
    vertLabel: semanticLabel[vertAxis],
  };
}

/**
 * T1 整體尺寸 SVG overlay（Phase 2 啟用）。
 *
 * 透過 OrthoView 提供的 ctx.partLocalToSvg 把 part-local mm 轉成 SVG px，
 * 再以 DimensionLine / VerticalDimensionLine 畫水平 + 垂直尺寸線。
 *
 * 端點取得（part-local 慣例：length=X、thickness=Y、width=Z）：
 *   front view (vy=wy, vx=-wx)
 *     horiz: localX = ±L/2 在 thickness 底面（localY=+T/2）
 *     vert:  localY = ±T/2 在 length 左端 = localX=-L/2（SVG 右側，因 X 被負）
 *   top view (vy=wz, vx=-wx)
 *     horiz: localX = ±L/2 在 width 前緣（localZ=+W/2，SVG 較大 y）
 *     vert:  localZ = ±W/2 在 length 左端 = localX=-L/2（SVG 右側）
 *   side view (vy=wy, vx=-wz) — 前=右慣例
 *     horiz: localZ = ±W/2 在 thickness 底面（localY=+T/2）
 *     vert:  localY = ±T/2 在 width 右端 = localZ=-W/2（SVG 較大 x = 前方）
 *
 * 尺寸線位置：水平線下方 +28（DimensionLine 內部 reach=26 預留），
 * 垂直線右側 +28。
 *
 * Spec: docs/superpowers/specs/2026-05-17-part-drawings-phase-2-design.md §1
 */
/**
 * 外撇托盤手把等「板平著挖、再傾斜板」的 cosmetic 斜孔（rotX/rotZ ≠ 0）：
 * 零件卡顯示「加工姿態」→ 孔心歸位壁厚中心、rot 清零、深 = 壁厚（維持貫穿）。
 * 與 svg-views isolate 的 mitered-ends vertices 反烘對齊（user 2026-06-11
 * 外撇左壁卡：俯視斜 pill 突出薄板、側視斜孔）。
 */
function normalizePartForDrawing(part: Part): Part {
  // 只反烘「貫穿」傾斜 cosmetic 孔（外撇牆/托盤手把＝平板鑽⊥孔再傾斜整片板）。
  // 非貫穿斜槽（百葉門 25° 斜鑿淺槽）保留斜度，零件圖才畫得出斜平行四邊形。
  if (!part.mortises?.some((m) => m.cosmetic && m.through && (m.rotX || m.rotZ)))
    return part;
  return {
    ...part,
    mortises: part.mortises.map((m) =>
      m.cosmetic && m.through && (m.rotX || m.rotZ)
        ? {
            ...m,
            origin: { ...m.origin, y: part.visible.thickness / 2 },
            rotX: 0,
            rotZ: 0,
            depth: part.visible.thickness,
          }
        : m,
    ),
  };
}

export function T1Dimensions({
  ctx,
  part,
  view,
}: {
  ctx: OrthoViewBoxCtx;
  part: Part;
  view: PartView;
}) {
  part = normalizePartForDrawing(part);
  // T1 標籤跟 dim arrow 改用 SCREEN BOUNDING BOX：
  // 對 stool leg (T > L) 這種 OrthoView 內部旋轉 (isolation rotation Rz=-π/2)
  // 把長軸投影到螢幕水平的件，part-local 軸跟視覺方向不一致。getT1ForView
  // 用 part-local 軸名硬綁 → user 看到「長度標寬度位置」。改用 8 corners
  // 投影後的 screen bounding box（top edge for horiz arrow, right edge for
  // vert arrow），label 用 auto-detect: 哪兩個軸的 mm ratio 接近 screen
  // X/Y extent ratio 就是當前 view 的 visible 兩軸。
  const L = part.visible.length;
  const W = part.visible.width;
  const T = part.visible.thickness;
  const arrowId = `arr-${view}`;
  // T1 dim line 距 part 邊緣（水平用小、垂直保留大 — 垂直方向有 T2 shoulder
  // dim 跟榫頭 box 容易撞，故 vert 端離遠一點）
  // HORIZ_OFFSET 18 對「無 tenon 端面」OK，有 tenon 凸出時 W chain dim 會擠
  // 上來，動態加 12 svg unit 給 W chain 跟箭頭預留空間
  const hasVertTenon = part.tenons.some(
    (t) =>
      t.length > 0 &&
      (view === "front" || view === "side"
        ? t.position === "top" || t.position === "bottom"
        : t.position === "left" || t.position === "right"),
  );
  const HORIZ_OFFSET = hasVertTenon ? 30 : 18;
  // VERT_OFFSET 從 50 拉到 70：避開短料側視圖（寬/厚軸）的「厚 20 / 寬 60」
  // 撞到內側 tenon 標籤（user 2026-05-29 後牙條側視圖）
  const VERT_OFFSET = 70;
  const GROSS_GAP = 14; // SVG px；含榫總長 dim 距 T1 dim line

  // 8 corners 投影
  const allCorners = [
    ctx.partLocalToSvg(-L / 2, -T / 2, -W / 2),
    ctx.partLocalToSvg(+L / 2, -T / 2, -W / 2),
    ctx.partLocalToSvg(-L / 2, +T / 2, -W / 2),
    ctx.partLocalToSvg(+L / 2, +T / 2, -W / 2),
    ctx.partLocalToSvg(-L / 2, -T / 2, +W / 2),
    ctx.partLocalToSvg(+L / 2, -T / 2, +W / 2),
    ctx.partLocalToSvg(-L / 2, +T / 2, +W / 2),
    ctx.partLocalToSvg(+L / 2, +T / 2, +W / 2),
  ];
  const partMinX = Math.min(...allCorners.map((p) => p.x));
  const partMaxX = Math.max(...allCorners.map((p) => p.x));
  const partMinY = Math.min(...allCorners.map((p) => p.y));
  const partMaxY = Math.max(...allCorners.map((p) => p.y));

  // horiz arrow = top edge bounding box（畫水平 arrow 橫跨 silhouette top）
  // vert  arrow = right edge bounding box（畫垂直 arrow 橫跨 silhouette right）
  const horizP1 = { x: partMinX, y: partMinY };
  const horizP2 = { x: partMaxX, y: partMinY };
  const vertP1 = { x: partMaxX, y: partMinY };
  const vertP2 = { x: partMaxX, y: partMaxY };

  // Auto-detect 哪兩軸投影到當前 view（避開 view 約定）：比對 screen X/Y
  // extent ratio 跟 [L,W,T] 三對組合的 mm ratio，挑最接近的那對。
  const screenXExt = partMaxX - partMinX;
  const screenYExt = partMaxY - partMinY;
  const screenLandscape = screenXExt >= screenYExt;
  const screenRatio =
    Math.max(screenXExt, screenYExt) /
    Math.max(0.001, Math.min(screenXExt, screenYExt));
  const dimsAll = [
    { mm: L, axis: "L" as const },
    { mm: W, axis: "W" as const },
    { mm: T, axis: "T" as const },
  ];
  let bestPair: [(typeof dimsAll)[0], (typeof dimsAll)[0]] = [dimsAll[0], dimsAll[1]];
  let bestDiff = Infinity;
  for (let i = 0; i < dimsAll.length; i++) {
    for (let j = i + 1; j < dimsAll.length; j++) {
      const a = dimsAll[i];
      const b = dimsAll[j];
      const r = Math.max(a.mm, b.mm) / Math.max(0.001, Math.min(a.mm, b.mm));
      const diff = Math.abs(r - screenRatio);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestPair = [a, b];
      }
    }
  }
  const bigVisible =
    bestPair[0].mm >= bestPair[1].mm ? bestPair[0] : bestPair[1];
  const smallVisible =
    bestPair[0].mm >= bestPair[1].mm ? bestPair[1] : bestPair[0];
  const horiz = round1(screenLandscape ? bigVisible.mm : smallVisible.mm);
  const vert = round1(screenLandscape ? smallVisible.mm : bigVisible.mm);
  // label by mm-rank 三軸（最大=長、中=寬、最小=厚）
  const allRanked = dimsAll.slice().sort((a, b) => b.mm - a.mm);
  const labelByAxis: Record<string, string> = {};
  labelByAxis[allRanked[0].axis] = "長";
  labelByAxis[allRanked[1].axis] = "寬";
  labelByAxis[allRanked[2].axis] = "厚";
  const horizAxisName = (screenLandscape ? bigVisible : smallVisible).axis;
  const vertAxisName = (screenLandscape ? smallVisible : bigVisible).axis;
  const horizLabel = labelByAxis[horizAxisName];
  const vertLabel = labelByAxis[vertAxisName];

  // 梯形 apron length 端：主「長」標 silhouette 對應的真實邊（不是肩到肩中線）。
  //
  //   正視 (annotation view="top",看得到梯形)：主「長」= 上邊 topLengthScale×L
  //     (短邊),dim 線端點貼上邊；下邊由第二條 dim 補。
  //   俯視 (annotation view="front",Y 軸壓掉變矩形 silhouette)：
  //     silhouette 寬 = max(top,bot)×L = 下邊 bottomLengthScale×L (長邊)。
  //     主「長」改標下邊 (290.4),跟可見矩形等長；上邊 (280) 由第二條 dim 補。
  //     user 2026-06-02：「不要中線 285.2,要 290.4(最長邊)跟 280(短邊)」
  //   側視 body 是矩形 W×T,主「長」維持 horiz (跟 L 無關)。
  const trapShapeForMain =
    (view === "top" || view === "front") &&
    part.shape?.kind === "apron-trapezoid" &&
    horizAxisName === "L"
      ? part.shape
      : null;
  const trapForMain = view === "top" ? trapShapeForMain : null;
  const horizMainDisplay = trapShapeForMain
    ? round1(
        part.visible.length *
          (view === "top"
            ? trapShapeForMain.topLengthScale
            : trapShapeForMain.bottomLengthScale),
      )
    : horiz;

  // 連榫頭總長：把所有 tenon bbox 8 corners 投影併入 → 算 gross 比 partBody 大多少
  const grossCorners: { x: number; y: number }[] = [...allCorners];
  for (const t of part.tenons) {
    if (t.length <= 0) continue;
    const lb = tenonLocalBox(part, t);
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) {
          grossCorners.push(
            ctx.partLocalToSvg(
              lb.cx + sx * lb.hx,
              lb.cy + sy * lb.hy,
              lb.cz + sz * lb.hz,
            ),
          );
        }
      }
    }
  }
  const grossMinX = Math.min(...grossCorners.map((p) => p.x));
  const grossMaxX = Math.max(...grossCorners.map((p) => p.x));
  const grossMinY = Math.min(...grossCorners.map((p) => p.y));
  const grossMaxY = Math.max(...grossCorners.map((p) => p.y));
  // T1 dim line 起點用 gross（含 tenon protrusion）邊緣，避免 dim 線/標籤
  // 撞進榫頭凸出區（user 05-17 23:16：「30 應該往上拉到 6 18 6 上面」）
  //
  // splay 件 dim chain 錨點：用未傾斜原料頂(grossMinY)、不為了避開傾斜端 silhouette
  // 而往上推。理由(user 2026-05-27)：木工拿到的是一根未傾斜方料,所有 dim chain
  // (37/365/含榫 445 等)都是沿未傾斜長度軸的量度——「要抓的是要挖孔的面」。
  // 傾斜只是組裝視覺結果,不是製作量度基準。trade-off：傾斜端(虛線)會穿過
  // dim chain 區,但語意正確優先於視覺乾淨。
  const horizY = grossMinY - HORIZ_OFFSET;
  const vertX = grossMaxX + VERT_OFFSET;
  const partWidthSvg =
    Math.max(...allCorners.map((p) => p.x)) -
    Math.min(...allCorners.map((p) => p.x));
  const partHeightSvg =
    Math.max(...allCorners.map((p) => p.y)) -
    Math.min(...allCorners.map((p) => p.y));
  const svgPerMmX =
    horiz > 0.1 && partWidthSvg > 1 ? partWidthSvg / horiz : 1;
  const svgPerMmY =
    vert > 0.1 && partHeightSvg > 1 ? partHeightSvg / vert : 1;
  // 含榫總長：直接從 part.tenons 加總，避免 SVG 投影反推（splayed/tapered
  // 件投影軸壓縮會造成 svgPerMmX 失準 → user 2026-05-26 回報「含榫 37.1」
  // 出現在無水平榫的凳腳上）。
  //
  // tenon.position 軸對應（lib/types/index.ts L114）：
  //   start/end → ±x（length 軸）
  //   top/bottom → ±y（thickness 軸）
  //   left/right → ±z（width 軸）
  // 各 view 的「水平軸」「垂直軸」對映 part-local：
  //   front: horiz=x, vert=y
  //   top:   horiz=x, vert=z
  //   side:  horiz=z, vert=y
  // horiz/vert tenon extension 跟 auto-detected 軸走（不是 view 約定）
  const axisToLocal = (a: "L" | "W" | "T"): "x" | "y" | "z" =>
    a === "L" ? "x" : a === "W" ? "z" : "y";
  const horizPartLocal = axisToLocal(horizAxisName as "L" | "W" | "T");
  const vertPartLocal = axisToLocal(vertAxisName as "L" | "W" | "T");
  let horizExt = 0;
  let vertExt = 0;
  for (const t of part.tenons) {
    if (t.length <= 0) continue;
    const pos = t.position;
    if (horizPartLocal === "x" && (pos === "start" || pos === "end")) horizExt += t.length;
    if (horizPartLocal === "y" && (pos === "top" || pos === "bottom")) horizExt += t.length;
    if (horizPartLocal === "z" && (pos === "left" || pos === "right")) horizExt += t.length;
    if (vertPartLocal === "x" && (pos === "start" || pos === "end")) vertExt += t.length;
    if (vertPartLocal === "y" && (pos === "top" || pos === "bottom")) vertExt += t.length;
    if (vertPartLocal === "z" && (pos === "left" || pos === "right")) vertExt += t.length;
  }
  const horizGross = round1(horiz + horizExt);
  const vertGross = round1(vert + vertExt);
  const showHorizGross = horizGross - horiz > 0.5;
  const showVertGross = vertGross - vert > 0.5;

  // 自己畫 dim line + extension（DimensionLine 預設 extension 朝上、不適合
  // 我們 dim line 在 part 上方的場景——應該朝 part 下方延伸）
  const sortedX = [horizP1.x, horizP2.x].sort((a, b) => a - b);
  let hxLo = sortedX[0];
  let hxHi = sortedX[1];
  // 梯形 apron 主「長」dim 線端點要貼真實邊（不是 allCorners bbox 中線）：
  //   view="top" → 上邊端點 ±L/2 × topLengthScale (跟 horizMainDisplay 一致)
  //   view="front" → 下邊端點 ±L/2 × bottomLengthScale (silhouette = max)
  // 否則線比數字長、user 2026-06-02「290.4 引線還在中線」回報。
  if (trapShapeForMain) {
    const scaleForMain =
      view === "top"
        ? trapShapeForMain.topLengthScale
        : trapShapeForMain.bottomLengthScale;
    const hL = (part.visible.length / 2) * scaleForMain;
    const e1 = ctx.partLocalToSvg(-hL, part.visible.thickness / 2, +part.visible.width / 2);
    const e2 = ctx.partLocalToSvg(+hL, part.visible.thickness / 2, +part.visible.width / 2);
    const xs = [e1.x, e2.x].sort((a, b) => a - b);
    hxLo = xs[0];
    hxHi = xs[1];
  }
  const hPartY = Math.min(horizP1.y, horizP2.y); // part edge SVG y（dim line 下方就是 part）
  const sortedY = [vertP1.y, vertP2.y].sort((a, b) => a - b);
  const vyLo = sortedY[0];
  const vyHi = sortedY[1];
  const vPartX = Math.max(vertP1.x, vertP2.x); // part edge SVG x（dim line 左邊就是 part）

  const ARROW = 3;
  // 垂直標籤（寬/厚 + 含榫）start-anchor 在 part 右方 vertX+4。寬扁件（牙條/腳踏）
  // 有水平榫時 vertX = grossMaxX(含榫凸出) + VERT_OFFSET 被推到接近 viewBox 右緣，
  // 「寬 30」文字會被右緣切掉（user 2026-06-14 吧台椅牙條/腳踏回報）。
  // → clamp：start-anchor 文字會超出右緣就改 end-anchor 貼右緣（沿用 side 視圖手法）。
  // CJK 字寬估 11px、ASCII 6.2px。
  const vbRight = ctx.vbX + ctx.vbW;
  const estLabelW = (s: string) =>
    [...s].reduce((acc, ch) => acc + (ch.charCodeAt(0) > 0x2000 ? 11 : 6.2), 0);
  const placeVertLabel = (startX: number, text: string) =>
    startX + estLabelW(text) > vbRight - 2
      ? { x: vbRight - 6, anchor: "end" as const }
      : { x: startX, anchor: "start" as const };
  return (
    <g
      className="t1-dim-overlay"
      stroke="#111"
      fill="#111"
      strokeWidth={0.4}
      fontFamily="sans-serif"
    >
      {/* 水平 dim line：dim line 在 part 上方、extension 從 dim line 往下拉到
          part edge 外側（留 2mm gap、不越過 part 邊）。CNS：dim line 上方再
          protrusion 2mm。 */}
      <line x1={hxLo} y1={horizY - 2} x2={hxLo} y2={hPartY - 2} strokeWidth={0.25} stroke="#888" />
      <line x1={hxHi} y1={horizY - 2} x2={hxHi} y2={hPartY - 2} strokeWidth={0.25} stroke="#888" />
      <line x1={hxLo} y1={horizY} x2={hxHi} y2={horizY} />
      <polygon points={`${hxLo},${horizY} ${hxLo + ARROW},${horizY - ARROW} ${hxLo + ARROW},${horizY + ARROW}`} />
      <polygon points={`${hxHi},${horizY} ${hxHi - ARROW},${horizY - ARROW} ${hxHi - ARROW},${horizY + ARROW}`} />
      <text x={(hxLo + hxHi) / 2} y={horizY - 4} textAnchor="middle" fontSize={11} stroke="none">
        {`${horizLabel} ${horizMainDisplay}`}
      </text>

      {/* 連榫頭總長 dim：在水平 dim 上方再加一條，跨整個 gross bbox */}
      {showHorizGross && (
        <g>
          <line
            x1={grossMinX}
            y1={horizY - GROSS_GAP - 2}
            x2={grossMinX}
            y2={horizY - 2}
            strokeWidth={0.25}
            stroke="#888"
          />
          <line
            x1={grossMaxX}
            y1={horizY - GROSS_GAP - 2}
            x2={grossMaxX}
            y2={horizY - 2}
            strokeWidth={0.25}
            stroke="#888"
          />
          <line
            x1={grossMinX}
            y1={horizY - GROSS_GAP}
            x2={grossMaxX}
            y2={horizY - GROSS_GAP}
          />
          <polygon
            points={`${grossMinX},${horizY - GROSS_GAP} ${grossMinX + ARROW},${horizY - GROSS_GAP - ARROW} ${grossMinX + ARROW},${horizY - GROSS_GAP + ARROW}`}
          />
          <polygon
            points={`${grossMaxX},${horizY - GROSS_GAP} ${grossMaxX - ARROW},${horizY - GROSS_GAP - ARROW} ${grossMaxX - ARROW},${horizY - GROSS_GAP + ARROW}`}
          />
          <text
            x={(grossMinX + grossMaxX) / 2}
            y={horizY - GROSS_GAP - 4}
            textAnchor="middle"
            fontSize={11}
            stroke="none"
          >
            {`含榫 ${horizGross}`}
          </text>
        </g>
      )}

      {/* 梯形斜接牙板的「另一邊」長度：
          - 正視 (view="top",梯形可見)：主標上邊 = topLengthScale×L,
            這條補下邊 = bottomLengthScale×L
          - 俯視 (view="front",silhouette 矩形 = max scale = 下邊)：
            主標下邊 = bottomLengthScale×L,這條補上邊 = topLengthScale×L
          user 2026-06-02：「俯視不要 285.2 中線,要 290.4 跟 280」 */}
      {(() => {
        const trap =
          part.shape?.kind === "apron-trapezoid" ? part.shape : null;
        if (view !== "top" && view !== "front") return null;
        if (!trap || horizAxisName !== "L") return null;
        // 另一邊 scale = 跟主標相反那一邊
        const otherScale = view === "top" ? trap.bottomLengthScale : trap.topLengthScale;
        const otherLen = round1(L * otherScale);
        if (Math.abs(otherLen - horizMainDisplay) < 0.5) return null; // 兩邊等長 → 不重複標
        // 端點 x = ±L/2 × otherScale
        const eL = ctx.partLocalToSvg((-L / 2) * otherScale, +T / 2, +W / 2);
        const eR = ctx.partLocalToSvg((+L / 2) * otherScale, +T / 2, +W / 2);
        const xs = [eL.x, eR.x].sort((a, b) => a - b);
        const bxLo = xs[0];
        const bxHi = xs[1];
        // 畫在 part 下緣外側（grossMaxY 之下）
        const botY = grossMaxY + GROSS_GAP;
        return (
          <g>
            <line x1={bxLo} y1={grossMaxY + 2} x2={bxLo} y2={botY + 2} strokeWidth={0.25} stroke="#888" />
            <line x1={bxHi} y1={grossMaxY + 2} x2={bxHi} y2={botY + 2} strokeWidth={0.25} stroke="#888" />
            <line x1={bxLo} y1={botY} x2={bxHi} y2={botY} />
            <polygon points={`${bxLo},${botY} ${bxLo + ARROW},${botY - ARROW} ${bxLo + ARROW},${botY + ARROW}`} />
            <polygon points={`${bxHi},${botY} ${bxHi - ARROW},${botY - ARROW} ${bxHi - ARROW},${botY + ARROW}`} />
            <text x={(bxLo + bxHi) / 2} y={botY + 11} textAnchor="middle" fontSize={11} stroke="none">
              {`長 ${otherLen}`}
            </text>
          </g>
        );
      })()}

      {/* 垂直 dim line：dim line 在 part 右方、extension 從 dim line 往左拉到
          part edge 外側（留 2mm gap、不越過 part 邊）。 */}
      <line x1={vertX + 2} y1={vyLo} x2={vPartX + 2} y2={vyLo} strokeWidth={0.25} stroke="#888" />
      <line x1={vertX + 2} y1={vyHi} x2={vPartX + 2} y2={vyHi} strokeWidth={0.25} stroke="#888" />
      <line x1={vertX} y1={vyLo} x2={vertX} y2={vyHi} />
      <polygon points={`${vertX},${vyLo} ${vertX - ARROW},${vyLo + ARROW} ${vertX + ARROW},${vyLo + ARROW}`} />
      <polygon points={`${vertX},${vyHi} ${vertX - ARROW},${vyHi - ARROW} ${vertX + ARROW},${vyHi - ARROW}`} />
      {/* 側視 T 軸 vert 標籤可能撞到部件本身 — 把 label 推到 viewBox 右邊（dim
          線 + 箭頭仍貼 part 邊）。user 2026-06-02「厚 20 大字移到右邊空白 不要
          擋到圖」。textAnchor="end" 從右邊對齊、x = viewBox 右緣留 6px margin。
          其他 view 維持貼 dim 線右。 */}
      {view === "side" ? (
        <text
          x={ctx.vbX + ctx.vbW - 6}
          y={(vyLo + vyHi) / 2 + 4}
          fontSize={11}
          stroke="none"
          textAnchor="end"
        >
          {`${vertLabel} ${vert}`}
        </text>
      ) : (() => {
        const txt = `${vertLabel} ${vert}`;
        const pl = placeVertLabel(vertX + 4, txt);
        return (
          <text x={pl.x} y={(vyLo + vyHi) / 2 + 4} fontSize={11} stroke="none" textAnchor={pl.anchor}>
            {txt}
          </text>
        );
      })()}

      {/* 連榫頭總長 dim（垂直）：vertical dim 右方再加一條 */}
      {showVertGross && (
        <g>
          <line
            x1={vertX + GROSS_GAP + 2}
            y1={grossMinY}
            x2={vertX + 2}
            y2={grossMinY}
            strokeWidth={0.25}
            stroke="#888"
          />
          <line
            x1={vertX + GROSS_GAP + 2}
            y1={grossMaxY}
            x2={vertX + 2}
            y2={grossMaxY}
            strokeWidth={0.25}
            stroke="#888"
          />
          <line
            x1={vertX + GROSS_GAP}
            y1={grossMinY}
            x2={vertX + GROSS_GAP}
            y2={grossMaxY}
          />
          <polygon
            points={`${vertX + GROSS_GAP},${grossMinY} ${vertX + GROSS_GAP - ARROW},${grossMinY + ARROW} ${vertX + GROSS_GAP + ARROW},${grossMinY + ARROW}`}
          />
          <polygon
            points={`${vertX + GROSS_GAP},${grossMaxY} ${vertX + GROSS_GAP - ARROW},${grossMaxY - ARROW} ${vertX + GROSS_GAP + ARROW},${grossMaxY - ARROW}`}
          />
          <text
            x={vertX + GROSS_GAP + 4}
            y={(grossMinY + grossMaxY) / 2 + 4}
            fontSize={11}
            stroke="none"
          >
            {`含榫 ${vertGross}`}
          </text>
        </g>
      )}
    </g>
  );
}

/**
 * Text-row 形式（Phase 1 用）：放在 OrthoView 下方一行純文字。
 * 每張 view 一條，例：「長 720　厚 40」。
 * 1 位小數 round（per feedback_ui_number_precision）。
 */
export function T1DimensionsRow({
  part,
  view,
  className,
}: {
  part: Part;
  view: PartView;
  className?: string;
}) {
  const { horiz, vert, horizLabel, vertLabel } = getT1ForView(part, view);
  return (
    <div
      className={`text-[10px] text-zinc-600 text-center mt-1 tabular-nums ${
        className ?? ""
      }`}
    >
      {horizLabel} {horiz}　{vertLabel} {vert}
    </div>
  );
}

/**
 * T2 label list — text rows below the 3-view grid listing each mortise/tenon
 * with dimensions and 距底 reference.
 *
 * Phase 1：簡單條列、無 leader line。Phase 2 會把 leader 從 dimension box 拉到
 * label。
 *
 * Format:
 *   榫眼N（depth-axis）：W×L 深 D，距底 Y
 *   榫頭N（position）：W×T 長 L，距底 Y
 *
 * 慣例：
 * - 1 位小數 round（feedback_ui_number_precision）
 * - mortise 沒有 `position` 欄位（depth axis 是 auto-detect），用 origin 推
 *   出進榫面當位置 hint
 * - tenon `length` 即「protrusion 長度」（沒有獨立的 depth 欄位）
 * - 「距底」= part 底面到 feature 中心的 Y 距離 = `cy + thickness/2`
 *
 * Spec: docs/superpowers/specs/2026-05-16-part-drawings-design.md §3.3 / §3.4
 */
interface MatchResult {
  partId: string;
  kind: "mortise" | "tenon";
  idx: number;
}

/**
 * 算 feature 的世界座標中心（mm）。
 *
 * - Mortise: `part.origin + mortise.origin`（origin 直接是 part-local mm）
 * - Tenon:   `part.origin + position-dependent offset`，沿端面外凸方向取
 *   `+length/2` 大致對中（端面對端面的榫頭—榫眼大概會落在 part 表面附近 ±length/2 內）。
 *   `offsetWidth/offsetThickness` 是斷面上的偏移，這裡也要納入。
 *
 * 注意：這只是一個粗略估算，目的是給 findMatchingFeature 比對「世界座標
 * 相鄰」用。15mm 容差吸收 part rotation/visible.length≠center-distance 的誤差。
 */
function featureWorldCenter(
  part: Part,
  feature: Mortise | Tenon,
  kind: "mortise" | "tenon",
): { x: number; y: number; z: number } {
  const px = part.origin?.x ?? 0;
  const py = part.origin?.y ?? 0;
  const pz = part.origin?.z ?? 0;
  if (kind === "mortise") {
    const m = feature as Mortise;
    return {
      x: px + (m.origin?.x ?? 0),
      y: py + (m.origin?.y ?? 0),
      z: pz + (m.origin?.z ?? 0),
    };
  }
  const t = feature as Tenon;
  const halfL = (part.visible.length ?? 0) / 2;
  const halfW = (part.visible.width ?? 0) / 2;
  const T = part.visible.thickness ?? 0;
  const offW = t.offsetWidth ?? 0;
  const offT = t.offsetThickness ?? 0;
  switch (t.position) {
    case "top":
      return { x: px + offW, y: py + T, z: pz + offT };
    case "bottom":
      return { x: px + offW, y: py, z: pz + offT };
    case "start":
      return { x: px - halfL, y: py + offT, z: pz + offW };
    case "end":
      return { x: px + halfL, y: py + offT, z: pz + offW };
    case "left":
      return { x: px + offT, y: py + offW, z: pz - halfW };
    case "right":
      return { x: px + offT, y: py + offW, z: pz + halfW };
    default:
      return { x: px, y: py, z: pz };
  }
}

/**
 * 找另一件零件上跟本 feature 配對的 mortise↔tenon。啟發式：
 * - 世界座標相鄰（中心距 < 15mm）
 * - 尺寸大致一致（width/length 差 ≤ 50%）
 *
 * 找不到合理候選回 null。多個候選取最近的。
 *
 * Spec: docs/superpowers/specs/2026-05-17-part-drawings-phase-2-design.md §6
 */
export function findMatchingFeature(
  part: Part,
  featureIdx: number,
  featureKind: "mortise" | "tenon",
  design: FurnitureDesign,
): MatchResult | null {
  const feature =
    featureKind === "mortise"
      ? part.mortises[featureIdx]
      : part.tenons[featureIdx];
  if (!feature) return null;

  const fCenter = featureWorldCenter(part, feature, featureKind);
  const targetKind: "mortise" | "tenon" =
    featureKind === "mortise" ? "tenon" : "mortise";

  // 自己 feature 的尺寸（用 width/length 做 sanity check）
  const fW = feature.width ?? 0;
  const fL =
    featureKind === "mortise"
      ? (feature as Mortise).length ?? 0
      : (feature as Tenon).length ?? 0;

  let best: { dist: number; result: MatchResult } | null = null;

  for (const other of design.parts) {
    if (other.id === part.id) continue;
    const list: Array<Mortise | Tenon> =
      targetKind === "mortise" ? other.mortises : other.tenons;
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      const oCenter = featureWorldCenter(other, o, targetKind);
      const dist = Math.hypot(
        oCenter.x - fCenter.x,
        oCenter.y - fCenter.y,
        oCenter.z - fCenter.z,
      );
      if (dist > 15) continue;

      // Size sanity: width / length within ~50%
      const oW = o.width ?? 0;
      const oL =
        targetKind === "mortise"
          ? (o as Mortise).length ?? 0
          : (o as Tenon).length ?? 0;
      if (fW && oW && Math.abs(fW - oW) / Math.max(fW, oW) > 0.5) continue;
      if (fL && oL && Math.abs(fL - oL) / Math.max(fL, oL) > 0.5) continue;

      if (best === null || dist < best.dist) {
        best = { dist, result: { partId: other.id, kind: targetKind, idx: i } };
      }
    }
  }
  return best?.result ?? null;
}

export function T2LabelList({
  part,
  design,
}: {
  part: Part;
  design?: FurnitureDesign;
}) {
  part = normalizePartForDrawing(part);
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const ly = part.visible.thickness;

  /** 從 mortise.origin 推測 entry face（純 display hint，不影響幾何）。 */
  const mortiseFaceHint = (m: Part["mortises"][number]): string => {
    const lx = part.visible.length;
    const lz = part.visible.width;
    const yToFace = Math.min(Math.abs(m.origin.y), Math.abs(m.origin.y - ly));
    const xToFace = Math.min(
      Math.abs(m.origin.x - lx / 2),
      Math.abs(m.origin.x + lx / 2),
    );
    const zToFace = Math.min(
      Math.abs(m.origin.z - lz / 2),
      Math.abs(m.origin.z + lz / 2),
    );
    const yIsCanonical = m.origin.y === 0 || m.origin.y === ly;
    // 同步 svg-views mortiseLocalBox 2026-05-21 修正：用「嚴格更靠近 face（< yToFace）」。
    // 舊條件 < ly/2 會把「真的從底/頂面入榫」的薄高件（椅背頂橫木 ly=50、
    // 直料榫眼 z 距面 11~17 < 25）誤判成 X/Z 面入榫 → 紅榫框畫到零件外。
    // yToFace=0（canonical）時嚴格小於不可能成立 → 底/頂面入榫永遠保留 Y。
    if (yIsCanonical && (xToFace < yToFace || zToFace < yToFace)) {
      return xToFace <= zToFace
        ? m.origin.x >= 0
          ? "右端"
          : "左端"
        : m.origin.z >= 0
          ? "前面"
          : "背面";
    }
    if (yToFace <= xToFace && yToFace <= zToFace) {
      return m.origin.y > ly / 2 ? "頂面" : "底面";
    }
    if (xToFace <= zToFace) return m.origin.x >= 0 ? "右端" : "左端";
    return m.origin.z >= 0 ? "前面" : "背面";
  };

  /**
   * Phase 2.5 Task 4：偵測通榫 vs 盲榫。
   * 優先吃 `m.through` flag；fallback 用 depth ≥ 95% × thickness 的 heuristic
   * （木匠視角：榫眼幾乎打穿就視為通榫）。
   */
  const isThroughMortise = (m: Part["mortises"][number]): boolean => {
    if (m.through) return true;
    const t = part.visible?.thickness ?? 0;
    return t > 0 && (m.depth ?? 0) >= t * 0.95;
  };

  const lines: string[] = [];

  part.mortises.forEach((m, idx) => {
    // cosmetic = 槽/孔/凹槽（指槽、底板入溝、無線充電孔、half-lap rabbet 等）
    // 不是真榫眼、不要列成「榫眼1（XX 面）」誤導木匠以為要鑿榫眼
    if (m.cosmetic) return;
    const W = round1(m.width);
    const L = round1(m.length);
    const D = round1(m.depth);
    const lb = mortiseLocalBox(part, m);
    const yFromBottom = round1(lb.cy + ly / 2);
    const face = mortiseFaceHint(m);
    const through = isThroughMortise(m);
    // Phase 2.5 Task 4：通榫 → 「W×L 通」；盲榫 → 「W×L 深 D」
    const dimText = through ? `${W}×${L} 通` : `${W}×${L} 深 ${D}`;
    let line = `榫眼${idx + 1}（${face}）：${dimText}，距底 ${yFromBottom}`;
    if (design) {
      const match = findMatchingFeature(part, idx, "mortise", design);
      if (match) {
        const label = match.kind === "tenon" ? "榫頭" : "榫眼";
        line += `　↔ ${match.partId} ${label}${match.idx + 1}`;
      }
    }
    lines.push(line);
  });

  part.tenons.forEach((t, idx) => {
    const W = round1(t.width);
    const T = round1(t.thickness);
    // Tenon `length` 就是榫頭凸出長度（沒有獨立 depth 欄位）
    const protrusion = round1(t.length);
    const lb = tenonLocalBox(part, t);
    const yFromBottom = round1(lb.cy + ly / 2);
    let line = `榫頭${idx + 1}（${t.position}）：${W}×${T} 長 ${protrusion}，距底 ${yFromBottom}`;
    if (design) {
      const match = findMatchingFeature(part, idx, "tenon", design);
      if (match) {
        const label = match.kind === "mortise" ? "榫眼" : "榫頭";
        line += `　↔ ${match.partId} ${label}${match.idx + 1}`;
      }
    }
    lines.push(line);
  });

  if (!lines.length) return null;
  return (
    <ul className="text-[10px] text-zinc-700 list-none mt-2 space-y-0.5 font-mono tabular-nums">
      {lines.map((l, i) => (
        <li key={i}>{l}</li>
      ))}
    </ul>
  );
}

/**
 * T2 joinery feature dashed bounding boxes (Phase 2 activated).
 *
 * 在每張 OrthoView 內疊一層 SVG `<g>`，於 mortise/tenon 投影位置畫細虛 box：
 *   - mortise: 虛線 `2 2` / `#666` / 0.6 mm（埋進母件，視覺上偏冷）
 *   - tenon:   虛線 `3 1.5` / `#888` / 0.5 mm（凸出部分，視覺上更細）
 * 兩種風格區分明確，木匠看圖時一眼分得出公榫 vs 母榫。
 *
 * 投影方式：把 `mortiseLocalBox` / `tenonLocalBox` 的 8 個角用 ctx.partLocalToSvg
 * 轉成 SVG 座標、取 AABB（part 有 rotation 時也能正確包到整個範圍）。
 *
 * 太小的 feature（< 0.5 mm × 0.5 mm 投影面積）略過避免製造噪點。
 * Phase 3 會再加 leader line + 對應 T2LabelList 編號。
 *
 * Spec: docs/superpowers/specs/2026-05-17-part-drawings-phase-2-design.md §2
 */
export function T2Annotations({
  ctx,
  part,
  view,
}: {
  ctx: OrthoViewBoxCtx;
  part: Part;
  view: PartView;
}) {
  part = normalizePartForDrawing(part);
  const projectBoxCorners = (box: {
    cx: number; cy: number; cz: number;
    hx: number; hy: number; hz: number;
    rotX?: number; rotY?: number; rotZ?: number;
  }): Array<{ x: number; y: number }> => {
    const brx = box.rotX ?? 0, bry = box.rotY ?? 0, brz = box.rotZ ?? 0;
    const bcx = Math.cos(brx), bsx = Math.sin(brx);
    const bcy = Math.cos(bry), bsy = Math.sin(bry);
    const bcz = Math.cos(brz), bsz = Math.sin(brz);
    const out: Array<{ x: number; y: number }> = [];
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) {
          let ox = sx * box.hx, oy = sy * box.hy, oz = sz * box.hz;
          if (brx) { const ny = oy * bcx - oz * bsx, nz = oy * bsx + oz * bcx; oy = ny; oz = nz; }
          if (bry) { const nx = ox * bcy + oz * bsy, nz = -ox * bsy + oz * bcy; ox = nx; oz = nz; }
          if (brz) { const nx = ox * bcz - oy * bsz, ny = ox * bsz + oy * bcz; ox = nx; oy = ny; }
          out.push(ctx.partLocalToSvg(box.cx + ox, box.cy + oy, box.cz + oz));
        }
      }
    }
    return out;
  };
  /**
   * 斜眼（帶 rot 的 mortise）投影：用「剪切」而非「整顆旋轉」。
   * 鑿斜眼的物理：孔口固定貼在 entry face 上（平的）、孔軸往 part 內斜進、
   * 孔底跟著橫移 depth×tanθ。projectBoxCorners 繞 box 中心旋轉會讓孔口下緣
   * 翹成斜線、離開面線（user 2026-06-12「下緣用中間對齊 左邊少一截」）。
   * 做法：每個 corner 先壓平到 entry face、再沿「旋轉後的孔軸方向」走它的
   * 深度距離 → 孔口/孔底兩端面都平行 entry face、側邊呈斜度。
   */
  const projectMortiseShearCorners = (
    box: {
      cx: number; cy: number; cz: number;
      hx: number; hy: number; hz: number;
      rotX?: number; rotY?: number; rotZ?: number;
    },
    depthAxis: "x" | "y" | "z",
    entrySign: 1 | -1,
  ): Array<{ x: number; y: number }> => {
    const brx = box.rotX ?? 0, bry = box.rotY ?? 0, brz = box.rotZ ?? 0;
    const bcx = Math.cos(brx), bsx = Math.sin(brx);
    const bcy = Math.cos(bry), bsy = Math.sin(bry);
    const bcz = Math.cos(brz), bsz = Math.sin(brz);
    // 孔軸方向 = 旋轉後的「指向 part 內部」單位向量
    let ax = 0, ay = 0, az = 0;
    if (depthAxis === "x") ax = -entrySign;
    else if (depthAxis === "y") ay = -entrySign;
    else az = -entrySign;
    if (brx) { const ny = ay * bcx - az * bsx, nz = ay * bsx + az * bcx; ay = ny; az = nz; }
    if (bry) { const nx = ax * bcy + az * bsy, nz = -ax * bsy + az * bcy; ax = nx; az = nz; }
    if (brz) { const nx = ax * bcz - ay * bsz, ny = ax * bsz + ay * bcz; ax = nx; ay = ny; }
    // 正規化成「每走 1mm 深度」的位移（深度軸分量 = -entrySign）
    const dcomp = depthAxis === "x" ? ax : depthAxis === "y" ? ay : az;
    const inv = Math.abs(dcomp) > 0.2 ? 1 / Math.abs(dcomp) : 1;
    const vx = ax * inv, vy = ay * inv, vz = az * inv;
    const hd = depthAxis === "x" ? box.hx : depthAxis === "y" ? box.hy : box.hz;
    const eFace = entrySign * hd; // entry face 在 box 局部座標的深度位置
    const out: Array<{ x: number; y: number }> = [];
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) {
          let ox = sx * box.hx, oy = sy * box.hy, oz = sz * box.hz;
          const od = depthAxis === "x" ? ox : depthAxis === "y" ? oy : oz;
          const t = Math.abs(eFace - od); // 此 corner 距孔口的深度（0 或 2hd）
          // 壓平到 entry face、再沿孔軸走 t
          if (depthAxis === "x") ox = eFace; else if (depthAxis === "y") oy = eFace; else oz = eFace;
          ox += t * vx; oy += t * vy; oz += t * vz;
          out.push(ctx.partLocalToSvg(box.cx + ox, box.cy + oy, box.cz + oz));
        }
      }
    }
    return out;
  };
  const convexHull2D = (pts: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> => {
    const sorted = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
    if (sorted.length <= 1) return sorted;
    const cross = (o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) =>
      (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lower: typeof sorted = [];
    for (const p of sorted) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
      lower.push(p);
    }
    const upper: typeof sorted = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
      const p = sorted[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
      upper.push(p);
    }
    upper.pop(); lower.pop();
    return [...lower, ...upper];
  };
  const projectBoxRect = (box: {
    cx: number; cy: number; cz: number;
    hx: number; hy: number; hz: number;
    rotX?: number; rotY?: number; rotZ?: number;
  }): { x: number; y: number; w: number; h: number } | null => {
    const corners = projectBoxCorners(box);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of corners) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const w = maxX - minX;
    const h = maxY - minY;
    if (w < 0.5 || h < 0.5) return null;
    return { x: minX, y: minY, w, h };
  };

  type Item = {
    kind: "m" | "t";
    idx: number;
    rect: { x: number; y: number; w: number; h: number };
    name: string;
    dims: string;
    /** 自訂槽名（如「底板槽」/「滑蓋槽」）——只有 mortise 帶 label 時才有，畫在 dims 上方。 */
    labelText?: string;
    /** 基準距：對稱件用「距中 X/Z」、其他用「距底 Y」（依當前 view 軸取捨）。 */
    baseline: string;
  };
  const items: Item[] = [];

  /**
   * Mortise entry-aligned box：偵測 entry face、box 從 entry face 往 part 內部
   * 延伸 depth。傳回 part-local CENTERED frame 的 box，方便用 partLocalToSvg。
   * 比 mortiseLocalBox 直觀——榫眼從哪面進、就從哪面開始畫。
   */
  function mortiseEntryBox(m: Mortise): {
    cx: number; cy: number; cz: number;
    hx: number; hy: number; hz: number;
    depthAxis: "x" | "y" | "z";
    rotX: number; rotY: number; rotZ: number;
  } {
    const lx = part.visible.length;
    const ly = part.visible.thickness;
    const lz = part.visible.width;
    const yToFace = Math.min(Math.abs(m.origin.y), Math.abs(m.origin.y - ly));
    const xToFace = Math.min(
      Math.abs(m.origin.x - lx / 2),
      Math.abs(m.origin.x + lx / 2),
    );
    const zToFace = Math.min(
      Math.abs(m.origin.z - lz / 2),
      Math.abs(m.origin.z + lz / 2),
    );
    const yIsCanonical = m.origin.y === 0 || m.origin.y === ly;
    let depthAxis: "x" | "y" | "z";
    // 同步 svg-views mortiseLocalBox 2026-05-21 修正：用「嚴格更靠近 face（< yToFace）」。
    // 舊條件 < ly/2 會把「真的從底/頂面入榫」的薄高件（椅背頂橫木 ly=50、
    // 直料榫眼 z 距面 11~17 < 25）誤判成 X/Z 面入榫 → 紅榫框畫到零件外。
    // yToFace=0（canonical）時嚴格小於不可能成立 → 底/頂面入榫永遠保留 Y。
    if (yIsCanonical && (xToFace < yToFace || zToFace < yToFace)) {
      depthAxis = xToFace <= zToFace ? "x" : "z";
    } else if (yToFace <= xToFace && yToFace <= zToFace) {
      depthAxis = "y";
    } else if (xToFace <= zToFace) {
      depthAxis = "x";
    } else {
      depthAxis = "z";
    }

    const D = m.depth;
    const W = m.width;
    const L = m.length;
    const longDim = Math.max(L, W);
    const shortDim = Math.min(L, W);
    // Auto-fit：把 longDim 放在「origin 較居中、空間較大」的軸（跟 mortiseLocalBox
    // 一致，避免 3-view 跟 part-drawing 同 mortise 軸向反轉）

    const oxC = m.origin.x;
    const oyC = m.origin.y - ly / 2;
    const ozC = m.origin.z;

    if (depthAxis === "y") {
      const enterTop = m.origin.y > ly / 2;
      const entryY = enterTop ? +ly / 2 : -ly / 2;
      const cyL = enterTop ? entryY - D / 2 : entryY + D / 2;
      const xFace = Math.min(Math.abs(oxC - lx / 2), Math.abs(oxC + lx / 2));
      const zFace = Math.min(Math.abs(ozC - lz / 2), Math.abs(ozC + lz / 2));
      // 嵌槽判別（2026-06-13 開放書櫃側板 dado 翻向修，⚠️與 svg-views
      // mortiseLocalBox y 分支同步）：
      // 1) 只有一軸塞得下 longDim → 放那軸（5% 容差：鳩尾插槽 56>壁高 54.75）
      // 2) 都塞得下且某軸填滿率 >0.8（dado 特徵：櫃側板槽 290/300）→ 填滿率高的軸
      // 3) 其他維持「距面較遠的軸」舊邏輯（桌面腿榫眼 40×17 沿 X 已驗對）
      const fitX = longDim <= lx * 1.05;
      const fitZ = longDim <= lz * 1.05;
      // cosmetic 穿透切口（half-lap 十字搭接缺口/指槽等）footprint = length×width 明確，
      // 不該 auto-fit 重猜軸向（否則旋轉件如紅酒架縱向分隔板的搭接缺口會被擺錯軸 → 畫成
      // 「橫躺長孔」）。length 沿 mesh-X、width 沿 mesh-Z，longDim 落 L/W 較長那軸。只認
      // cosmetic（鳩尾盒齒槽等真 mortise 仍走 auto-fit、避免迴歸）。
      const longOnZ = m.cosmetic && m.through && L !== W
        ? W > L
        : fitX !== fitZ
          ? fitZ
          : fitX && (longDim / lz > 0.8 || longDim / lx > 0.8)
            ? longDim / lz >= longDim / lx
            : zFace > xFace;
      return {
        cx: m.origin.x,
        cy: cyL,
        cz: m.origin.z,
        hx: (longOnZ ? shortDim : longDim) / 2,
        hy: D / 2,
        hz: (longOnZ ? longDim : shortDim) / 2,
        depthAxis: "y",
        rotX: m.rotX ?? 0, rotY: m.rotY ?? 0, rotZ: m.rotZ ?? 0,
      };
    } else if (depthAxis === "x") {
      const enterRight = m.origin.x >= 0;
      const cxL = enterRight ? lx / 2 - D / 2 : -lx / 2 + D / 2;
      const yFace = Math.min(Math.abs(oyC - ly / 2), Math.abs(oyC + ly / 2));
      const zFace = Math.min(Math.abs(ozC - lz / 2), Math.abs(ozC + lz / 2));
      // tall part isolation rotation (Rz=-π/2) 場景：橫向接過來的牙板/橫撐 W 軸
      // 走世界 Y 軸（leg 主軸），所以 mortise.length (= 配對 tenon W) 應該落在
      // leg part-local Y 軸；不該被 face-distance heuristic 拋給 Z 軸 cross-section。
      // 非 tall part 維持原 auto-fit（cosmetic mortise / 桌面榫眼需要）。
      const isTallPart = ly > lx && ly > lz;
      const longOnZ = isTallPart ? false : zFace > yFace;
      return {
        cx: cxL,
        cy: oyC,
        cz: m.origin.z,
        hx: D / 2,
        hy: (longOnZ ? shortDim : longDim) / 2,
        hz: (longOnZ ? longDim : shortDim) / 2,
        depthAxis: "x",
        rotX: m.rotX ?? 0, rotY: m.rotY ?? 0, rotZ: m.rotZ ?? 0,
      };
    } else {
      // depthAxis === "z"
      const enterFront = m.origin.z >= 0;
      const czL = enterFront ? lz / 2 - D / 2 : -lz / 2 + D / 2;
      const xFace = Math.min(Math.abs(oxC - lx / 2), Math.abs(oxC + lx / 2));
      const yFace = Math.min(Math.abs(oyC - ly / 2), Math.abs(oyC + ly / 2));
      // tall part：同理 force longDim 落在 Y 軸（leg 主軸 = 配對 tenon W 方向）
      const isTallPart = ly > lx && ly > lz;
      const longOnX = isTallPart ? false : xFace > yFace;
      return {
        cx: m.origin.x,
        cy: oyC,
        cz: czL,
        hx: (longOnX ? longDim : shortDim) / 2,
        hy: (longOnX ? shortDim : longDim) / 2,
        hz: D / 2,
        depthAxis: "z",
        rotX: m.rotX ?? 0, rotY: m.rotY ?? 0, rotZ: m.rotZ ?? 0,
      };
    }
  }

  // 對稱件偵測：座板 / 椅面 / 圓桌面 等寬度方向對稱（mortise 在 X 軸或 Z 軸兩側）
  // 偵測啟發式：mortises 存在 +X 跟 -X 兩側、或 +Z 跟 -Z 兩側 → 對稱件
  const xs = part.mortises.map((m) => m.origin?.x ?? 0);
  const zs = part.mortises.map((m) => m.origin?.z ?? 0);
  const hasPlusX = xs.some((x) => x > 1);
  const hasMinusX = xs.some((x) => x < -1);
  const hasPlusZ = zs.some((z) => z > 1);
  const hasMinusZ = zs.some((z) => z < -1);
  const symmetricX = hasPlusX && hasMinusX;
  const symmetricZ = hasPlusZ && hasMinusZ;
  const isSymmetricPart = symmetricX || symmetricZ;

  /** 依 view + 對稱性給出基準距字串。 */
  const baselineFor = (
    lb: { cx: number; cy: number; cz: number; hy: number },
  ): string => {
    const distFromBot = round1(lb.cy + lb.hy);
    if (!isSymmetricPart) {
      return `距底 ${distFromBot}`;
    }
    // 對稱件用 距中心軸
    if (view === "top") {
      // top view: 看 X×Z, 取 X 跟 Z 距中
      const dx = round1(Math.abs(lb.cx));
      const dz = round1(Math.abs(lb.cz));
      return `距中 X${dx} Z${dz}`;
    } else if (view === "front") {
      // front view: 看 X×Y, X 軸距中 + 距底
      const dx = round1(Math.abs(lb.cx));
      return `距中 X${dx}　距底 ${distFromBot}`;
    } else {
      // side view: 看 Z×Y, Z 軸距中 + 距底
      const dz = round1(Math.abs(lb.cz));
      return `距中 Z${dz}　距底 ${distFromBot}`;
    }
  };

  // 視圖軸 → 對應「面入」mortise 的 depthAxis
  // user:「俯視尺寸圖太亂了」→ 細長腳的 top view 投影 30×30 小方塊把 4 個側面
  // mortise 全擠進去。本視圖 cross-section < 50mm 時只渲染從這視圖軸方向進入
  // 的 mortise（depthAxis === viewDepthAxis），其他面入的 mortise 留給對應視圖
  //
  // tall isolated part（ly > lx && ly > lz）：OrthoView 自動套 Rz=-π/2 把長軸轉橫躺
  // → 原 local Y 軸對到 world -X，原 local X 軸對到 world Y。
  // 所以 top view 看到的是 part-local +X face（不是 +Y face）→ viewDepthAxis 應為 "x"。
  // side view 看到的 X-face mortise（local +X）也匹配 "x"。
  // 對 stool leg X-face 牙板榫眼（depthAxis="x"），這修使 top/bottom/side 都能 render T2 標籤。
  const weForView = worldExtents(part);
  const isTallIso = weForView.yExt > weForView.xExt && weForView.yExt > weForView.zExt;
  const viewDepthAxis: "x" | "y" | "z" = isTallIso
    ? (view === "front" ? "z" : "x")
    : (view === "top" ? "y" : view === "side" ? "x" : "z");
  const crossSectionMm = (() => {
    if (view === "top") return Math.max(part.visible.length, part.visible.width);
    if (view === "side") return Math.max(part.visible.width, part.visible.thickness);
    return Math.max(part.visible.length, part.visible.thickness);
  })();
  const crossOtherMm = (() => {
    if (view === "top") return Math.min(part.visible.length, part.visible.width);
    if (view === "side") return Math.min(part.visible.width, part.visible.thickness);
    return Math.min(part.visible.length, part.visible.thickness);
  })();
  const isCrossViewTooSmall = crossSectionMm < 60 && crossOtherMm < 60;
  part.mortises.forEach((m, idx) => {
    const lb = mortiseEntryBox(m);
    // 早期 crossSection<60 過濾被移除(user 2026-05-27:「仰視圖少了兩個榫孔」)
    // → 細長腳 top/bottom 視圖之前只渲染本視軸 mortise、隱掉其他面的、結果
    // 仰視缺斜孔(對應前視 4 個榫的另 2 個 Z 面)。改成全 render、不可見的走
    // 虛線 hidden 慣例(下面 isVisibleFromView 判斷)。原 isCrossViewTooSmall
    // 變數還留下面其他地方用。
    //
    // dim chain 抓未旋轉 AABB(user 2026-05-27「轉向之後標線是不是要重抓」):
    // splay 件 mortise 帶 rotX/rotZ,projectBoxRect 對旋轉 box 算 AABB,dim chain
    // 邊跟著 AABB 走 → 鋸口位置不對應原料挖孔面。strip rotation 後 AABB 就是
    // 「未傾斜原料挖孔位置」、木匠量度的邊。
    const lbForDim = { ...lb, rotX: 0, rotY: 0, rotZ: 0 };
    const r = projectBoxRect(lbForDim);
    if (!r) return;
    const W = round1(m.width ?? 0);
    const L = round1(m.length ?? 0);
    const D = round1(m.depth ?? 0);
    // 圓孔（mortise.shape === "round"）用 Ø 標、不寫 W×L。
    // 貫穿孔（through，如托盤手把孔）標「穿」不標深——標「深8」會被當盲孔
    // 鑽 8mm 就停（user 2026-06-11 托盤手把孔回報）
    const isRound = m.shape === "round";
    const depthLabel = m.through ? "穿" : `深${D}`;
    const dims = isRound ? `Ø${W} ${depthLabel}` : `${W}×${L} ${depthLabel}`;
    // cosmetic mortise = 凹槽（指槽/底板入溝/rabbet），不是真榫眼、label 用「凹槽」
    // 有指定 m.label（如「底板槽」/「滑蓋槽」）優先用，避免多條 cosmetic 槽看不出誰是誰。
    const nameLabel = m.label ?? (m.cosmetic ? `凹槽${idx + 1}` : `榫眼${idx + 1}`);
    items.push({
      kind: "m",
      idx,
      rect: r,
      name: nameLabel,
      // 只有明確給了 m.label（如「底板槽」/「滑蓋槽」）才畫名稱，避免每個榫眼都標字干擾
      labelText: m.label,
      dims,
      baseline: baselineFor(lb),
    });
  });

  // 圓料 part 上的 tenon 視為圓榫（user:「這榫不是圓的嗎？」）
  const isRoundPart =
    part.shape?.kind === "round" ||
    part.shape?.kind === "round-tapered" ||
    part.shape?.kind === "splayed-round-tapered" ||
    part.shape?.kind === "lathe-turned" ||
    part.shape?.kind === "shaker";
  part.tenons.forEach((t, idx) => {
    if (t.length <= 0) return;
    const lb = tenonLocalBox(part, t);
    const r = projectBoxRect(lb);
    if (!r) return;
    const W = round1(t.width ?? 0);
    const T = round1(t.thickness ?? 0);
    const L = round1(t.length ?? 0);
    const tenonDims = isRoundPart
      ? `Ø${W} 長${L}`
      : `${W}×${T} 長${L}`;
    items.push({
      kind: "t",
      idx,
      rect: r,
      name: `榫頭${idx + 1}`,
      dims: tenonDims,
      baseline: baselineFor(lb),
    });
  });

  // 投影去重：例如 apron 兩端 tenon 在 side view 都投到同一塊 rect，
  // 兩個榫頭的 chain dim 會疊出「43|42」「43|42」兩條一模一樣的尺寸
  // （user 2026-05-21 回報）。同 kind + 同 projected rect + 同 dims 視為
  // 同一張視覺特徵，保留第一個就好。
  //
  // mortise dedupe key 加 part-local origin + depthAxis：splay 腳 Z 面 vs X 面
  // mortise 在 bottom view 都投影到同 AABB,但 part-local origin/depthAxis 不同,
  // 不該 dedup(user 2026-05-27:仰視缺斜孔)。
  {
    const seen = new Set<string>();
    const unique: Item[] = [];
    for (const it of items) {
      let mortiseTag = "";
      if (it.kind === "m") {
        const m = part.mortises[it.idx];
        const lb = mortiseEntryBox(m);
        // dedupe：只用 depthAxis（入榫面）當 mortise 區分，不含 part-local origin。
        // 沿視線方向排成一列的同款 mortise（櫃側板 5 條 dado 差在高度、中式櫃柱
        // 10 個榫眼差在高度——都沿視線軸 collapse 到同一投影 rect）會 key 全等 →
        // 只畫一個，尺寸不再疊成一團（user 2026-06-14「擠在一起/同水平」）。
        // key 已含投影後的 it.rect+it.dims：投影到不同處者 rect 不同自然保留；
        // splay 腳 Z 面 vs X 面投影到同 rect 但 depthAxis 不同 → 仍保留（仰視不缺孔）。
        mortiseTag = `|${lb.depthAxis}`;
      }
      const key = `${it.kind}|${Math.round(it.rect.x)}|${Math.round(it.rect.y)}|${Math.round(it.rect.w)}|${Math.round(it.rect.h)}|${it.dims}${mortiseTag}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(it);
    }
    items.length = 0;
    items.push(...unique);
  }

  if (!items.length) return null;

  // splay 件 silhouette top（含 dx/dz 變形）— W dim chain `wDimY = box.y - wGap`
  // 在 splayed/splayed-tapered/splayed-round-tapered 件上會跑進 silhouette 內、
  // 被翹起的 splay 端蓋住（user 2026-05-27 回報「415 往上移不要蓋著圖」）。
  // 算 4 個「shape-deformed 底面 corners」svg y 最小值、wDim above-case 把
  // wDimY clamp 在它上面避免蓋圖。注意：這個 clamp **只**動 wDimY 位置、不
  // 影響 box / dim 值衍生。
  let splaySilTopY = Infinity;
  const splayShapeForSil =
    part.shape?.kind === "splayed" ||
    part.shape?.kind === "splayed-tapered" ||
    part.shape?.kind === "splayed-round-tapered"
      ? part.shape
      : null;
  if (
    splayShapeForSil &&
    (Math.abs(splayShapeForSil.dxMm) > 0.01 ||
      Math.abs(splayShapeForSil.dzMm) > 0.01)
  ) {
    const L = part.visible.length;
    const T = part.visible.thickness;
    const W = part.visible.width;
    const samples = [
      ctx.partLocalToSvg(-L / 2 + splayShapeForSil.dxMm, +T / 2, -W / 2 + splayShapeForSil.dzMm),
      ctx.partLocalToSvg(+L / 2 + splayShapeForSil.dxMm, +T / 2, -W / 2 + splayShapeForSil.dzMm),
      ctx.partLocalToSvg(-L / 2 + splayShapeForSil.dxMm, +T / 2, +W / 2 + splayShapeForSil.dzMm),
      ctx.partLocalToSvg(+L / 2 + splayShapeForSil.dxMm, +T / 2, +W / 2 + splayShapeForSil.dzMm),
    ];
    splaySilTopY = Math.min(...samples.map((p) => p.y));
  }
  const SIL_TOP_SAFETY = 4; // svg px

  // 工程圖風格：每個 feature 畫 dashed box + 名稱/尺寸 label + 真實 dim line（黃俊傑式）
  // - DimensionLine: extension line + dim line + filled triangle arrows + label
  // - 對稱件用「距中軸」、非對稱件用「距底/距邊」
  // - 簡單 arrow: 在 line 端 draw small filled triangle
  const drawArrow = (
    cx: number,
    cy: number,
    dir: "left" | "right" | "up" | "down",
    color: string,
    key: string,
  ) => {
    const SZ = 2.5;
    let pts: string;
    if (dir === "left") pts = `${cx},${cy} ${cx + SZ},${cy - SZ} ${cx + SZ},${cy + SZ}`;
    else if (dir === "right") pts = `${cx},${cy} ${cx - SZ},${cy - SZ} ${cx - SZ},${cy + SZ}`;
    else if (dir === "up") pts = `${cx},${cy} ${cx - SZ},${cy + SZ} ${cx + SZ},${cy + SZ}`;
    else pts = `${cx},${cy} ${cx - SZ},${cy - SZ} ${cx + SZ},${cy - SZ}`;
    return <polygon key={key} points={pts} fill={color} />;
  };

  const hDim = (
    x1: number,
    x2: number,
    y: number,
    label: string,
    color: string,
    key: string,
  ) => {
    const lo = Math.min(x1, x2);
    const hi = Math.max(x1, x2);
    return (
      <g key={key}>
        <line x1={lo} y1={y} x2={hi} y2={y} stroke={color} strokeWidth={0.5} />
        {drawArrow(lo, y, "left", color, `${key}-aL`)}
        {drawArrow(hi, y, "right", color, `${key}-aR`)}
        <text
          x={(lo + hi) / 2}
          y={y - 2}
          fontSize={8}
          fill={color}
          textAnchor="middle"
        >
          {label}
        </text>
      </g>
    );
  };

  const vDim = (
    y1: number,
    y2: number,
    x: number,
    label: string,
    color: string,
    key: string,
  ) => {
    const lo = Math.min(y1, y2);
    const hi = Math.max(y1, y2);
    return (
      <g key={key}>
        <line x1={x} y1={lo} x2={x} y2={hi} stroke={color} strokeWidth={0.5} />
        {drawArrow(x, lo, "up", color, `${key}-aU`)}
        {drawArrow(x, hi, "down", color, `${key}-aD`)}
        <text
          x={x - 2}
          y={(lo + hi) / 2 + 3}
          fontSize={8}
          fill={color}
          textAnchor="end"
        >
          {label}
        </text>
      </g>
    );
  };

  // Part 中心軸在 SVG 的位置（用 partLocalToSvg(0, T/2, 0)）
  const centerLocalY = part.visible.thickness / 2;
  const partCenterSvg = ctx.partLocalToSvg(0, centerLocalY, 0);

  // ─────────────────────────────────────────────────────────────
  // 重疊避撞 pre-pass：偵測哪些 items 共用同一條 W chain dim row
  // （wDimY 接近 + chain x-span 重疊）→ 第 2+ 個 stagger 下推一行
  // 同理偵測共用同一條 L chain dim column（lDimX 接近 + chain y-span 重疊）→
  // stagger label 往外推一格
  //
  // 為什麼要做：對稱 mortise（左右兩個）box.y 一樣 → wDimY 一樣 → shoulderLft/
  // shoulderRgt 標籤跟 W dim label 全擠在同一條水平線上，標籤撞字（user:
  // 「nightstand 底板 438 438 / 415 415 / 202.5 202.5 一堆數字撞同位置」）
  //
  // 上方已存在的 lSiblings 偵測只處理 L 軸 chain（vertical），這裡補 W 軸。
  // ─────────────────────────────────────────────────────────────

  type DimRowMeta = {
    wDimY: number;
    wDimBelow: boolean;
    lDimX: number;
    wStagger: number; // 0=base, 1+ = 往下推 STAGGER_GAP * wStagger
    lStagger: number; // 0=base, 1+ = 往外推 STAGGER_GAP * lStagger
  };

  const STAGGER_GAP = 14; // SVG px；同 row sibling 互推距離
  const ROW_TOL = 6; // wDimY 容差，判同 row
  const X_OVERLAP_TOL = 4; // x 範圍重疊閾值

  // 第一步：先算每個 item 的 baseline wDimY / lDimX（不含 stagger）
  // 為求準確，這裡複製 forEach 內部 wDimY/lDimX 邏輯（partLeftSvg / partRightSvg
  // 也要算到，因為 lDimX 用得到）
  const baselineMetas: DimRowMeta[] = items.map((it) => {
    const box = it.rect;
    // 重新算 partLeftSvg/partRightSvg 跟 forEach 內邏輯一致
    const T = part.visible.thickness;
    const W = part.visible.width;
    const L = part.visible.length;
    const cornersXForDim: number[] = [];
    if (view === "front") {
      cornersXForDim.push(
        ctx.partLocalToSvg(-L / 2, -T / 2, 0).x,
        ctx.partLocalToSvg(+L / 2, +T / 2, 0).x,
      );
    } else if (view === "top") {
      // 同 forEach 內 8 corners(tall iso rotation Rz=-π/2 把 part-local Y → world X
      // → 只取 +T/2 corner 會 collapse)
      for (const sx of [-1, 1]) {
        for (const sy of [-1, 1]) {
          for (const sz of [-1, 1]) {
            cornersXForDim.push(ctx.partLocalToSvg((sx * L) / 2, (sy * T) / 2, (sz * W) / 2).x);
          }
        }
      }
    } else {
      cornersXForDim.push(
        ctx.partLocalToSvg(0, -T / 2, -W / 2).x,
        ctx.partLocalToSvg(0, +T / 2, +W / 2).x,
      );
    }
    const partLeftSvg = Math.min(...cornersXForDim);
    const partRightSvg = Math.max(...cornersXForDim);
    const outerAbove = box.y < partCenterSvg.y;
    const GAP = 12;
    const otherOuterLeft = box.x < partCenterSvg.x;
    const lDimXBase = otherOuterLeft
      ? Math.min(box.x, partLeftSvg) - GAP
      : Math.max(box.x + box.w, partRightSvg) + GAP;
    // wDimBelow：上方有任何 L sibling 時走 below；簡化判斷只用 outerAbove
    // (上面真實邏輯也檢查 prevLSibling，會更積極選 below；這裡 baseline 用簡化版
    //  夠精確分辨同 row、後面 stagger 再調整)
    const wDimBelow = !outerAbove;
    const wGap = GAP;
    // splay 件不再 clamp 到 silhouette top 之上（user 2026-05-27：dim chain 錨
    // 未傾斜原料、虛線傾斜端穿過 dim 區可接受）
    const wDimY = wDimBelow ? box.y + box.h + wGap : box.y - wGap;
    return { wDimY, wDimBelow, lDimX: lDimXBase, wStagger: 0, lStagger: 0 };
  });

  // 第二步：對每個 item 找「同 row 且實際 label 區域會撞」更早的 item
  // 偵測規則：
  //   wDimY 相近 (< ROW_TOL) 且兩個 box 「在水平上靠近」（mid-x 距離 < 一個
  //   shoulder 段的寬度 ~80svg）→ shoulderRgt(prev) / shoulderLft(curr) 會撞中間
  //   → 第 2+ 個 item 往下推一行
  //
  // 為什麼不直接每個同 row item 都 stagger：對稱件 mortise A/B 都在同 row、
  // 中間 shoulder 段重疊 → 撞；但如果 box A 跟 box B 距離超遠（>200svg），
  // shoulder 段不會撞，不該 stagger。避免之前 4f518b0「整 chain 重排」的問題。
  const SHOULDER_PROX_SVG = 80; // 兩 box 距離 < 80svg 視為 shoulder 段會撞
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const box = it.rect;
    const meta = baselineMetas[i];
    let wRowCount = 0;
    let lColCount = 0;
    const myMidX = box.x + box.w / 2;
    const myMidY = box.y + box.h / 2;
    for (let j = 0; j < i; j++) {
      const other = items[j];
      const otherBox = other.rect;
      const otherMeta = baselineMetas[j];
      // 同 W row 偵測：wDimY 接近 + box 中心 x 距離 < SHOULDER_PROX → 撞
      // 不論 box 是否 x-overlap、中間 shoulder 段都會塞同一條水平線
      if (Math.abs(meta.wDimY - otherMeta.wDimY) < ROW_TOL) {
        const otherMidX = otherBox.x + otherBox.w / 2;
        // box 直接 x-overlap、或中心 x 太近 → 撞
        const overlapsX =
          box.x - X_OVERLAP_TOL <= otherBox.x + otherBox.w &&
          box.x + box.w + X_OVERLAP_TOL >= otherBox.x;
        const closeX = Math.abs(myMidX - otherMidX) < SHOULDER_PROX_SVG * 4;
        // 對稱件（兩 mortise 鏡像）：myMid / otherMid 通常 200~300svg 遠、但中間
        // shoulder 段都集中在 part 中央區（mid_partX 附近），仍會撞 → closeX 用
        // 4x 寬鬆 threshold 抓得到
        if (overlapsX || closeX) {
          wRowCount++;
        }
      }
      // 同 L col 偵測：lDimX 接近 + box 中心 y 距離 < SHOULDER_PROX → 撞
      if (Math.abs(meta.lDimX - otherMeta.lDimX) < ROW_TOL) {
        const otherMidY = otherBox.y + otherBox.h / 2;
        const overlapsY =
          box.y - X_OVERLAP_TOL <= otherBox.y + otherBox.h &&
          box.y + box.h + X_OVERLAP_TOL >= otherBox.y;
        const closeY = Math.abs(myMidY - otherMidY) < SHOULDER_PROX_SVG * 4;
        // y 重疊已由 prevLSibling 路徑（chain shoulder + leader）處理，這裡
        // 只對「box 在同 col 但 y 不 overlap、label 中央仍撞」的 case 動
        if (!overlapsY && closeY) {
          lColCount++;
        }
      }
    }
    meta.wStagger = wRowCount;
    meta.lStagger = lColCount;
  }

  const elements: React.ReactNode[] = [];
  // dedupe shoulder label keys (`${lDimX}|${value}` for shoulderTop/Bot, `${wDimY}|${value}` for shoulderLft/Rgt)
  // 同 column 同值的 shoulder 只畫第一個,避免雙面 mortise(splay 腳 Z 面+X 面)的
  // 12.5 等 label 重複(user 2026-05-27:「先刪除一個 12.5」)
  const renderedShoulderKeys = new Set<string>();
  // 正視（annView=top）腿件 shoulderLft/Rgt label 撞行避撞：
  // splay 腿同側 outer mortise (solid box) + 旋轉 mortise (dashed box) 兩個 shoulder
  // dim label 會落在同一條 wDimY → 視覺上「279³⁰¹」「128¹⁰⁶」疊字。
  // 收到第 N 個落在同 Y(±4px tol) 同側 (L/R) 的 label,往下推 STAGGER_GAP * N。
  // (user 2026-05-28「正視圖底下 301 279 跟 128 106 太近了 把 279 128 往下移」)
  const shoulderHYUsed: { L: number[]; R: number[] } = { L: [], R: [] };
  const SHOULDER_Y_TOL = 4;
  // 「距中 X」藍色 dim 階梯：多個 mortise 的距中尺寸全落在同一條 xDimY → 線
  // 互疊看不出哪條標哪個孔（user 2026-06-14「藍色尺寸都在同水平/看不出標哪」）。
  // 每收到第 N 個落在同 Y(±4) 同側的距中 dim 就往外推 STAGGER_GAP*N、排成階梯。
  const xDistYUsed: { L: number[]; R: number[] } = { L: [], R: [] };
  // 圓榫「Ø 深X」label 同位防撞：軸向視圖兩端圓榫同心（端面投影重疊）、
  // leader 落同一點 → 兩行字疊在一起（user 2026-06-11 邊柱側視卡回報）。
  const roundLabelSlots: Array<{ x: number; y: number }> = [];
  items.forEach((it, itemIdx) => {
    const box = it.rect;
    const isMortise = it.kind === "m";
    // cosmetic mortise（指槽 / 底板入溝 / half-lap rabbet 等凹槽）用橘色、
    // 跟 svg-views 主視圖 c97a2b 同步、不要跟真榫眼/真榫頭混色。
    const isCosmetic = isMortise && (part.mortises[it.idx] as Mortise).cosmetic;
    const stroke = isCosmetic
      ? "#c97a2b"
      : isMortise
        ? "#dc2626"
        : "#2563eb";
    const fill = isCosmetic
      ? "rgba(201, 122, 43, 0.10)"
      : isMortise
        ? "rgba(220, 38, 38, 0.12)"
        : "rgba(37, 99, 235, 0.10)";

    // 取得對應 feature 的 local box（重新計算用 cx/cz）
    // mortise 用 mortiseEntryBox（從 entry face 量起、跟 visual 對齊）；
    // tenon 用 tenonLocalBox
    const feature = isMortise
      ? part.mortises[it.idx]
      : part.tenons[it.idx];
    const lb = isMortise
      ? mortiseEntryBox(feature as Mortise)
      : tenonLocalBox(part, feature as Tenon);

    // HLE: tenon 是凸出實體、任何視圖都實線。mortise 是內藏腔體、只有入榫面
    // 朝鏡頭（深度軸跟視圖軸一致 + origin 在 + face）才實線、否則虛線。
    // (user:「上面的牙條榫應該是紅色實線」/「藍色榫頭線也應該是藍色實線」)
    // 用 viewDepthAxis(line 939)而非 view-only mapping:tall iso 件 bottom view
    // 看 X 面(同 top view、Rz=-π/2 isolation rotation)、不是預設 "z"。
    // user 2026-05-27 回報:「仰視圖這兩個榫是看得到的榫 要實心紅線」。
    let isVisibleFromView = false;
    if (isMortise) {
      const mortiseLb = lb as ReturnType<typeof mortiseEntryBox>;
      isVisibleFromView = mortiseLb.depthAxis === viewDepthAxis;
    } else {
      isVisibleFromView = true; // tenon 永遠實線
    }
    // 隱藏榫眼用較粗虛線（user 2026-05-27 回報：原本 "3 2" 太細在俯視幾乎看不到）。
    // tenon 維持 "4 2"（凸出實體本來就少用 hidden）
    const dash = isVisibleFromView ? undefined : (isMortise ? "6 3" : "4 2");

    // 側視 frame 對腿件完全不顯示 mortise（紅色榫孔），只留 tenon（藍色榫頭）。
    // 整顆 mortise（box outline + cosmetic 填色 + inline-dims + tics + shoulder）一次跳。
    // 必須早 return，因為 box outline push 在 1454、isLegPart 計算在 1569。
    // (user 2026-05-28「只留藍色的」= 側視只看 tenon)
    const _isSplayLegPartEarly =
      part.shape?.kind === "splayed" ||
      part.shape?.kind === "splayed-tapered" ||
      part.shape?.kind === "splayed-round-tapered";
    const _isLegPartEarly =
      part.id?.startsWith("leg-") || part.id === "leg" || _isSplayLegPartEarly;
    if (view === "side" && _isLegPartEarly && isMortise) {
      return;
    }

    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;

    // 尺寸 label 放在 part body 下方（不塞進材料裡）+ 短 leader 從 box 拉到 label
    // 計算 part body 在 SVG 的最低點（下緣）+ 8px gap
    const T = part.visible.thickness;
    const W = part.visible.width;
    const L = part.visible.length;
    const cornersY: number[] = [];
    if (view === "front") {
      cornersY.push(
        ctx.partLocalToSvg(-L / 2, -T / 2, 0).y,
        ctx.partLocalToSvg(+L / 2, -T / 2, 0).y,
        ctx.partLocalToSvg(-L / 2, +T / 2, 0).y,
        ctx.partLocalToSvg(+L / 2, +T / 2, 0).y,
      );
    } else if (view === "top") {
      // 同 cornersXForDim 8 corners(tall iso rotation 把 part-local Y → world X、
      // 同時 splay rotation 讓 ±T/2 兩端在 world Z 上偏移,silhouette 上下緣靠 8 個
      // 完整 corner 才抓得到)
      for (const sx of [-1, 1]) {
        for (const sy of [-1, 1]) {
          for (const sz of [-1, 1]) {
            cornersY.push(ctx.partLocalToSvg((sx * L) / 2, (sy * T) / 2, (sz * W) / 2).y);
          }
        }
      }
    } else {
      cornersY.push(
        ctx.partLocalToSvg(0, -T / 2, -W / 2).y,
        ctx.partLocalToSvg(0, +T / 2, -W / 2).y,
        ctx.partLocalToSvg(0, -T / 2, +W / 2).y,
        ctx.partLocalToSvg(0, +T / 2, +W / 2).y,
      );
    }
    const partBottomY = Math.max(...cornersY);
    // label 水平 X 對齊 box 中心、垂直在 part body 下方 + 10
    const lblX = box.x + box.w / 2;
    const lblY = partBottomY + 16;

    // 圓榫眼：只有看圓柱軸線方向才是圓、垂直方向看是矩形（圓柱側影）
    // 推 mortise 的 depth axis（從 origin 距哪面最近）+ 比對當前 view 的視軸：
    //   top view 看 -Y → view axis = "y"
    //   front view 看 -Z → view axis = "z"
    //   side view 看 X → view axis = "x"
    const mortiseShapeIsRound =
      isMortise &&
      (part.mortises[it.idx] as Mortise).shape === "round";
    // rect 榫眼（牙條/橫撐等鑿出的方口袋）一律畫方形矩形，即使開在圓料（圓腳/圓座板）
    // 上——圓料上唯一畫橢圓的是真正的「圓孔」(mortise.shape==="round"，接圓榫)。
    // (user 2026-06-15「橫撐跟牙條還是方孔才對」。先前 isRoundPartForMortise 把圓料上
    //  所有 rect 榫眼一律橢圓是錯的，已移除；圓料 tenon 是否圓由下方 tenonIsRound 另判。)
    let mortiseIsRound = false;
    if (isMortise && mortiseShapeIsRound) {
      const m = part.mortises[it.idx] as Mortise;
      const ly = part.visible.thickness;
      const yToFace = Math.min(Math.abs(m.origin.y), Math.abs(m.origin.y - ly));
      const xToFace = Math.min(
        Math.abs(m.origin.x - part.visible.length / 2),
        Math.abs(m.origin.x + part.visible.length / 2),
      );
      const zToFace = Math.min(
        Math.abs(m.origin.z - part.visible.width / 2),
        Math.abs(m.origin.z + part.visible.width / 2),
      );
      const yIsCanonical = m.origin.y === 0 || m.origin.y === ly;
      let depthAxis: "x" | "y" | "z";
      // 同步 svg-views mortiseLocalBox 2026-05-21 修正：用「嚴格更靠近 face（< yToFace）」。
    // 舊條件 < ly/2 會把「真的從底/頂面入榫」的薄高件（椅背頂橫木 ly=50、
    // 直料榫眼 z 距面 11~17 < 25）誤判成 X/Z 面入榫 → 紅榫框畫到零件外。
    // yToFace=0（canonical）時嚴格小於不可能成立 → 底/頂面入榫永遠保留 Y。
    if (yIsCanonical && (xToFace < yToFace || zToFace < yToFace)) {
        depthAxis = xToFace <= zToFace ? "x" : "z";
      } else if (yToFace <= xToFace && yToFace <= zToFace) {
        depthAxis = "y";
      } else if (xToFace <= zToFace) {
        depthAxis = "x";
      } else {
        depthAxis = "z";
      }
      // 圓榫眼：只有看圓柱軸線方向才是圓、垂直方向看是矩形（圓柱側影）
      const viewAxis: "x" | "y" | "z" =
        view === "top" ? "y" : view === "side" ? "x" : "z";
      mortiseIsRound = depthAxis === viewAxis;
    }
    // 圓料 part 上的 tenon 也是圓的（user:「這榫不是圓的嗎？」）。檢查 part shape
    // 是否屬於 round 家族 + tenon 從哪個軸凸出（position） vs 當前 view axis：
    //   軸向一致 → 看圓圈、畫 ellipse；否則畫矩形（圓柱側影）
    let tenonIsRound = false;
    if (!isMortise) {
      const t = part.tenons[it.idx] as Tenon;
      const isRoundPart =
        part.shape?.kind === "round" ||
        part.shape?.kind === "round-tapered" ||
        part.shape?.kind === "splayed-round-tapered" ||
        part.shape?.kind === "lathe-turned" ||
        part.shape?.kind === "shaker";
      if (isRoundPart) {
        let tenonAxis: "x" | "y" | "z" =
          t.position === "top" || t.position === "bottom"
            ? "y"
            : t.position === "start" || t.position === "end"
              ? "x"
              : "z";
        // tall isolated part（Windsor 邊柱等）：OrthoView isolation rotation
        // Rz=-π/2 把 part-local Y 轉到 world X → top/bottom 圓榫的「軸向視圖」
        // 從俯視變側視。不補償會圓方對調：側視（端面視）畫成方框疊在端面圓上、
        // 正視（側影）反而畫橢圓（user 2026-06-11 邊柱卡回報）。跟 mortise 的
        // viewDepthAxis isTallIso 補償同款。
        if (isTallIso) {
          tenonAxis = tenonAxis === "y" ? "x" : tenonAxis === "x" ? "y" : tenonAxis;
        }
        const viewAxis: "x" | "y" | "z" =
          view === "top" ? "y" : view === "side" ? "x" : "z";
        tenonIsRound = tenonAxis === viewAxis;
      }
    }
    const isRoundFeature = mortiseIsRound || tenonIsRound;

    // 單斜梯形牙板（apron-trapezoid）length 端榫頭：body 端面是斜的（接座窄、
    // 接地寬），但榫頭框走 axis-aligned rect → 內側竪邊沒貼斜端面、被 body 斜
    // 出去的角蓋住（user 2026-06-01）。改畫平行四邊形，內側兩頂點貼 body 斜邊。
    // 只處理：梯形 apron + start/end 榫頭 + 非圓 + 矩形分支(無 box rotation)。
    const trapShape =
      !isMortise && part.shape?.kind === "apron-trapezoid"
        ? part.shape
        : null;
    const tenonForTrap = !isMortise ? (part.tenons[it.idx] as Tenon) : null;
    const isTrapEndTenon =
      !!trapShape &&
      !isRoundFeature &&
      !!tenonForTrap &&
      (tenonForTrap.position === "start" || tenonForTrap.position === "end") &&
      !((lb as any).rotX || (lb as any).rotY || (lb as any).rotZ);
    const trapTenonPolyPoints = ((): string | null => {
      if (!isTrapEndTenon || !trapShape) return null;
      const Lp = part.visible.length;
      const Wp = part.visible.width;
      const Tp = part.visible.thickness;
      // ⚠️ part 可能已 mirrorYPart 翻過(零件圖正視)，左右/上下/W 面對應都會翻，
      // 不能直推。實證對照(annView=top + mirror)：+W/2 面投影到接座(窄)、
      // -W/2 面投影到接地(寬)。body 用 doc §A10.4 真實比例(接座 L/2×topScale、
      // 接地 L/2×bottomScale，2026-06-01 統一基準)，這裡 seat/ground 同步。
      // 用 partLocalToSvg(跟榫頭框 box 同系、自洽)投影兩端，再挑跟榫頭框同側
      // (x 同號)的那條 length 端斜邊。
      const tenonOnPlusX = box.x + box.w / 2 >= 0;
      const edges = [1, -1].map((s) => ({
        seat: ctx.partLocalToSvg((s * Lp) / 2 * trapShape.topLengthScale, Tp / 2, +Wp / 2),
        ground: ctx.partLocalToSvg((s * Lp) / 2 * trapShape.bottomLengthScale, Tp / 2, -Wp / 2),
      }));
      const edge =
        edges.find((e) => e.seat.x >= 0 === tenonOnPlusX) ?? edges[0];
      const { seat, ground } = edge;
      // 內側 = box 靠中心那條竪邊、外側 = 凸出尖端
      const innerX = tenonOnPlusX ? box.x : box.x + box.w;
      const outerX = tenonOnPlusX ? box.x + box.w : box.x;
      const yTop = box.y;
      const yBot = box.y + box.h;
      // body 斜邊參數式 seat + t*(ground-seat)，解給定 svg y 的 x
      const dy = ground.y - seat.y;
      const xAtY = (yv: number): number => {
        if (Math.abs(dy) < 0.01) return innerX;
        const t = (yv - seat.y) / dy;
        return seat.x + t * (ground.x - seat.x);
      };
      const inTop = xAtY(yTop);
      const inBot = xAtY(yBot);
      // user 2026-06-02：不管 body 斜邊在榫頭內外，全部 tenon 內側肩都要
      // 跟著斜（不只「補縫」的場景）。上半 stagger 榫的內側肩跟下半同條 body
      // 斜邊，這樣兩個榫看起來都跟 body 接合面對齊。
      // 防退化：如果 body 在此 Y 段內 X 完全不變（直料），仍 fallback 到 rect。
      const tilt = Math.abs(inTop - inBot);
      if (tilt < 0.3) return null;
      // 4 頂點：外側上 → 外側下 → 內側下(貼斜) → 內側上(貼斜)
      return [
        `${outerX.toFixed(2)},${yTop.toFixed(2)}`,
        `${outerX.toFixed(2)},${yBot.toFixed(2)}`,
        `${inBot.toFixed(2)},${yBot.toFixed(2)}`,
        `${inTop.toFixed(2)},${yTop.toFixed(2)}`,
      ].join(" ");
    })();

    const partEls: React.ReactNode[] = [
      isRoundFeature ? (
        <g key={`${it.kind}-${it.idx}-box`}>
          <ellipse
            cx={box.x + box.w / 2}
            cy={box.y + box.h / 2}
            rx={box.w / 2}
            ry={box.h / 2}
            fill={fill}
            stroke={stroke}
            strokeWidth={1.2}
            strokeDasharray={dash}
          />
          {/* 工程慣例：圓孔中心 long-dash-dot 十字線、延伸圓外 25% */}
          <line
            x1={box.x - box.w * 0.25}
            x2={box.x + box.w * 1.25}
            y1={box.y + box.h / 2}
            y2={box.y + box.h / 2}
            stroke={stroke}
            strokeWidth={0.4}
            strokeDasharray="4 1.5 0.5 1.5"
          />
          <line
            x1={box.x + box.w / 2}
            x2={box.x + box.w / 2}
            y1={box.y - box.h * 0.25}
            y2={box.y + box.h * 1.25}
            stroke={stroke}
            strokeWidth={0.4}
            strokeDasharray="4 1.5 0.5 1.5"
          />
        </g>
      ) : ((lb as any).rotX || (lb as any).rotY || (lb as any).rotZ) ? (
        <polygon
          key={`${it.kind}-${it.idx}-box`}
          points={(() => {
            const mm = isMortise ? (part.mortises[it.idx] as Mortise) : null;
            // 非貫穿傾斜 cosmetic 槽（百葉門 25° 斜槽）：斜度只在「看得到傾斜的視圖」
            // 顯示＝俯視（annView="front"，視線沿葉片長軸、看到截面整顆轉 25°）。
            // 正視（annView="top"，斜度沿視線進頁面）＝軸對齊方框不斜；側視同理畫方框。
            // user 回報「正視圖榫應該是方框沒斜、側視是高的方框」。
            if (mm && mm.cosmetic && !mm.through && (mm.rotX || mm.rotZ)) {
              if (view !== "front") {
                // 正視（annView=top，斜度沿視線進頁面）＝方框不斜；側視（annView=side，
                // 視線沿門高）＝傾斜葉片截面投影成「高的方框」。兩者都用 box 的自然
                // 投影（projectBoxCorners 含 rotX）：正視幾乎不受斜度影響仍方框、側視
                // 斜葉片面投影拉高成高框（user 回報「正視方框不斜、側視高的方框」）。
                return convexHull2D(projectBoxCorners(lb as any))
                  .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
                  .join(" ");
              }
              // 俯視（annView=front，視線沿葉片長軸）：截面整顆繞中心 2D 旋轉 rotX，
              // 且「槽頭做圓」＝跑道形(stadium)配合圓邊(bullnose)葉片：長軸兩端各半圓
              // (半徑=短邊/2=葉片圓邊半徑)，非方角(user 回報槽頭也要圓)。
              const ang = -(mm.rotX || mm.rotZ || 0);
              const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
              const ca = Math.cos(ang), sa = Math.sin(ang);
              const longHoriz = box.w >= box.h;
              const halfLong = (longHoriz ? box.w : box.h) / 2;
              const r = (longHoriz ? box.h : box.w) / 2;
              const straight = Math.max(0, halfLong - r);
              const N = 8;
              const local: Array<[number, number]> = [];
              for (let i = 0; i <= N; i++) {
                const t = Math.PI / 2 - (Math.PI * i) / N; // 右半圓 +90°→−90°
                local.push([straight + r * Math.cos(t), r * Math.sin(t)]);
              }
              for (let i = 0; i <= N; i++) {
                const t = -Math.PI / 2 - (Math.PI * i) / N; // 左半圓 −90°→−270°
                local.push([-straight + r * Math.cos(t), r * Math.sin(t)]);
              }
              return local
                .map(([lx0, ly0]) => {
                  // local 以長軸=X 建；長軸若實際在垂直軸則交換
                  const lx = longHoriz ? lx0 : ly0;
                  const ly = longHoriz ? ly0 : lx0;
                  return `${(cx + lx * ca - ly * sa).toFixed(2)},${(cy + lx * sa + ly * ca).toFixed(2)}`;
                })
                .join(" ");
            }
            return convexHull2D(
              isMortise
                ? // 斜眼用剪切投影：孔口貼平面線、孔身沿軸斜進（不繞中心整顆轉）
                  projectMortiseShearCorners(
                    lb as any,
                    (lb as any).depthAxis ?? "z",
                    ((lb as any).depthAxis === "x"
                      ? (part.mortises[it.idx] as Mortise).origin.x >= 0
                      : (lb as any).depthAxis === "y"
                        ? (part.mortises[it.idx] as Mortise).origin.y > T / 2
                        : (part.mortises[it.idx] as Mortise).origin.z >= 0)
                      ? 1
                      : -1,
                  )
                : projectBoxCorners(lb as any),
            )
              .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
              .join(" ");
          })()}
          fill={fill}
          stroke={stroke}
          strokeWidth={1.2}
          strokeDasharray={dash}
        />
      ) : trapTenonPolyPoints ? (
        <polygon
          key={`${it.kind}-${it.idx}-box`}
          points={trapTenonPolyPoints}
          fill={fill}
          stroke={stroke}
          strokeWidth={1.2}
          strokeDasharray={dash}
        />
      ) : (
        <rect
          key={`${it.kind}-${it.idx}-box`}
          x={box.x}
          y={box.y}
          width={box.w}
          height={box.h}
          fill={fill}
          stroke={stroke}
          strokeWidth={1.2}
          strokeDasharray={dash}
        />
      ),
    ];
    // 自訂槽名（底板槽 / 滑蓋槽）：讓同件多條 cosmetic 槽分得出誰是誰。視圖無關規則——
    // (1) 跟另一條有標籤的槽「垂直重疊」就跳過：俯視高度被壓掉兩槽投影疊在一起 → 疊字，跳。
    // (2) box 太窄（< 40px）跳過：側視槽只是小缺口，標字會爆框。
    // 只剩「正視」這種兩槽分開又夠長的視圖會標。位置放朝零件內側（兩槽間空白），
    // 避開外緣尺寸線（長 / 距底），上下兩槽標籤也各自往內不互撞。
    if (it.labelText && box.w >= 40) {
      const yOverlapsLabeled = items.some((o, oi) => {
        if (oi === itemIdx || o.kind !== "m" || !o.labelText) return false;
        return !(box.y + box.h < o.rect.y || o.rect.y + o.rect.h < box.y);
      });
      if (!yOverlapsLabeled) {
        const partMidY = (Math.min(...cornersY) + Math.max(...cornersY)) / 2;
        const boxMidY = box.y + box.h / 2;
        const labelY = boxMidY < partMidY ? box.y + box.h + 11 : box.y - 5;
        partEls.push(
          <text
            key={`${it.kind}-${it.idx}-glabel`}
            x={box.x + box.w / 2}
            y={labelY}
            fontSize={8.5}
            fill="#c2410c"
            fontWeight="bold"
            textAnchor="middle"
          >
            {it.labelText}
          </text>,
        );
      }
    }
    // mortise（紅/橘框）裁進零件 silhouette：錐形腳細端的眼框是按方料截面畫的、
    // 會突出楔形輪廓外（user 2026-06-12 茶几錐形腳卡回報）。clip 到 OrthoView
    // 給的零件輪廓 clipPath；tenon（藍框）本來就凸出件外，不裁。
    if (isMortise && ctx.partClipId) {
      partEls[0] = (
        <g key={`${it.kind}-${it.idx}-clip`} clipPath={`url(#${ctx.partClipId})`}>
          {partEls[0]}
        </g>
      );
    }

    // 工程慣例（CNS / drafting-math §I6 不冗餘）：hidden（虛線）榫眼只畫輪廓、
    // 不標尺寸——尺寸由「入榫面朝鏡頭」的視圖標（該視圖一定存在：non-tall
    // top=y / side=x / front=z 全覆蓋）。沒有這條的話側視圖會把 8 顆沿弧分佈
    // 的椅背直料榫眼疊在同一截面上各標一套 W/L chain，stagger 推到圖外
    // （user 2026-06-11 長凳椅背零件圖回報）。tall-iso 件 y 軸入榫無對應視圖
    // （viewDepthAxis 不含 y）→ 例外保留標註。
    if (isMortise && !isVisibleFromView) {
      const mortiseLb = lb as ReturnType<typeof mortiseEntryBox>;
      const noViewWillLabel = isTallIso && mortiseLb.depthAxis === "y";
      if (!noViewWillLabel) {
        elements.push(<g key={`${it.kind}-${it.idx}`}>{partEls}</g>);
        return;
      }
    }

    // 圓孔/圓榫：保留下方 leader + 「Ø18 深25」label（Ø 是行業慣例 short label）
    // 方榫 (rect)：把 W/L 拉箭頭直接畫在 box 上、深度小字附近（工程圖風格）
    if (isRoundFeature) {
      // 同位 label 防撞：兩端圓榫端面同心時 leader/字會疊 → 第二顆往下推。
      // 基準再 +8：端面視圖（小截面）lblY=partBottom+16 會壓到圓輪廓下緣
      let rlY = lblY + 8;
      while (
        roundLabelSlots.some(
          (s) => Math.abs(s.x - lblX) < 40 && Math.abs(s.y - rlY) < 12,
        )
      ) {
        rlY += 14;
      }
      roundLabelSlots.push({ x: lblX, y: rlY });
      partEls.push(
        <line
          key={`${it.kind}-${it.idx}-lead`}
          x1={box.x + box.w / 2}
          y1={box.y + box.h}
          x2={lblX}
          y2={rlY - 8}
          stroke={stroke}
          strokeWidth={0.4}
          strokeDasharray="2 1.5"
        />,
        <text
          key={`${it.kind}-${it.idx}-dims`}
          x={lblX}
          y={rlY}
          fontSize={9}
          fill="#1f2937"
          fontFamily="monospace"
          textAnchor="middle"
        >
          {it.dims}
        </text>,
      );
    } else {
      // 視圖軸 mapping：mortiseEntryBox / tenonLocalBox 都以 part-local 中心系
      //   front: 水平=X, 垂直=Y, 深(into page)=Z
      //   top:   水平=X, 垂直=Z, 深=Y
      //   side:  水平=Z, 垂直=Y, 深=X
      // ⚠ tall part (T>L && T>=W) 有 svg-views.tsx isolation rotation Rz=-π/2，
      // 把 part-local Y 轉到螢幕水平 → hMm/vMm 軸來源要互換才對應視覺 box 大小
      // (user 2026-05-26 14:33 回報「光看榫大小就知道標錯了」7/23 互換)
      const L_local_label = part.visible.length;
      const W_local_label = part.visible.width;
      const T_local_label = part.visible.thickness;
      const tallSwapLabel =
        T_local_label > L_local_label &&
        T_local_label >= W_local_label &&
        (view === "front" || view === "side");
      // splay 腳零件圖 mortise 都用「沿牙板高方向(length) × 進深(depth)」標,跟視
      // 圖無關。原本走 box 投影軸推 vMm 對 X 面 mortise 在 FRONT view 給 23(=depth)
      // 但對 Z 面 mortise 給 10(=width),user 期待兩面都 25×23(user 2026-05-27
      // 「左邊紅榫是 25×23 不是 25×10、厚度寬度搞反」);厚 10 改成單獨「深」label
      // 已被前一輪簡化掉,但 user 不關心 — 他在意的是 box 兩維是 length × depth、
      // 看到的數字跟「沿榫眼長」「沿挖孔深」對得上。
      const isSplayLegPart =
        part.shape?.kind === "splayed" ||
        part.shape?.kind === "splayed-tapered" ||
        part.shape?.kind === "splayed-round-tapered";
      const splayMortiseLabel = isSplayLegPart && isMortise;
      // 仰視 BOTTOM (annView="top") + 正視 FRONT (annView="front") 的「實心框」mortise
      // (isVisibleFromView=true) → vMm 走 mortise.width（square stool=12.5、splayed=10）。
      // 只 scope 到「腳件」(part.id 開頭是 leg-)，避免桌面/椅面/抽屜板等其他件的
      // mortise 跟著被改成 width。user 2026-05-28 保守提案：「這樣會不會其他家具
      // 零件圖不會跟著改？」回答：會 → 先限到腳件。
      // 側視 (side) / 虛線框 / tenon 完全不動。
      const isLegPart =
        part.id?.startsWith("leg-") ||
        part.id === "leg" ||
        isSplayLegPart;
      const isFrontOrTopVisibleMortise =
        isMortise &&
        isVisibleFromView &&
        (view === "top" || view === "front") &&
        isLegPart;
      const mortiseFeature = isMortise ? part.mortises[it.idx] : null;
      const tenonFeature = !isMortise ? part.tenons[it.idx] : null;
      // 側視 + 腿件 + tenon：用 tenon.width × tenon.thickness 的 cross-section
      // 尺寸，不要走 lb.hy/hz（會把「length 凸出量」當高度標出來，例如顯示
      // 25×20 而不是正確的 25×12）。(user 2026-05-28「側視圖榫頭尺寸應該是 25×12 才對」)
      const sideLegTenonOverride =
        view === "side" && isLegPart && !isMortise && tenonFeature;
      const hMm = sideLegTenonOverride
        ? round1(tenonFeature!.width)
        : splayMortiseLabel
          ? round1(mortiseFeature?.length ?? 0)
          : tallSwapLabel
            ? round1(2 * lb.hy)
            : view === "side"
              ? round1(2 * lb.hz)
              : round1(2 * lb.hx);
      const vMm = sideLegTenonOverride
        ? round1(tenonFeature!.thickness)
        : isFrontOrTopVisibleMortise
          ? round1(mortiseFeature?.width ?? 0)
          : splayMortiseLabel
          ? round1(mortiseFeature?.depth ?? 0)
          : tallSwapLabel
            ? round1(2 * lb.hx)
            : view === "top"
              ? round1(2 * lb.hz)
              : round1(2 * lb.hy);
      // 工程慣例：視圖內看不到的尺寸不在這視圖標（into-page dim 留給其他 view 標）

      // dim line 擺在 part body 外側（用 partCenterSvg 判內外）
      // 計算 partTopY / partLeftX / partRightX 當參考（內部 tenon 也能離 part
      // 邊有 GAP，不會擠在 part 內側 6/6/6 跟 part 邊重疊）
      const cornersXForDim: number[] = [];
      if (view === "front") {
        cornersXForDim.push(
          ctx.partLocalToSvg(-L / 2, -T / 2, 0).x,
          ctx.partLocalToSvg(+L / 2, +T / 2, 0).x,
        );
      } else if (view === "top") {
        // 對 tall iso isolation rotation(Rz=-π/2)、part-local +Y → world -X、
        // (±L/2, T/2, ±W/2) 兩 corner 經 rotation 後 world X 都 = T/2 → partLeftX
        // === partRightX → featureInsideX 永遠 false → 沿 leg 軸的 chain dim 全
        // 不畫(user 2026-05-27:「仰視圖沒有長向尺寸標注」)。取 ±T/2 全 8 corner
        // 才 cover leg 兩端 in tall iso 場景;對 non-tall part 同 x 不影響。
        for (const sx of [-1, 1]) {
          for (const sy of [-1, 1]) {
            for (const sz of [-1, 1]) {
              cornersXForDim.push(ctx.partLocalToSvg((sx * L) / 2, (sy * T) / 2, (sz * W) / 2).x);
            }
          }
        }
      } else {
        cornersXForDim.push(
          ctx.partLocalToSvg(0, -T / 2, -W / 2).x,
          ctx.partLocalToSvg(0, +T / 2, +W / 2).x,
        );
      }
      const partLeftSvg = Math.min(...cornersXForDim);
      const partRightSvg = Math.max(...cornersXForDim);
      const partTopSvg = Math.min(...cornersY);

      const outerAbove = box.y < partCenterSvg.y;
      const outerLeft = box.x < partCenterSvg.x;
      const GAP = 12; // SVG px；榫 dim 距 box 邊
      const computeLDimX = (otherR: { x: number; w: number }) => {
        const otherOuterLeft = otherR.x < partCenterSvg.x;
        return otherOuterLeft
          ? Math.min(otherR.x, partLeftSvg) - GAP
          : Math.max(otherR.x + otherR.w, partRightSvg) + GAP;
      };
      const lDimX = computeLDimX({ x: box.x, w: box.w });
      // 預先偵測 lSiblings、prevLSibling、nextLSibling，給 wDimY 選方向參考
      const COL_TOL = 5;
      const lSiblings = items
        .filter((other) => {
          const otherFeature =
            other.kind === "m"
              ? part.mortises[other.idx]
              : part.tenons[other.idx];
          const otherLb =
            other.kind === "m"
              ? mortiseEntryBox(otherFeature as Mortise)
              : tenonLocalBox(part, otherFeature as Tenon);
          const otherR = projectBoxRect(otherLb);
          if (!otherR) return false;
          return Math.abs(computeLDimX(otherR) - lDimX) < COL_TOL;
        })
        .map((other) => {
          // cache lb to allow part-local shoulder boundary computation later
          const otherFeature =
            other.kind === "m"
              ? part.mortises[other.idx]
              : part.tenons[other.idx];
          const otherLb =
            other.kind === "m"
              ? mortiseEntryBox(otherFeature as Mortise)
              : tenonLocalBox(part, otherFeature as Tenon);
          return { other, r: other.rect, lb: otherLb };
        })
        .sort((a, b) => a.r.y - b.r.y);
      const myLIdx = lSiblings.findIndex((s) => s.other === it);
      const prevLSibling = myLIdx > 0 ? lSiblings[myLIdx - 1] : null;
      const nextLSibling =
        myLIdx >= 0 && myLIdx < lSiblings.length - 1
          ? lSiblings[myLIdx + 1]
          : null;

      // W dim (horizontal) 緊貼 box 上/下邊；上面有 sibling 時強制畫到 box 下方
      // 避免蓋到上面 mortise（user:「往下一點 不要蓋到榫孔」/「再往下移」）
      // 有 sibling 在上方的 chain mortise 用較大 gap=24 拉開
      const wDimBelow = !!prevLSibling || !outerAbove;
      const wGap = prevLSibling ? 40 : GAP;
      // 多 mortise 同 row 撞：wStagger > 0 時往下推 STAGGER_GAP*wStagger
      // 避免「438 438」「415 415」「202.5 202.5」這種多 mortise 標籤撞同一行
      const myMeta = baselineMetas[itemIdx];
      const wStaggerOffset = myMeta.wStagger * STAGGER_GAP;
      // splay 件不再 clamp 到 silhouette top 之上（同上 user 決策）
      const wDimYBase = wDimBelow ? box.y + box.h + wGap : box.y - wGap;
      const wDimY = wDimBelow
        ? wDimYBase + wStaggerOffset
        : wDimYBase - wStaggerOffset;
      const wLabelY = wDimBelow ? wDimY + 7 : wDimY - 2;
      // L label 同 col 撞：lStagger > 0 時往外推 STAGGER_GAP*lStagger
      const lStaggerOffset = myMeta.lStagger * STAGGER_GAP;
      const lLabelX = outerLeft
        ? lDimX - 2 - lStaggerOffset
        : lDimX + 2 + lStaggerOffset;
      const lLabelAnchor: "start" | "end" = outerLeft ? "end" : "start";

      // 內向箭頭 dim line（box 兩端 tick → 中央 label）
      const SZ = 2.2;
      const inwardArrowsH = (lo: number, hi: number, y: number) => (
        <>
          <polygon
            points={`${lo},${y} ${lo + SZ + 1},${y - SZ} ${lo + SZ + 1},${y + SZ}`}
            fill={stroke}
          />
          <polygon
            points={`${hi},${y} ${hi - SZ - 1},${y - SZ} ${hi - SZ - 1},${y + SZ}`}
            fill={stroke}
          />
        </>
      );
      const inwardArrowsV = (lo: number, hi: number, x: number) => (
        <>
          <polygon
            points={`${x},${lo} ${x - SZ},${lo + SZ + 1} ${x + SZ},${lo + SZ + 1}`}
            fill={stroke}
          />
          <polygon
            points={`${x},${hi} ${x - SZ},${hi - SZ - 1} ${x + SZ},${hi - SZ - 1}`}
            fill={stroke}
          />
        </>
      );

      // W/L dim 框瘦身：原本 hMm/vMm label 在 box 外側的 dim 線上、現在改 inline 貼
      // box 邊，所以 bracket box 寬/高的 dim 主線 + 兩端內向箭頭都不需要。
      // **保留 tics**——
      //   W-dim tics（box 上/下到 wDimY 的短垂直連接）= box 接 392/279/128 chain dim
      //   L-dim tics（box 兩端到 lDimX 的水平連接）= box 接 12.5/14.4 shoulder dim 列
      // (user 2026-05-26 多輪釐清：「12.5 上面沒用的箭頭可去掉」+「12.5/14.4 引線
      // 要留著」+「10/25 引線還留在右邊」→ 真因＝L-dim tics 是 12.5/14.4 的引線，
      // 不是 10/25 的；只刪 W/L 主線+箭頭、tics 全留。)
      const skipTicsInSide = view === "side" && isLegPart;
      if (!skipTicsInSide) {
      partEls.push(
        // W-dim 列：box 兩側 vertical 延伸到 wDimY（mortise 接 chain dim 用）
        <g key={`${it.kind}-${it.idx}-Wdim-tics`}>
          <line
            x1={box.x}
            y1={outerAbove ? box.y : box.y + box.h}
            x2={box.x}
            y2={wDimY}
            stroke={stroke}
            strokeWidth={0.3}
          />
          <line
            x1={box.x + box.w}
            y1={outerAbove ? box.y : box.y + box.h}
            x2={box.x + box.w}
            y2={wDimY}
            stroke={stroke}
            strokeWidth={0.3}
          />
        </g>,
        // L-dim 列：box 兩端 horizontal 延伸到 lDimX（mortise 接 12.5/14.4 shoulder
        // dim 列；少了這條 shoulderTop/Bot 的 box 端內向箭頭就指向空氣）
        <g key={`${it.kind}-${it.idx}-Ldim-tics`}>
          <line
            x1={outerLeft ? box.x : box.x + box.w}
            y1={box.y}
            x2={lDimX}
            y2={box.y}
            stroke={stroke}
            strokeWidth={0.3}
          />
          <line
            x1={outerLeft ? box.x : box.x + box.w}
            y1={box.y + box.h}
            x2={lDimX}
            y2={box.y + box.h}
            stroke={stroke}
            strokeWidth={0.3}
          />
        </g>,
      );
      }
      partEls.push(
        // vMm / hMm label 直接貼在 box 左/上邊（user 2026-05-26 14:17 要求
        // 「直接標在榫孔的左邊跟上方兩側」），不再跟 chain shoulder 共用
        // lLabelX/wLabelY 那個外推欄位，避免多 feature 同欄位疊字。
        //
        // 隱藏線（dashed shadow）mortise：vMm 走 box 右邊（不跟同列實線 mortise 的
        // vMm 擠左欄位）。對 splayed leg 的 side-face mortise（投影到 front view
        // 成虛線殘影）尤其明顯——dashed 高度 = mortise.depth、實線高度 = mortise.width
        // 兩個 vMm 數字不一樣、同列左邊難辨。(user 2026-05-26「兩個 25 應該移到榫孔
        // 右邊比較好」)
        (() => {
          // 側視 + 腿件 + dashed mortise：vMm/hMm 推開避免跟 solid mortise inline-dim
          // 撞字（user 2026-05-28「榫頭旁邊的尺寸靠太近 擠在一起看不出來了」）
          const isSideLegDashed =
            view === "side" && isLegPart && isMortise && !isVisibleFromView;
          const rightVMmX = isSideLegDashed ? box.x + box.w + 8 : box.x + box.w + 2;
          const hMmX = box.x + box.w / 2;
          const hMmAboveY = box.y - 2;
          // mortise 緊貼 part 頂緣時 hMmAboveY 會撞 part 輪廓黑線(2026-05-29
          // SIDE view 短料 apron 截圖)。clamp 到 partTopSvg - 4 確保字頭在
          // part 邊上方留空。
          const hMmClearedY = Math.min(hMmAboveY, partTopSvg - 4);
          // cosmetic 槽：下半的槽長度標籤改放槽「下方」，不要跟上半槽一起被 clamp 到 part
          // 頂端疊字（user 2026-06-15「兩個尺寸疊在一起」）。上半槽 / 一般榫眼維持原本頂端。
          const hMmY = isSideLegDashed
            ? box.y + box.h + 8
            : isCosmetic && box.y + box.h / 2 >= partCenterSvg.y
              ? box.y + box.h + 11
              : hMmClearedY;
          return (
            <g key={`${it.kind}-${it.idx}-inline-dims`}>
              {/* L dim label 規則：
                  - 仰視圖 (top view) mortise：dashed 走左、visible 走右
                    兩個 vMm 各坐成對 box 的外側空白，不擠中間（user 2026-05-28）
                  - 其他視圖 mortise：dashed 走右、visible 走左（原規則）
                  - tenon：outerLeft=true 走左、false 走右（凸出側） */}
              {(!isMortise && !outerLeft) ||
              (isMortise && view === "top" && isVisibleFromView) ||
              (isMortise && view !== "top" && !isVisibleFromView) ? (
                <text
                  x={rightVMmX}
                  y={box.y + box.h / 2 + 3}
                  fontSize={7}
                  fill={stroke}
                  fontFamily="monospace"
                  textAnchor="start"
                >
                  {vMm}
                </text>
              ) : (
                <text
                  x={box.x - 2}
                  y={box.y + box.h / 2 + 3}
                  fontSize={7}
                  fill={stroke}
                  fontFamily="monospace"
                  textAnchor="end"
                >
                  {vMm}
                </text>
              )}
              {/* W dim label on box TOP side (side+leg+dashed: 推到底部) */}
              <text
                x={hMmX}
                y={hMmY}
                fontSize={7}
                fill={stroke}
                fontFamily="monospace"
                textAnchor="middle"
              >
                {hMm}
              </text>
            </g>
          );
        })(),
      );

      // 鏈式 dim：榫到 part 邊緣（user 要求標 shoulder/offset）
      // 在 W/L dim 線上延伸，partEdge→box→box→partEdge 各段；段 < 2mm 跳過
      // 沿用上面已算出的 partLeftSvg / partRightSvg / partTopSvg
      const partLeftX = partLeftSvg;
      const partRightX = partRightSvg;
      const partTopY = partTopSvg;

      // shoulder 數值改用 part-local 座標直接算。原本 (box.y - topBoundary) *
      // mmPerSvg 量的是 SVG 投影上的 screen-Y 距離，對 splayed/tapered 件（投影
      // 為傾斜平行四邊形）量出來的不是 part-local 軸向距離 → 121.4 / 170 / 418.1
      // 等離譜值（user 2026-05-26 多次回報）。
      //
      // 各 view 軸對映（與 mortiseEntryBox / tenonLocalBox 同座標系）：
      //   front: horiz=X, vert=Y
      //   top:   horiz=X, vert=Z
      //   side:  horiz=Z, vert=Y
      // BUT：對 stool leg 這種 thickness > length 的件，OrthoView 把長軸
      // 旋轉成螢幕橫向 → 螢幕水平方向實際對應 part-local Y 軸（T 軸）。
      // 為了讓 T2 shoulder chain 跟 T1「長 425」量同一個軸（user 2026-05-26
      // 回報「上面黑 vs 下面紅 方向不合」），偵測這個 case 並把 horiz/vert
      // 軸來源對調。
      const L_local = part.visible.length;
      const W_local = part.visible.width;
      const T_local = part.visible.thickness;
      // tall iso isolation rotation Rz=-π/2:part-local +Y → world -X、+X → world +Y、Z 不變。
      // 各 view 螢幕軸對應(tall iso):
      //   front (X-Y plane): H=world X=part-local -Y, V=world Y=part-local +X
      //   side  (Z-Y plane): H=world Z=part-local  Z, V=world Y=part-local +X
      //   top   (X-Z plane): H=world X=part-local -Y, V=world Z=part-local  Z
      // 原本 swapForTallPart 只 cover front/side、漏 top → 仰視 BOTTOM(annView="top")
      // 沿 leg 軸的 shoulderLft/Rgt chain dim 抓錯軸(走 lb.cx 而非 lb.cy)就沒畫
      // (user 2026-05-27:「仰視圖沒有長向尺寸標注」)。
      // SIDE view 邏輯不動(user 已驗收過,partHalfH=T/2 不對但暫不動避免迴歸)。
      const swapForTallPart =
        T_local > L_local &&
        T_local > W_local &&
        (view === "front" || view === "side" || view === "top");
      const partHalfH = swapForTallPart
        ? T_local / 2
        : view === "side"
          ? W_local / 2
          : L_local / 2;
      const partHalfV = swapForTallPart
        ? view === "side"
          ? W_local / 2
          : view === "top"
            ? W_local / 2
            : L_local / 2
        : view === "top"
          ? W_local / 2
          : T_local / 2;
      const featCh = swapForTallPart
        ? lb.cy
        : view === "side"
          ? lb.cz
          : lb.cx;
      const featHh = swapForTallPart
        ? lb.hy
        : view === "side"
          ? lb.hz
          : lb.hx;
      const featCv = swapForTallPart
        ? view === "side"
          ? lb.cz
          : view === "top"
            ? lb.cz
            : lb.cx
        : view === "top"
          ? lb.cz
          : lb.cy;
      const featHv = swapForTallPart
        ? view === "side"
          ? lb.hz
          : view === "top"
            ? lb.hz
            : lb.hx
        : view === "top"
          ? lb.hz
          : lb.hy;

      // feature 必須在 part body 那軸範圍內，才算 shoulder（榫頭凸出側不是
      // shoulder、是 part 外）；2mm 容差吸收 SVG 投影誤差
      const SLACK = 2;
      const featureInsideX =
        box.x >= partLeftX - SLACK &&
        box.x + box.w <= partRightX + SLACK;
      const featureInsideY =
        box.y >= partTopY - SLACK &&
        box.y + box.h <= partBottomY + SLACK;

      // lSiblings / prevLSibling / nextLSibling 在 wDimY 計算前已提前算過

      // top 邊界：前一個 sibling 的 bot edge（如果有），不然 partTopY
      const topBoundary = prevLSibling
        ? prevLSibling.r.y + prevLSibling.r.h
        : partTopY;
      // 中段 sibling 的 botShoulder 不畫（由 nextSibling 的 topShoulder 補）
      const drawBotShoulder = !nextLSibling;
      // shoulder 線太長（> 60 svg unit）直接跳過，不管有沒有 sibling。
      // user:「拉到底下太遠了」「應該往上面拉」=> 把長線拿掉、相鄰 chain 保留。
      const LONG_CHAIN_TH = 60; // SVG px；超過視為「太長」
      const isLastSibling = !nextLSibling;
      const skipFirstShoulderTop =
        !prevLSibling && box.y - topBoundary > LONG_CHAIN_TH;
      const skipLastShoulderBot =
        isLastSibling && partBottomY - (box.y + box.h) > LONG_CHAIN_TH;

      // 取 prev sibling 在 vertAxis 上的 part-local 下緣（如有 sibling）
      // 不然用 part 邊（+partHalfV = top edge）
      // ⚠ 必須跟 featCv/featHv 同軸（swapForTallPart 對 tall part FRONT/SIDE
      // 把 vert 對到 part-local X 軸），不然會混到 T 軸 ±212.5 算出 199/158
      // 這種不合理數值（user 2026-05-26 12:36 回報）。
      const prevSibCv = prevLSibling
        ? swapForTallPart
          ? view === "top"
            ? prevLSibling.lb.cz
            : prevLSibling.lb.cx
          : view === "top"
            ? prevLSibling.lb.cz
            : prevLSibling.lb.cy
        : 0;
      const prevSibHv = prevLSibling
        ? swapForTallPart
          ? view === "top"
            ? prevLSibling.lb.hz
            : prevLSibling.lb.hx
          : view === "top"
            ? prevLSibling.lb.hz
            : prevLSibling.lb.hy
        : 0;
      const topBoundaryLocal = prevLSibling
        ? prevSibCv + prevSibHv
        : partHalfV;
      const shoulderTop =
        featureInsideY && !skipFirstShoulderTop
          ? round1(topBoundaryLocal - (featCv + featHv))
          : 0;
      const shoulderBot =
        featureInsideY && drawBotShoulder && !skipLastShoulderBot
          ? round1((featCv - featHv) + partHalfV)
          : 0;
      // swapForTallPart 把 horiz 軸對到 part-local Y，但 part-local +Y → screen
      // -X（Rz=-π/2 rotation）→ part-local Y 軸的「正向」對應 screen 的「左方」
      // → shoulderLft/Rgt 的「左右」對應跟 part-local Y 方向相反，需鏡像。
      // (user 2026-05-26 回報「106-25-301 應該是 301-25-106」)
      const shoulderLft = featureInsideX
        ? swapForTallPart
          ? round1(partHalfH - (featCh + featHh))
          : round1((featCh - featHh) + partHalfH)
        : 0;
      const shoulderRgt = featureInsideX
        ? swapForTallPart
          ? round1((featCh - featHh) + partHalfH)
          : round1(partHalfH - (featCh + featHh))
        : 0;
      const TH = 2; // mm 門檻
      // shoulder top 的 dim line 起點用 topBoundary（不一定 partTopY）
      // splay 腿 + 正視 FRONT (annView="top") + 實線 mortise：起點改回 partTopY
      // （= 未傾斜方料的 gross top = 「腳輪廓虛線最上緣」），不要走 prevLSibling
      // chain 規則。leader 從 gross top 拉到 mortise 上緣 = 「12.5 dim 起點往上移」
      // (user 2026-05-28「腳輪廓虛線最上緣到 18×10 的 mortise 上緣」)
      const useGrossTopAnchor =
        isSplayLegPart && view === "top" && isMortise && isVisibleFromView;
      const shoulderTopStartY = useGrossTopAnchor ? partTopY : topBoundary;

      // L dim 線（vertical）上下延伸：topBoundary→box.y 和 box.y+box.h→partBottom
      // 原本 mid-chain shoulderTop label 會外推 tightOut + 加斜引線避免跟 box W-dim
      // label 同列撞，現在 W/L dim 框已拆 → 撤掉外推，label 回到 dim 線中點原位。
      // (user 2026-05-26「14.4 可以移回去原本位置了」)
      // dedupe by VALUE only,跨軸跨 mortise 同值只畫第一個(user 2026-05-27
      // 「先刪除一個 12.5」)。同 mortise 的 shoulderTop=12.5 跟 shoulderRgt=12.5
      // 或雙面 mortise 兩個 shoulderRgt=12.5,只留第一個渲染。
      // 側視 frame 對腿件不需要長軸 shoulder chain dim（cross-section 已用 T1
      // 寬/厚標完）。splay 件 rotated mortise lb.cz/lb.cx 吃進長軸分量會算出
      // 10/392/279/301/128/106 這種跟木料長度搞混的數值,直接跳過。
      // (user 2026-05-28「側視圖很多尺寸數字都跟木料的長度搞混了」)
      const skipShoulderInSide = view === "side" && isLegPart;
      const shTKey = `${shoulderTop}`;
      if (shoulderTop > TH && !renderedShoulderKeys.has(shTKey) && !skipShoulderInSide) {
        renderedShoulderKeys.add(shTKey);
        const segMidY = (shoulderTopStartY + box.y) / 2;
        partEls.push(
          <g key={`${it.kind}-${it.idx}-shT`}>
            <line
              x1={lDimX}
              y1={shoulderTopStartY}
              x2={lDimX}
              y2={box.y}
              stroke={stroke}
              strokeWidth={0.5}
            />
            <line
              x1={outerLeft ? partLeftX : partRightX}
              y1={shoulderTopStartY}
              x2={lDimX}
              y2={shoulderTopStartY}
              stroke={stroke}
              strokeWidth={0.3}
            />
            {inwardArrowsV(shoulderTopStartY, box.y, lDimX)}
            <text
              x={lLabelX}
              y={segMidY + 3}
              fontSize={7}
              fill={stroke}
              fontFamily="monospace"
              textAnchor={lLabelAnchor}
            >
              {shoulderTop}
            </text>
          </g>,
        );
      }
      const shBKey = `${shoulderBot}`;
      if (shoulderBot > TH && !renderedShoulderKeys.has(shBKey) && !skipShoulderInSide) {
        renderedShoulderKeys.add(shBKey);
        partEls.push(
          <g key={`${it.kind}-${it.idx}-shB`}>
            <line
              x1={lDimX}
              y1={box.y + box.h}
              x2={lDimX}
              y2={partBottomY}
              stroke={stroke}
              strokeWidth={0.5}
            />
            <line
              x1={outerLeft ? partLeftX : partRightX}
              y1={partBottomY}
              x2={lDimX}
              y2={partBottomY}
              stroke={stroke}
              strokeWidth={0.3}
            />
            {inwardArrowsV(box.y + box.h, partBottomY, lDimX)}
            <text
              x={lLabelX}
              y={(box.y + box.h + partBottomY) / 2 + 3}
              fontSize={7}
              fill={stroke}
              fontFamily="monospace"
              textAnchor={lLabelAnchor}
            >
              {shoulderBot}
            </text>
          </g>,
        );
      }
      // W dim 線（horizontal）左右延伸：partLeft→box.x 和 box.x+box.w→partRight
      // user:「我是說往下的延伸線」=>「partEdge 角→wDimY」那條垂直延伸不畫
      // （長線視覺雜訊、shoulder 量 + arrow 已能傳達距邊資訊）
      // 修正：所有 part-drawing view 的投影都做 x_svg = -x_local 翻轉，所以
      // SVG MIN x (= partLeftX) 對應 part-local 右邊，MAX x (= partRightX) 對應
      // part-local 左邊。shoulderLft 值（part-local 左肩）→ 線端要落在 SVG 右側
      // (box.x+box.w → partRightX)；shoulderRgt 值（part-local 右肩）→ 線端要落在
      // SVG 左側 (partLeftX → box.x)。原本左右搞反，導致 user 2026-06-02「下面
      // 10 跟 315 接反了」。
      const shLKey = `${shoulderLft}`;
      if (shoulderLft > TH && !renderedShoulderKeys.has(shLKey) && !skipShoulderInSide) {
        renderedShoulderKeys.add(shLKey);
        const shLOffset =
          view === "top" && isLegPart
            ? shoulderHYUsed.L.filter((y) => Math.abs(y - wDimY) <= SHOULDER_Y_TOL).length *
              STAGGER_GAP
            : 0;
        shoulderHYUsed.L.push(wDimY);
        const shLDimY = wDimY + shLOffset;
        // 線段 = box.x+box.w → partRightX（短，對應 LEFT mortise 的 shoulderLft=10）
        partEls.push(
          <g key={`${it.kind}-${it.idx}-shL`}>
            <line
              x1={box.x + box.w}
              y1={shLDimY}
              x2={partRightX}
              y2={shLDimY}
              stroke={stroke}
              strokeWidth={0.5}
            />
            {inwardArrowsH(box.x + box.w, partRightX, shLDimY)}
            <text
              x={(box.x + box.w + partRightX) / 2}
              y={wLabelY + shLOffset}
              fontSize={7}
              fill={stroke}
              fontFamily="monospace"
              textAnchor="middle"
            >
              {shoulderLft}
            </text>
          </g>,
        );
      }
      const shRKey = `${shoulderRgt}`;
      if (shoulderRgt > TH && !renderedShoulderKeys.has(shRKey) && !skipShoulderInSide) {
        renderedShoulderKeys.add(shRKey);
        const shROffset =
          view === "top" && isLegPart
            ? shoulderHYUsed.R.filter((y) => Math.abs(y - wDimY) <= SHOULDER_Y_TOL).length *
              STAGGER_GAP
            : 0;
        shoulderHYUsed.R.push(wDimY);
        const shRDimY = wDimY + shROffset;
        // 線段 = partLeftX → box.x（長，對應 LEFT mortise 的 shoulderRgt=315）
        partEls.push(
          <g key={`${it.kind}-${it.idx}-shR`}>
            <line
              x1={partLeftX}
              y1={shRDimY}
              x2={box.x}
              y2={shRDimY}
              stroke={stroke}
              strokeWidth={0.5}
            />
            {inwardArrowsH(partLeftX, box.x, shRDimY)}
            <text
              x={(partLeftX + box.x) / 2}
              y={wLabelY + shROffset}
              fontSize={7}
              fill={stroke}
              fontFamily="monospace"
              textAnchor="middle"
            >
              {shoulderRgt}
            </text>
          </g>,
        );
      }
    }

    // 工程 dim line：根據 view + 對稱性
    // 距中軸 dim 放在 W/L dim line 外側（mortiseIsRound 用原 8px、rect 用 18px 避撞）
    const offCenter = mortiseIsRound ? 8 : 18;
    // cosmetic 槽（底板槽/滑蓋槽）不畫藍色「距中」dim——對槽沒意義又擠（user 2026-06-15）。
    // 槽位置由槽寬(底5.5/蓋7.5)+ 名稱表達；真榫眼/榫頭仍照常標距中。
    if (view === "top" && isSymmetricPart && !isCosmetic) {
      // 距中 X：水平 dim line 從 centerline 到 mortise center。
      // 距中 = 0（孔就在中軸上）的 dim 無資訊量還畫一支「0」箭頭 →
      // 跳過（user 2026-06-11 托盤側壁卡「0」標回報）
      const dxMm = round1(Math.abs(lb.cx));
      const dzMm = round1(Math.abs(lb.cz));
      const xDimY =
        box.y < partCenterSvg.y
          ? box.y - offCenter
          : box.y + box.h + offCenter;
      const zDimX =
        box.x < partCenterSvg.x
          ? box.x - offCenter
          : box.x + box.w + offCenter;
      if (dxMm >= 2) {
        // 階梯：同側同 Y 的距中 dim 往外推 STAGGER_GAP*N，避免全疊一條線看不出標哪個
        const side = cx < partCenterSvg.x ? "L" : "R";
        const lvl = xDistYUsed[side].filter((y) => Math.abs(y - xDimY) <= 4).length;
        xDistYUsed[side].push(xDimY);
        const stagY = box.y < partCenterSvg.y ? xDimY - lvl * STAGGER_GAP : xDimY + lvl * STAGGER_GAP;
        partEls.push(
          hDim(partCenterSvg.x, cx, stagY, String(dxMm), "#0ea5e9", `${it.kind}-${it.idx}-xdim`),
        );
      }
      if (dzMm >= 2) {
        partEls.push(
          vDim(partCenterSvg.y, cy, zDimX, String(dzMm), "#0ea5e9", `${it.kind}-${it.idx}-zdim`),
        );
      }
    } else if (view !== "top" && isSymmetricPart && !isCosmetic) {
      // front / side 對稱件：只畫 X / Z 距中軸 dim line（距底 dim 已砍）
      const dxMm = round1(Math.abs(lb.cx));
      const xDimY = box.y - offCenter;
      // 視線方向是 part-local X（viewDepthAxis="x"，如櫃側板 side view 沿高度看）時，
      // 「距中 X」是沿視線軸的高度位置、在此視圖collapse 看不到，畫了只會擠在中央、
      // 跟長/深尺寸疊（user 2026-06-14「這尺寸擠在一起」）→ 跳過。
      if (dxMm >= 2 && viewDepthAxis !== "x") {
        const side = cx < partCenterSvg.x ? "L" : "R";
        const lvl = xDistYUsed[side].filter((y) => Math.abs(y - xDimY) <= 4).length;
        xDistYUsed[side].push(xDimY);
        const stagY = xDimY - lvl * STAGGER_GAP;
        partEls.push(
          hDim(
            partCenterSvg.x,
            cx,
            stagY,
            String(dxMm),
            "#0ea5e9",
            `${it.kind}-${it.idx}-xdim`,
          ),
        );
      }
    }

    elements.push(<g key={`${it.kind}-${it.idx}`}>{partEls}</g>);
  });

  return <g className="t2-overlay">{elements}</g>;
}

/**
 * GrainArrow — 順紋方向小箭頭（Phase 2 Task 4）。
 *
 * 每張 OrthoView 右下角繪一個 14px 標記 + 「順紋」字（藍色 #1d4ed8）：
 *   - horiz：水平箭頭 →（沿水平軸順紋）
 *   - vert： 垂直箭頭 ↑（沿垂直軸順紋）
 *   - into： ⊙ 圓圈+點（順紋指向紙面內側，無法在此 view 平面表示）
 *
 * Per view 對應（GrainDirection 只有 length | width）：
 *   front: length→horiz / width→into
 *   top:   length→horiz / width→vert
 *   side:  length→into  / width→horiz
 *
 * Spec: docs/superpowers/specs/2026-05-17-part-drawings-phase-2-design.md §4
 */
type ArrowDir = "horiz" | "vert" | "into";

function grainArrowDir(
  grain: Part["grainDirection"],
  view: PartView,
): ArrowDir {
  if (view === "front") return grain === "length" ? "horiz" : "into";
  if (view === "top") return grain === "length" ? "horiz" : "vert";
  // side
  return grain === "width" ? "horiz" : "into";
}

export function GrainArrow({
  ctx,
  part,
  view,
}: {
  ctx: OrthoViewBoxCtx;
  part: Part;
  view: PartView;
}) {
  // 零件圖隱藏順紋箭頭：常與右下角榫頭/尺寸標籤重疊（user 2026-05-29）
  // 順紋資訊已在材料表/spec 欄位呈現，此處不再畫小箭頭。
  return null;
  // eslint-disable-next-line no-unreachable
  const dir = grainArrowDir(part.grainDirection, view);
  const x0 = ctx.vbX + ctx.vbW - 38;
  const y0 = ctx.vbY + ctx.vbH - 18;
  const len = 14;

  let glyph: React.ReactNode;
  if (dir === "horiz") {
    glyph = (
      <g>
        <line
          x1={x0}
          y1={y0 - 4}
          x2={x0 + len}
          y2={y0 - 4}
          stroke="#1d4ed8"
          strokeWidth={0.7}
        />
        <polygon
          points={`${x0 + len},${y0 - 4} ${x0 + len - 3},${y0 - 6} ${x0 + len - 3},${y0 - 2}`}
          fill="#1d4ed8"
        />
      </g>
    );
  } else if (dir === "vert") {
    glyph = (
      <g>
        <line
          x1={x0 + len / 2}
          y1={y0}
          x2={x0 + len / 2}
          y2={y0 - len}
          stroke="#1d4ed8"
          strokeWidth={0.7}
        />
        <polygon
          points={`${x0 + len / 2},${y0 - len} ${x0 + len / 2 - 2},${y0 - len + 3} ${x0 + len / 2 + 2},${y0 - len + 3}`}
          fill="#1d4ed8"
        />
      </g>
    );
  } else {
    // into the page
    glyph = (
      <g>
        <circle
          cx={x0 + len / 2}
          cy={y0 - 4}
          r={4}
          fill="none"
          stroke="#1d4ed8"
          strokeWidth={0.7}
        />
        <circle cx={x0 + len / 2} cy={y0 - 4} r={1} fill="#1d4ed8" />
      </g>
    );
  }

  return (
    <g className="grain-arrow">
      {glyph}
      <text x={x0} y={y0 + 8} fontSize={7} fill="#1d4ed8">
        順紋
      </text>
    </g>
  );
}

/**
 * FacingMark — 面向記號（Phase 2 Task 5）
 *
 * 推論非對稱零件的「外/內/上/下」面，協助木匠決定哪面當外觀面（光面/打磨完整）。
 *
 * `inferFacing(part)` 啟發式：
 * - X 軸：mortise.origin.x 偏向某側集中 → 對面為「外」（因為榫眼那側是組裝隱面）
 * - Z 軸：同上以 mortise.origin.z 推論
 * - Y 軸：tenon.position = "top" → 上 / "bottom" → 下
 *   （Tenon 沒有 origin，用 position 軸別判斷）
 * - 完全對稱 / 無線索 → null（不標）
 *
 * 顯示：左上角 9px 深橘 #7c2d12 字。只在能看到該軸的 view 顯示
 * （X→front/top、Z→side/top、Y→front/side）。
 *
 * Spec: docs/superpowers/specs/2026-05-17-part-drawings-phase-2-design.md §5
 */
type FacingHint = {
  axis: "x" | "y" | "z";
  positive: boolean;
  label: "外" | "內" | "上" | "下";
};

export function inferFacing(part: Part): FacingHint | null {
  const mortises = part.mortises ?? [];
  const tenons = part.tenons ?? [];

  // X / Z 軸：以 mortise.origin 群聚判斷
  // origin.x / origin.z 是 part-centered（[-l/2, +l/2]）
  let xPos = 0,
    xNeg = 0;
  let zPos = 0,
    zNeg = 0;
  for (const m of mortises) {
    const x = m.origin?.x ?? 0;
    const z = m.origin?.z ?? 0;
    if (x > 1) xPos++;
    else if (x < -1) xNeg++;
    if (z > 1) zPos++;
    else if (z < -1) zNeg++;
  }

  // 偏移 ≥ 2 才算明顯不對稱（避免單個 mortise 就觸發 noise）
  if (xPos > xNeg + 1) return { axis: "x", positive: false, label: "外" };
  if (xNeg > xPos + 1) return { axis: "x", positive: true, label: "外" };
  if (zPos > zNeg + 1) return { axis: "z", positive: false, label: "外" };
  if (zNeg > zPos + 1) return { axis: "z", positive: true, label: "外" };

  // Y 軸（上/下）：Tenon 沒有 origin，改用 position 判斷
  let yTop = 0,
    yBot = 0;
  for (const t of tenons) {
    if (t.position === "top") yTop++;
    else if (t.position === "bottom") yBot++;
  }
  if (yTop > yBot && yTop > 0) return { axis: "y", positive: true, label: "上" };
  if (yBot > yTop && yBot > 0) return { axis: "y", positive: false, label: "下" };

  return null;
}

export function FacingMark({
  ctx,
  part,
  view,
}: {
  ctx: OrthoViewBoxCtx;
  part: Part;
  view: PartView;
}) {
  const facing = inferFacing(part);
  if (!facing) return null;

  // 只在能看到該軸面的 view 顯示記號
  //   X 軸面 → front（length 水平）/ top（length 水平）能看見
  //   Z 軸面 → side（width 水平）/ top（width 垂直）能看見
  //   Y 軸面（上/下）→ front / side 能看見；top 是俯視看不到上下面
  const showOn =
    (facing.axis === "x" && (view === "front" || view === "top")) ||
    (facing.axis === "z" && (view === "side" || view === "top")) ||
    (facing.axis === "y" && view !== "top");
  if (!showOn) return null;

  const x0 = ctx.vbX + 14;
  const y0 = ctx.vbY + 22;
  return (
    <g className="facing-mark">
      <text x={x0} y={y0} fontSize={9} fill="#7c2d12" fontWeight="bold">
        {facing.label}
      </text>
    </g>
  );
}

/**
 * <ShapeSpecificAnnotation> — 依 part.shape.kind 分派對應的特殊標註元件
 *（Phase 3 Task 1+ 框架）。
 *
 * 不在 5 種 hard shape 內回 null（safe no-op）。
 *
 * Spec: docs/superpowers/specs/2026-05-17-part-drawings-phase-3-design.md §1
 */
export function ShapeSpecificAnnotation({
  ctx,
  part,
  view,
}: {
  ctx: OrthoViewBoxCtx;
  part: Part;
  view: PartView;
}) {
  if (!part.shape) return null;
  switch (part.shape.kind) {
    case "lathe-turned":
      return <LatheSegmentTable ctx={ctx} part={part} view={view} />;
    case "arch-bent":
      return <ArchBentChord ctx={ctx} part={part} view={view} />;
    case "apron-trapezoid":
      // 上邊長/下邊長 雙標移除——T1 dim 已標 part body length、taper 細微差
      // 用 shape 視覺呈現即可，多印一行字反而噪音（user 05-17 22:28 要求）
      return null;
    case "hoof":
      return <HoofDirection ctx={ctx} part={part} view={view} />;
    case "splayed":
    case "splayed-tapered":
    case "splayed-round-tapered":
      return <SplayedTrueLength ctx={ctx} part={part} view={view} />;
    default:
      return null;
  }
}

/**
 * <LouverLayoutDims> — 百葉門豎梃斜槽「劃線尺寸」（俯視）。
 * 木工劃線排槽需要：道數、槽間距(pitch)、傾角、首槽距端。逐槽 W×L×深 已由 T2 標，
 * 這裡補整體排版資訊：一個 pitch 尺寸（最左兩槽中心）＋首槽距端＋「×N 間距P 斜A°」字。
 */
export function LouverLayoutDims({
  ctx,
  part,
  view,
}: {
  ctx: OrthoViewBoxCtx;
  part: Part;
  view: PartView;
}) {
  // 俯視（葉片沿長軸排開、看得到傾斜）才標
  if (view !== "front") return null;
  const grooves = (part.mortises ?? []).filter(
    (m) => m.cosmetic && (m.rotX || m.rotZ) && (m.label ?? "").startsWith("百葉槽"),
  );
  if (grooves.length < 2) return null;
  const tHalf = part.visible.thickness / 2;
  const byZ = [...grooves].sort((a, b) => a.origin.z - b.origin.z);
  const pitchMm = Math.round(Math.abs(byZ[1].origin.z - byZ[0].origin.z));
  const angleDeg = Math.round(
    (Math.abs(grooves[0].rotX ?? grooves[0].rotZ ?? 0) * 180) / Math.PI,
  );
  const pts = byZ.map((m) => ctx.partLocalToSvg(m.origin.x, tHalf, m.origin.z));
  const sx = [...pts].sort((a, b) => a.x - b.x);
  const g0 = sx[0], g1 = sx[1];
  // 首槽距端（part 端面到第一槽中心，沿排槽軸）＝以 part 邊界投影估；用 z 距半長算 mm
  const halfLen = part.visible.width / 2; // 豎梃長軸＝width(門高)
  const firstFromEnd = Math.round(halfLen - Math.abs(byZ[byZ.length - 1].origin.z));
  const dimY = Math.max(...pts.map((p) => p.y)) + 18;
  const ARROW = 1.6;
  return (
    <g stroke="#111" fill="#111" strokeWidth={0.4} fontFamily="sans-serif">
      {/* 一個 pitch 尺寸：最左兩槽中心間 */}
      <line x1={g0.x} y1={g0.y + 2} x2={g0.x} y2={dimY + 2} strokeWidth={0.25} stroke="#888" />
      <line x1={g1.x} y1={g1.y + 2} x2={g1.x} y2={dimY + 2} strokeWidth={0.25} stroke="#888" />
      <line x1={g0.x} y1={dimY} x2={g1.x} y2={dimY} />
      <polygon points={`${g0.x},${dimY} ${g0.x + ARROW},${dimY - ARROW} ${g0.x + ARROW},${dimY + ARROW}`} />
      <polygon points={`${g1.x},${dimY} ${g1.x - ARROW},${dimY - ARROW} ${g1.x - ARROW},${dimY + ARROW}`} />
      <text x={(g0.x + g1.x) / 2} y={dimY - 3} textAnchor="middle" fontSize={9} stroke="none">
        {`間距 ${pitchMm}`}
      </text>
      {/* 整體劃線資訊 */}
      <text x={ctx.vbX + 10} y={dimY + 16} fontSize={10} stroke="none" fill="#1f2937" fontFamily="monospace">
        {`百葉槽 ×${grooves.length}　間距 ${pitchMm}　斜 ${angleDeg}°　首槽距端 ${firstFromEnd}`}
      </text>
    </g>
  );
}

/**
 * <LatheSegmentTable> — lathe-turned 段別表（side view 角落）。
 *
 * 讀 module 常數 LATHE_SEG（12 段 [topR, botR, hFrac]）。
 *   Y(seg i) = Σ(hFrac[0..i]) × visible.length   // 累加從頂往下
 *   R(seg i) = botR × visible.width / 2          // 半徑 = bot 比例 × fullR
 *
 * 字級 6px / 行高 9px / 等寬字、貼右邊 90px。
 *
 * Spec: …phase-3 §1.1
 */
function LatheSegmentTable({
  ctx,
  part,
  view,
}: {
  ctx: OrthoViewBoxCtx;
  part: Part;
  view: PartView;
}) {
  if (view !== "side") return null;
  // round leg 系列用 width 當直徑、length 當高度
  const fullR = part.visible.width / 2;
  const length = part.visible.length;

  let cumH = 0;
  const rows = LATHE_SEG.map((seg, i) => {
    const [, botR, hFrac] = seg;
    cumH += hFrac;
    return {
      idx: i + 1,
      y: Math.round(cumH * length * 10) / 10,
      r: Math.round(botR * fullR * 10) / 10,
    };
  });

  const x0 = ctx.vbX + ctx.vbW - 90;
  const y0 = ctx.vbY + 24;
  const lineH = 9;

  return (
    <g
      className="lathe-segment-table"
      style={{ fontSize: 6, fontFamily: "monospace" }}
    >
      <text x={x0} y={y0} fontWeight="bold">
        段│Y│R
      </text>
      {rows.map((r, i) => (
        <text key={i} x={x0} y={y0 + (i + 1) * lineH}>
          {String(r.idx).padStart(2)}│{String(r.y).padStart(4)}│
          {String(r.r).padStart(4)}
        </text>
      ))}
    </g>
  );
}

/**
 * <ArchBentChord> — arch-bent 弦長 + 矢高（front view 左下）。
 *
 * 木匠用「弦長 + 矢高」就能用繩子+尺放樣弧線（古法）。
 *   弦長 = visible.length（直線端到端距離）
 *   矢高 = shape.bendMm（垂直弦的最大彎度）
 *
 * 配「順弦切向木紋」小字提示走紋方向。
 *
 * Spec: …phase-3 §1.2
 */
function ArchBentChord({
  ctx,
  part,
  view,
}: {
  ctx: OrthoViewBoxCtx;
  part: Part;
  view: PartView;
}) {
  if (part.shape?.kind !== "arch-bent") return null;
  const chord = part.visible.length;
  const sagitta = part.shape.bendMm ?? 0;

  // 俯視 TOP (view="front")：左下角放弦長 + 矢高 + 走紋小字
  if (view === "front") {
    const x0 = ctx.vbX + 14;
    const y0 = ctx.vbY + ctx.vbH - 40;
    return (
      <g className="arch-bent-chord" style={{ fontSize: 8 }}>
        <text x={x0} y={y0} fill="#374151">
          弦長 {round1(chord)}
        </text>
        <text x={x0} y={y0 + 10} fill="#374151">
          矢高 {round1(sagitta)}
        </text>
        <text x={x0} y={y0 + 20} fontSize={6} fill="#6b7280">
          （順弦切向木紋）
        </text>
      </g>
    );
  }

  // 正視 FRONT (view="top")：直接在零件上畫垂直 dim 線標「毛料厚 ≥ W + bendMm」
  // user 2026-06-02「要直接在上面標尺寸」
  if (view === "top") {
    const W = part.visible.width ?? 0;
    const envThick = round1(W + sagitta);
    // 弧峰在 part-local (0, +W/2+sagitta, 0)，弦端最低點在 (±L/2, -W/2, 0)
    // arch-bent bend 在 part-local Z 軸（width 方向），不是 Y。
    // 正視 FRONT 垂直軸 = local Z = visible.width。envelope = W + sagitta。
    const top = ctx.partLocalToSvg(0, 0, W / 2 + sagitta);
    const botL = ctx.partLocalToSvg(-chord / 2, 0, -W / 2);
    const botR = ctx.partLocalToSvg(+chord / 2, 0, -W / 2);
    // dim 線放在零件最左端外側 30px 處（SVG x-flip：取 min x 才是畫面左端）
    const leftSvgX = Math.min(top.x, botL.x, botR.x);
    const dimX = leftSvgX - 30;
    const bot = botL.y > botR.y ? botL : botR;
    const yLo = Math.min(top.y, bot.y);
    const yHi = Math.max(top.y, bot.y);
    const SZ = 3;
    const stroke = "#b45309";
    return (
      <g className="arch-bent-envelope">
        {/* 延伸線：弧峰水平延到 dimX */}
        <line
          x1={top.x}
          y1={top.y}
          x2={dimX}
          y2={top.y}
          stroke={stroke}
          strokeDasharray="3 2"
          strokeWidth={0.6}
        />
        {/* 延伸線：弦端水平延到 dimX */}
        <line
          x1={bot.x}
          y1={bot.y}
          x2={dimX}
          y2={bot.y}
          stroke={stroke}
          strokeDasharray="3 2"
          strokeWidth={0.6}
        />
        {/* dim 主線 */}
        <line
          x1={dimX}
          y1={yLo}
          x2={dimX}
          y2={yHi}
          stroke={stroke}
          strokeWidth={0.8}
        />
        {/* 上下向內箭頭 */}
        <polygon
          points={`${dimX},${yLo} ${dimX - SZ},${yLo + SZ + 1} ${dimX + SZ},${yLo + SZ + 1}`}
          fill={stroke}
        />
        <polygon
          points={`${dimX},${yHi} ${dimX - SZ},${yHi - SZ - 1} ${dimX + SZ},${yHi - SZ - 1}`}
          fill={stroke}
        />
        {/* 文字標籤：垂直置於 dim 線旁 */}
        <text
          x={dimX - 5}
          y={(yLo + yHi) / 2}
          textAnchor="end"
          dominantBaseline="middle"
          fill={stroke}
          fontWeight={600}
          fontSize={9}
        >
          毛料厚 ≥ {envThick}
        </text>
        <text
          x={dimX - 5}
          y={(yLo + yHi) / 2 + 11}
          textAnchor="end"
          dominantBaseline="middle"
          fill="#6b7280"
          fontSize={7}
        >
          （含弧高 {round1(sagitta)}）
        </text>
      </g>
    );
  }

  return null;
}

/**
 * <ApronTrapezoidDualEdge> — apron-trapezoid 上下邊雙標 + 端面斜角 + 切角。
 *
 * 牙條梯形（topLengthScale / bottomLengthScale）要木匠看清上邊跟下邊各多長，
 * top view 左上角同時標兩條邊長，bevelAngle 非 0 時加端面斜角度°。
 * 錐形腳家具：top/bot 長度不同 → 端面要切角才能貼合腳的斜面，
 * 補上「切角」= atan(|botL−topL|/2 / apronWidth)，木匠依此設斜切鋸刃角。
 *
 *   上邊長 = visible.length × topLengthScale（不含榫頭）
 *   下邊長 = visible.length × bottomLengthScale（不含榫頭）
 *   切角  = atan(|botL−topL|/2 / apronWidth)
 *   端面斜 = bevelAngle * 180/π （若 != 0）
 *
 * Spec: …phase-3 §1.3
 */
function ApronTrapezoidDualEdge({
  ctx,
  part,
  view,
}: {
  ctx: OrthoViewBoxCtx;
  part: Part;
  view: PartView;
}) {
  if (view !== "top") return null;
  if (part.shape?.kind !== "apron-trapezoid") return null;
  const shape = part.shape;
  const L = part.visible.length;
  const topL = L * (shape.topLengthScale ?? 1);
  const botL = L * (shape.bottomLengthScale ?? 1);
  const bevel = shape.bevelAngle ?? 0;
  const apronH = part.visible.width;
  const cutAngleDeg =
    apronH > 0
      ? (Math.atan(Math.abs(botL - topL) / 2 / apronH) * 180) / Math.PI
      : 0;

  const x0 = ctx.vbX + 14;
  const y0 = ctx.vbY + 42;

  let row = 0;
  return (
    <g className="apron-trap-dual" style={{ fontSize: 8 }}>
      <text x={x0} y={y0 + 10 * row++} fill="#9ca3af" fontSize={7}>
        ─ 淨長（不含榫頭）─
      </text>
      <text x={x0} y={y0 + 10 * row++} fill="#374151">
        上邊長 {round1(topL)}
      </text>
      <text x={x0} y={y0 + 10 * row++} fill="#374151">
        下邊長 {round1(botL)}
      </text>
      {cutAngleDeg > 0.05 && (
        <text x={x0} y={y0 + 10 * row++} fill="#b45309" fontWeight="bold">
          切角 {round1(cutAngleDeg)}°（鋸刃角）
        </text>
      )}
      {bevel !== 0 && (
        <text x={x0} y={y0 + 10 * row++} fill="#374151">
          端面斜 {round1((bevel * 180) / Math.PI)}°
        </text>
      )}
    </g>
  );
}

/**
 * <HoofDirection> — 明式馬蹄腳方向 + 轉折 Y（Phase 3 Task 4）。
 *
 * `hoof` shape：`hoofMm` (馬蹄高)、`hoofScale` (外撇倍率)、
 * `dirX`/`dirZ` ∈ {-1, 0, +1} 外撇方向。
 *
 * front + side view 角標：
 *   - 「腳趾朝右/左/前/後」中文（不寫變數名）
 *   - 「轉折 Y={hoofMm}」距底高度（從底往上量到 S 上半轉折點）
 *
 * 卡片底再加一行毛料厚建議（drawing.tsx）。
 *
 * Spec: …phase-3 §1.4
 */
function HoofDirection({
  ctx,
  part,
  view,
}: {
  ctx: OrthoViewBoxCtx;
  part: Part;
  view: PartView;
}) {
  if (view === "top") return null;
  if (part.shape?.kind !== "hoof") return null;
  const shape = part.shape;

  const dirX = shape.dirX ?? 0;
  const dirZ = shape.dirZ ?? 0;
  const hoofMm = shape.hoofMm ?? 0;

  const dirParts: string[] = [];
  if (dirX > 0) dirParts.push("右");
  if (dirX < 0) dirParts.push("左");
  if (dirZ > 0) dirParts.push("前");
  if (dirZ < 0) dirParts.push("後");
  const dirText = dirParts.length
    ? `腳趾朝${dirParts.join("")}`
    : "腳趾外撇";

  const x0 = ctx.vbX + 14;
  const y0 = ctx.vbY + 32;

  return (
    <g className="hoof-direction" style={{ fontSize: 8 }}>
      <text x={x0} y={y0} fill="#7c2d12" fontWeight="bold">
        {dirText}
      </text>
      <text x={x0} y={y0 + 10} fontSize={7} fill="#374151">
        轉折 Y={round1(hoofMm)}
      </text>
    </g>
  );
}

/**
 * <SplayedTrueLength> — 外斜腳真實長度 + 端面斜角（Phase 3 Task 5）。
 *
 * `splayed-tapered` / `splayed-round-tapered`：整支腳沿 length 軸傾斜，
 * 底面相對頂面在 part-local 偏移 (dxMm, dzMm)。
 *
 * front view 左下角標：
 *   - 真長 = √(L² + dx² + dz²)
 *   - 端面斜 = atan2(√(dx² + dz²), L) × 180/π （°）
 *   - splayed-round-tapered 多標頂徑/底徑（visible.width × bottomScale）
 *
 * 視覺長度 visible.length 是 chord（直線距離），真長要含偏移量。
 *
 * Spec: …phase-3 §1.5
 */
function SplayedTrueLength({
  ctx,
  part,
  view,
}: {
  ctx: OrthoViewBoxCtx;
  part: Part;
  view: PartView;
}) {
  if (view !== "front") return null;
  const kind = part.shape?.kind;
  // 擴大覆蓋：純 splayed 也要標（之前只標 splayed-tapered/splayed-round-tapered）
  if (
    kind !== "splayed" &&
    kind !== "splayed-tapered" &&
    kind !== "splayed-round-tapered"
  ) {
    return null;
  }
  const shape = part.shape!;
  // splayed family 長軸 = visible.thickness（不是 length）
  const L = part.visible.thickness;
  const dx = Math.abs((shape as { dxMm?: number }).dxMm ?? 0);
  const dz = Math.abs((shape as { dzMm?: number }).dzMm ?? 0);
  if (dx === 0 && dz === 0) return null;
  const realL = Math.sqrt(L * L + dx * dx + dz * dz);
  // 分軸 splay 角度（木工機台設定值用）
  const angleX = dx > 0 ? (Math.atan(dx / L) * 180) / Math.PI : 0;
  const angleZ = dz > 0 ? (Math.atan(dz / L) * 180) / Math.PI : 0;
  const isCompound = dx > 0 && dz > 0;

  const x0 = ctx.vbX + 14;
  const y0 = ctx.vbY + ctx.vbH - 56;
  const lineH = 9;

  // 機台設定值（木工實務優於投影角度）
  const splayType = isCompound ? "複斜" : dx > 0 ? "單斜（X 軸）" : "單斜（Z 軸）";

  return (
    <g className="splayed-true-length" style={{ fontSize: 7.5 }}>
      <text x={x0} y={y0} fontSize={8} fontWeight={600} fill="#111">
        {splayType}腳
      </text>
      <text x={x0} y={y0 + lineH * 1} fill="#374151">
        真長 {round1(realL)} mm
      </text>
      {dx > 0 && (
        <text x={x0} y={y0 + lineH * 2} fill="#6b7280">
          {isCompound ? "X-splay" : "傾角"} {round1(angleX)}°（鋸片傾斜）
        </text>
      )}
      {dz > 0 && (
        <text x={x0} y={y0 + lineH * 3} fill="#6b7280">
          {isCompound ? "Z-splay" : "傾角"} {round1(angleZ)}°（切割角度）
        </text>
      )}
      {(kind === "splayed-tapered" || kind === "splayed-round-tapered") && (
        <text x={x0} y={y0 + lineH * 4} fill="#6b7280">
          底錐縮 {round1((shape as { bottomScale: number }).bottomScale * 100)}%
        </text>
      )}
      {kind === "splayed-round-tapered" && (
        <text x={x0} y={y0 + lineH * 5} fill="#374151">
          頂徑 {round1(part.visible.width)} / 底徑{" "}
          {round1(part.visible.width * (shape as { bottomScale: number }).bottomScale)}
        </text>
      )}
    </g>
  );
}

/**
 * <DetailCallout> — Phase 5 多 detail + corner placement 版。
 *
 * 為複雜榫卯 part 在 front view 拉最多 3 個 2× zoom detail inset：
 *   - 觸發條件：≥2 mortises（全收）OR tenon length ≥ 40mm（填餘格）
 *   - 每個 feature 在 main view 圈紅圈 + 字母（A/B/C）
 *   - 每個 detail 用 corner-based collision avoidance：
 *     優先序 BR → TR → BL → TL，避撞 grain arrow 保留區與已放 inset
 *   - 50×50 inset：border + 「詳圖 X 2:1」 + 名稱 + 尺寸
 *   - dash leader 從 feature 圓邊拉到 inset 最近角
 *
 * Phase 5 升級自 Phase 3.5（單一 detail / 固定右下）。
 *
 * Spec: docs/superpowers/specs/2026-05-17-part-drawings-phase-3-5-design.md
 *       (Phase 5 extension — multi-detail corner placement)
 */
interface DetailTarget {
  kind: "mortise" | "tenon";
  idx: number;
  localBox: ReturnType<typeof mortiseLocalBox>;
  label: string; // "A" | "B" | "C"
}

function findDetailTargets(part: Part): DetailTarget[] {
  const labels = ["A", "B", "C"];
  const out: DetailTarget[] = [];

  // 1st priority: 所有 mortises（最多 3）
  if ((part.mortises?.length ?? 0) >= 2) {
    for (let i = 0; i < part.mortises.length && out.length < 3; i++) {
      out.push({
        kind: "mortise",
        idx: i,
        localBox: mortiseLocalBox(part, part.mortises[i]),
        label: labels[out.length],
      });
    }
  }

  // 2nd priority: 深 tenons (length ≥ 40mm) 填餘格
  for (let i = 0; i < (part.tenons ?? []).length && out.length < 3; i++) {
    const t = part.tenons[i];
    if ((t.length ?? 0) >= 40) {
      out.push({
        kind: "tenon",
        idx: i,
        localBox: tenonLocalBox(part, t),
        label: labels[out.length],
      });
    }
  }

  return out;
}

type Corner = "TL" | "TR" | "BR" | "BL";
// BR 優先（左下/右上次之，TL 留給 facing mark）
const CORNER_PRIORITY: Corner[] = ["BR", "TR", "BL", "TL"];

interface InsetPlacement {
  corner: Corner;
  x: number;
  y: number;
  w: number;
  h: number;
}

function placeInsets(
  ctx: OrthoViewBoxCtx,
  count: number,
): InsetPlacement[] {
  const W = 50;
  const H = 50;
  const pad = 6;
  // GrainArrow 在右下角 ~40×40 px 保留區（避免 inset 蓋上去）
  const grainReserve = {
    x: ctx.vbX + ctx.vbW - 45,
    y: ctx.vbY + ctx.vbH - 45,
    w: 40,
    h: 40,
  };

  const corners: Record<Corner, { x: number; y: number }> = {
    TL: { x: ctx.vbX + pad, y: ctx.vbY + pad + 18 }, // 讓出 facing mark 區
    TR: { x: ctx.vbX + ctx.vbW - W - pad, y: ctx.vbY + pad + 18 },
    BR: {
      x: ctx.vbX + ctx.vbW - W - pad,
      y: ctx.vbY + ctx.vbH - H - pad - 30,
    },
    BL: { x: ctx.vbX + pad, y: ctx.vbY + ctx.vbH - H - pad - 30 },
  };

  const placed: InsetPlacement[] = [];

  for (let i = 0; i < count; i++) {
    for (const c of CORNER_PRIORITY) {
      const pos = corners[c];
      const candidate: InsetPlacement = {
        corner: c,
        x: pos.x,
        y: pos.y,
        w: W,
        h: H,
      };
      // 避撞已放 inset
      const overlapsPlaced = placed.some(
        (p) =>
          !(
            candidate.x + candidate.w < p.x ||
            candidate.x > p.x + p.w ||
            candidate.y + candidate.h < p.y ||
            candidate.y > p.y + p.h
          ),
      );
      if (overlapsPlaced) continue;
      // 避撞 grain arrow 保留區
      const overlapsGrain = !(
        candidate.x + candidate.w < grainReserve.x ||
        candidate.x > grainReserve.x + grainReserve.w ||
        candidate.y + candidate.h < grainReserve.y ||
        candidate.y > grainReserve.y + grainReserve.h
      );
      if (overlapsGrain) continue;
      placed.push(candidate);
      break;
    }
    // 找不到 corner 就 skip（不渲染這個 detail）
  }

  return placed;
}

export function DetailCallout({
  ctx,
  part,
  view,
}: {
  ctx: OrthoViewBoxCtx;
  part: Part;
  view: PartView;
}) {
  if (view !== "front") return null;
  part = normalizePartForDrawing(part);
  const targets = findDetailTargets(part);
  if (!targets.length) return null;

  const placements = placeInsets(ctx, targets.length);

  // Project feature local box → SVG AABB → 中心 + 半徑
  function projectFeature(lb: DetailTarget["localBox"]) {
    const corners: Array<{ x: number; y: number }> = [];
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) {
          corners.push(
            ctx.partLocalToSvg(
              lb.cx + sx * lb.hx,
              lb.cy + sy * lb.hy,
              lb.cz + sz * lb.hz,
            ),
          );
        }
      }
    }
    const xs = corners.map((c) => c.x);
    const ys = corners.map((c) => c.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const fcx = (minX + maxX) / 2;
    const fcy = (minY + maxY) / 2;
    const r = Math.max((maxX - minX) / 2, (maxY - minY) / 2) * 1.3 + 1;
    return { cx: fcx, cy: fcy, r };
  }

  return (
    <g className="detail-callout">
      {targets.map((t, i) => {
        const p = placements[i];
        if (!p) return null; // 沒角落塞 → 不渲染
        const feature = projectFeature(t.localBox);

        const m = t.kind === "mortise" ? part.mortises[t.idx] : part.tenons[t.idx];
        const W = round1(m.width ?? 0);
        const L = round1(m.length ?? 0);
        // mortise: depth；tenon: thickness（斷面 T）
        const D = round1(
          t.kind === "mortise"
            ? (part.mortises[t.idx].depth ?? 0)
            : (part.tenons[t.idx].thickness ?? 0),
        );
        const targetName =
          t.kind === "mortise" ? `榫眼${t.idx + 1}` : `榫頭${t.idx + 1}`;
        // 正視圖榫頭 callout 不標榫厚（D 是 Z 方向，正視圖看不到，標出來會誤導
        // — 之前畫面上的「10」就是這個 D；榫厚請看材料單或側視圖）。
        // 貫穿孔標「穿」不標深（同 T2 dims；user 2026-06-11 托盤手把孔）
        const dimText =
          t.kind === "mortise"
            ? `${W}×${L} ${part.mortises[t.idx].through ? "穿" : `深${D}`}`
            : `${W} 長${L}`;

        // Leader: feature 圓邊朝 inset 中心方向 → inset 最近角
        const insetCx = p.x + p.w / 2;
        const insetCy = p.y + p.h / 2;
        const dx = insetCx - feature.cx;
        const dy = insetCy - feature.cy;
        const dist = Math.hypot(dx, dy) || 1;
        const lx1 = feature.cx + (dx / dist) * feature.r;
        const ly1 = feature.cy + (dy / dist) * feature.r;
        const fromLeft = lx1 < insetCx;
        const fromTop = ly1 < insetCy;
        const lx2 = fromLeft ? p.x : p.x + p.w;
        const ly2 = fromTop ? p.y : p.y + p.h;

        return (
          <g key={i}>
            {/* feature 圓圈 + 字母 */}
            <circle
              cx={feature.cx}
              cy={feature.cy}
              r={feature.r}
              fill="none"
              stroke="#dc2626"
              strokeWidth={0.8}
            />
            <text
              x={feature.cx + feature.r + 2}
              y={feature.cy - feature.r + 4}
              fontSize={7}
              fill="#dc2626"
              fontWeight="bold"
            >
              {t.label}
            </text>

            {/* leader */}
            <line
              x1={lx1}
              y1={ly1}
              x2={lx2}
              y2={ly2}
              stroke="#dc2626"
              strokeWidth={0.5}
              strokeDasharray="3 1.5"
            />

            {/* inset background */}
            <rect
              x={p.x}
              y={p.y}
              width={p.w}
              height={p.h}
              fill="white"
              stroke="#dc2626"
              strokeWidth={0.6}
            />

            {/* inset title */}
            <text
              x={p.x + 3}
              y={p.y + 9}
              fontSize={6}
              fill="#dc2626"
              fontWeight="bold"
            >
              {`詳圖 ${t.label} 2:1`}
            </text>

            {/* feature name + dims（text-only，避免幾何變換誤差） */}
            <text
              x={p.x + p.w / 2}
              y={p.y + p.h / 2}
              fontSize={6.5}
              fill="#374151"
              textAnchor="middle"
            >
              {targetName}
            </text>
            <text
              x={p.x + p.w / 2}
              y={p.y + p.h / 2 + 9}
              fontSize={5.5}
              fill="#374151"
              textAnchor="middle"
              fontFamily="monospace"
            >
              {dimText}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/**
 * <CompoundMiterLabel> — 單一複斜切角度文字 primitive。
 *
 * 用於有 tilted axis 的公榫（compound splay，見 2026-05-18-compound-splay-tenon-axis）。
 * side="start" → 文字靠左對齊；side="end" → 靠右對齊。
 */
export function CompoundMiterLabel({
  x,
  y,
  primaryDeg,
  secondaryDeg,
  side,
  endLabel,
}: {
  x: number;
  y: number;
  primaryDeg: number;
  secondaryDeg: number;
  side: "start" | "end";
  /** 自訂端面標籤（「起端」/「尾端」/「頂端」/「底端」），不傳則依 side 用「起/尾」 */
  endLabel?: string;
}) {
  const hasPrimary = primaryDeg >= 0.5;
  const hasSecondary = secondaryDeg >= 0.5;
  if (!hasPrimary && !hasSecondary) return null;
  const prefix = endLabel ?? (side === "start" ? "起端" : "尾端");
  const text =
    hasPrimary && hasSecondary
      ? `${prefix}複斜切　寬面 ${primaryDeg.toFixed(1)}°　窄面 ${secondaryDeg.toFixed(1)}°`
      : hasPrimary
        ? `${prefix}單斜　寬面 ${primaryDeg.toFixed(1)}°`
        : `${prefix}單斜　窄面 ${secondaryDeg.toFixed(1)}°`;
  return (
    <g transform={`translate(${x},${y})`} className="compound-miter-label">
      <text
        fontSize={3.5}
        fill="#222"
        textAnchor={side === "start" ? "start" : "end"}
      >
        {text}
      </text>
    </g>
  );
}

/**
 * <CompoundMiterAnnotation> — 在 front view 兩端標出 tilted-axis 公榫的複斜角。
 *
 * 對每個 `part.tenons` 中具有 `axis` 的榫頭（compound splay），分解 axis 成：
 *   primary  = atan2(axis.y, |axis.x|)  寬面斜（length × width 平面）
 *   secondary = atan2(axis.z, |axis.x|)  窄面斜（length × thickness 平面）
 *
 * 標籤位置以 part outline 端點（±L/2, ±T/2）轉 SVG，再上移 8px 留間距。
 * start 在 SVG 右側（vx = -wx 翻轉）、end 在 SVG 左側。
 */
export function CompoundMiterAnnotation({
  ctx,
  part,
  view,
}: {
  ctx: OrthoViewBoxCtx;
  part: Part;
  view: PartView;
}) {
  if (view !== "front") return null;
  if (!part.tenons || part.tenons.length === 0) return null;
  const tilted = part.tenons.filter((t) => t.axis);
  if (tilted.length === 0) return null;

  const L = part.visible.length;
  const T = part.visible.thickness;

  return (
    <g className="compound-miter-annotations">
      {tilted.map((t, i) => {
        const ax = t.axis!;
        const isEnd = t.position === "end";
        const isStart = t.position === "start";
        const isTop = t.position === "top";
        const isBottom = t.position === "bottom";

        let primaryDeg: number;
        let secondaryDeg: number;
        let labelX: number;
        let labelY: number;
        let side: "start" | "end";
        let endLabel: string;

        if (isEnd || isStart) {
          // 沿 length 軸（X major）
          primaryDeg = Math.abs((Math.atan2(ax.y, Math.abs(ax.x)) * 180) / Math.PI);
          secondaryDeg = Math.abs((Math.atan2(ax.z, Math.abs(ax.x)) * 180) / Math.PI);
          // X：從 part 邊角往內縮 6mm，讓文字主體留在 frame 內側、不貼到右邊界
          // Y：從 part 底邊外推 45mm（原 28mm），讓出 T2 tenon length dim「30」
          //   chain 空間（user 2026-05-21 回報蓋到尺寸）
          const localX = isEnd ? +L / 2 - 6 : -L / 2 + 6;
          const bottom = ctx.partLocalToSvg(localX, -T / 2, 0);
          labelX = bottom.x;
          labelY = bottom.y + 45;
          side = isEnd ? "end" : "start";
          endLabel = isEnd ? "尾端" : "起端";
        } else if (isTop || isBottom) {
          // 沿 thickness 軸（Y major，垂直榫如後柱底榫）
          primaryDeg = Math.abs((Math.atan2(ax.x, Math.abs(ax.y)) * 180) / Math.PI);
          secondaryDeg = Math.abs((Math.atan2(ax.z, Math.abs(ax.y)) * 180) / Math.PI);
          if (isTop) {
            const topPt = ctx.partLocalToSvg(0, +T / 2, 0);
            labelX = topPt.x + L * 0.4;
            labelY = topPt.y - (t.length + 18);
            side = "end";
            endLabel = "頂端";
          } else {
            const botPt = ctx.partLocalToSvg(0, -T / 2, 0);
            labelX = botPt.x + L * 0.4;
            labelY = botPt.y + (t.length + 28);
            side = "end";
            endLabel = "底端";
          }
        } else {
          return null;
        }

        return (
          <CompoundMiterLabel
            key={`${part.id}-miter-${t.position}-${i}`}
            x={labelX}
            y={labelY}
            primaryDeg={primaryDeg}
            secondaryDeg={secondaryDeg}
            side={side}
            endLabel={endLabel}
          />
        );
      })}
    </g>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// <ChamferRoundAnnotation> — 倒角 / 圓角角度標
//
// 偵測 part.shape 含 chamferMm 的 shape kind（splayed / round / chamfered-top
// / chamfered-edges / mitered-corner 等），在 silhouette 一角加 leader + 標籤
// 「C5」(45° chamfer 5mm) 或 「R5」(rounded edge 5mm)。木工慣例優於 CAD 的
// 「5×45°」寫法。
// ─────────────────────────────────────────────────────────────────────────────

interface ChamferInfo {
  mm: number;
  style: "chamfered" | "rounded";
  source: string; // shape kind 來源
}

function extractChamfer(part: Part): ChamferInfo | null {
  const s = part.shape;
  if (!s) return null;
  switch (s.kind) {
    case "splayed":
    case "round": {
      const mm = s.chamferMm ?? 0;
      if (mm <= 0) return null;
      return { mm, style: s.chamferStyle ?? "chamfered", source: s.kind };
    }
    case "chamfered-top":
    case "chamfered-edges":
      if (s.chamferMm <= 0) return null;
      return { mm: s.chamferMm, style: s.style ?? "chamfered", source: s.kind };
    case "mitered-corner": {
      const mm = s.chamferMm ?? 0;
      if (mm <= 0) return null;
      return { mm, style: "chamfered", source: "mitered-corner" };
    }
    default:
      return null;
  }
}

export function ChamferRoundAnnotation({
  ctx,
  part,
  view,
}: {
  ctx: OrthoViewBoxCtx;
  part: Part;
  view: PartView;
}) {
  const info = extractChamfer(part);
  if (!info) return null;
  // 只在 front view 標一次（避免三 view 重複）
  if (view !== "front") return null;

  // 找 part 在 view 內的右上角，放 leader 朝右上斜出去 + 標籤
  const lx = part.visible.length;
  const ly = part.visible.thickness;
  const lz = part.visible.width;
  const corner = ctx.partLocalToSvg(lx / 2, ly / 2, lz / 2);
  const leaderEndX = corner.x + 22;
  const leaderEndY = corner.y - 14;
  const label = info.style === "rounded"
    ? `R${Math.round(info.mm)}`
    : `C${Math.round(info.mm)}`;

  return (
    <g className="chamfer-annotation">
      {/* Leader 細線從倒角角落往外斜引出 */}
      <line
        x1={corner.x - 2}
        y1={corner.y + 2}
        x2={leaderEndX}
        y2={leaderEndY}
        stroke="#222"
        strokeWidth={0.3}
      />
      {/* 標籤 */}
      <text
        x={leaderEndX + 2}
        y={leaderEndY + 3}
        fontSize={10}
        fill="#111"
        fontFamily="sans-serif"
        fontWeight={600}
      >
        {label}
      </text>
    </g>
  );
}

/**
 * <SawSetupTable> — 複斜腳「桌鋸設定表」（Phase 4 W5）。
 *
 * 依 docs/research/compound-splay-leg-drawing-refs.md W5 結論：
 *   - 表頭：[切割 | 鋸片傾角 | 米角機台]
 *   - 兩列：腳頂 / 腳底（同數值，腳底鏡像）
 *   - 鋸片傾角 = atan(dx / T)（朝 X 方向 splay 分量）
 *   - 米角機台 = atan(dz / T)（朝 Z 方向 splay 分量）
 *   - 表格下方附 TL（真實長度）公式提示
 *
 * 只在 front view、且 splayed 家族 + 有偏移時顯示。
 * 位置：viewBox 內、靠左下、與 SplayedTrueLength 文字塊不重疊（往右偏移）。
 *
 * Ref: docs/research/compound-splay-leg-drawing-refs.md §2
 */
export function SawSetupTable({
  ctx,
  part,
  view,
}: {
  ctx: OrthoViewBoxCtx;
  part: Part;
  view: PartView;
}) {
  if (view !== "front") return null;
  const sh = part.shape;
  if (
    !sh ||
    (sh.kind !== "splayed" &&
      sh.kind !== "splayed-tapered" &&
      sh.kind !== "splayed-round-tapered")
  ) {
    return null;
  }
  const dx = Math.abs((sh as { dxMm?: number }).dxMm ?? 0);
  const dz = Math.abs((sh as { dzMm?: number }).dzMm ?? 0);
  if (dx === 0 && dz === 0) return null;

  // splayed family 長軸 = visible.thickness
  const T = part.visible.thickness;
  const bladeTilt = T > 0 ? (Math.atan(dx / T) * 180) / Math.PI : 0;
  const miterAngle = T > 0 ? (Math.atan(dz / T) * 180) / Math.PI : 0;
  const realL = Math.sqrt(T * T + dx * dx + dz * dz);

  // 表格放在 viewBox 右下角，避開 SplayedTrueLength（左下）+ GrainArrow（右下角小區）
  // 表寬 70mm × 4 行 × 行高 6mm
  const colW = [18, 22, 22]; // 切割 / 鋸片傾角 / 米角機台
  const tableW = colW[0] + colW[1] + colW[2];
  const rowH = 6;
  const headerH = 6;
  const titleH = 7;
  const footerH = 6;
  const tableH = titleH + headerH + rowH * 2 + footerH;

  // 放右下角（避開 grain arrow 預留區 ~40×40：往上推 + 靠左）
  const x0 = ctx.vbX + ctx.vbW - tableW - 50;
  const y0 = ctx.vbY + ctx.vbH - tableH - 8;

  const xCol1 = x0 + colW[0];
  const xCol2 = xCol1 + colW[1];
  const xEnd = x0 + tableW;

  const yTitle = y0 + titleH - 1;
  const yHeader = y0 + titleH + headerH - 1;
  const yRow1 = yHeader + rowH;
  const yRow2 = yRow1 + rowH;
  const yFooter = yRow2 + footerH - 1;

  const lineTop = y0 + titleH;
  const lineHeader = y0 + titleH + headerH;
  const lineRow1 = lineHeader + rowH;
  const lineRow2 = lineRow1 + rowH;

  const fmt = (n: number) => `${round1(n)}°`;

  return (
    <g className="saw-setup-table" fontFamily="sans-serif">
      {/* 標題 */}
      <text
        x={x0 + tableW / 2}
        y={yTitle}
        fontSize={4}
        fontWeight={700}
        textAnchor="middle"
        fill="#111"
      >
        桌鋸設定
      </text>
      {/* 外框 */}
      <rect
        x={x0}
        y={lineTop}
        width={tableW}
        height={headerH + rowH * 2}
        fill="#fff"
        stroke="#222"
        strokeWidth={0.3}
      />
      {/* 直線分欄 */}
      <line
        x1={xCol1}
        y1={lineTop}
        x2={xCol1}
        y2={lineRow2}
        stroke="#222"
        strokeWidth={0.3}
      />
      <line
        x1={xCol2}
        y1={lineTop}
        x2={xCol2}
        y2={lineRow2}
        stroke="#222"
        strokeWidth={0.3}
      />
      {/* 橫線分列 */}
      <line
        x1={x0}
        y1={lineHeader}
        x2={xEnd}
        y2={lineHeader}
        stroke="#222"
        strokeWidth={0.3}
      />
      <line
        x1={x0}
        y1={lineRow1}
        x2={xEnd}
        y2={lineRow1}
        stroke="#222"
        strokeWidth={0.3}
      />
      {/* 表頭 */}
      <text
        x={x0 + colW[0] / 2}
        y={yHeader - 1.5}
        fontSize={3.2}
        fontWeight={600}
        textAnchor="middle"
        fill="#111"
      >
        切割
      </text>
      <text
        x={xCol1 + colW[1] / 2}
        y={yHeader - 1.5}
        fontSize={3.2}
        fontWeight={600}
        textAnchor="middle"
        fill="#111"
      >
        鋸片傾角
      </text>
      <text
        x={xCol2 + colW[2] / 2}
        y={yHeader - 1.5}
        fontSize={3.2}
        fontWeight={600}
        textAnchor="middle"
        fill="#111"
      >
        米角機台
      </text>
      {/* row1 — 腳頂 */}
      <text
        x={x0 + colW[0] / 2}
        y={yRow1 - 1.5}
        fontSize={3.2}
        textAnchor="middle"
        fill="#374151"
      >
        腳頂
      </text>
      <text
        x={xCol1 + colW[1] / 2}
        y={yRow1 - 1.5}
        fontSize={3.2}
        textAnchor="middle"
        fill="#374151"
      >
        {fmt(bladeTilt)}
      </text>
      <text
        x={xCol2 + colW[2] / 2}
        y={yRow1 - 1.5}
        fontSize={3.2}
        textAnchor="middle"
        fill="#374151"
      >
        {fmt(miterAngle)}
      </text>
      {/* row2 — 腳底（鏡像，數值相同） */}
      <text
        x={x0 + colW[0] / 2}
        y={yRow2 - 1.5}
        fontSize={3.2}
        textAnchor="middle"
        fill="#374151"
      >
        腳底
      </text>
      <text
        x={xCol1 + colW[1] / 2}
        y={yRow2 - 1.5}
        fontSize={3.2}
        textAnchor="middle"
        fill="#374151"
      >
        {fmt(bladeTilt)}
      </text>
      <text
        x={xCol2 + colW[2] / 2}
        y={yRow2 - 1.5}
        fontSize={3.2}
        textAnchor="middle"
        fill="#374151"
      >
        {fmt(miterAngle)}
      </text>
      {/* 註腳：TL 公式 + 鏡像提醒 */}
      <text x={x0} y={yFooter} fontSize={2.8} fill="#6b7280">
        TL={round1(realL)}mm｜腳底與腳頂鏡像
      </text>
    </g>
  );
}
