/**
 * paper-fit.ts — A4 landscape paper fit + CNS standard scale tree
 *
 * 規格（Step 1 + Step 2）：
 *   - 紙張固定 A4 横式：viewBox 0 0 297 210（mm）
 *   - 主繪圖區（drawing area）：x∈[10, 287]，y∈[24, 180]（267×156 mm）
 *   - title bar：y∈[8, 20]
 *   - title block：y∈[182, 202]
 *   - 候選比例（CNS）：1 / 2 / 5 / 10 / 20
 *   - dim chain padding：H≈35mm（水平），V≈25mm（垂直）
 *   - 三 view（front/top/side）共用同一比例 n（取 max）
 *   - 都不滿足 → scale=20 + needBrokenView=true
 *
 * Spec：partLocalToSvg 仍輸出 mm，SVG 內用 <g transform="scale(1/n)"> 包覆。
 */

import type { Part } from "@/lib/types";
import { worldExtents } from "@/lib/render/geometry";

// A4 横式紙面常數（mm）
export const A4_PAPER = {
  W: 297,
  H: 210,
  DRAW_X_LO: 10,
  DRAW_X_HI: 287, // 287-10 = 277mm
  DRAW_Y_LO: 24,
  DRAW_Y_HI: 180, // 180-24 = 156mm
  TITLE_BAR_Y_LO: 8,
  TITLE_BAR_Y_HI: 20,
  TITLE_BLOCK_Y_LO: 182,
  TITLE_BLOCK_Y_HI: 202,
} as const;

// 主繪圖區可用 mm
export const DRAW_AREA_W = A4_PAPER.DRAW_X_HI - A4_PAPER.DRAW_X_LO; // 277
export const DRAW_AREA_H = A4_PAPER.DRAW_Y_HI - A4_PAPER.DRAW_Y_LO; // 156

// dim chain padding（紙上 mm）
export const DIM_CHAIN_PAD_H = 35; // 水平方向左右共 35mm（給 dim line + 文字）
export const DIM_CHAIN_PAD_V = 25; // 垂直方向上下共 25mm

// 實際可放 part 投影的紙上區域（扣除 dim padding）
export const FIT_W = DRAW_AREA_W - DIM_CHAIN_PAD_H; // 242
export const FIT_H = DRAW_AREA_H - DIM_CHAIN_PAD_V; // 131

// CNS 標準比例樹（denominator）
const SCALE_CANDIDATES = [1, 2, 5, 10, 20] as const;

export type PartView = "front" | "top" | "side";

/**
 * Isolation 模式會把 part 的長軸旋轉到 world X（橫躺正規製圖）。
 * 此函式回傳「isolation 後」的 xExt/yExt/zExt，給 paper-fit 跟 paper-sheet
 * 用同一套座標計算 L 佈局，避免 layout 算法跟實際渲染對不上。
 *
 * 對應 svg-views.tsx 內 isolation rotation 邏輯（thickness 最長 → rot.z=-π/2,
 * width 最長 → rot.y=-π/2）。
 */
export function getIsolatedExtents(part: Part): { xExt: number; yExt: number; zExt: number } {
  const L = part.visible.length;
  const T = part.visible.thickness;
  const W = part.visible.width;
  // 預設（length 最長）→ xExt=L, yExt=T, zExt=W
  let xExt = L, yExt = T, zExt = W;
  if (T > L && T >= W) {
    // rotation.z=-π/2: local Y → world X，local X → world -Y（swap X↔Y）
    [xExt, yExt] = [yExt, xExt];
  } else if (W > L && W > T) {
    // rotation.y=-π/2: local Z → world X（swap X↔Z）
    [xExt, zExt] = [zExt, xExt];
  }
  // splay extension：splayed* shape 底面相對頂面有 dxMm/dzMm 偏移，
  // silhouette 會延伸到 box bbox 之外（平行四邊形/梯形端面斜伸）。
  // paper-fit 不補的話 viewport 會撐爆相鄰 view。
  // 簡化：用「軸對齐 upper bound」三軸都加 max(|dx|,|dz|)，
  // 避免在 isolation rotation 後算錯軸別（rotation 可能把 dx 映到任一軸）。
  const sh = part.shape as { kind?: string; dxMm?: number; dzMm?: number } | undefined;
  if (
    sh &&
    (sh.kind === "splayed" ||
      sh.kind === "splayed-tapered" ||
      sh.kind === "splayed-round-tapered")
  ) {
    const dx = Math.abs(sh.dxMm ?? 0);
    const dz = Math.abs(sh.dzMm ?? 0);
    const splayMax = Math.max(dx, dz);
    if (splayMax > 0) {
      xExt += splayMax;
      yExt += splayMax;
      zExt += splayMax;
    }
  }
  return { xExt, yExt, zExt };
}

