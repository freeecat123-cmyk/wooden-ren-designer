import type { FurnitureDesign } from "@/lib/types";
import { calculateCutDimensions } from "@/lib/geometry/cut-dimensions";
import { effectiveBillableMaterial } from "@/lib/pricing/catalog";
import { MATERIALS } from "@/lib/materials";
import type { CutPiece } from "./types";

/**
 * 把設計的零件清單展開成待排料的 CutPiece 陣列，並依計價材質分成：
 * - 實木：同 material × 同寬 × 同厚 為一組，進 1D FFD
 * - 板材（plywood / mdf）：同 billable × 同厚 為一組，進 2D FFDH
 */
export function buildCutPieces(design: FurnitureDesign): {
  lumberGroups: Map<string, CutPiece[]>;
  sheetGroups: Map<string, CutPiece[]>;
} {
  const lumberGroups = new Map<string, CutPiece[]>();
  const sheetGroups = new Map<string, CutPiece[]>();

  for (const part of design.parts) {
    if (part.visual === "glass") continue;
    const cut = calculateCutDimensions(part);
    const billable = effectiveBillableMaterial(part);
    // 裁切語意：長邊 = 沿纖維長度，中邊 = 寬，短邊 = 厚。
    // visible / cut dims 是幾何軸（length→X、thickness→Y 垂直、width→Z），
    // 立柱的長邊在 thickness、面板的長邊在 length，不能直接對應。
    const [longSide, midSide, shortSide] = [cut.length, cut.width, cut.thickness].sort(
      (a, b) => b - a,
    );
    const piece: CutPiece = {
      partId: part.id,
      partNameZh: part.nameZh,
      length: longSide,
      width: midSide,
      thickness: shortSide,
      material: part.material,
      billable,
    };

    if (billable === "plywood" || billable === "mdf") {
      const key = `${billable}|${piece.thickness}`;
      if (!sheetGroups.has(key)) sheetGroups.set(key, []);
      sheetGroups.get(key)!.push(piece);
    } else {
      // 實木：寬厚取「較大兩邊為橫截面 × 最長邊為長」，沿纖維走。
      // cut.length 已是纖維方向長度，width/thickness 是橫截面。
      const key = `${piece.material}|${piece.width}|${piece.thickness}`;
      if (!lumberGroups.has(key)) lumberGroups.set(key, []);
      lumberGroups.get(key)!.push(piece);
    }
  }

  return { lumberGroups, sheetGroups };
}

export function materialZh(materialId: string): string {
  return (MATERIALS as Record<string, { nameZh: string }>)[materialId]?.nameZh ?? materialId;
}
