/**
 * rawStockSize — 估算 part 的「毛料」尺寸（Phase 2.5 Task 2）。
 *
 * 成品 = visible.length × visible.width × visible.thickness（圖上實際尺寸）
 * 毛料 = 成品 + 餘量（per-shape；木匠買料要含刨光/車旋/弧形外接矩形）
 *
 * Per-shape rule：
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

export function rawStockSize(part: Part): { L: number; W: number; T: number } {
  const v = part.visible;
  const s = part.shape as any;

  let L = (v.length ?? 0) + 12;
  let W = (v.width ?? 0) + 4;
  let T = (v.thickness ?? 0) + 2;

  if (s?.kind === "lathe-turned") {
    W = (v.width ?? 0) * 1.15;
    T = (v.thickness ?? 0) * 1.15;
    L = (v.length ?? 0) + 20;
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
    L = (v.length ?? 0) * 1.1;
  } else if (s?.kind === "splayed-tapered") {
    const dx = s.dxMm ?? 0;
    const dz = s.dzMm ?? 0;
    L = Math.sqrt((v.length ?? 0) ** 2 + dx * dx + dz * dz) + 12;
  }

  return { L: Math.round(L), W: Math.round(W), T: Math.round(T) };
}
