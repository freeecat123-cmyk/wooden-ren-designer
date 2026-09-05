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
