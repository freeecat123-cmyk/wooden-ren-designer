/**
 * inferProcessSteps — per-part 加工順序建議（Phase 4 Task 2）。
 *
 * 規則：
 * - lathe-turned：「圓鋸下料 → 車旋 → 細砂 → 鑿徑向榫眼」
 * - arch-bent：「鋸出輪廓 → 蒸彎/疊層 → 刨光」
 * - hoof：「鋸毛料 → 劃線 → 鑿/刨腳趾段 → 馬蹄收尾」
 * - splayed-*：「鋸料 → 計算傾角 → 刨平 → 開榫」
 * - apron-trapezoid：「鋸料 → 桌鋸斜切兩端 → 鑿榫頭 → 試裝」
 * - box-like（含 round / round-tapered 等非 hard shape）：
 *   「鋸料 → 刨平」+ 視 mortise/tenon 有無加「鑿榫眼」「開榫頭」「試裝」
 *
 * Spec: docs/superpowers/specs/2026-05-17-part-drawings-phase-4-design.md §2
 */
import type { Part } from "@/lib/types";

export function inferProcessSteps(part: Part): string[] {
  const shape = part.shape?.kind ?? "box";
  const hasMortise = (part.mortises?.length ?? 0) > 0;
  const hasTenon = (part.tenons?.length ?? 0) > 0;

  if (shape === "lathe-turned") {
    const steps = ["圓鋸下料", "車旋", "細砂"];
    if (hasMortise) steps.push("鑿徑向榫眼");
    return steps;
  }
  if (shape === "arch-bent") {
    return ["鋸出輪廓", "蒸彎/疊層", "刨光"];
  }
  if (shape === "hoof") {
    return ["鋸毛料", "劃線", "鑿/刨腳趾段", "馬蹄收尾"];
  }
  if (shape === "splayed-tapered" || shape === "splayed-round-tapered") {
    const steps = ["鋸料", "計算傾角", "刨平"];
    if (hasTenon) steps.push("開榫");
    return steps;
  }
  if (shape === "apron-trapezoid") {
    const steps = ["鋸料", "桌鋸斜切兩端"];
    if (hasTenon) steps.push("鑿榫頭");
    steps.push("試裝");
    return steps;
  }
  if (shape === "mitered-ends") {
    // 多邊形拼板（六/八角盒壁、斜接方盒壁）：兩側立邊斜切後拼接
    const steps = ["鋸料", "桌鋸立邊斜切"];
    if (hasMortise) steps.push("鑿榫眼");
    if (hasTenon) steps.push("開榫頭");
    steps.push("試裝");
    return steps;
  }

  // box-like default
  const steps = ["鋸料", "刨平"];
  if (hasMortise) steps.push("鑿榫眼");
  if (hasTenon) steps.push("開榫頭");
  if (hasMortise && hasTenon) steps.push("試裝");
  return steps;
}

/**
 * inferTableSawSetting — 鋸台設定值提示（Phase 4 Task 3）。
 *
 * 只針對特定斜角件出現、其他 part 回 null（不打擾）。
 * - apron-trapezoid + bevel：「桌鋸鋸片傾 X°」
 * - splayed-tapered / -round-tapered：「斜切鋸 X° (端面)」
 * - hoof：劃線手鑿提示
 */
export function inferTableSawSetting(part: Part): string | null {
  const shape = part.shape as any;
  if (!shape) return null;

  if (shape.kind === "apron-trapezoid" && typeof shape.bevelAngle === "number") {
    const deg = Math.round((shape.bevelAngle * 180) / Math.PI * 10) / 10;
    if (deg > 0.1) return `桌鋸鋸片傾 ${deg}°`;
  }
  if (
    shape.kind === "splayed-tapered" ||
    shape.kind === "splayed-round-tapered"
  ) {
    const dx = shape.dxMm ?? 0;
    const dz = shape.dzMm ?? 0;
    const L = part.visible.length ?? 1;
    const horiz = Math.sqrt(dx * dx + dz * dz);
    if (horiz < 0.5) return null;
    const angleDeg =
      Math.round((Math.atan2(horiz, L) * 180) / Math.PI * 10) / 10;
    return `斜切鋸 ${angleDeg}° (端面)`;
  }
  if (shape.kind === "hoof") {
    return "劃線後手鑿或帶鋸切腳趾餘料";
  }
  // 多邊形拼板（六/八角盒壁、斜接方盒壁）：兩側立邊斜切，鋸片傾角 =
  // atan(insetEach / 壁厚)。六角 30°、八角 22.5°、方盒 45°。tiltAngle/bevelAngle
  // 複斜（外撇牆）另計，此處只標基本立邊斜切角。
  if (shape.kind === "mitered-ends" && !shape.tiltAngle && !shape.bevelAngle) {
    const inset = shape.insetEach ?? 0;
    const t = part.visible.thickness ?? 0;
    if (inset > 0.1 && t > 0.1) {
      const deg = Math.round((Math.atan2(inset, t) * 180) / Math.PI * 10) / 10;
      return `桌鋸鋸片傾 ${deg}°（兩側立邊斜切）`;
    }
  }
  return null;
}
