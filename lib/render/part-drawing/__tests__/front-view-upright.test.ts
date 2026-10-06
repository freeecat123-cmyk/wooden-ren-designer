/**
 * 零件卡「正視 FRONT」要正立：直立件的頂面在上、底面在下（2026-10-06 老闆裁示要改）。
 *
 * 以前 svg-views 的 isolate 會把 mirrorYDesign 給的「繞 X 轉 180°」蓋掉，正視其實是
 * 俯視原樣 → 上下顛倒：乙級前橫檔的壸門曲線跑到上緣、頂緣 6×4 缺口畫在下緣；
 * 抽屜面板的底板槽畫在上緣（照圖做會做反）。榫頭偏移則被 mirrorYPart 單獨反號
 * 「補」成看起來對（2026-06-01 f5db4096），所以榫頭跟本體互相矛盾。
 *
 * 這支只看「本體 / 槽 / 缺口 / 榫頭在零件中線的上方還是下方」，不比像素。
 * 內層群組座標：零件中心在 y=0，SVG 往下為正 → 在上 = y < 0。
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { FurnitureDesign, Part } from "@/lib/types";
import { certB1 } from "@/lib/templates/cert-b1";
import { FURNITURE_CATALOG } from "@/lib/templates";
import { PartDrawingPaperSheet } from "../paper-sheet";
import { pickScaleForPaper } from "../paper-fit";

function sheet(design: FurnitureDesign, part: Part): string {
  return renderToStaticMarkup(
    createElement(PartDrawingPaperSheet, {
      design, part, partNo: "P-01", count: 1, scale: pickScaleForPaper(part).scale,
      materialLabel: "松木", dimsLabel: "", title: part.nameZh,
    }),
  );
}

/** 正視 FRONT 那一段（內部 view="bottom" 走 top 投影，marker id 是 arr-top）。 */
function frontSection(svg: string): string {
  const start = svg.indexOf('<g><defs><marker id="arr-top"');
  const end = svg.lastIndexOf('<g font-family="sans-serif">');
  expect(start).toBeGreaterThan(0);
  expect(end).toBeGreaterThan(start);
  return svg.slice(start, end);
}

function attr(tag: string, name: string): number {
  const m = tag.match(new RegExp(`\\s${name}="([-\\d.e]+)"`));
  return m ? Number(m[1]) : NaN;
}

