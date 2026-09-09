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

  it("被鎖的那幾段真的都掛上 examLocked（三視圖／零件圖／材料單／工序）", () => {
    const page = readFileSync(join(ROOT, "app", "[locale]", "design", "[type]", "page.tsx"), "utf8");
    for (const guarded of ["ZoomableThreeViews", "PartDrawingsPanel", "MaterialListWithSelection", "BuildSteps"]) {
      const line = page.split("\n").find((l) => l.includes(`<${guarded}`));
      expect(line, `找不到 ${guarded}`).toBeTruthy();
      expect(line, `${guarded} 沒有被 examLocked 擋住`).toContain("examLocked");
    }
  });
});
