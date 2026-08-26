import { describe, it, expect } from "vitest";
import { projectPartSilhouette, projectPartPolygon, curvedTaperProfilePoints } from "./geometry";
import * as fs from "node:fs";
import { CURVED_TAPER_ARC_SEG, buildCurvedTaperGeometry, buildTwoWayCurvedTaperGeometry, curvedTaperCoveSpan, curvedTaperInsetAtY } from "./part-geometry";
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

/**
 * 輪廓點數 = 5 個固定轉折點 + 弧段取樣數。
 * ⚠️ 不要寫死數字 —— 2026-08-25 把弧從 8 段加密到 24 段時,這裡三條全紅。
 *    改成跟實際取樣數連動,加密弧段不會誤傷,但「弧不見了」仍然會被抓到。
 */
const PROFILE_PTS = 5 + CURVED_TAPER_ARC_SEG;   // 5 個固定轉折點 + 弧段取樣數

describe("⚠️ 關掉兩向時，三視圖輸出跟改動前完全一致", () => {
  for (const view of ["front", "side", "top"] as const) {
    it(`${view}：單向的 silhouette 不受影響`, () => {
      const off = projectPartSilhouette(leg(false), view);
      // 單向側視本來就是方框(4 點)、正視是弧肩輪廓
      expect(off.length).toBe(view === "front" ? PROFILE_PTS : 4);
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

  it("⭐ 側視從 4 點方框變成弧肩輪廓", () => {
    expect(projectPartSilhouette(leg(false), "side").length).toBe(4);
    expect(projectPartSilhouette(leg(true), "side").length).toBe(PROFILE_PTS);
  });

  it("側視 polygon 也要跟著變（三視圖實際畫的是它）", () => {
    expect(projectPartPolygon(leg(false), "side").length).toBe(4);
    expect(projectPartPolygon(leg(true), "side").length).toBe(PROFILE_PTS);
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

    it(`${cat}：腳的用料一點都沒多（弧是從同一根方料挖掉的）`, () => {
      /**
       * ⚠️ 這條原本斷言「總材積完全不變」,2026-08-25 改成「腳不變、總量只准微增」。
       *
       * 原因不是放水:兩向弧肩把腳的 Z 內面也挖掉了,兩腳之間在橫撐高度的
       * **淨距離真的變寬**,Z 向橫撐必須做長才頂得到腳的實際面
       * (不補的話端頭懸空在凹弧裡,埋在裡面的紅色榫頭會露出來)。
       * 所以材料本來就該多一點點 —— 多的是橫撐,不是腳。
       *
       * 守住真正該守的:**腳的材積必須逐一相同**,而且總量增幅要很小(<2%)。
       */
      const legBdft = (d: any) =>
        (d.parts as any[])
          .filter((p) => p.shape?.kind === "curved-taper")
          .map((p) => p.visible.length * p.visible.width * p.visible.thickness)
          .sort((x, y) => x - y);
      const A = build(cat, false), B = build(cat, true);
      expect(legBdft(B), "腳的材積不可以變").toEqual(legBdft(A));
    });

    it(`${cat}：兩向的總材積只准微增（橫撐變長）、工時與總價要變高`, async () => {
      const { calculateQuote } = await import("@/lib/pricing/quote");
      const { LABOR_DEFAULTS } = await import("@/lib/pricing/labor");
      const opts: any = { ...LABOR_DEFAULTS, primaryMaterialPricePerBdft: 300 };
      const a: any = calculateQuote(build(cat, false), opts);
      const b: any = calculateQuote(build(cat, true), opts);
      expect(b.totalBdft).toBeGreaterThanOrEqual(a.totalBdft);
      expect((b.totalBdft - a.totalBdft) / a.totalBdft, "增幅超過 2% 代表有東西算爆了").toBeLessThan(0.02);
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
    it(`${cat}：牙條高到腳裝不下時要出聲`, () => {
      const e = (FURNITURE_CATALOG as never[] as any[]).find((x) => x.category === cat)!;
      const spec = (e.optionSchema ?? []).find((s: any) => s.key === "apronWidth");
      const base: any = (e.optionSchema ?? []).reduce((a: any, s: any) => ((a[s.key] = s.defaultValue), a), {});
      /**
       * ⚠️ 2026-08-25 反轉:接撐段會長高去容納牙條,所以在滑桿範圍內**不會**再被夾。
       *    要驗「夾了要出聲」得推到真的放不下(牙條高過腳高)。
       */
      const tooTall = Math.round(e.defaults.height * 1.5);
      const d: any = e.template({
        length: e.defaults.length, width: e.defaults.width, height: e.defaults.height,
        material: "maple", options: { ...base, legShape: "curved-taper", apronWidth: tooTall },
      });
      const w = (d.warnings ?? []).find((x: string) => /牙板高|牙條高/.test(x));
      expect(w, "真的放不下卻沒有警告 = 使用者會以為滑桿壞了").toBeTruthy();
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

/**
 * ⭐⭐ 網格朝向 —— 這一組就是 2026-08-25 木頭仁連報三次都沒被我抓到的那個 bug。
 *
 * 症狀:「表面不見了」「變透視」「外層不見了」。
 * 真因:兩向弧肩的側面四邊形繞行順序寫反 → 法線全部朝內 →
 *       GPU 的 FrontSide culling 把腳的外皮整個剔掉不畫 →
 *       從外面看穿進腳裡,埋在裡面的紅色榫頭全部露出來。
 *
 * ⚠️ 為什麼原本 14 條測試全綠卻沒抓到:它們驗的都是 **2D 輪廓函式與投影**
 *    (curvedTaperInsetAtY / projectPartSilhouette),那些本來就是對的。
 *    **3D 網格本身從頭到尾沒有任何一條測試碰過。**
 *    ⇒ 教訓:做「新的幾何 builder」時,2D 數學對不等於 3D 網格對。
 */
describe("兩向弧肩的 3D 網格必須是封閉、面朝外的實體", () => {
  /** 散度定理:封閉網格的有號體積。正 = 面朝外;負 = 法線反了(外皮會被剔掉) */
  const signedVolume = (g: { getAttribute: (n: string) => any; getIndex: () => any }) => {
    const pos = g.getAttribute("position");
    const idx = g.getIndex();
    const n = idx ? idx.count : pos.count;
    const at = (i: number) => {
      const k = idx ? idx.getX(i) : i;
      return [pos.getX(k), pos.getY(k), pos.getZ(k)] as const;
    };
    let v = 0;
    for (let i = 0; i < n; i += 3) {
      const [ax, ay, az] = at(i), [bx, by, bz] = at(i + 1), [cx, cy, cz] = at(i + 2);
      v += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
    }
    return v;
  };
  /** 每條邊要剛好被 2 個三角形共用,否則有破口(缺蓋 / 破面) */
  const openEdges = (g: { getAttribute: (n: string) => any; getIndex: () => any }) => {
    const pos = g.getAttribute("position");
    const idx = g.getIndex();
    const n = idx ? idx.count : pos.count;
    const key = (i: number) => {
      const k = idx ? idx.getX(i) : i;
      return `${pos.getX(k).toFixed(4)},${pos.getY(k).toFixed(4)},${pos.getZ(k).toFixed(4)}`;
    };
    const m = new Map<string, number>();
    for (let i = 0; i < n; i += 3) {
      const v = [key(i), key(i + 1), key(i + 2)];
      for (let e = 0; e < 3; e++) {
        const a = v[e], b = v[(e + 1) % 3];
        const k = a < b ? `${a}|${b}` : `${b}|${a}`;
        m.set(k, (m.get(k) ?? 0) + 1);
      }
    }
    return [...m.values()].filter((c) => c !== 2).length;
  };

  const SIZE: [number, number, number] = [35, 425, 35];
  const [BH, SH, INS] = [40, 8, 12];

  it("有號體積必須為正（繞反 = 外皮被 culling 剔掉 = 外層不見了）", () => {
    const g = buildTwoWayCurvedTaperGeometry(SIZE, BH, SH, INS, -1, -1, 0, 0);
    expect(signedVolume(g as never), "體積是負的 → 側面法線朝內,腳會變透明").toBeGreaterThan(0);
  });

  it("網格必須封閉（沒有破口邊）", () => {
    const g = buildTwoWayCurvedTaperGeometry(SIZE, BH, SH, INS, -1, -1, 0, 0);
    expect(openEdges(g as never), "有破口邊 → 缺蓋或破面").toBe(0);
  });

  it("體積要比單向小（兩面都挖,料一定更少）而且落在合理範圍", () => {
    const one = buildCurvedTaperGeometry(SIZE, BH, SH, INS, -1, 0, 0);
    const two = buildTwoWayCurvedTaperGeometry(SIZE, BH, SH, INS, -1, -1, 0, 0);
    const vOne = signedVolume(one as never), vTwo = signedVolume(two as never);
    expect(vOne).toBeGreaterThan(0);
    expect(vTwo).toBeGreaterThan(0);
    expect(vTwo, "兩向挖掉更多料,體積必須比單向小").toBeLessThan(vOne);
    // 不能挖到只剩皮:至少要有方料的 1/3
    expect(vTwo).toBeGreaterThan((SIZE[0] * SIZE[1] * SIZE[2]) / 3);
  });

  it("四個方向組合都要是正體積、封閉", () => {
    for (const dx of [-1, 1] as const)
      for (const dz of [-1, 1] as const) {
        const g = buildTwoWayCurvedTaperGeometry(SIZE, BH, SH, INS, dx, dz, 0, 0);
        expect(signedVolume(g as never), `dirX=${dx} dirZ=${dz} 體積是負的`).toBeGreaterThan(0);
        expect(openEdges(g as never), `dirX=${dx} dirZ=${dz} 有破口`).toBe(0);
      }
  });
});

/**
 * ⭐ 弧要是「順的」,不是幾片平面拼的。
 *
 * 木頭仁 2026-08-25:「這個弧肩的弧是好幾個平面組成,不是順順的弧」。
 * 兩個原因,都在這組釘住:
 *
 * 1. **兩向弧肩的取樣高度平均分佈在整支腳上** —— 腳 425mm、40 層 → 間隔 10.6mm,
 *    而弧只有 8mm 高 ⇒ **弧段裡一個取樣點都沒有**,被切成一刀斜面。
 *    改成照輪廓轉折點取樣、弧段給 24 段。
 * 2. **弧的取樣數有兩份**(3D 網格一份、三視圖輪廓一份),只改一邊會讓
 *    畫面跟圖紙對不起來。當時 165 組腳型指紋「沒反應」就是因為它量的是輪廓那份。
 */
describe("弧肩的弧必須夠密（不可以是幾片平面）", () => {
  const SIZE: [number, number, number] = [35, 425, 35];
  const [BH, SH, INS] = [40, 8, 12];

  /** 落在弧段高度範圍內的三角形有幾種不同法線 = 視覺上幾片平面 */
  const facetsInCove = (g: any) => {
    const cove = curvedTaperCoveSpan(SIZE[0], SIZE[1], BH, SH);
    const hy = SIZE[1] / 2, yBlockBot = hy - BH, yCoveEnd = yBlockBot - cove;
    const pos = g.getAttribute("position");
    const idx = g.getIndex();
    const n = idx ? idx.count : pos.count;
    const at = (i: number) => {
      const k = idx ? idx.getX(i) : i;
      return [pos.getX(k), pos.getY(k), pos.getZ(k)] as [number, number, number];
    };
    const normals = new Set<string>();
    for (let i = 0; i < n; i += 3) {
      const a = at(i), b = at(i + 1), c = at(i + 2);
      const ys = [a[1], b[1], c[1]];
      if (Math.min(...ys) < yCoveEnd - 0.01 || Math.max(...ys) > yBlockBot + 0.01) continue;
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const nx = u[1] * v[2] - u[2] * v[1], ny = u[2] * v[0] - u[0] * v[2], nz = u[0] * v[1] - u[1] * v[0];
      const len = Math.hypot(nx, ny, nz);
      if (len > 1e-9) normals.add(`${(nx / len).toFixed(2)},${(ny / len).toFixed(2)},${(nz / len).toFixed(2)}`);
    }
    return normals.size;
  };

  it("兩向：弧段裡至少要有 16 種法線方向（0 = 整段被跳過）", () => {
    const g = buildTwoWayCurvedTaperGeometry(SIZE, BH, SH, INS, -1, -1, 0, 0);
    expect(facetsInCove(g), "弧段取樣太疏 → 3D 看起來是幾片平面").toBeGreaterThanOrEqual(16);
  });

  it("單向：弧段裡至少要有 16 種法線方向", () => {
    const g = buildCurvedTaperGeometry(SIZE, BH, SH, INS, -1, 0, 0);
    expect(facetsInCove(g), "弧段取樣太疏 → 3D 看起來是幾片平面").toBeGreaterThanOrEqual(16);
  });

  /**
   * ⭐ 2026-08-25 升級:原本是「兩份 ARC 的數字要一樣」。
   *    統一之後只剩一份(`CURVED_TAPER_ARC_SEG`),所以改成釘更強的:
   *    **不准再出現第二份定義**,兩個消費端都必須用共用常數。
   */
  it("⭐ 弧段數只能有一份定義,三視圖不可以自己再寫一個", () => {
    const mesh = fs.readFileSync("lib/render/part-geometry.ts", "utf-8").replace(/\/\*[\s\S]*?\*\//g, "");
    const view = fs.readFileSync("lib/render/geometry.ts", "utf-8").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(
      /export const CURVED_TAPER_ARC_SEG = \d+;/.test(mesh),
      "part-geometry.ts 找不到共用的弧段數常數",
    ).toBe(true);
    expect(
      /const ARC(_SEG)? = \d+/.test(view),
      "geometry.ts 又自己定義了一份弧段數 —— 兩份各改各的就會 3D 跟圖紙不一樣",
    ).toBe(false);
    expect(view.includes("CURVED_TAPER_ARC_SEG"), "geometry.ts 沒有用共用常數").toBe(true);
  });

  it("⭐ 側面輪廓的形狀只能有一份來源（三個地方都要走 curvedTaperInsetAtY）", () => {
    const mesh = fs.readFileSync("lib/render/part-geometry.ts", "utf-8").replace(/\/\*[\s\S]*?\*\//g, "");
    const view = fs.readFileSync("lib/render/geometry.ts", "utf-8").replace(/\/\*[\s\S]*?\*\//g, "");
    // 「自己算弧」的特徵:shoulder * Math.cos(...)
    expect(
      (mesh.match(/shoulder \* Math\.cos/g) ?? []).length,
      "part-geometry.ts 出現第二份弧的算式（唯一一份應該在 curvedTaperInsetAtY 裡）",
    ).toBeLessThanOrEqual(1);
    expect(
      (view.match(/shoulder \* Math\.cos/g) ?? []).length,
      "geometry.ts 又自己算了一份弧",
    ).toBe(0);
  });

  it("弧的取樣點要沿著圓弧走（相鄰段的轉角不可以有大跳變）", () => {
    // 用輪廓函式逐點算內縮量,檢查二階差分沒有尖點
    const cove = curvedTaperCoveSpan(SIZE[0], SIZE[1], BH, SH);
    const hy = SIZE[1] / 2, yBlockBot = hy - BH;
    const vals: number[] = [];
    for (let i = 0; i <= 40; i++)
      vals.push(curvedTaperInsetAtY(SIZE[0], SIZE[1], BH, SH, INS, yBlockBot - (cove * i) / 40));
    let worst = 0;
    for (let i = 1; i < vals.length - 1; i++)
      worst = Math.max(worst, Math.abs(vals[i + 1] - 2 * vals[i] + vals[i - 1]));
    expect(worst, "弧的曲率有尖點 = 不是順的圓弧").toBeLessThan(SH * 0.25);
  });
});

/**
 * ⭐ 「牙條縮進」只准對弧肩腳生效（木頭仁 2026-08-25:「只改弧肩腳」）。
 *
 * 這條釘住兩件事:
 *   1. 弧肩腳 → 牙條齊腳外面（縮進 0）
 *   2. 其他腳型 → 一律置中,跟改動前逐字等價（改壞了就是動到既有外觀）
 */
describe("牙條縮進只對弧肩腳生效", () => {
  const outerStep = (cat: string, legShape: string) => {
    const e = (FURNITURE_CATALOG as never[] as any[]).find((x) => x.category === cat)!;
    const base: any = (e.optionSchema ?? []).reduce((a: any, s: any) => ((a[s.key] = s.defaultValue), a), {});
    const d: any = e.template({ length: e.defaults.length, width: e.defaults.width, height: e.defaults.height,
      material: "pine", options: { ...base, legShape } });
    const ap = (d.parts as any[]).find((p) => /^apron-front$|^upper-apron-front$/.test(p.id));
    const leg = (d.parts as any[]).filter((p) => /^leg-/.test(p.id)).sort((a, b) => a.origin.z - b.origin.z)[0];
    // 用名目方框比即可（這裡要驗的是「有沒有位移」,不是外斜腳的實際傾角）
    return (ap.origin.z - ap.visible.thickness / 2) - (leg.origin.z - leg.visible.width / 2);
  };

  for (const cat of ["stool", "bench", "dining-table", "dining-chair", "bar-stool", "tea-table"]) {
    it(`${cat}：弧肩腳 → 牙條齊腳外面`, () => {
      expect(outerStep(cat, "curved-taper")).toBeCloseTo(0, 1);
    });
    it(`${cat}：直腳 → 維持置中（不准被改到）`, () => {
      const e = (FURNITURE_CATALOG as never[] as any[]).find((x) => x.category === cat)!;
      const base: any = (e.optionSchema ?? []).reduce((a: any, s: any) => ((a[s.key] = s.defaultValue), a), {});
      const d: any = e.template({ length: e.defaults.length, width: e.defaults.width, height: e.defaults.height,
        material: "pine", options: { ...base, legShape: "box" } });
      const ap = (d.parts as any[]).find((p) => /^apron-front$|^upper-apron-front$/.test(p.id));
      const leg = (d.parts as any[]).filter((p) => /^leg-/.test(p.id)).sort((a, b) => a.origin.z - b.origin.z)[0];
      const expected = (leg.visible.width - ap.visible.thickness) / 2;   // 置中
      expect(outerStep(cat, "box"), "直腳的牙條被移動了 = 動到既有外觀").toBeCloseTo(expected, 1);
    });
  }
});

/**
 * ⭐⭐ 3D 預覽的 shape 是**逐欄位重組**的 —— 新增欄位不會自動跟過來。
 *
 * 🩸 這個地方已經漏過兩次:
 *    2026-08-25 漏 `dirZ` → 兩向的弧挖到朝外那面（「外層不見了」）
 *    2026-08-26 漏 `lowerCove` → 勾了「橫撐處也做弧肩」3D 完全沒反應（「根本沒有」）
 *    兩次都是幾何/三視圖是對的、只有 3D 沒有,所有稽核都綠。
 *
 * ⇒ 釘住:`curved-taper` 的每一個欄位都必須出現在 PerspectiveView 的重組區塊裡。
 */
describe("3D 預覽不可以漏掉 curved-taper 的任何欄位", () => {
  it("型別裡有的欄位，PerspectiveView 重組時都要帶", () => {
    /**
     * 用 `part-geometry.ts` 的 ShapeSpec union —— 它是**一行**列完所有欄位,
     * 比 `lib/types/index.ts`（欄位之間夾大段註解）好剖析得多。
     */
    const spec = fs.readFileSync("lib/render/part-geometry.ts", "utf-8");
    const line = spec.split("\n").find((l) => l.includes('kind: "curved-taper";'));
    expect(line, "part-geometry.ts 找不到 curved-taper 的 ShapeSpec").toBeTruthy();
    const fields = [...new Set(
      (line!.match(/(\w+)\??:/g) ?? [])
        .map((m) => m.replace(/\??:$/, ""))
        .filter((f) => !["kind"].includes(f)),
    )];
    expect(fields.length, `只抓到 ${fields.length} 個欄位,剖析可能失敗`).toBeGreaterThanOrEqual(8);

    const view = fs.readFileSync("components/PerspectiveView.tsx", "utf-8");
    const i = view.indexOf('kind: "curved-taper",');
    expect(i, "PerspectiveView 找不到 curved-taper 分支").toBeGreaterThan(0);
    /**
     * ⚠️ 一定要先剝掉註解 —— 我在那一段寫了「漏掉 lowerCove / dirZ」的說明,
     *    註解裡就有欄位名,不剝的話 `includes` 永遠成立 = 橡皮圖章。
     *    (第一版就是這樣,把欄位刪掉測試還是綠的。)
     */
    const branch = view
      .slice(i, view.indexOf("} else if", i))
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    for (const f of fields) {
      expect(
        branch.includes(f),
        `PerspectiveView 的 curved-taper 分支漏了「${f}」→ 3D 會跟三視圖／零件圖不一樣`,
      ).toBe(true);
    }
  });
});