/** 本體輪廓（renderer 的 <g data-part-id> 第一個 polygon）的頂點。 */
function silhouette(front: string): Array<[number, number]> {
  const m = front.match(/<g data-part-id="[^"]+"><polygon points="([^"]+)"/);
  expect(m, "找不到本體輪廓").toBeTruthy();
  return m![1].trim().split(/\s+/).map((p) => p.split(",").map(Number) as [number, number]);
}

/** 長度約為 lengthMm 的 cosmetic 槽框（renderer 的 <rect>，橘色 #c97a2b）的垂直中心。 */
function cosmeticRectCenterY(front: string, lengthMm: number): number {
  const rects = [...front.matchAll(/<rect [^>]*stroke="#c97a2b"[^>]*>/g)]
    .map((m) => m[0])
    .filter((t) => Math.abs(attr(t, "width") - lengthMm) < 0.5);
  expect(rects.length, `找不到長 ${lengthMm} 的槽框`).toBeGreaterThan(0);
  return attr(rects[0], "y") + attr(rects[0], "height") / 2;
}

const b1 = certB1({ length: 450, width: 450, height: 450, material: "pine", options: {} });
const byId = (id: string) => {
  const p = b1.parts.find((q) => q.id === id);
  expect(p, id).toBeDefined();
  return p!;
};

describe("零件卡正視 FRONT 正立（頂面在上）", () => {
  it("乙級前曲線橫檔：壸門曲線在下緣、上緣是平的", () => {
    const pts = silhouette(frontSection(sheet(b1, byId("front-rail"))));
    // 橫檔寬 60 → 上下緣 y=∓30；壸門在中段往內縮 20（R15 弧）
    const mid = pts.filter(([x]) => Math.abs(x) < 80);
    expect(mid.length).toBeGreaterThan(0);
    // 中段有點縮到 y=+10（下緣往上挖 20）＝壸門在下
    expect(mid.some(([, y]) => Math.abs(y - 10) < 0.5)).toBe(true);
    // 上緣中段沒有被挖：不該出現 y=−10
    expect(mid.some(([, y]) => Math.abs(y + 10) < 0.5)).toBe(false);
  });

  it("乙級前曲線橫檔：頂緣 6×4 缺口畫在上緣", () => {
    const front = frontSection(sheet(b1, byId("front-rail")));
    expect(cosmeticRectCenterY(front, 346)).toBeLessThan(-20);
  });

  it("乙級抽屜面板：底板槽畫在下緣", () => {
    const front = frontSection(sheet(b1, byId("drawer-1-front")));
    expect(cosmeticRectCenterY(front, 324)).toBeGreaterThan(20);
  });

  it("抽屜面板肩距鏈：槽到「下緣」標 11（數字跟線段要對得上）", () => {
    const front = frontSection(sheet(b1, byId("drawer-1-front")));
    // 找標 11 的橘色文字，它所在的 <g> 裡那條垂直尺寸線長度必須 = 11
    const groups = [...front.matchAll(/<g><line [^>]*><\/line><line [^>]*><\/line><polygon [^>]*><\/polygon><polygon [^>]*><\/polygon><text [^>]*>([\d.]+)<\/text><\/g>/g)];
    const g11 = groups.filter((g) => g[1] === "11");
    expect(g11.length).toBeGreaterThan(0);
    for (const g of g11) {
      const line = g[0].match(/<line [^>]*>/)![0];
      const len = Math.abs(attr(line, "y2") - attr(line, "y1"));
      expect(len).toBeCloseTo(11, 1);
      // 而且量在零件下半部（槽在下）
      expect(Math.min(attr(line, "y1"), attr(line, "y2"))).toBeGreaterThan(0);
    }
  });

  it("偏心榫頭跟本體一起翻：往上偏的榫頭畫在上半", () => {
    // 直立件（繞 X 轉 +90°：local −Z = 世界上方）。榫頭 offsetWidth −20 = 往 local −Z = 往上偏。
    // 同時在上緣（local −Z 面）開一條 cosmetic 槽當對照：兩者必須同一側。
    const part: Part = {
      id: "probe-rail", nameZh: "探針橫檔", material: "pine", grainDirection: "length",
      visible: { length: 300, width: 80, thickness: 20 },
      origin: { x: 0, y: 300, z: 0 }, rotation: { x: Math.PI / 2, y: 0, z: 0 },
      tenons: [{ position: "start", type: "blind-tenon", length: 30, width: 30, thickness: 8, offsetWidth: -20 }],
      mortises: [{ origin: { x: 0, y: 10, z: -40 }, length: 300, width: 6, depth: 4, through: false, cosmetic: true, label: "上緣槽" }],
    };
    const design = { id: "probe", category: "side-table", nameZh: "探針", overall: { length: 300, width: 20, thickness: 80 },
      parts: [part], primaryMaterial: "pine", defaultJoinery: "blind-tenon" } as unknown as FurnitureDesign;
    const front = frontSection(sheet(design, part));
    expect(cosmeticRectCenterY(front, 300)).toBeLessThan(-30);
    // 榫頭：annotation 藍框（fill rgba(37, 99, 235, 0.10)），凸在本體左端外（x < −150）
    const tenonTags = [...front.matchAll(/<(?:rect|polygon) [^>]*fill="rgba\(37, 99, 235, 0\.10\)"[^>]*>/g)].map((m) => m[0]);
    expect(tenonTags.length, "找不到榫頭藍框").toBeGreaterThan(0);
    const ys: number[] = [];
    for (const t of tenonTags) {
      if (t.startsWith("<rect")) ys.push(attr(t, "y") + attr(t, "height") / 2);
      else {
        const pts = t.match(/points="([^"]+)"/)![1].trim().split(/\s+/).map((p) => p.split(",").map(Number));
        ys.push(pts.reduce((s, p) => s + p[1], 0) / pts.length);
      }
    }
    // 榫頭寬 30、往上偏 20 → 中心 y ≈ −20
    for (const y of ys) expect(y).toBeCloseTo(-20, 0);
  });

  it("梯形牙條（圓餐桌）：接座窄邊在上，榫頭內側肩貼著本體斜端面", () => {
    const entry = FURNITURE_CATALOG.find((e) => e.category === "round-table")!;
    const opts = Object.fromEntries((entry.optionSchema ?? []).map((s) => [s.key, s.defaultValue]));
    const design = entry.template!({ ...entry.defaults, material: "pine", options: opts } as never);
    const apron = design.parts.find((p) => p.id === "apron-front")!;
    expect(apron.shape?.kind).toBe("apron-trapezoid");
    const front = frontSection(sheet(design, apron));
    // 本體：寫死「接座（topLengthScale，窄）在上」的梯形 polygon
    const body = front.match(/<polygon data-part-id="[^"]+" points="([^"]+)"/)![1]
      .trim().split(/\s+/).map((p) => p.split(",").map(Number));
    const topY = Math.min(...body.map((p) => p[1]));
    const botY = Math.max(...body.map((p) => p[1]));
    const halfTop = Math.max(...body.filter((p) => p[1] === topY).map((p) => p[0]));
    const halfBot = Math.max(...body.filter((p) => p[1] === botY).map((p) => p[0]));
    expect(halfTop).toBeLessThan(halfBot); // 窄邊在上
    // 右端榫頭藍框：內側兩點（x 較小的兩點）必須落在本體右斜邊上
    const tenons = [...front.matchAll(/<polygon points="([^"]+)" fill="rgba\(37, 99, 235, 0\.10\)"/g)]
      .map((m) => m[1].trim().split(/\s+/).map((p) => p.split(",").map(Number)))
      .filter((pts) => pts.every((p) => p[0] > 0));
    expect(tenons.length, "找不到右端梯形榫頭框").toBeGreaterThan(0);
    const xOnEdge = (y: number) => halfTop + ((y - topY) / (botY - topY)) * (halfBot - halfTop);
    for (const pts of tenons) {
      const inner = [...pts].sort((a, b) => a[0] - b[0]).slice(0, 2);
      for (const [x, y] of inner) expect(Math.abs(x - xOnEdge(y))).toBeLessThan(0.3);
    }
  });
});
