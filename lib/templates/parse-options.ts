import type { OptionSpec } from "@/lib/types";

/**
 * 從 URL searchParams 解析模板 options。
 *
 * 為什麼存在：design / quote / quote-print 三個頁面都需要把 URL 上的選項
 * （legStyle、edgeChamfer、…）restore 成 template input。沒有這個 helper
 * 時 quote / print 頁完全沒讀 options，導致客戶點報價單連結看到的設計
 * 與「剛剛在設計頁編輯的版本」不同（價格也跟著錯）。
 */
export function parseOptionsFromQuery(
  schema: OptionSpec[],
  sp: Record<string, string | string[] | undefined>,
): Record<string, string | number | boolean> {
  const options: Record<string, string | number | boolean> = {};
  const get = (k: string): string | undefined => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  for (const spec of schema) {
    const raw = get(spec.key);
    if (raw === undefined || raw === "") {
      options[spec.key] = spec.defaultValue;
      continue;
    }
    if (spec.type === "number") {
      const n = Number(raw);
      options[spec.key] = Number.isFinite(n) ? n : spec.defaultValue;
    } else if (spec.type === "checkbox") {
      options[spec.key] = raw === "true" || raw === "on" || raw === "1";
    } else {
      options[spec.key] = raw;
    }
  }
  return options;
}
