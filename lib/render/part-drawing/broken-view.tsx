/**
 * broken-view.tsx — Step 3 中斷視圖（broken view）
 *
 * 觸發：pickScaleForPaper 回 needBrokenView=true（1:20 仍超出紙張）。
 * 只對「水平投影最長的 view」中斷——根據 view，水平軸對應 part-local 軸不同：
 *   front view → 水平 = local X（length 在 rotation 後落到 world X）
 *   top view   → 水平 = local X
 *   side view  → 水平 = local Z
 *
 * 但 part 已被 rotation 過（OrthoView isolate 模式 thickness/width 最長時會繞 z 或 y）
 * 所以我們用「worldExtents 最大邊」+ 直接在 world 座標系做中斷。
 *
 * 切法（world mm）：
 *   - 兩端各保留 endKeep = max(80mm, L_world × 0.15)
 *   - 中間 gap 紙上 24mm（除以 scale 即 world mm）
 *   - silhouette 切割：用 <clipPath>（不改 path data）
 *
 * 波浪線符號：兩條垂直波浪線在 gap 左右邊界。
 */

import React from "react";
import type { Part } from "@/lib/types";
import { worldExtents } from "@/lib/render/geometry";

export type PartView = "front" | "top" | "side";

export interface BrokenViewSpec {
  /** 是否切割這個 view。 */
  active: boolean;
  /** part-world 座標下，左端 keep 區的 X 範圍。 */
  leftLo: number;
  leftHi: number;
  /** part-world 座標下，右端 keep 區的 X 範圍。 */
  rightLo: number;
  rightHi: number;
  /** part 全長（world mm，沿水平軸）。 */
  fullLength: number;
  /** part 在垂直方向的高度（用來畫 clip rect）。 */
  vertHeight: number;
  /** Gap 紙上寬（mm）— 由 scale 決定 world mm = paperGap × scale。 */
  paperGapMm: number;
  /** Gap 在 part-world 座標的中點 X。 */
  gapCenterX: number;
  /** Gap 在 part-world 座標的寬度（world mm）。 */
  gapWorldMm: number;
  /** 對應到哪個 view（front/top/side）。 */
  view: PartView;
}

/**
 * 判斷某 view 是否需要中斷，並算出切割範圍（part-world 座標 mm）。
 *
 * 水平軸對應：
 *   front/top view：水平 = world X
 *   side view：水平 = world Z
 *
 * 垂直軸對應：
 *   front/side view：垂直 = world Y
 *   top view：垂直 = world Z
 */
export function computeBrokenViewSpec(
  part: Part,
  view: PartView,
  scale: number,
  needBrokenView: boolean,
): BrokenViewSpec {
  const we = worldExtents(part);
  const horiz = view === "side" ? we.zExt : we.xExt;
  const vert = view === "top" ? we.zExt : we.yExt;
  if (!needBrokenView) {
    return {
      active: false,
      leftLo: -horiz / 2,
      leftHi: horiz / 2,
      rightLo: -horiz / 2,
      rightHi: horiz / 2,
      fullLength: horiz,
      vertHeight: vert,
      paperGapMm: 0,
      gapCenterX: 0,
      gapWorldMm: 0,
      view,
    };
  }
  const endKeep = Math.max(80, horiz * 0.15);
  const paperGapMm = 24; // 紙上 mm
  const gapWorldMm = paperGapMm * scale; // world mm
  // 中心線左右各 endKeep；gap 在中段
  const leftLo = -horiz / 2;
  const leftHi = -gapWorldMm / 2;
  const rightLo = gapWorldMm / 2;
  const rightHi = horiz / 2;
  // 保留量檢查：endKeep 若超出 leftHi-leftLo，自動 clamp
  const leftHiClamped = Math.min(leftHi, leftLo + endKeep);
  const rightLoClamped = Math.max(rightLo, rightHi - endKeep);
  return {
    active: true,
    leftLo,
    leftHi: leftHiClamped,
    rightLo: rightLoClamped,
    rightHi,
    fullLength: horiz,
    vertHeight: vert,
    paperGapMm,
    gapCenterX: 0,
    gapWorldMm,
    view,
  };
}

/**
 * 波浪線元件 — 兩條垂直波浪線在 gap 左右邊界。
 * x: 紙上 mm 位置；y0/y1: 紙上 mm 起末垂直範圍；stroke 0.4mm。
 */
export function BreakWaveLine({
  x,
  y0,
  y1,
  stroke = "#222",
}: {
  x: number;
  y0: number;
  y1: number;
  stroke?: string;
}) {
  const amp = 1.5; // 波幅 mm
  const seg = 4; // 每段高度 mm
  const n = Math.max(2, Math.ceil((y1 - y0) / seg));
  let d = `M ${x} ${y0}`;
  for (let i = 0; i < n; i++) {
    const yMid = y0 + (i + 0.5) * ((y1 - y0) / n);
    const yEnd = y0 + (i + 1) * ((y1 - y0) / n);
    const dir = i % 2 === 0 ? +1 : -1;
    d += ` Q ${x + dir * amp} ${yMid} ${x} ${yEnd}`;
  }
  return <path d={d} stroke={stroke} strokeWidth={0.4} fill="none" />;
}
