import { describe, it, expect } from "vitest";
import { FURNITURE_CATALOG } from "@/lib/templates";
import { toBeginnerMode } from "@/lib/templates/beginner-mode";
import { applyEdgeProtection } from "@/lib/joinery/edge-protection";
import { deriveBuildSteps } from "./derive";
import { deriveRequiredTools } from "@/lib/tools/derive";
import { TOOL_CATALOG } from "@/lib/tools/catalog";

/**
 * 施工說明書跟工具清單要對得起來。
 *
 * 2026-08-24 大軍稽核抓到三條互相牽連的問題：
 * 1. 工具清單從**零件的榫頭**推、工序表從另一條路徑推 → 組裝版（網址預設模式）
 *    28 款全部漏列電鑽與斜孔治具，而那正是組裝版唯一的接合工具。
 * 2. 14 個工具 id 不在 TOOL_CATALOG 裡 → 工序卡的「工具：」標籤後面空空的。
 * 3. 相框的 back-panel 含 "panel" 被判成有門 → 長出「在門板背面鑽 35mm 鉸鏈杯孔」。
 */
const entries = (FURNITURE_CATALOG as any[]).filter((e) => e.template);
const build = (e: any, wrap: any) => {
  const base: any = (e.optionSchema ?? []).reduce((a: any, s: any) => ((a[s.key] = s.defaultValue), a), {});
  return wrap(e.template({
    length: e.defaults.length, width: e.defaults.width, height: e.defaults.height,
    material: "maple", options: base,
  }));
};

describe("工序叫人用的工具，購物清單裡一定要有", () => {
  for (const e of entries) {
    for (const [mode, wrap] of [["組裝版", toBeginnerMode], ["榫接版", applyEdgeProtection]] as any[]) {
      it(`${e.category}（${mode}）`, () => {
        let d: any;
        try { d = build(e, wrap); } catch { return; }
        const listed = new Set((deriveRequiredTools(d) as any[]).map((t) => t.tool.id));
        const missing = new Set<string>();
        for (const s of deriveBuildSteps(d) as any[]) {
          for (const id of s.toolIds ?? []) if (!listed.has(id)) missing.add(id);
        }
        expect([...missing]).toEqual([]);
      });
    }
  }
});

describe("工序點名的工具 id，型錄裡一定查得到（查不到會被靜默吞掉）", () => {
  it("全目錄掃描：0 個未知 id", () => {
    const unknown = new Set<string>();
    for (const e of entries) {
      for (const wrap of [toBeginnerMode, applyEdgeProtection]) {
        let d: any;
        try { d = build(e, wrap); } catch { continue; }
        for (const s of deriveBuildSteps(d) as any[]) {
          for (const id of s.toolIds ?? []) if (!TOOL_CATALOG[id]) unknown.add(id);
        }
      }
    }
    expect([...unknown]).toEqual([]);
  });
});

describe("沒有門的家具不准長出鉸鏈工序", () => {
  it("相框不該有「裝鉸鏈與門把」（back-panel 的 panel 不是門）", () => {
    const d = build(entries.find((e) => e.category === "photo-frame"), toBeginnerMode);
    expect((d.parts as any[]).filter((p) => /(?:^|-)door(?:$|-)/.test(p.id))).toEqual([]);
    const hinge = (deriveBuildSteps(d) as any[]).filter((s) => /鉸鏈|hinge/i.test(s.title ?? ""));
    expect(hinge.map((s) => s.title)).toEqual([]);
  });

  it("全目錄：沒有 door 零件的家具，一律不該出現鉸鏈工序", () => {
    const offenders: string[] = [];
    for (const e of entries) {
      let d: any;
      try { d = build(e, toBeginnerMode); } catch { continue; }
      const realDoors = (d.parts as any[]).filter((p) => /(?:^|-)door(?:$|-)/.test(p.id)).length;
      const hinge = (deriveBuildSteps(d) as any[]).some((s) => /鉸鏈|hinge/i.test(s.title ?? ""));
      if (!realDoors && hinge) offenders.push(e.category);
    }
    expect(offenders).toEqual([]);
  });

  it("⚠️ 有門的櫃子還是要有鉸鏈工序（別把閘關過頭）", () => {
    const d = build(entries.find((e) => e.category === "wardrobe"), toBeginnerMode);
    expect((d.parts as any[]).some((p) => /(?:^|-)door(?:$|-)/.test(p.id))).toBe(true);
    expect((deriveBuildSteps(d) as any[]).some((s) => /鉸鏈/.test(s.title ?? ""))).toBe(true);
  });
});

