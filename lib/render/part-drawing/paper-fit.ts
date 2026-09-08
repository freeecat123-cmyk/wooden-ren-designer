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
import { tenonLocalBox } from "@/lib/render/svg-views";

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
// 1:2.5 是 CNS 3／JIS Z 8314 允許的縮尺：沒有它，350×120 的檢定側板在 A4 只能掉到 1:5（字 <2mm 看不清；2026-09-08 零件圖審查）
const SCALE_CANDIDATES = [1, 2, 2.5, 5, 10, 20] as const;

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

/**
 * Isolation 後，榫頭凸出零件本體的量（world 軸，mm；每軸取兩側較大者、不分正負）。
 *
 * T1 的「厚／寬」垂直標籤是從**含榫**邊緣往外 VERT_OFFSET 再放字，而 L 佈局的 chain pad
 * 只按本體算 → 榫頭愈長、標籤愈往鄰居視圖裡鑽（c1 上層板／c2 門橫檔的「厚 18」壓進側視圖；
 * 2026-09-08 零件圖審查 v3 遺留項）。paper-sheet 用這個把凸出量補進視圖間距。
 * 軸對應同 getIsolatedExtents（thickness 最長 swap X↔Y、width 最長 swap X↔Z）。
 */
export function getIsolatedTenonProtrusion(part: Part): {
  x: number; y: number; z: number;
  /** 兩側凸出量相加（鏡射不變，給 pickScaleForPaper 算總寬高；單側有榫的件不會被多算一支） */
  xTotal: number; yTotal: number; zTotal: number;
} {
  const L = part.visible.length;
  const T = part.visible.thickness;
  const W = part.visible.width;
  // [neg, pos] 各側凸出量（part-local）
  const px = [0, 0], py = [0, 0], pz = [0, 0];
  for (const t of part.tenons ?? []) {
    if (!(t.length > 0)) continue;
    const lb = tenonLocalBox(part, t);
    const side = (c: number, h: number, half: number, acc: number[]) => {
      const lo = -(c - h) - half; // 往負側凸出
      const hi = c + h - half; // 往正側凸出
      acc[0] = Math.max(acc[0], lo);
      acc[1] = Math.max(acc[1], hi);
    };
    side(lb.cx, lb.hx, L / 2, px);
    side(lb.cy, lb.hy, T / 2, py);
    side(lb.cz, lb.hz, W / 2, pz);
  }
  let ax = px, ay = py, az = pz;
  if (T > L && T >= W) [ax, ay] = [ay, ax];
  else if (W > L && W > T) [ax, az] = [az, ax];
  const mx = (a: number[]) => Math.max(a[0], a[1]);
  const tot = (a: number[]) => a[0] + a[1];
  return { x: mx(ax), y: mx(ay), z: mx(az), xTotal: tot(ax), yTotal: tot(ay), zTotal: tot(az) };
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
  // 榫頭凸出：T1 從含榫邊緣往外標，本體剛好塞滿紙面的件（c1 上層板 264 本體／320 含榫）會把「厚 18」
  // 擠進側視圖、側視圖的「厚 18」擠出繪圖區 → 比例判斷把凸出量算進去（2026-09-08 零件圖審查 v3 遺留項）。
  const prot = getIsolatedTenonProtrusion(part);
  for (const n of SCALE_CANDIDATES) {
    const fW = views.front.w / n;
    const fH = views.front.h / n;
    const tH = views.top.h / n;
    const sW = views.side.w / n;
    const padPaper = L_LAYOUT_CHAIN_PAD / n; // 紙上每邊 chain pad
    // L 佈局 bbox（跟 paper-sheet 一致：兩端+中間 view 邊界共 4 條 chain pad）
    // 凸出量先吃掉半個 chain pad 才開始算（pad 本來就留給 dim 線）：不然本體剛好塞滿的大板
    // （衣櫃側板 1:10 差 2mm、展示櫃頂板 1:5 差 2mm）會為了幾 mm 直接跳一級，字縮一半。
    const protW = Math.max(0, (prot.xTotal + prot.zTotal) / n - padPaper / 2);
    const protH = Math.max(0, (prot.yTotal + prot.zTotal) / n - padPaper / 2);
    const lLayoutW = fW + sW + L_LAYOUT_GAP + padPaper * 4 + protW;
    const lLayoutH = tH + fH + L_LAYOUT_GAP + padPaper * 4 + protH;
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
