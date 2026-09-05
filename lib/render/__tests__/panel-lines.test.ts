/**
 * 「幾層就要有幾片、線就要有幾條」的機器檢查。
 *
 * 🩸2026-09-05 木頭仁連續三次回報層數不對（2 看起來像 3、4 像 5、3 又多一條），
 * 每次原因都不同（膠合線畫到零件最外緣、鉗座墊塊被當成一層），而我每次只截一個
 * 角度、一端就說修好了 → 換個角度又錯。改成用資料與 SVG 數，不靠眼睛。
 */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { workbench, workbenchOptions } from "@/lib/templates/workbench";
import { ThreeViewLayout } from "@/lib/render/svg-views";
import { panelSplitWorld } from "@/lib/render/geometry";
import { getWoodCompile, boardBandMath } from "@/components/wood-shader";
import { plyLayers } from "@/lib/render/ply-layers";
import type { FurnitureDesign, MaterialId } from "@/lib/types";

type OptVal = string | number | boolean;

function build(options: Record<string, OptVal>): FurnitureDesign {
  const base: Record<string, OptVal> = {};
  for (const s of workbenchOptions) base[s.key] = s.defaultValue as OptVal;
  return workbench({
    length: 1800,
    width: 600,
    height: 830,
    material: "pine" as MaterialId,
    options: { ...base, ...options },
  });
}

/** 三視圖裡的分件線（拼板 / 疊層接縫），stroke #666 */
function panelLineCount(d: FurnitureDesign): number {
  const svg = renderToStaticMarkup(
    React.createElement(ThreeViewLayout as unknown as React.FC<{ design: FurnitureDesign }>, { design: d }),
  );
  return (svg.match(/<line[^>]*stroke="#666"/g) ?? []).length;
}

describe("夾板疊層：幾層就幾片、每片一樣厚", () => {
  for (const layers of [2, 3, 4]) {
    it(`${layers} 層 → 桌面 ${layers} 片、每片 18mm、沒有第三方零件混進來`, () => {
      const d = build({ materialStyle: "plywood", plyTopLayers: String(layers) });
      const top = d.parts.find((p) => p.id === "top")!;
      expect(top.panelPieces).toBe(layers);
      expect(top.panelSplit).toBe("thickness");
      expect(top.visible.thickness).toBe(18 * layers);
      // 每片一樣厚（總厚 ÷ 片數 剛好 18，沒有零頭）
      expect(top.visible.thickness / (top.panelPieces ?? 1)).toBe(18);
      // ⛔ 鉗座墊塊那類東西不准貼在桌底被看成多一層（2026-09-05 木頭仁：虎鉗只是示意）
      expect(d.parts.some((p) => p.id.includes("spacer"))).toBe(false);
      // 分件方向只有一個（厚度），片數對得上
      const split = panelSplitWorld(top)!;
      expect(split.pieces).toBe(layers);
      expect(split.axis).toBe("y");
      // 分件線畫的是「內部界線」：N 片 = N−1 條，兩個看得到的視圖各一組
      expect(panelLineCount(d)).toBeGreaterThanOrEqual(2 * (layers - 1));
    });
  }

  it("層數變，三視圖的線數要跟著變（不會卡在同一個數字）", () => {
    const n2 = panelLineCount(build({ materialStyle: "plywood", plyTopLayers: "2" }));
    const n3 = panelLineCount(build({ materialStyle: "plywood", plyTopLayers: "3" }));
    const n4 = panelLineCount(build({ materialStyle: "plywood", plyTopLayers: "4" }));
    expect(n2).toBeLessThan(n3);
    expect(n3).toBeLessThan(n4);
  });

  it("桌腳也是幾層就幾片、每片 18mm", () => {
    for (const legLayers of [3, 4, 5]) {
      const d = build({ materialStyle: "plywood", legLayers: String(legLayers) });
      const leg = d.parts.find((p) => p.id === "leg-1")!;
      expect(leg.panelPieces).toBe(legLayers);
      expect(leg.visible.length).toBe(18 * legLayers);
      // 疊層方向要落在「最小的那一維」（腳的 thickness 欄位是腳高，不能拿它切）
      const split = panelSplitWorld(leg)!;
      expect(split.hi - split.lo).toBe(18 * legLayers);
    }
  });
});