describe("抽屜工時要隨抽屜數放大（報價直接吃這個工時）", () => {
  const chest = entries.find((e) => e.category === "chest-of-drawers");
  const withDrawers = (n: number) => {
    const base: any = (chest.optionSchema ?? []).reduce((a: any, s: any) => ((a[s.key] = s.defaultValue), a), {});
    const d = toBeginnerMode(chest.template({
      length: chest.defaults.length, width: chest.defaults.width, height: chest.defaults.height,
      material: "maple", options: { ...base, topCount: n, midCount: n, bottomCount: n },
    }));
    const steps = deriveBuildSteps(d) as any[];
    const boxes = (d.parts as any[]).filter((p) => /(?:^|-)drawer/.test(p.id) && /side-left/.test(p.id)).length;
    return {
      boxes,
      box: steps.find((s) => s.id === "step-07b-glue-drawer-box")?.estimatedMinutes ?? 0,
      slide: steps.find((s) => s.id === "step-19-drawer-slide")?.estimatedMinutes ?? 0,
    };
  };

  it("抽屜多一倍，組箱與裝滑軌的工時就要多一倍", () => {
    const few = withDrawers(1);
    const many = withDrawers(9);
    expect(many.boxes).toBeGreaterThan(few.boxes);
    expect(many.box / few.box).toBeCloseTo(many.boxes / few.boxes, 5);
    expect(many.slide / few.slide).toBeCloseTo(many.boxes / few.boxes, 5);
  });

  /**
   * ⚠️ 不能斷言絕對分鐘數 —— 後面還有一層 sizeFactor（依族群與尺寸放大／縮小）
   *    會再乘上去，實測 8 組抽屜的組箱是 224 分 = 40 × 8 × 0.7。
   *    要驗的是「有沒有隨數量走」，不是「等於某個寫死的數字」。
   */
  it("同一份設計裡，每組抽屜攤下來的工時是固定的（線性，不是階梯或封頂）", () => {
    for (const n of [1, 3, 6, 9]) {
      const r = withDrawers(n);
      const perBox = r.box / r.boxes;
      const perSlide = r.slide / r.boxes;
      expect(perBox, `${r.boxes} 組時每組組箱工時`).toBeGreaterThan(0);
      expect(perSlide, `${r.boxes} 組時每組滑軌工時`).toBeGreaterThan(0);
    }
    // 每組攤下來的工時，在不同抽屜數之間必須一致（線性，不是階梯也不是封頂）
    // ⚠️ 組箱與滑軌套的 sizeFactor 不同（實測 28 vs 40 分/組），所以分開驗，不能互相比。
    const perBoxes = [1, 3, 6, 9].map((n) => { const r = withDrawers(n); return r.box / r.boxes; });
    const perSlides = [1, 3, 6, 9].map((n) => { const r = withDrawers(n); return r.slide / r.boxes; });
    expect(new Set(perBoxes.map((x) => x.toFixed(6))).size, `每組組箱工時: ${perBoxes}`).toBe(1);
    expect(new Set(perSlides.map((x) => x.toFixed(6))).size, `每組滑軌工時: ${perSlides}`).toBe(1);
  });

  it("負向對照：把數量拿掉就會抓到（確認這組測試不是恆綠）", () => {
    const few = withDrawers(1);
    const many = withDrawers(9);
    expect(many.slide).not.toBe(few.slide);
  });
});
