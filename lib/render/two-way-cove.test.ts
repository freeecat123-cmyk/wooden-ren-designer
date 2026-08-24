import { describe, it, expect } from "vitest";
import { projectPartSilhouette, projectPartPolygon, curvedTaperProfilePoints } from "./geometry";
import { curvedTaperInsetAtY } from "./part-geometry";
import { FURNITURE_CATALOG } from "@/lib/templates";
import { toBeginnerMode } from "@/lib/templates/beginner-mode";

/**
 * 兩向弧肩（§A9.9）：把同一道「方肩→凹弧→斜降」同時做在兩個相鄰內面。
 *
 * 腳站在家具角落，兩個方向都有牙條進來，本來就該有兩道弧肩。
 * 現有做法是「單一側面輪廓沿厚度擠出」→ 只有一面有造型，從另一邊看是方料。
 *
 * ⚠️ 最重要的一條：**關掉時輸出必須跟改動前完全一致**。
 */
const leg = (twoWay: boolean, extra: Record<string, unknown> = {}) => ({
  id: "leg-1", nameZh: "腳", material: "maple", grainDirection: "length",
  visible: { length: 60, width: 60, thickness: 420 },
  origin: { x: 0, y: 210, z: 0 }, tenons: [], mortises: [],
  shape: {
    kind: "curved-taper", blockHeightMm: 40, shoulderMm: 8, insetMm: 12, dir: 1,
    ...(twoWay ? { twoWay: true } : {}), ...extra,
  },
}) as never;

describe("內縮函式跟原本的輪廓點必須逐點一致", () => {
  it("同一組參數下，兩者算出的內面 X 完全相同（誤差 < 0.001mm）", () => {
    const lx = 60, ly = 420;
    const pts = curvedTaperProfilePoints(lx, ly, 40, 8, 12, 1);
    for (const [x, y] of pts) {
      if (x > 0) continue; // 只比內面
      expect(-lx / 2 + curvedTaperInsetAtY(lx, ly, 40, 8, 12, y)).toBeCloseTo(x, 3);
    }
  });

  it("三段各自的行為：方肩段 0、弧段遞增、斜降段最深", () => {
    const f = (y: number) => curvedTaperInsetAtY(60, 420, 40, 8, 12, y);
    expect(f(210)).toBeCloseTo(0, 6);       // 頂
    expect(f(180)).toBeCloseTo(0, 6);       // 方肩段內
    expect(f(-210)).toBeCloseTo(8 + 12, 6); // 腳底 = shoulder + inset
    expect(f(0)).toBeGreaterThan(8);        // 斜降段
    expect(f(0)).toBeLessThan(8 + 12);
  });
});

describe("⚠️ 關掉兩向時，三視圖輸出跟改動前完全一致", () => {
  for (const view of ["front", "side", "top"] as const) {
    it(`${view}：單向的 silhouette 不受影響`, () => {
      const off = projectPartSilhouette(leg(false), view);
      // 單向側視本來就是方框(4 點)、正視是輪廓(13 點)
      expect(off.length).toBe(view === "front" ? 13 : 4);
    });
  }

  it("單向的側視 polygon 仍是矩形", () => {
    expect(projectPartPolygon(leg(false), "side").length).toBe(4);
  });
});