describe("實木拼板：片數與線數", () => {
  it("寬板平拼 600 深 → 3 片、2 條線；窄條側立拼 → 條數 = 深 ÷ 桌面厚", () => {
    const plank = build({ topBuild: "plank" });
    const top = plank.parts.find((p) => p.id === "top")!;
    expect(top.panelPieces).toBe(3);
    expect(top.panelSplit).toBeUndefined();
    const split = panelSplitWorld(top)!;
    expect(split.pieces).toBe(3);
    expect(split.axis).toBe("z");

    const stave = build({ topBuild: "stave" });
    expect(stave.parts.find((p) => p.id === "top")!.panelPieces).toBeGreaterThan(3);
    expect(panelLineCount(stave)).toBeGreaterThan(panelLineCount(plank));
  });
});

describe("3D 木紋著色器：只畫內部界線", () => {
  /** 假的 shader 物件：把注入後的 fragment 抓出來檢查 */
  function fragmentFor(pieces: number): string {
    const compile = getWoodCompile("length", "wide", { pieces, spanMm: 18 * pieces, axis: "y" });
    const shader = {
      vertexShader: "#include <common>\n#include <fog_vertex>",
      fragmentShader: "#include <common>\n#include <map_fragment>",
    };
    (compile as unknown as (s: typeof shader) => void)(shader);
    return shader.fragmentShader;
  }
  it("有「最外面兩條不畫」的守衛，而且守衛帶著實際片數", () => {
    const f = fragmentFor(3);
    // bNear = 最近的界線編號；只有 0.5 ≤ bNear ≤ 片數−0.5 才畫
    expect(f).toContain("bNear");
    expect(f).toMatch(/step\(0\.5, bNear\)/);
    expect(f).toMatch(/step\(bNear, 3\.0 - 0\.5\)/);
    expect(f).toMatch(/bGlue = bInner \*/);
  });
  it("片數換了，著色器裡的界線上限跟著換（不會寫死）", () => {
    expect(fragmentFor(2)).toMatch(/step\(bNear, 2\.0 - 0\.5\)/);
    expect(fragmentFor(4)).toMatch(/step\(bNear, 4\.0 - 0\.5\)/);
  });
  it("線寬有螢幕空間下限（縮小也看得到）", () => {
    const f = fragmentFor(3);
    expect(f).toMatch(/float bPix = fwidth\(bT\);/);
    expect(f).toMatch(/max\(bWantUnit, bPix \* 1\.3\)/);
  });

  /**
   * 🩸2026-09-05：木頭仁先說「3 層錯、2 跟 4 對」，十分鐘後同一份程式又變成
   * 「2 跟 4 錯、3 對」。會翻來翻去＝不是某個層數算錯，是**線根本分不清誰是誰**：
   * 側邊上的木紋雜訊跟膠合線一樣是沿桌長的細橫線，而木紋每片亂數。
   * 前幾輪一直加粗膠合線＝只調訊號沒動雜訊，所以永遠治不好。
   */
  it("看得到分層的側邊要把木紋雜訊壓掉（不是只把膠合線加粗）", () => {
    const f = fragmentFor(3);
    expect(f).toContain("bShowSplit");
    // 判「這一面看不看得到分層」要用實際的分件軸，不能寫死某一軸
    expect(f).toMatch(/float bFace = abs\(vWoodLocalNormal\.y\);/);
    // 會跟膠合線混淆的三種雜訊（順紋、導管孔、中尺度斑紋）都要被衰減
    const damped = f.match(/dimming -= [^;]*\* bNoiseMul;/g) ?? [];
    expect(damped.length).toBeGreaterThanOrEqual(3);
  });

  it("側邊的『層色差』要明顯大過殘餘雜訊（訊噪比 ≥ 3）", () => {
    const f = fragmentFor(3);
    // 殘餘雜訊 = 各雜訊振幅 × (1 − 0.85)
    const keep = 1 - Number(f.match(/bNoiseMul = 1\.0 - ([\d.]+) \* bShowSplit/)![1]);
    const noise = (f.match(/dimming -= [^;]*?\* ([\d.]+) \* bNoiseMul;/g) ?? [])
      .map((l) => Number(l.match(/\* ([\d.]+) \* bNoiseMul;/)![1]))
      .reduce((a, b) => a + b, 0) * keep;
    // 訊號 = 奇偶交替的層色差 × 側邊放大倍率
    const boost = 1 + Number(f.match(/\* \(1\.0 \+ ([\d.]+) \* bShowSplit\)/)![1]);
    const signal = 0.07 * boost;
    expect(signal / noise).toBeGreaterThanOrEqual(3);
  });

  it("沒有分件的零件不受影響（其他 28 款模板不能被波及）", () => {
    const compile = getWoodCompile("length", "wide");
    const shader = { vertexShader: "#include <common>\n#include <fog_vertex>", fragmentShader: "#include <common>\n#include <map_fragment>" };
    (compile as unknown as (s: typeof shader) => void)(shader);
    expect(shader.fragmentShader).toContain("float bNoiseMul = 1.0;");
    expect(shader.fragmentShader).toContain("float bShowSplit = 0.0;");
  });
});

