// 1:1 樣板用紙張表。尺寸為 mm，一律「長邊 × 短邊」。
import type { PartCategory } from "@/lib/render/categorize-part";

export interface PaperSpec {
  id: string;
  label: string;
  /** 長邊 mm */
  w: number;
  /** 短邊 mm */
  h: number;
}

export const PAPERS: readonly PaperSpec[] = [
  { id: "A4", label: "A4", w: 297, h: 210 },
  { id: "A3", label: "A3", w: 420, h: 297 },
  { id: "B3", label: "B3", w: 500, h: 353 },
  { id: "A2", label: "A2", w: 594, h: 420 },
  { id: "A1", label: "A1", w: 841, h: 594 },
  { id: "A0", label: "A0", w: 1189, h: 841 },
] as const;

/** 每邊留白 mm。 */
export const SHEET_MARGIN_MM = 5;

/** 面板類（categorizePart 回這幾種）紙張上限 A2；其餘 A0。 */
const PANEL_CATEGORIES: ReadonlySet<PartCategory> = new Set<PartCategory>([
  "case",
  "divider",
  "seat",
  "door",
]);

export function isPanelCategory(category: PartCategory): boolean {
  return PANEL_CATEGORIES.has(category);
}

/**
 * 依零件分類回傳可用的紙張階梯。
 * 面板類截到 A2 —— B3 短邊只有 353mm，方凳座板 350×350、餐椅椅面 420×400
 * 都卡在短邊過不了，斜擺救不了正方形（spec §5.1）。
 */
export function ladderFor(category: PartCategory): PaperSpec[] {
  const cap = isPanelCategory(category) ? "A2" : "A0";
  const out: PaperSpec[] = [];
  for (const p of PAPERS) {
    out.push(p);
    if (p.id === cap) break;
  }
  return out;
}
