import type { FurnitureDesign } from "@/lib/types";
import { calculateCutDimensions } from "@/lib/geometry/cut-dimensions";
import { effectiveBillableMaterial } from "@/lib/pricing/catalog";
import { MATERIALS } from "@/lib/materials";
import { partName } from "@/lib/templates/part-names";
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
    if (part.visual !== undefined) continue; // 任何非木材 visual hint 都跳過排料
    const cut = calculateCutDimensions(part);
    const billable = effectiveBillableMaterial(part);
    // 拼板：concept 是 1 塊面板，實際買料 / 裁切是 N 片小料。把寬度切成 N 等份
    // 各自進排料；總材積仍與單片一致。
    const pieces = Math.max(1, Math.round(part.panelPieces ?? 1));
    // 裁切語意：長邊 = 沿纖維長度，中邊 = 寬，短邊 = 厚。
    // visible / cut dims 是幾何軸（length→X、thickness→Y 垂直、width→Z），
    // 立柱的長邊在 thickness、面板的長邊在 length，不能直接對應。
    // 拼板下，width 要先除以片數再排序（拆完才是真正單片橫截面）
    /**
     * ⛔ 要先排序再除片數，不能先除 `cut.width`。
     *
     * `visible` 是幾何軸三元組（§A9.1），立著的零件（壁掛工具牆背板、櫃子背板）
     * 真正的板厚在 `width`、面寬在 `thickness`。舊碼直接 `cut.width / pieces`
     * → 把 18mm 板厚切成 5 份變 3.6mm，面寬 1200mm 完全沒拆，裁切照樣排不下。
     * （2026-08-23；同一個軸假設在 pricing/quote.ts 也踩過一次）
     *
     * 拼板是沿「面寬」拼的：最長邊＝順紋長度、中間邊＝面寬（要拆的就是它）、
     * 最短邊＝板厚。先排序就跟零件怎麼擺無關。
     */
    const [longSide, rawMidSide, shortSide] = [cut.length, cut.width, cut.thickness].sort(
      (a, b) => b - a,
    );
    // 疊層（panelSplit="thickness"）：拼的是厚度不是面寬（工作桌 stack 桌面 = N 層 × 厚/N）
    const byThickness = part.panelSplit === "thickness";
    const midSide = byThickness ? rawMidSide : rawMidSide / pieces;
    const thinSide = byThickness ? shortSide / pieces : shortSide;

    for (let i = 0; i < pieces; i++) {
      const suffix = pieces > 1 ? ` (${i + 1}/${pieces})` : "";
      const piece: CutPiece = {
        partId: pieces > 1 ? `${part.id}-piece-${i + 1}` : part.id,
        partNameZh: `${part.nameZh}${suffix}`,
        partNameEn: `${partName(part, "en")}${suffix}`,
        length: longSide,
        width: midSide,
        thickness: thinSide,
        material: part.material,
        billable,
      };

      if (billable === "plywood" || billable === "mdf") {
        const key = `${billable}|${piece.thickness}`;
        if (!sheetGroups.has(key)) sheetGroups.set(key, []);
        sheetGroups.get(key)!.push(piece);
      } else {
        // 實木：寬厚取「較大兩邊為橫截面 × 最長邊為長」，沿纖維走。
        const key = `${piece.material}|${piece.width}|${piece.thickness}`;
        if (!lumberGroups.has(key)) lumberGroups.set(key, []);
        lumberGroups.get(key)!.push(piece);
      }
    }
  }

  return { lumberGroups, sheetGroups };
}

export function materialZh(materialId: string): string {
  return (MATERIALS as Record<string, { nameZh: string }>)[materialId]?.nameZh ?? materialId;
}