describe("分件線的位置：幾條、在哪、等不等距（跟 GLSL 同一份算式）", () => {
  it("2 層 36mm：只有 1 條線，在正中間；上下邊不畫", () => {
    const m = boardBandMath(2, 36);
    expect(m.w).toBe(18);
    expect(m.boundariesMm).toEqual([0]);          // 中間
    expect(m.lineAt(0)).toBeGreaterThan(0.9);      // 中間有線
    expect(m.lineAt(-18)).toBe(0);                 // 上邊不畫
    expect(m.lineAt(18)).toBe(0);                  // 下邊不畫
    expect(m.lineAt(-9)).toBe(0);                  // 片中間沒線
  });
  it("4 層 72mm：3 條線，等距 18mm；上下邊不畫", () => {
    const m = boardBandMath(4, 72);
    expect(m.boundariesMm).toEqual([-18, 0, 18]);
    for (const b of m.boundariesMm) expect(m.lineAt(b)).toBeGreaterThan(0.9);
    expect(m.lineAt(-36)).toBe(0);
    expect(m.lineAt(36)).toBe(0);
    const gaps = m.boundariesMm.slice(1).map((v, i) => v - m.boundariesMm[i]);
    expect(new Set(gaps).size).toBe(1);            // 等距
  });
  it("N 層一定是 N−1 條線、每片一樣厚（2~6 層都驗）", () => {
    for (const n of [2, 3, 4, 5, 6]) {
      const m = boardBandMath(n, 18 * n);
      expect(m.boundariesMm).toHaveLength(n - 1);
      expect(m.w).toBe(18);
      // 掃過整個厚度，數出有線的位置（用 0.1mm 取樣，合併相鄰）
      const hits: number[] = [];
      for (let mm = -9 * n; mm <= 9 * n; mm += 0.1) {
        // 一條線本身有寬度（±wantMm），合併門檻要用「半片」才不會把同一條數成兩條
        if (m.lineAt(mm) > 0.5 && (hits.length === 0 || mm - hits[hits.length - 1] > m.w / 2)) hits.push(mm);
      }
      expect(hits).toHaveLength(n - 1);
    }
  });
});


/**
 * 🩸2026-09-05 最後一輪：改成「每層畫成真的一塊板」，不再靠著色器畫線。
 * 理由見 lib/render/ply-layers.ts 的檔頭 —— 45° 下桌面稜線跟膠合線長得一樣，
 * 畫線這條路本身躲不掉，所以層數改用真實幾何表示。
 */
