import type { Part } from "@/lib/types";

/**
 * 圓木釘的「直徑 × 長度」——照 `shape.axis` 取：軸 x → length 是長、y → thickness、z → width；
 * 直徑＝另外兩軸較小者（跟 overlap.ts `clearedByRoundHole`、plan.ts 木釘接合同一套）。
 * 🩸2026-09-08 材料單原本一律拿 thickness×length，丙級第三題沿 z 的連接木釘印成「Ø8 × 8」。
 */
export function dowelDims(part: Part): { dia: number; len: number } {
  const ax = part.shape?.kind === "round" ? (part.shape.axis ?? "y") : "x";
  const { length, width, thickness } = part.visible;
  if (ax === "x") return { dia: Math.min(width, thickness), len: length };
  if (ax === "z") return { dia: Math.min(length, thickness), len: width };
  return { dia: Math.min(length, width), len: thickness };
}
