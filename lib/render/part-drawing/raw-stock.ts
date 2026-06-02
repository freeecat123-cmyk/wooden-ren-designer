/**
 * rawStockSize — 估算 part 的「毛料」尺寸（Phase 2.5 Task 2）。
 *
 * 成品 = visible.length × visible.width × visible.thickness（裸露對接尺寸）
 * 含榫 = 成品 + 兩端榫頭長（=實際下料長，maker 切料用）
 * 毛料 = 含榫 + 餘量（per-shape；木匠買料要含刨光/車旋/弧形外接矩形）
 *
 * Per-shape rule（基礎餘量，再加 tenon 延伸）：
 * - default: L +12（兩端各 ~5mm）/ W +4 / T +2（單面刨光）
 * - lathe-turned: 徑向 ×1.15、長 +20mm（端面車削留量）
 * - hoof: 徑向 × hoofScale（含腳趾外撇段）
 * - round / round-tapered / splayed-round-tapered: 徑 +6mm（雙面車削）
 * - arch-bent: 弦長 ×1.1（外接矩形）
 * - splayed-tapered: L = √(L² + dx² + dz²) + 12（傾斜後真長加餘量）
 *
 * Spec: docs/superpowers/specs/2026-05-17-part-drawings-phase-2-5-design.md §2
 */
import type { Part } from "@/lib/types";

/**
 * 三軸 tenon 延伸量（butt-joint 慣例：visible.length 不含榫，maker 切料要加）。
 * 跟 drawing.tsx 的 grossPartDims 對齊。
 */
function tenonExt(part: Part): { L: number; W: number; T: number } {
  let L = 0;
  let W = 0;
  let T = 0;
  for (const t of part.tenons) {
    if (t.length <= 0) continue;
    if (t.position === "start" || t.position === "end") L += t.length;
    else if (t.position === "left" || t.position === "right") W += t.length;
    else if (t.position === "top" || t.position === "bottom") T += t.length;
  }
  return { L, W, T };
}

export function rawStockSize(part: Part): { L: number; W: number; T: number } {
  const v = part.visible;
  const s = part.shape as any;
  const ext = tenonExt(part);

  let L = (v.length ?? 0) + ext.L + 12;
  let W = (v.width ?? 0) + ext.W + 4;
  let T = (v.thickness ?? 0) + ext.T + 2;

  if (s?.kind === "lathe-turned") {
    W = (v.width ?? 0) * 1.15;
    T = (v.thickness ?? 0) * 1.15;
    L = (v.length ?? 0) + ext.L + 20;
  } else if (s?.kind === "hoof") {
    const hoofScale = s.hoofScale ?? 1.4;
    W = (v.width ?? 0) * hoofScale;
    T = (v.thickness ?? 0) * hoofScale;
  } else if (
    s?.kind === "round" ||
    s?.kind === "round-tapered" ||
    s?.kind === "splayed-round-tapered"
  ) {
    W = (v.width ?? 0) + 6;
    T = (v.thickness ?? 0) + 6;
  } else if (s?.kind === "arch-bent") {
    L = (v.length ?? 0) + ext.L;
    L = L * 1.1;
    // 弧線在 W 軸延伸 bendMm（矢高）→ 毛料寬要含弧高才切得出弧形
    W = (v.width ?? 0) + ext.W + (s.bendMm ?? 0) + 4;
  } else if (s?.kind === "splayed-tapered") {
    const dx = s.dxMm ?? 0;
    const dz = s.dzMm ?? 0;
    L = Math.sqrt((v.length ?? 0) ** 2 + dx * dx + dz * dz) + ext.L + 12;
  }

  return { L: Math.round(L), W: Math.round(W), T: Math.round(T) };
}
