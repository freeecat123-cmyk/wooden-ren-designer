import type { FurnitureCatalogEntry } from "@/lib/templates";
import { MATERIALS } from "@/lib/materials";
import type { MaterialId, OptionSpec } from "@/lib/types";

export type SpRecord = Record<string, string | string[] | undefined>;

export interface ParsedDesignParams {
  length: number;
  width: number;
  height: number;
  material: MaterialId;
  options: Record<string, string | number | boolean>;
  joineryMode: boolean;
  /**
   * 設計師模式：解除範本 limits 上限，允許自由輸入到 mm。
   * 用於系統櫃級客製場景（卡牆、避柱），但極端尺寸下範本可能產生不合理結果，
   * 請以三視圖檢核。預設 false。
   */
  designerMode: boolean;
}

const spStr = (sp: SpRecord, key: string): string | undefined => {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
};

const parseOption = (
  spec: OptionSpec,
  raw: string | undefined,
): string | number | boolean => {
  if (raw === undefined || raw === "") return spec.defaultValue;
  if (spec.type === "number") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : spec.defaultValue;
  }
  if (spec.type === "checkbox") {
    return raw === "true" || raw === "on" || raw === "1";
  }
  return raw;
};

/**
 * 統一解析 design 系列頁面（design / cut-plan / quote / print）的 URL searchParams。
 * 集中於此確保各頁解析行為一致 — 預設值、型別轉換、joineryMode 舊 URL 相容（beginnerMode=false）。
 */
export function parseDesignSearchParams(
  sp: SpRecord,
  entry: FurnitureCatalogEntry,
): ParsedDesignParams {
  const length = parseInt(spStr(sp, "length") ?? "") || entry.defaults.length;
  const width = parseInt(spStr(sp, "width") ?? "") || entry.defaults.width;
  const height = parseInt(spStr(sp, "height") ?? "") || entry.defaults.height;
  const rawMaterial = spStr(sp, "material");
  const material: MaterialId =
    rawMaterial && rawMaterial in MATERIALS
      ? (rawMaterial as MaterialId)
      : ("pine" as MaterialId);

  const joineryRaw = spStr(sp, "joineryMode");
  const joineryMode =
    joineryRaw === "true" ||
    joineryRaw === "1" ||
    spStr(sp, "beginnerMode") === "false";

  const options: Record<string, string | number | boolean> = {};
  for (const spec of entry.optionSchema ?? []) {
    const raw = spStr(sp, spec.key);
    // 榫接版預設改入溝（傳統榫卯做法）：backMode / drawerBottomMode 兩個 key 在
    // joineryMode 時 surface（釘背/釘底）強制升級為 rebated（入溝）。
    // 使用者要在 joineryMode 用 surface 需手動選；其他值（none）正常 pass-through。
    if (
      joineryMode &&
      (spec.key === "backMode" || spec.key === "drawerBottomMode") &&
      (raw === undefined || raw === "surface")
    ) {
      options[spec.key] = "rebated";
      continue;
    }
    options[spec.key] = parseOption(spec, raw);
  }

  // 套用使用情境 preset（force-apply）：preset 有定義的欄位一律 shadow user 值，
  // 讓表單 UI 顯示跟模板渲染數字一致
  const finalOptions = entry.applyPresets ? entry.applyPresets(options) : options;

  const designerRaw = spStr(sp, "designerMode");
  const designerMode = designerRaw === "true" || designerRaw === "1";

  return { length, width, height, material, options: finalOptions, joineryMode, designerMode };
}

/**
 * 把已解析的 params 序列化回 URLSearchParams（給跨頁連結用：
 * design → cut-plan / quote / print 都要帶完整參數）。
 */
export function designParamsToQuery(
  parsed: ParsedDesignParams,
  entry: FurnitureCatalogEntry,
): URLSearchParams {
  const q = new URLSearchParams({
    length: String(parsed.length),
    width: String(parsed.width),
    height: String(parsed.height),
    material: parsed.material,
  });
  for (const spec of entry.optionSchema ?? []) {
    q.set(spec.key, String(parsed.options[spec.key]));
  }
  if (parsed.joineryMode) q.set("joineryMode", "true");
  if (parsed.designerMode) q.set("designerMode", "true");
  return q;
}
