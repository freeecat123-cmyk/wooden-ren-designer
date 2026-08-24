import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import { nextPartSelection } from "./part-selection";

describe("點零件的選取語意（3D 與材料單共用）", () => {
  it("點目前已選的那個 → 取消選取", () => {
    expect(nextPartSelection("leg-1", "leg-1")).toBeNull();
  });
  it("點別的零件 → 換成它", () => {
    expect(nextPartSelection("leg-1", "seat")).toBe("seat");
  });
  it("目前沒選 → 選起來", () => {
    expect(nextPartSelection(null, "leg-1")).toBe("leg-1");
  });

  /**
   * ⭐ 這一條才是真正防護 2026-08-25 那個 bug 的:
   * 「有沒有 toggle」是寫在 onClick 裡的,單元測試碰不到 ——
   * 所以改成檢查「兩個呼叫點都走同一支共用函式」。
   * 誰把它改回自己手寫 `id === selected ? null : id`（或漏掉 toggle）都會紅。
   */
  it("3D 與材料單兩個呼叫點都必須走 nextPartSelection", () => {
    const cases: { file: string; must: string; mustNot: RegExp }[] = [
      {
        file: "components/PerspectiveView.tsx",
        must: "onPartSelect(nextPartSelection(",
        // 無條件選取(= 沒有 toggle)。`onPartSelect(null)` 是空白處清除,合法。
        mustNot: /onPartSelect\(\s*part\.id\s*\)/,
      },
      {
        file: "components/MaterialListWithSelection.tsx",
        must: "setSelectedPartId(nextPartSelection(",
        mustNot: /setSelectedPartId\(\s*id\s*\)/,
      },
    ];
    for (const c of cases) {
      // 註解裡會出現這些字面(說明歷史),先剝掉再驗,否則驗到自己的說明
      const src = fs
        .readFileSync(c.file, "utf-8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      expect(
        src.includes(c.must),
        `${c.file} 沒有 ${c.must} —— 選取語意沒走共用函式`,
      ).toBe(true);
      expect(
        c.mustNot.test(src),
        `${c.file} 出現無條件選取(沒有「再點一次取消」),手機上點到就回不來`,
      ).toBe(false);
    }
  });
});