/** 取某 view 在 isolation 旋轉後 part-local mm 下的水平/垂直 needed extent。 */
export function projectExtentForView(part: Part, view: PartView): { w: number; h: number } {
  const we = getIsolatedExtents(part);
  // front view: horizontal = X, vertical = Y
  // top view:   horizontal = X, vertical = Z
  // side view:  horizontal = Z, vertical = Y
  if (view === "front") return { w: we.xExt, h: we.yExt };
  if (view === "top") return { w: we.xExt, h: we.zExt };
  return { w: we.zExt, h: we.yExt };
}

export interface PaperFitResult {
  scale: number;
  needBrokenView: boolean;
  /** 三 view 各自的 needed (w, h) — debug/工具用。 */
  views: Record<PartView, { w: number; h: number }>;
}

/** L 佈局 view 間隔（紙上 mm，view 之間的留白） */
export const L_LAYOUT_GAP = 14;
/** L 佈局每個 view 周圍 dim chain 預留量（part-local mm）— H_OFFSET 30 + GROSS_GAP 14 + text + safety */
export const L_LAYOUT_CHAIN_PAD = 35;

/**
 * 找到能讓 L 佈局（TOP 上 + FRONT 下 + SIDE 右）整體 fit 進 DRAW_AREA 的最小 CNS 比例 n。
 * L 佈局總寬 = fW + sW + gap + chain_pad_paper*4（左右兩端 + 中間 view 邊界）
 * L 佈局總高 = tH + fH + gap + chain_pad_paper*4
 * 若 1:20 仍超出，回 { scale: 20, needBrokenView: true }。
 */
export function pickScaleForPaper(part: Part): PaperFitResult {
  const views = {
    front: projectExtentForView(part, "front"),
    top: projectExtentForView(part, "top"),
    side: projectExtentForView(part, "side"),
  };
  // L 佈局水平 = front 寬 + side 寬 + gap + chain pad 兩端
  // L 佈局垂直 = top 高 + front 高 + gap + chain pad 上下
  for (const n of SCALE_CANDIDATES) {
    const fW = views.front.w / n;
    const fH = views.front.h / n;
    const tH = views.top.h / n;
    const sW = views.side.w / n;
    const padPaper = L_LAYOUT_CHAIN_PAD / n; // 紙上每邊 chain pad
    // L 佈局 bbox（跟 paper-sheet 一致：兩端+中間 view 邊界共 4 條 chain pad）
    const lLayoutW = fW + sW + L_LAYOUT_GAP + padPaper * 4;
    const lLayoutH = tH + fH + L_LAYOUT_GAP + padPaper * 4;
    // DRAW_AREA_H 扣 5mm 給比例尺+第三角法符號（y=178-185 區）
    if (lLayoutW <= DRAW_AREA_W && lLayoutH <= DRAW_AREA_H - 5) {
      return { scale: n, needBrokenView: false, views };
    }
  }
  return { scale: 20, needBrokenView: true, views };
}

/**
 * 在 A4 紙面上，把某 view 對應的繪圖區「子矩形」回傳（mm）。
 * 三 view 在主繪圖區裡的位置（簡化版：row 排列由 PartDrawing 安排，
 * OrthoView 只負責自己這張紙）。本函式提供「主繪圖區中心」給 OrthoView 用。
 */
export function drawAreaCenter(): { cx: number; cy: number } {
  return {
    cx: (A4_PAPER.DRAW_X_LO + A4_PAPER.DRAW_X_HI) / 2,
    cy: (A4_PAPER.DRAW_Y_LO + A4_PAPER.DRAW_Y_HI) / 2,
  };
}
