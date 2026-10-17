import { describe, expect, it } from "vitest";
import { getTemplate } from "@/lib/templates";
import type { FurnitureCategory } from "@/lib/types";
import { buildDesign, resolveDesignInputs } from "./compute-design";

// 瀏覽器即時預覽跟 server 共用這支：付費鎖 / 上限一鬆，預覽就會先畫出 server 不給的尺寸。
const entry = (c: string) => getTemplate(c as FurnitureCategory)!;
const open = { previewLocked: false, canBypassLimits: false };

describe("resolveDesignInputs", () => {
  it("付費鎖：網址帶的尺寸與結構選項全丟，只留材料", () => {
    const r = resolveDesignInputs("side-table", entry("side-table"),
      { length: "600", height: "700", material: "walnut", withDrawer: "true" }, { previewLocked: true, canBypassLimits: false });
    // 邊桌預設 450×400×600
    expect([r.length, r.width, r.height]).toEqual([450, 400, 600]);
    expect(r.material).toBe("walnut");
    expect(r.options.withDrawer).toBe(entry("side-table").optionSchema!.find(s => s.key === "withDrawer")!.defaultValue);
  });

  it("沒鎖就吃網址尺寸", () => {
    const r = resolveDesignInputs("side-table", entry("side-table"), { length: "600", height: "700" }, open);
    expect([r.length, r.height]).toEqual([600, 700]);
  });

  it("上限：方凳 500 封頂，自由尺寸要方案允許＋網址帶 designerMode 才解除", () => {
    const sp = { length: "900", width: "900", height: "900", designerMode: "true" };
    const capped = resolveDesignInputs("stool", entry("stool"), sp, open);
    expect([capped.length, capped.width, capped.height]).toEqual([500, 500, 500]);
    const free = resolveDesignInputs("stool", entry("stool"), sp, { previewLocked: false, canBypassLimits: true });
    expect([free.length, free.width, free.height]).toEqual([900, 900, 900]);
    const noFlag = resolveDesignInputs("stool", entry("stool"), { length: "900" }, { previewLocked: false, canBypassLimits: true });
    expect(noFlag.length).toBe(500);
  });

  it("圓形家具寬度跟著直徑", () => {
    const r = resolveDesignInputs("round-stool", entry("round-stool"), { length: "380", width: "200" }, open);
    expect(r.width).toBe(380);
  });

  it("書桌 H 框離地高夾到櫃底以下", () => {
    // 桌高 750、面板 28、牙板 90 → 腳高 722、櫃頂 627；2 抽 → 櫃高 290、櫃底 337；H 框上限 337−40 = 297
    const r = resolveDesignInputs("desk", entry("desk"),
      { height: "750", drawerCount: "2", pedestalStretcherHeight: "500", topThickness: "28", apronWidth: "90", withApron: "true" }, open);
    expect(r.options.pedestalStretcherHeight).toBe(297);
  });

  it("算得出模型", () => {
    const r = resolveDesignInputs("stool", entry("stool"), { length: "400" }, open);
    const { design } = buildDesign(entry("stool"), r, "zh-TW");
    expect(design.parts.length).toBeGreaterThan(0);
    expect(design.overall.length).toBe(400);
  });
});