describe("夾板疊層：3D 拆成真的一層一層", () => {
  it("N 層就 N 塊，等厚、由下往上排、總厚不變", () => {
    for (const n of [2, 3, 4, 5, 6]) {
      const total = 18 * n;
      const ls = plyLayers(total, n);
      expect(ls).toHaveLength(n);
      // 中心等距、間距 = 每層厚
      const gaps = ls.slice(1).map((l, i) => +(l.dy - ls[i].dy).toFixed(6));
      expect(new Set(gaps)).toEqual(new Set([18]));
      // 最上與最下那層的外緣要剛好貼齊零件表面（總厚沒變胖也沒變瘦）
      expect(ls[0].dy - 18 / 2).toBeCloseTo(-total / 2, 6);
      expect(ls[n - 1].dy + 18 / 2).toBeCloseTo(total / 2, 6);
      // 每層畫出來的厚度一致，且比 18 略薄（讓層間有縫看得見）
      for (const l of ls) {
        expect(l.thick).toBeLessThan(18);
        expect(l.thick).toBeGreaterThan(18 * 0.9);
      }
      expect(new Set(ls.map((l) => +l.thick.toFixed(6))).size).toBe(1);
    }
  });

  it("縫最多吃掉一層的 6%（很薄的層不會被縫吃光）", () => {
    const thin = plyLayers(2 * 3, 2); // 每層才 3mm
    expect(thin[0].thick).toBeCloseTo(3 - 3 * 0.06, 6);
  });

  it("1 層或 0 厚度不拆（維持原本單塊路徑）", () => {
    expect(plyLayers(18, 1)).toEqual([]);
    expect(plyLayers(0, 4)).toEqual([]);
  });
});

describe("疊層方向：一定要切最小的那一維", () => {
  /** 跟 PerspectiveView 同一套：在 [長, 厚, 寬] 裡挑最小 */
  function thinAxisOf(v: { length: number; thickness: number; width: number }) {
    const d: Array<{ i: 0 | 1 | 2; mm: number }> = [
      { i: 0, mm: v.length }, { i: 1, mm: v.thickness }, { i: 2, mm: v.width },
    ];
    return d.reduce((a, b) => (b.mm < a.mm ? b : a));
  }
  function build(o: Record<string, string>) {
    const base: Record<string, unknown> = {};
    for (const s of workbenchOptions) base[s.key] = s.defaultValue;
    return workbench({ length: 1800, width: 600, height: 830, material: "pine" as MaterialId,
      options: { ...base, materialStyle: "plywood", ...o } as Record<string, string | number | boolean> });
  }
  it("桌面切厚度、桌腳切腳寬（🩸腳的 thickness 欄位裝的是腳高，照它切＝層數看不見）", () => {
    const d = build({ plyTopLayers: "3", legLayers: "4" });
    const top = d.parts.find((p) => p.id === "top")!;
    const leg = d.parts.find((p) => p.id === "leg-1")!;
    const ta = thinAxisOf(top.visible);
    const la = thinAxisOf(leg.visible);
    expect(ta.i).toBe(1);                       // 桌面 → 厚度軸
    expect(ta.mm).toBe(54);
    expect(la.i).not.toBe(1);                   // ⛔ 桌腳絕不能切 thickness（那是腳高 776）
    expect(la.mm).toBe(72);                     // 腳寬 = 4 層 × 18
    expect(leg.visible.thickness).toBe(776);    // 證明 thickness 真的是腳高
    // 切出來的層數與每層厚度
    expect(plyLayers(ta.mm, top.panelPieces!)).toHaveLength(3);
    expect(plyLayers(la.mm, leg.panelPieces!)).toHaveLength(4);
    for (const l of plyLayers(la.mm, leg.panelPieces!)) expect(l.thick).toBeCloseTo(18 - 0.4, 6);
  });
});

