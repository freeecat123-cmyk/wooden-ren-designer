/**
 * 檢定考題範本的「答案外洩」守門。
 *
 * 🩸 2026-09-09（回歸檢查員抓到）：`app/[locale]/design/[type]/page.tsx` 的 `examLocked`
 * 原本寫成 `previewLocked && !!getBundleFor(type)` —— 用「有沒有在 TEMPLATE_BUNDLES 裡」
 * 代替「是不是考題」。丙級三題與乙級第一題剛好都在套組裡，所以看起來一直是對的；
 * 但**乙級第二、三題沒進任何套組 → examLocked 變 false**，未登入訪客直接在 HTML 裡
 * 讀得到整條官方尺寸鏈（實測 `>450<`×6、`>434<`×2、`>324<`×2…）。
 * 「先不要上架」擋住了買、沒擋住看。
 *
 * 這支測試釘住兩件事：
 *   1. 每個 `joineryOnly` 的目錄項都要在 EXAM_CATEGORIES 裡（新增檢定題目漏加會紅）
 *   2. 設計頁的 examLocked 判準不可以再退回去看套組／付費狀態
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FURNITURE_CATALOG, EXAM_CATEGORIES, isExamCategory } from "@/lib/templates";
import { deriveBuildSteps } from "@/lib/steps/derive";
import { calculateQuote } from "@/lib/pricing/quote";
import { LABOR_DEFAULTS } from "@/lib/pricing/labor";
import { getBundleFor } from "@/lib/pricing/template-unlock";

const ROOT = process.cwd();

describe("檢定考題不可以把答案放出來", () => {
  it("名單含六題，且六題都認得出來", () => {
    for (const c of ["cert-c1", "cert-c2", "cert-c3", "cert-b1", "cert-b2", "cert-b3"]) {
      expect(isExamCategory(c), c).toBe(true);
    }
    expect(isExamCategory("stool")).toBe(false);
    expect(isExamCategory("workbench")).toBe(false);
  });

  it("每個 joineryOnly 的目錄項都在名單裡（新增檢定題目漏加會紅）", () => {
    const joineryOnly = FURNITURE_CATALOG.filter((e) => e.joineryOnly).map((e) => e.category);
    expect(joineryOnly.length, "joineryOnly 目前就是六題檢定").toBeGreaterThanOrEqual(6);
    const missing = joineryOnly.filter((c) => !EXAM_CATEGORIES.has(c));
    expect(missing, `這些是檢定題卻沒加進 EXAM_CATEGORIES：${missing.join(", ")}`).toEqual([]);
  });

  it("⭐ 判準不可以是「有沒有在套組裡」——那正是上次漏掉 b2/b3 的原因", () => {
    // 反證：cert-b2 / cert-b3 不在任何套組，但一定要被鎖
    for (const c of ["cert-b2", "cert-b3"]) {
      expect(getBundleFor(c), `${c} 目前不在任何套組`).toBeNull();
      expect(isExamCategory(c), `${c} 沒進套組但仍然是考題，必須鎖`).toBe(true);
    }
    // 設計頁必須吃單一真相來源，不可以自己用套組／價格判
    const page = readFileSync(join(ROOT, "app", "[locale]", "design", "[type]", "page.tsx"), "utf8");
    const examLine = page.split("\n").find((l) => l.includes("const examLocked"));
    expect(examLine, "找不到 examLocked").toBeTruthy();
    expect(examLine, "examLocked 要吃 isExamCategory").toContain("isExamCategory");
    expect(examLine, "examLocked 不可以再看套組").not.toContain("getBundleFor");
    expect(examLine, "examLocked 不可以看價格").not.toContain("getUnlockPrice");
  });

  /**
   * 🩸 2026-09-10：檢定題原本在兩個地方被**一個一個列**——
   *   `lib/steps/derive.ts` 的 `categoryFamily()`（工時折減）與
   *   `lib/pricing/quote.ts` 的 `wasteRateFor()`（切料損耗 25% vs 10%）。
   * 加乙級第四題時兩處都漏掉：工時 8.1h 被算成 15.7h、材料費少算 NT$138。
   * **六種輸出沒有一種會紅**——工時與報價本來就沒有任何稽核在守。
   * 這兩條就是那個機器閘門：下一題（第五、六題）漏加一定會紅。
   */
  const buildExam = (category: string) => {
    const e = FURNITURE_CATALOG.find((x) => x.category === category);
    if (!e?.template) return null;
    const o = Object.fromEntries((e.optionSchema ?? []).map((s) => [s.key, s.defaultValue])) as Record<string, string | number | boolean>;
    return e.template({ length: e.defaults.length, width: e.defaults.width, height: e.defaults.height, material: "pine", options: o });
  };

  it("⭐ 每一題檢定範本都要吃到 accessory 的工時折減（漏加會變成兩倍工時）", () => {
    for (const c of EXAM_CATEGORIES) {
      const d = buildExam(c);
      if (!d) continue;
      const hours = deriveBuildSteps(d).reduce((a, s) => a + (s.estimatedMinutes ?? 0), 0) / 60;
      // 六題官方測驗時間都是 7 小時（丙級 4 小時），套上 accessory 折減後實測落在 5.6~9.2h。
      // 門檻取 12：沒吃到折減的話會直接跳到 15h 以上（cert-b4 實測 8.45 vs 15.77），兩邊都有餘裕。
      // ⚠️ 之後再往 deriveBuildSteps 加工序時，這個數字要跟著看一眼。
      expect(hours, `${c} 工時 ${hours.toFixed(1)}h 太高——categoryFamily() 沒把它算成 accessory`).toBeLessThan(12);
    }
  });

  it("⭐ 每一題檢定範本的切料損耗都要吃 accessory 的 25%（不是一般家具的 10%）", () => {
    const opts = { ...LABOR_DEFAULTS, primaryMaterialPricePerBdft: 300 };
    for (const c of EXAM_CATEGORIES) {
      const d = buildExam(c);
      if (!d) continue;
      const asExam = calculateQuote(d, opts).materialCost;
      // 同一份幾何只換 category → 損耗率是唯一的差別；25% vs 10% 差 13.6%
      const asOrdinary = calculateQuote({ ...d, category: "stool" }, opts).materialCost;
      expect(asExam / asOrdinary, `${c} 沒吃到 accessory 損耗率（wasteRateFor 漏加）`).toBeCloseTo(1.25 / 1.1, 2);
    }
  });

  it("被鎖的那幾段真的都掛上 examLocked（三視圖／零件圖／材料單／工序）", () => {
    const page = readFileSync(join(ROOT, "app", "[locale]", "design", "[type]", "page.tsx"), "utf8");
    for (const guarded of ["ZoomableThreeViews", "PartDrawingsPanel", "MaterialListWithSelection", "BuildSteps"]) {
      const line = page.split("\n").find((l) => l.includes(`<${guarded}`));
      expect(line, `找不到 ${guarded}`).toBeTruthy();
      expect(line, `${guarded} 沒有被 examLocked 擋住`).toContain("examLocked");
    }
  });
});
