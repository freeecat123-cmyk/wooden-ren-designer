import { describe, it, expect } from "vitest";
import { localePath } from "./metadata";
import { routing } from "./routing";

/**
 * 🧷 表單 action / router.replace 用的路徑:**預設語系不加前綴**。
 *
 * ⛔ 兩處表單的 action 以前寫死 `/${locale}/...`,但 routing 設的是
 *   `localePrefix: "as-needed"`(zh-TW 不帶前綴)→ 台灣使用者拿到 `/zh-TW/design/stool`,
 *   而表單每次 debounce 都 `router.replace(action + "?" + params)`
 *   → **每動一次參數就多吃一次 307 轉址**。(2026-08-21 稽核發現。)
 */
describe("localePath", () => {
  it("① 預設語系(zh-TW)不加前綴", () => {
    expect(localePath("/design/stool", routing.defaultLocale)).toBe("/design/stool");
  });

  it("② 非預設語系要加前綴", () => {
    expect(localePath("/design/stool", "en")).toBe("/en/design/stool");
  });

  it("③ 沒有開頭斜線也要處理好", () => {
    expect(localePath("design/stool", "en")).toBe("/en/design/stool");
    expect(localePath("design/stool", routing.defaultLocale)).toBe("/design/stool");
  });

  it("④ ⛔負向對照:結果不可以出現 /zh-TW 前綴(那正是多吃轉址的原因)", () => {
    for (const p of ["/design/stool", "/design/stool/quote", "/templates"]) {
      expect(localePath(p, routing.defaultLocale)).not.toContain("/zh-TW");
    }
  });

  it("⑤ 預設語系是 zh-TW、前綴策略是 as-needed(前提變了這支就該重寫)", () => {
    expect(routing.defaultLocale).toBe("zh-TW");
    expect(routing.localePrefix).toBe("as-needed");
  });
});
