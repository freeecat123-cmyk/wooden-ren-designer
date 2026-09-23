import { getTemplate } from "@/lib/templates";
import { parseOptionsFromQuery } from "@/lib/templates/parse-options";
import type {
  FurnitureCategory,
  FurnitureDesign,
  MaterialId,
} from "@/lib/types";
import type { ProjectItemRow } from "@/lib/projects/types";
import { readModelSnapshot } from "@/lib/design/model-snapshot";
import { savedDesignQuery } from "@/lib/design/saved-query";
import { toBeginnerMode } from "@/lib/templates/beginner-mode";

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
  if (p._modelSnapshot) {
    const snapshot = readModelSnapshot(p._modelSnapshot, slug, p);
    if (!snapshot) throw new Error("Project model snapshot could not be verified");
    return snapshot.design;
  }
  const length = Number(p.length);
  const width = Number(p.width);
  const height = Number(p.height);
  if (![length, width, height].every((n) => Number.isFinite(n) && n > 0)) {
    return null;
  }
  const material = (typeof p.material === "string" ? p.material : "pine") as MaterialId;
  const spLike = Object.fromEntries(savedDesignQuery("", p));
  const options = parseOptionsFromQuery(entry.optionSchema ?? [], spLike);
  try {
    const raw = entry.template({ length, width, height, material, options });
    return ["true", "1"].includes(spLike.joineryMode) || spLike.beginnerMode === "false" ? raw : toBeginnerMode(raw);
  } catch {
    return null;
  }
}
