import type { FurnitureDesign } from "@/lib/types";

/**
 * 檢查圓腳家具的榫接合規性。
 *
 * 規則：圓腳（shape ∈ round / round-tapered / shaker）的母件不能有
 * through-tenon（貫穿榫）。原因：圓腳側面是曲面，鑿穿榫眼時公榫
 * 會在曲面上斜出，加工難、結構差、外觀醜。
 *
 * 回傳 warning 字串陣列，可 push 進 design.warnings 給 UI 顯示。
 */
export function validateRoundLegJoinery(design: FurnitureDesign): string[] {
  const warnings: string[] = [];
  for (const part of design.parts) {
    const k = part.shape?.kind;
    const isRoundLeg = k === "round" || k === "round-tapered" || k === "shaker" || k === "lathe-turned";
    if (!isRoundLeg) continue;
    for (const m of part.mortises) {
      if (m.through) {
        warnings.push(
          `「${part.nameZh}」是圓腳但 mortise 設為 through（貫穿榫）` +
            `——圓腳側面是曲面，鑿穿榫眼會在曲面上斜出，請改用 blind / shouldered / stub-joint。`,
        );
        break; // 同一隻腳只報一次
      }
    }
  }
  return warnings;
}