describe("開啟兩向後，只有側視改變", () => {
  it("正視不動（那一面本來就有弧肩）", () => {
    expect(JSON.stringify(projectPartSilhouette(leg(true), "front")))
      .toBe(JSON.stringify(projectPartSilhouette(leg(false), "front")));
  });

  it("俯視不動（斷面最寬處在頂部，本來就是矩形）", () => {
    expect(JSON.stringify(projectPartSilhouette(leg(true), "top")))
      .toBe(JSON.stringify(projectPartSilhouette(leg(false), "top")));
  });

  it("⭐ 側視從 4 點方框變成 13 點輪廓", () => {
    expect(projectPartSilhouette(leg(false), "side").length).toBe(4);
    expect(projectPartSilhouette(leg(true), "side").length).toBe(13);
  });

  it("側視 polygon 也要跟著變（三視圖實際畫的是它）", () => {
    expect(projectPartPolygon(leg(false), "side").length).toBe(4);
    expect(projectPartPolygon(leg(true), "side").length).toBe(13);
  });

  it("側視輪廓確實是凹的（不是被 hull 填平成方框）", () => {
    const poly = projectPartPolygon(leg(true), "side") as Array<{ x: number; y: number }>;
    const xs = poly.map((p) => p.x);
    // 有中間值不落在兩端 → 代表有階梯與弧，不是矩形
    expect(new Set(xs.map((x) => x.toFixed(2))).size).toBeGreaterThan(2);
  });
});

describe("三款有弧肩斜腳的家具，開兩向後輪廓都合法", () => {
  for (const cat of ["stool", "bar-stool", "dining-chair"]) {
    it(cat, () => {
      const e = (FURNITURE_CATALOG as never[] as any[]).find((x) => x.category === cat)!;
      const base: any = (e.optionSchema ?? []).reduce((a: any, s: any) => ((a[s.key] = s.defaultValue), a), {});
      const d = e.template({
        length: e.defaults.length, width: e.defaults.width, height: e.defaults.height,
        material: "maple", options: { ...base, legShape: "curved-taper", ctTwoWay: true },
      });
      const legs = (d.parts as any[]).filter((p) => p.shape?.kind === "curved-taper");
      expect(legs.length).toBeGreaterThan(0);
      for (const p of legs) {
        for (const v of ["front", "side", "top"] as const) {
          const poly = projectPartSilhouette(p, v) as Array<{ x: number; y: number }>;
          expect(poly.length, `${cat} ${v} 點數`).toBeGreaterThanOrEqual(3);
          expect(poly.every((q) => Number.isFinite(q.x) && Number.isFinite(q.y))).toBe(true);
          let area = 0;
          for (let i = 0; i < poly.length; i++) {
            const a = poly[i], b = poly[(i + 1) % poly.length];
            area += a.x * b.y - b.x * a.y;
          }
          expect(Math.abs(area / 2), `${cat} ${v} 面積`).toBeGreaterThan(1);
        }
      }
    });
  }
});

