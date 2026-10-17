import type { OptionSpec } from "@/lib/types";
import { STYLE_PRESETS, applyStylePreset, getAllStyleManagedKeys } from "./style-presets";

/**
 * 功能性設定：抽屜、層板、扶手、座高這些是「要做成什麼樣的家具」，不是「長什麼樣子」，
 * 套風格不准動。2026-09-09 改版擔心的就是這個（按風格把使用者的抽屜數洗掉）。
 */
const FUNCTIONAL_KEY = /drawer|Drawer|Shelf|LazySusan|ModestyPanel|dropLeaf|Armrest|seatHeight|footrestHeight|pull|Slide|constructionVersion/;

function validValue(spec: OptionSpec, value: string | number | boolean): string | null {
  if (spec.type === "select") {
    return spec.choices.some(c => c.value === String(value)) ? String(value) : null;
  }
  if (spec.type === "checkbox") return typeof value === "boolean" ? String(value) : null;
  if (spec.type === "number") {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    if (spec.min !== undefined && n < spec.min) return null;
    if (spec.max !== undefined && n > spec.max) return null;
    return String(n);
  }
  return null;
}

/**
 * 快速風格：一鍵換「外觀」——木種、腳形與粗細、邊緣、牙板、桌面厚、橫撐、椅背樣式。
 * 尺寸（長寬高）與功能性設定（抽屜、層板、扶手…）保留使用者原本的。
 *
 * 2026-10-17 木頭仁：「風格變化不是很有特色」。09-09 改版後只剩換腳形（邊緣樣式多半是
 * 條件欄位被略過），各風格看起來幾乎一樣；風格資料（style-presets / detail packs）其實
 * 都還在，這裡改回全部套用，只擋尺寸跟功能性設定。
 */
export function quickStyleQuery(
  current: URLSearchParams,
  styleId: string,
  category: string | undefined,
  schema: OptionSpec[],
  size?: { length: number; width: number; height: number },
): URLSearchParams | null {
  const preset = STYLE_PRESETS[styleId];
  if (!preset || category === "workbench" || category === "cert-c1") return null;
  if (category && preset.applicableTo && !preset.applicableTo.includes(category)) return null;
  const num = (k: string) => Number(current.get(k));
  const ctx = {
    totalLength: size?.length ?? num("length"),
    totalWidth: size?.width ?? num("width"),
    totalHeight: size?.height ?? num("height"),
  };
  const hasCtx = Number.isFinite(ctx.totalLength) && ctx.totalLength > 0
    && Number.isFinite(ctx.totalWidth) && ctx.totalWidth > 0
    && Number.isFinite(ctx.totalHeight) && ctx.totalHeight > 0;
  const params = applyStylePreset(styleId, category, hasCtx ? ctx : undefined, 0, schema);
  if (!params) return null;

  const specs = new Map(schema.map(s => [s.key, s]));
  const next = new URLSearchParams(current);
  // 上一個風格寫過、這個風格沒寫的外觀欄位回模板預設，不然切風格會殘留前一個的樣子
  for (const k of getAllStyleManagedKeys(category)) {
    if (k === "length" || k === "width" || k === "height" || k === "material" || FUNCTIONAL_KEY.test(k)) continue;
    if (specs.has(k)) next.delete(k);
  }
  // 有腳形欄位的家具，風格的招牌腳形要對得上才算這個風格（方凳沒有明式圓腳 → 不出「明式」）
  const legSpec = specs.get("legShape");
  if (legSpec && validValue(legSpec, params.legShape ?? "") === null) return null;
  let applied = 0;
  for (const [k, v] of Object.entries(params)) {
    if (k.startsWith("_") || FUNCTIONAL_KEY.test(k)) continue;
    const spec = specs.get(k);
    if (!spec) continue;
    const value = validValue(spec, v);
    if (value === null) continue;
    next.set(k, value);
    applied++;
  }
  // 只換得了一兩個邊角欄位的家具，按了看不出差別，不給按
  if (applied < 3) return null;
  if (typeof params.material === "string") next.set("material", params.material);
  next.set("style", styleId);
  next.delete("styleVariant");
  // 先刪後設會打亂順序；排序後同一個風格再按一次網址一字不差，不會白白重抓
  next.sort();
  return next;
}
