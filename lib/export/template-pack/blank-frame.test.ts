import { describe, it, expect } from "vitest";
import { getTemplate } from "@/lib/templates";
import type { FurnitureCatalogEntry } from "@/lib/templates";
import type { FurnitureDesign, MaterialId, OptionSpec } from "@/lib/types";
import { groupPartsForDrawing, groupDisplayName } from "@/lib/render/part-drawing/grouping";
import { deriveMortisesByPart } from "@/lib/export/derived-mortises";
import { pickTemplateFaces } from "./face";
import { templateSheetSvg } from "./sheet";
import { placeOnLadder } from "./fit";
import { ladderForOutline } from "./paper";

/**
 * 1:1 樣板畫的是**方料**（翻型階段那根方的），不是切完造型的成品。
 *
 * 木工實務：「通常我們是在翻型的時候，就先把孔找好，之後才把造型切出來。所以
 * 榫孔位置應該是腳還在方形的情況下要鑿的位置」（木頭仁 2026-08-21，實際印出來
 * 貼到料上才發現對不起來）。
 *
 * 舊版把外斜腳畫成「裝上去之後歪掉的平行四邊形」，同一條中線上的兩個孔在紙上
 * 橫移了 23mm —— 貼到方料上直接鑿錯位。
 */
const entry = getTemplate("stool" as never) as FurnitureCatalogEntry;

function stool(legShape: string): FurnitureDesign {
  const options = (entry.optionSchema ?? []).reduce<Record<string, string | number | boolean>>(
    (acc, spec: OptionSpec) => {
      acc[spec.key] = spec.defaultValue;
      return acc;
    },
    {},
  );
  return entry.template!({
    length: entry.defaults.length,
    width: entry.defaults.width,
    height: entry.defaults.height,
    material: "maple" as MaterialId,
    options: { ...options, legShape },
  });
}

function legFaces(legShape: string) {
  const design = stool(legShape);
  const derivedMap = deriveMortisesByPart(design.parts);
  const g = groupPartsForDrawing(design).find((x) => /腳/.test(groupDisplayName(x, "zh-TW")))!;
  return pickTemplateFaces(g.representative, derivedMap.get(g.representative.id) ?? []);
}

function xRange(pts: Array<{ x: number; y: number }>) {
  const xs = pts.map((p) => p.x);
  return { lo: Math.min(...xs), hi: Math.max(...xs) };
}

describe("樣板畫方料，不畫成品", () => {
  it("外斜腳的外框是 35mm 方料，不是 72mm 的傾斜投影", () => {
    for (const f of legFaces("splayed")) {
      const r = xRange(f.outline);
      expect(r.hi - r.lo).toBeCloseTo(35, 0);
    }
  });

  it("外斜腳同一面的兩個孔落在同一條中線上（舊版橫移 23mm）", () => {
    for (const f of legFaces("splayed")) {
      const rects = f.holes.filter((h) => h.pts?.length);
      if (rects.length < 2) continue;
      const first = xRange(rects[0].pts!);
      for (const h of rects.slice(1)) {
        const r = xRange(h.pts!);
        expect(r.lo).toBeCloseTo(first.lo, 1);
        expect(r.hi).toBeCloseTo(first.hi, 1);
      }
    }
  });

  it("外斜腳的孔位跟直腳完全一樣——方料階段本來就同一個位置", () => {
    const box = legFaces("box");
    const splayed = legFaces("splayed");
    const boxHole = xRange(box[0].holes[0].pts!);
    const splayHole = xRange(splayed[0].holes[0].pts!);
    expect(splayHole.lo).toBeCloseTo(boxHole.lo, 1);
    expect(splayHole.hi).toBeCloseTo(boxHole.hi, 1);
  });
});

describe("鑿孔角度", () => {
  it("外斜腳的孔帶 5° 傾角（模板的 rotX/rotZ 換算）", () => {
    const holes = legFaces("splayed").flatMap((f) => f.holes);
    expect(holes.length).toBeGreaterThan(0);
    for (const h of holes) expect(h.angleDeg).toBeCloseTo(5, 0);
  });

  it("直腳的孔是垂直的（不標角度＝0，不是 undefined 造成的假垂直）", () => {
    for (const h of legFaces("box").flatMap((f) => f.holes)) {
      expect(h.angleDeg ?? 0).toBe(0);
    }
  });

  it("紙上每個孔都要有角度標註——垂直的也要寫，不能留給人猜", () => {
    for (const legShape of ["box", "splayed"]) {
      const face = legFaces(legShape)[0];
      const placement = placeOnLadder(face.w, face.h, ladderForOutline(face.outline))!;
      const svg = templateSheetSvg({ face, placement, partNo: "P-01", nameZh: "凳腳", qty: 4 });
      const marks = (svg.match(/data-mark="hole-angle"/g) ?? []).length;
      expect(marks).toBe(face.holes.length);
      expect(svg).toContain(legShape === "splayed" ? "斜 5°" : "垂直");
    }
  });
});