describe("挖弧肩要算工時，但不該多算材料", () => {
  /**
   * 2026-08-24：工序推導原本完全不知道弧肩斜腳存在，挖弧的工時是 0。
   * quote.ts 直接吃 totalEstimatedHours() 算工資 → 這道工白做。
   *
   * ⚠️ 同時修掉一個我自己寫錯的 UI 文案：原本寫「會多耗料」是**錯的** ——
   *    弧肩是從同一根方料挖掉的，料一點都沒多，多的是工。
   */
  const build = (cat: string, twoWay: boolean) => {
    const e = (FURNITURE_CATALOG as never[] as any[]).find((x) => x.category === cat)!;
    const base: any = (e.optionSchema ?? []).reduce((a: any, s: any) => ((a[s.key] = s.defaultValue), a), {});
    return e.template({
      length: e.defaults.length, width: e.defaults.width, height: e.defaults.height,
      material: "maple", options: { ...base, legShape: "curved-taper", ctTwoWay: twoWay },
    });
  };

  for (const cat of ["stool", "bar-stool", "dining-chair"]) {
    it(`${cat}：兩向的挖弧工時剛好是單向的兩倍`, async () => {
      const { deriveBuildSteps } = await import("@/lib/steps/derive");
      const one = (deriveBuildSteps(build(cat, false)) as any[]).find((s) => s.id === "step-06b-cove-legs");
      const two = (deriveBuildSteps(build(cat, true)) as any[]).find((s) => s.id === "step-06b-cove-legs");
      expect(one, "單向也要有挖弧工序").toBeTruthy();
      expect(two, "兩向也要有挖弧工序").toBeTruthy();
      expect(two.estimatedMinutes / one.estimatedMinutes).toBeCloseTo(2, 6);
    });

    it(`${cat}：材料一點都沒多（弧是從同一根方料挖掉的）`, async () => {
      const { calculateQuote } = await import("@/lib/pricing/quote");
      const { LABOR_DEFAULTS } = await import("@/lib/pricing/labor");
      const opts: any = { ...LABOR_DEFAULTS, primaryMaterialPricePerBdft: 300 };
      const a: any = calculateQuote(build(cat, false), opts);
      const b: any = calculateQuote(build(cat, true), opts);
      expect(b.totalBdft).toBeCloseTo(a.totalBdft, 6);
      expect(b.materialCost).toBeCloseTo(a.materialCost, 6);
      // 但工時與總價要變高
      expect(b.laborHours).toBeGreaterThan(a.laborHours);
      expect(b.total).toBeGreaterThan(a.total);
    });
  }

  it("沒有弧肩斜腳的家具不該長出挖弧工序", async () => {
    const { deriveBuildSteps } = await import("@/lib/steps/derive");
    const e = (FURNITURE_CATALOG as never[] as any[]).find((x) => x.category === "stool")!;
    const base: any = (e.optionSchema ?? []).reduce((a: any, s: any) => ((a[s.key] = s.defaultValue), a), {});
    const d = e.template({
      length: e.defaults.length, width: e.defaults.width, height: e.defaults.height,
      material: "maple", options: { ...base, legShape: "box" },
    });
    expect((deriveBuildSteps(d) as any[]).some((s) => s.id === "step-06b-cove-legs")).toBe(false);
  });
});

describe("牙板被夾住時要出聲（§A10.11 第 2 條）", () => {
  /**
   * 夾制本身是對的（牙板下緣不能蓋到弧肩），但原本**默默**把使用者設的 200mm
   * 改成 40mm，畫面上一句話都沒有 —— 使用者會以為滑桿壞了。
   */
  for (const cat of ["stool", "bar-stool", "dining-chair"]) {
    it(`${cat}：把牙板高拉到最大 → 有警告，而且講得出實際做出多少`, () => {
      const e = (FURNITURE_CATALOG as never[] as any[]).find((x) => x.category === cat)!;
      const spec = (e.optionSchema ?? []).find((s: any) => s.key === "apronWidth");
      const base: any = (e.optionSchema ?? []).reduce((a: any, s: any) => ((a[s.key] = s.defaultValue), a), {});
      const d: any = e.template({
        length: e.defaults.length, width: e.defaults.width, height: e.defaults.height,
        material: "maple", options: { ...base, legShape: "curved-taper", apronWidth: spec.max },
      });
      const w = (d.warnings ?? []).find((x: string) => /牙板高/.test(x));
      expect(w, "應該要有牙板被夾的警告").toBeTruthy();
      expect(w).toContain(String(spec.max));
    });

    it(`${cat}：牙板在範圍內時不可以亂噴警告`, () => {
      const e = (FURNITURE_CATALOG as never[] as any[]).find((x) => x.category === cat)!;
      const base: any = (e.optionSchema ?? []).reduce((a: any, s: any) => ((a[s.key] = s.defaultValue), a), {});
      const d: any = e.template({
        length: e.defaults.length, width: e.defaults.width, height: e.defaults.height,
        material: "maple", options: { ...base, legShape: "curved-taper", apronWidth: 20, ctBlockHeight: 120 },
      });
      expect((d.warnings ?? []).filter((x: string) => /牙板高/.test(x))).toEqual([]);
    });
  }
});

