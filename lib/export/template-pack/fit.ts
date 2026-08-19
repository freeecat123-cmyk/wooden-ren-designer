// 1:1 樣板的選紙與擺放。允許把零件轉角度（含斜擺）以塞進較小的紙。
import { PAPERS, SHEET_MARGIN_MM, type PaperSpec } from "./paper";

export interface Placement {
  paper: PaperSpec;
  /** 內容要旋轉的角度（度，0 = 水平擺）。 */
  angleDeg: number;
  /** true = 紙張直放（短邊在下），false = 橫放。 */
  swapped: boolean;
}

/** 掃描步進（度）。1° 已足夠，再細沒有實際效益。 */
const ANGLE_STEP = 1;

/**
 * 找出零件 w×h 在單張紙上塞得下的最小角度。
 * 判定用旋轉後的軸對齊外框：
 *   bw = w·cosθ + h·sinθ
 *   bh = w·sinθ + h·cosθ
 * 紙張直放橫放都試（swapped）。
 */
function placeOnPaper(w: number, h: number, paper: PaperSpec): Placement | null {
  const W = paper.w - SHEET_MARGIN_MM * 2;
  const H = paper.h - SHEET_MARGIN_MM * 2;
  // 浮點容差：287 = 287 這種剛好相等的情況要算塞得下
  const EPS = 1e-6;
  for (let deg = 0; deg <= 90; deg += ANGLE_STEP) {
    const t = (deg * Math.PI) / 180;
    const bw = w * Math.cos(t) + h * Math.sin(t);
    const bh = w * Math.sin(t) + h * Math.cos(t);
    if (bw <= W + EPS && bh <= H + EPS) return { paper, angleDeg: deg, swapped: false };
    if (bw <= H + EPS && bh <= W + EPS) return { paper, angleDeg: deg, swapped: true };
  }
  return null;
}

/**
 * 沿紙張階梯由小到大找第一個塞得下的擺法。
 * 整條階梯都塞不下回 null —— 呼叫端據此把該零件歸類為「退回比例零件圖」。
 */
export function placeOnLadder(
  w: number,
  h: number,
  ladder: readonly PaperSpec[] = PAPERS,
): Placement | null {
  for (const paper of ladder) {
    const hit = placeOnPaper(w, h, paper);
    if (hit) return hit;
  }
  return null;
}
