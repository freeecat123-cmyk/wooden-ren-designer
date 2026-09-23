/**
 * 範本「常見尺寸表」資料層（2026-09-04）。
 *
 * 目的：/templates/<slug> 與 /en/templates/<slug> 行銷頁自動長一段尺寸表，
 * 數字**一律從程式常數來**（FURNITURE_CATALOG 的 defaults / limits、optionSchema
 * 的 min / max / defaultValue），不手打，範本改了表格自己跟。
 *
 * 主尺寸（長／寬／高，圓形家具只有直徑／高）只有「可調上限」（catalog.limits 只存
 * max；滑桿下限是 20mm 地板，沒有語意），所以 range 的 min 留 null。
 * 子尺寸從 SIZING_SUB_KEYS 白名單挑，該款 schema 沒這個 key 就略過。
 */
import type { FurnitureCategory, OptionSpec } from "@/lib/types";
import type { FurnitureCatalogEntry } from "@/lib/templates";
import { specLabel } from "@/lib/templates/spec-labels";

export interface SizingRow {
  key: string;
  label: string;
  /** 下限；主尺寸沒有語意下限時為 null */
  min: number | null;
  max: number | null;
  defaultValue: number;
  /** mm / cm / ° / %；空字串代表無單位（個數、倍率） */
  unit: string;
}

export const ROUND_CATEGORIES: ReadonlySet<string> = new Set([
  "round-stool",
  "round-table",
  "round-tea-table",
]);

/** 每款要放進表格的關鍵子尺寸（schema 沒有的自動略過） */
export const SIZING_SUB_KEYS: Partial<Record<FurnitureCategory, string[]>> = {
  stool: ["seatThickness", "legSize"],
  bench: ["topThickness", "legSize"],
  "tea-table": ["topThickness", "legSize"],
  "side-table": ["topThickness", "drawerHeight"],
  "low-table": ["topThickness", "legSize"],
  "dining-table": ["topThickness", "legSize"],
  desk: ["topThickness", "legSize"],
  workbench: ["topThickness", "legSize", "userHeightCm"],
  "dining-chair": ["seatHeight", "backRake", "armrestHeight"],
  "bar-stool": ["footrestHeight", "backHeight"],
  "round-stool": ["seatThickness", "legSize"],
  "round-tea-table": ["topThickness", "lazySusanDiameter"],
  "round-table": ["topThickness", "lazySusanDiameter"],
  "open-bookshelf": ["panelThickness", "legHeight"],
  "chest-of-drawers": ["panelThickness", "legHeight"],
  "display-cabinet": ["panelThickness", "legHeight"],
  wardrobe: ["panelThickness", "legHeight"],
  nightstand: ["panelThickness", "legHeight"],
  "media-console": ["panelThickness", "drawerHeight", "legHeight"],
  "shoe-cabinet": ["upperHeight", "lowerHeight", "angledRackTilt", "legHeight"],
  "chinese-cabinet": ["postSize", "hoofMm"],
  "pencil-holder": ["wallThickness", "bottomThickness"],
  tray: ["wallThickness", "bottomThickness"],
  "dovetail-box": ["wallThickness", "bottomThickness"],
  "photo-frame": ["frameThickness"],
  "wine-rack": ["bottleDiameter", "legHeight"],
  bed: ["headboardHeight", "mattressClearanceMm", "sideRailWidth"],
  "coat-rack": ["footLength", "hookLength"],
  "wall-mounted-tool-storage": ["backThickness", "cleatHeight"],
};

const MAIN_LABELS = {
  "zh-TW": { length: "長度", width: "寬度（深度）", height: "高度", diameter: "直徑" },
  en: { length: "Length", width: "Width (depth)", height: "Height", diameter: "Diameter" },
} as const;

export function getSizingRows(
  entry: Pick<FurnitureCatalogEntry, "category" | "defaults" | "limits" | "optionSchema">,
  locale: string,
): SizingRow[] {
  const L = locale === "en" ? MAIN_LABELS.en : MAIN_LABELS["zh-TW"];
  const rows: SizingRow[] = [];
  const isRound = ROUND_CATEGORIES.has(entry.category);
  const lim = entry.limits;
  if (isRound) {
    rows.push({ key: "diameter", label: L.diameter, min: null, max: lim?.length ?? null, defaultValue: entry.defaults.length, unit: "mm" });
  } else {
    rows.push({ key: "length", label: L.length, min: null, max: lim?.length ?? null, defaultValue: entry.defaults.length, unit: "mm" });
    rows.push({ key: "width", label: L.width, min: null, max: lim?.width ?? null, defaultValue: entry.defaults.width, unit: "mm" });
  }
  rows.push({ key: "height", label: L.height, min: null, max: lim?.height ?? null, defaultValue: entry.defaults.height, unit: "mm" });

  const wanted = SIZING_SUB_KEYS[entry.category] ?? [];
  const schema = entry.optionSchema ?? [];
  for (const key of wanted) {
    const spec = schema.find((s): s is Extract<OptionSpec, { type: "number" }> => s.key === key && s.type === "number");
    if (!spec) continue;
    rows.push({
      key,
      label: specLabel(spec, locale),
      min: spec.min ?? null,
      max: spec.max ?? null,
      defaultValue: spec.defaultValue,
      unit: spec.unit ?? "",
    });
  }
  return rows;
}

/** 35 → "35 mm（3.5 cm）"；非 mm 單位照印 */
export function formatSizingValue(v: number, unit: string, locale = "zh-TW"): string {
  if (unit === "mm") {
    const cm = v / 10;
    const cmStr = Number.isInteger(cm) ? String(cm) : cm.toFixed(1);
    return locale === "en" ? `${v} mm (${cmStr} cm)` : `${v} mm（${cmStr} cm）`;
  }
  return unit ? `${v} ${unit}` : String(v);
}

export function formatSizingRange(row: SizingRow, locale: string): string {
  const upTo = locale === "en" ? "up to" : "最多";
  if (row.min == null && row.max == null) return "—";
  if (row.min == null) return `${upTo} ${formatSizingValue(row.max as number, row.unit, locale)}`;
  if (row.max == null) return `≥ ${formatSizingValue(row.min, row.unit, locale)}`;
  if (row.unit === "mm") {
    const cm = (n: number) => (Number.isInteger(n / 10) ? String(n / 10) : (n / 10).toFixed(1));
    return locale === "en"
      ? `${row.min}–${row.max} mm (${cm(row.min)}–${cm(row.max)} cm)`
      : `${row.min}–${row.max} mm（${cm(row.min)}–${cm(row.max)} cm）`;
  }
  return `${row.min}–${row.max}${row.unit ? ` ${row.unit}` : ""}`;
}