describe("換了拼板參數，材質要跟著重建（不然要 F5 才看得到）", () => {
  /**
   * 🩸2026-09-05 木頭仁：「選桌面做法時不會即時更新，要重新整理網頁」。
   * three.js 的 onBeforeCompile 只在材質第一次編譯時跑；參數變了 material 還拿舊 program。
   * PerspectiveView 靠 `key={woodCompile.cacheKey}` 讓 React 重建材質 —— 
   * 所以 cacheKey **必須**隨片數 / 跨距 / 方向改變，寫死或漏帶就會再次卡住。
   */
  const key = (pieces: number, spanMm: number) =>
    getWoodCompile("length", "wide", { pieces, spanMm, axis: "y" }).cacheKey;

  it("片數不同 → cacheKey 不同", () => {
    expect(new Set([key(2, 36), key(3, 54), key(4, 72)]).size).toBe(3);
  });
  it("跨距不同 → cacheKey 不同（同片數也要分開）", () => {
    expect(key(3, 54)).not.toBe(key(3, 60));
  });
  it("有拼板 vs 沒拼板 → cacheKey 不同", () => {
    expect(getWoodCompile("length", "wide").cacheKey).not.toBe(key(3, 54));
  });
  it("木紋方向不同 → cacheKey 不同", () => {
    expect(getWoodCompile("length", "wide").cacheKey)
      .not.toBe(getWoodCompile("width", "wide").cacheKey);
  });
});

describe("夾板：橫撐 / 穿帶也要是夾板、也要看得到層數", () => {
  function mk(o: Record<string, string | boolean>) {
    const base: Record<string, unknown> = {};
    for (const s of workbenchOptions) base[s.key] = s.defaultValue;
    return workbench({ length: 1800, width: 600, height: 830, material: "pine" as MaterialId,
      options: { ...base, materialStyle: "plywood", ...o } as Record<string, string | number | boolean> });
  }
  it("下橫撐層數可調，厚度＝層數×18，料單片數跟著走", () => {
    for (const n of [1, 2, 3]) {
      const ls = mk({ lsLayers: String(n) }).parts.find((p) => p.id === "ls-front")!;
      expect(ls.visible.thickness).toBe(18 * n);
      expect(ls.panelPieces ?? 1).toBe(n);   // 1 層不是疊層，不標片數
      expect(ls.materialOverride).toBe("plywood");
    }
  });
  it("穿帶在夾板模式做得出來，是夾板、也標了層數（🩸以前這個選項只在實木出現）", () => {
    for (const n of [1, 2, 3]) {
      const d = mk({ topBattens: true, battenLayers: String(n) });
      const bats = d.parts.filter((p) => /^top-batten-/.test(p.id));
      expect(bats).toHaveLength(2);
      for (const b of bats) {
        expect(b.visible.thickness).toBe(18 * n);
        expect(b.panelPieces ?? 1).toBe(n);
        expect(b.panelSplit).toBe(n > 1 ? "thickness" : undefined);
        expect(b.materialOverride).toBe("plywood");
      }
      // 腳照穿帶厚度變短，總高不變
      const leg = d.parts.find((p) => p.id === "leg-1")!;
      expect(leg.visible.thickness).toBe(776 - 18 * n);
    }
  });
  it("搭接槽做不出來時要出聲（深度不是 18 的倍數＝不能少疊一層）", () => {
    const d = mk({ lsLayers: "3" });          // 72 腳 + 54 撐 → 槽只剩 9mm
    expect((d.warnings ?? []).some((w) => w.includes("不是 18 的倍數"))).toBe(true);
    const ok = mk({ lsLayers: "2" });         // 槽剛好 18
    expect((ok.warnings ?? []).some((w) => w.includes("不是 18 的倍數"))).toBe(false);
  });
  it("⛔ 預設值一格都不能動（新選項不准改到舊設計）", () => {
    const d = mk({});
    expect(d.parts.find((p) => p.id === "ls-front")!.visible.thickness).toBe(36);
    expect(d.parts.filter((p) => /^top-batten-/.test(p.id))).toHaveLength(0);
    expect(d.parts.find((p) => p.id === "leg-1")!.visible.thickness).toBe(776);
  });
});
