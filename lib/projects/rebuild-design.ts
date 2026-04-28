import { getTemplate } from "@/lib/templates";
import { parseOptionsFromQuery } from "@/lib/templates/parse-options";
import type {
  FurnitureCategory,
  FurnitureDesign,
  MaterialId,
} from "@/lib/types";
import type { ProjectItemRow } from "@/lib/projects/types";

/**
 * 從 ProjectItemRow.params 重建 FurnitureDesign，用於在報價單嵌入三視圖。
 * 失敗回 null（type 不存在 / 缺尺寸）。
 */
export function rebuildDesignFromItem(
  item: ProjectItemRow,
): FurnitureDesign | null {
  const slug = item.furniture_type.replace(/_/g, "-") as FurnitureCategory;
  const entry = getTemplate(slug);
  if (!entry || !entry.template) return null;
  const p = item.params as Record<string, unknown>;
  const length = Number(p.length);
  const width = Number(p.width);
  const height = Number(p.height);
  if (![length, width, height].every((n) => Number.isFinite(n) && n > 0)) {
    return null;
  }
  const material = (typeof p.material === "string" ? p.material : "maple") as MaterialId;
  const spLike: Record<string, string> = {};
  for (const [k, v] of Object.entries(p)) {
    if (v == null) continue;
    spLike[k] = String(v);
  }
  const options = parseOptionsFromQuery(entry.optionSchema ?? [], spLike);
  try {
    return entry.template({ length, width, height, material, options });
  } catch {
    return null;
  }
}