/**
 * ⭐ 方向迴歸 —— 這一組釘住 2026-08-24 上線後回報的 bug（詳見 docs §A9.9）。
 *
 * 當時 `dirZ` 多乘了一個 -1，弧被挖到「朝外」那面：
 *   使用者看到的是「新做的這面沒有弧」+「透視穿了 15.6mm」，
 *   而所有既有稽核都是綠的（它們只掃 legShape 下拉選單，不掃勾選框）。
 *
 * 這裡不看 dirZ 這個欄位本身，直接量**投影出來的輪廓**：
 * 弧一定要出現在「朝家具中心」那一面 —— 跟單向弧肩的 X 面同一個慣例。
 */
describe("兩向弧肩：弧要挖在朝家具中心那面（不是朝外）", () => {
  // side: vx = -worldZ ; front: vx = -worldX（geometry.ts:422）
  const spanAtY = (poly: { x: number; y: number }[], y: number) => {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      if ((a.y - y) * (b.y - y) > 0) continue;
      const t = Math.abs(b.y - a.y) < 1e-9 ? 0 : (y - a.y) / (b.y - a.y);
      const v = a.x + t * (b.x - a.x);
      lo = Math.min(lo, v); hi = Math.max(hi, v);
    }
    return lo > hi ? null : { min: -hi, max: -lo };   // 轉回 world 座標
  };

  for (const cat of ["tea-table", "stool", "side-table", "low-table"]) {
    it(`${cat}：四支腳的兩個弧都朝中心`, () => {
      const e = (FURNITURE_CATALOG as never[] as any[]).find((x) => x.category === cat)!;
      const base: any = (e.optionSchema ?? []).reduce((a: any, s: any) => ((a[s.key] = s.defaultValue), a), {});
      const d: any = toBeginnerMode(e.template({
        length: e.defaults.length, width: e.defaults.width, height: e.defaults.height,
        material: "maple", options: { ...base, legShape: "curved-taper", ctTwoWay: true },
      }));
      const legs = d.parts.filter((p: any) => p.shape?.kind === "curved-taper" && p.shape?.twoWay);
      expect(legs.length, "應該要有兩向弧肩的腳").toBeGreaterThan(0);

      for (const leg of legs) {
        const y = leg.origin.y + leg.visible.thickness * 0.35;   // 弧段中間
        const wx = spanAtY(projectPartSilhouette(leg, "front"), y);
        const wz = spanAtY(projectPartSilhouette(leg, "side"), y);
        expect(wx, `${leg.id} front 輪廓在 y=${y} 取不到`).toBeTruthy();
        expect(wz, `${leg.id} side 輪廓在 y=${y} 取不到`).toBeTruthy();

        const hx = leg.visible.length / 2, hz = leg.visible.width / 2;
        // 「朝中心」= 座標絕對值較小那一端；退了 = 該端離腳中心變近
        const inX = leg.origin.x < 0 ? hx - (wx!.max - leg.origin.x) : hx - (leg.origin.x - wx!.min);
        const outX = leg.origin.x < 0 ? hx - (leg.origin.x - wx!.min) : hx - (wx!.max - leg.origin.x);
        const inZ = leg.origin.z < 0 ? hz - (wz!.max - leg.origin.z) : hz - (leg.origin.z - wz!.min);
        const outZ = leg.origin.z < 0 ? hz - (leg.origin.z - wz!.min) : hz - (wz!.max - leg.origin.z);

        expect(inX, `${leg.id}: X 朝中心那面必須被挖`).toBeGreaterThan(1);
        expect(outX, `${leg.id}: X 朝外那面不可以動`).toBeLessThan(0.05);
        expect(inZ, `${leg.id}: Z 朝中心那面必須被挖（dirZ 符號反了就會是 0）`).toBeGreaterThan(1);
        expect(outZ, `${leg.id}: Z 朝外那面不可以動（dirZ 符號反了就會是這個被挖）`).toBeLessThan(0.05);
        expect(inZ, `${leg.id}: 兩個方向挖的量要一樣`).toBeCloseTo(inX, 3);
      }
    });
  }
});