describe("成型線", () => {
  it("錐形腳有成型線（要鋸掉的那條）", () => {
    const f = legFaces("tapered")[0];
    expect(f.shapeOutline?.length).toBeGreaterThan(0);
  });

  it("直腳沒有成型線（沒有造型就不要多畫一條重疊的線）", () => {
    for (const f of legFaces("box")) expect(f.shapeOutline).toBeUndefined();
  });

  it("外斜腳沒有成型線——那個 shape 是「裝上去歪掉的樣子」，不是切線", () => {
    for (const f of legFaces("splayed")) expect(f.shapeOutline).toBeUndefined();
  });

  it("成型線一定落在方料範圍內，而且畫成虛線跟方料分得開", () => {
    const face = legFaces("tapered")[0];
    const r = xRange(face.outline);
    for (const p of face.shapeOutline!) {
      expect(p.x).toBeGreaterThanOrEqual(r.lo - 0.05);
      expect(p.x).toBeLessThanOrEqual(r.hi + 0.05);
    }
    const placement = placeOnLadder(face.w, face.h, ladderForOutline(face.outline))!;
    const svg = templateSheetSvg({ face, placement, partNo: "P-01", nameZh: "凳腳", qty: 4 });
    expect(svg).toContain('data-mark="shape-line"');
    expect(svg).toMatch(/data-mark="shape-line"[^>]*stroke-dasharray/);
  });
});

/**
 * 弧肩斜腳／非方腳：腳上的牙板與下橫撐榫眼原本被模板**刻意不建**（3D 挖下去會從
 * 斜降薄區破出「破口」），代價是 1:1 樣板上腳身完全沒有孔位——木頭仁 2026-08-21
 * 實際印出來回報「沒有出現下橫撐的榫孔」。
 *
 * 改法：榫眼照建、標 Mortise.axis。axis 一石二鳥：mortiseLocalBox 不用再猜入榫面
 * （這兩種腳的榫眼位置會讓「哪一軸離表面最近」判錯），而 joineryMode 的 CSG 過濾器
 * 看到 axis 就跳過不挖 → 3D 維持乾淨。
 */
describe("弧肩斜腳的腳上榫眼", () => {
  function leg(legShape: string) {
    const design = stool(legShape);
    return design.parts.find((p) => p.id === "leg-1")!;
  }

  it("弧肩斜腳的腳身有真母榫（舊版是 0 個）", () => {
    expect(leg("curved-taper").mortises.length).toBeGreaterThan(0);
  });

  it("弧肩斜腳的榫眼帶明確 axis；一般方腳不帶（方腳的接合視圖還要挖得到孔）", () => {
    expect(leg("curved-taper").mortises.every((m) => m.axis)).toBe(true);
    expect(leg("box").mortises.some((m) => m.axis)).toBe(false);
  });

  it("樣板上剛好 4 個孔、分在 2 個面——不會在腳的外側面多一個幽靈孔", () => {
    const faces = legFaces("curved-taper").filter((f) => f.holes.length > 0);
    expect(faces).toHaveLength(2);
    expect(faces.reduce((s, f) => s + f.holes.length, 0)).toBe(4);
  });

  it("模板宣告過 axis 的零件不再套反推——反推會把孔判到外側面（實測差 16mm）", () => {
    const part = leg("curved-taper");
    // 故意餵一堆反推進去，輸出的孔數不該變
    const withDerived = pickTemplateFaces(part, deriveMortisesByPart(stool("curved-taper").parts).get(part.id) ?? []);
    const withoutDerived = pickTemplateFaces(part, []);
    const count = (fs: ReturnType<typeof pickTemplateFaces>) => fs.reduce((s, f) => s + f.holes.length, 0);
    expect(count(withDerived)).toBe(count(withoutDerived));
  });
});
