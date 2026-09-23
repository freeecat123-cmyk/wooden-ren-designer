import { getTemplate } from "@/lib/templates";
import { parseOptionsFromQuery } from "@/lib/templates/parse-options";
import { calculateQuote } from "@/lib/pricing/quote";
import { LABOR_DEFAULTS } from "@/lib/pricing/labor";
import { MATERIAL_PRICE_PER_BDFT } from "@/lib/pricing/catalog";
import type { FurnitureCategory, MaterialId } from "@/lib/types";
import type { ProjectLaborOpts } from "@/lib/projects/types";
import { designFingerprint, savedDesignQuery } from "@/lib/design/saved-query";
import type { ModelSnapshot } from "@/lib/design/model-snapshot";
import { toBeginnerMode } from "@/lib/templates/beginner-mode";

/**
 * 用 template + 工資 / 材料單價估出單件未稅報價，給專案項目帶入預設單價。
 * `projectOpts` 提供時，對應欄位覆蓋系統預設（LABOR_DEFAULTS）。
 * 失敗（type 不存在 / 缺尺寸）回 null，呼叫端應 fallback 到 null（讓使用者自填）。
 * 結果四捨五入到百位。
 */
export function estimateUnitPriceFromParams(
  furnitureType: string,
  params: Record<string, unknown>,
  projectOpts?: ProjectLaborOpts | null,
): number | null {
  const slug = furnitureType.replace(/_/g, "-") as FurnitureCategory;
  const entry = getTemplate(slug);
  if (!entry || !entry.template) return null;

  const length = Number(params.length);
  const width = Number(params.width);
  const height = Number(params.height);
  if (![length, width, height].every((n) => Number.isFinite(n) && n > 0)) {
    return null;
  }
  const material = (typeof params.material === "string"
    ? params.material
    : "maple") as MaterialId;

  const spLike = Object.fromEntries(savedDesignQuery("", params));
  const options = parseOptionsFromQuery(entry.optionSchema ?? [], spLike);

  try {
    // This is a client-side price suggestion, not signature verification.
    // Official project quote/purchase pages verify archives on the server.
    const snapshot = params._modelSnapshot as ModelSnapshot | undefined;
    if (snapshot && (snapshot.schema !== 1 || snapshot.category !== slug || snapshot.input !== designFingerprint(params))) return null;
    const raw = snapshot?.design ?? entry.template({ length, width, height, material, options });
    const design = snapshot || ["true", "1"].includes(spLike.joineryMode) || spLike.beginnerMode === "false" ? raw : toBeginnerMode(raw);
    const primaryPrice = MATERIAL_PRICE_PER_BDFT[material] ?? 300;
    const merged = {
      ...LABOR_DEFAULTS,
      primaryMaterialPricePerBdft: primaryPrice,
      ...(projectOpts ?? {}),
    };
    const quote = calculateQuote(design, merged);
    const unit = quote.unitPriceExclVat;
    if (!Number.isFinite(unit) || unit <= 0) return null;
    return Math.round(unit / 100) * 100;
  } catch {
    return null;
  }
}
