import { getTemplate } from "@/lib/templates";
import type { FurnitureCategory, FurnitureDesign, JoineryType, MaterialId } from "@/lib/types";

/**
 * 從儲存於 designs 表的 furniture_type + params 重建 FurnitureDesign。
 * 失敗（template 不存在 / 必填欄位缺、template 拋例外）回 null，呼叫端 fallback。
 */
export function buildDesignFromParams(
  furnitureType: string,
  params: Record<string, unknown>,
): FurnitureDesign | null {
  const slug = furnitureType.replace(/_/g, "-") as FurnitureCategory;
  const entry = getTemplate(slug);
  if (!entry || !entry.template) return null;

  const length = Number(params.length);
  const width = Number(params.width);
  const height = Number(params.height);
  if (!Number.isFinite(length) || !Number.isFinite(width) || !Number.isFinite(height)) {
    return null;
  }

  const material = ((params.material as MaterialId) ?? "pine") as MaterialId;
  const joinery = (params.joinery as JoineryType | undefined) ?? undefined;

  // 整包 params 直接當 options 餵進去（templates 用 getOption 安全讀取，多餘欄位會被忽略）。
  const options = params as Record<string, string | number | boolean>;

  try {
    return entry.template({ length, width, height, material, joinery, options });
  } catch {
    return null;
  }
}
