/**
 * 跑法:npx tsx lib/raised-floor/geometry.test.ts
 * 全綠印 "✅ geometry: N passed"。
 */
import {
  rectPolygon,
  lShapePolygon,
  subtractCornerRect,
  buildPlatformPolygon,
  joistRunLengthsM,
  subJoistRunLengthsM,
} from "./geometry";
import { polygonArea, polygonPerimeter } from "@/lib/floor/geometry";

let passed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("❌ " + msg);
  passed++;
}
function approx(a: number, b: number, eps = 0.5) {
  return Math.abs(a - b) < eps;
}

// ────────── rectPolygon ──────────
{
  const r = rectPolygon(300, 400);
  assert(r.vertices.length === 4, "rect 4 頂點");
  assert(polygonArea(r) === 300 * 400, "rect 面積 = 300*400");
  assert(polygonPerimeter(r) === 1400, "rect 周長 = 2*(300+400)");
}

// ────────── lShapePolygon ──────────
{
  const l = lShapePolygon(400, 300, 160, 120);
  assert(l.vertices.length === 6, "L 6 頂點");
  // 面積 = 矩形 - 缺角
  const expected = 400 * 300 - 160 * 120;
  assert(polygonArea(l) === expected, `L 面積 = 400*300 - 160*120 = ${expected}`);
}

// ────────── subtractCornerRect ──────────
{
  const r = rectPolygon(400, 300);
  // tl 挖 50×40
  const after = subtractCornerRect(r, "tl", 50, 40);
  assert(after.vertices.length === 6, "矩形挖 tl 後 6 頂點");
  assert(polygonArea(after) === 400 * 300 - 50 * 40, "tl 挖洞面積");
}
{
  const r = rectPolygon(400, 300);
  // tr 挖 50×40
  const after = subtractCornerRect(r, "tr", 50, 40);
  assert(after.vertices.length === 6, "tr 挖後 6 頂點");
  assert(polygonArea(after) === 400 * 300 - 50 * 40, "tr 挖洞面積");
}
{
  const r = rectPolygon(400, 300);
  const after = subtractCornerRect(r, "bl", 60, 30);
  assert(after.vertices.length === 6, "bl 挖後 6 頂點");
  assert(polygonArea(after) === 400 * 300 - 60 * 30, "bl 挖洞面積");
}
{
  const r = rectPolygon(400, 300);
  const after = subtractCornerRect(r, "br", 80, 50);
  assert(after.vertices.length === 6, "br 挖後 6 頂點");
  assert(polygonArea(after) === 400 * 300 - 80 * 50, "br 挖洞面積");
}

// ────────── buildPlatformPolygon ──────────
{
  const p = buildPlatformPolygon({
    shape: "rect",
    widthCm: 300,
    depthCm: 400,
    pillars: [],
  });
  assert(p.vertices.length === 4, "rect 預設 4 頂點");
  assert(polygonArea(p) === 120000, "rect 面積 12 m²");
}
{
  const p = buildPlatformPolygon({
    shape: "rect",
    widthCm: 400,
    depthCm: 300,
    pillars: [{ corner: "tl", widthCm: 50, depthCm: 40 }],
  });
  assert(p.vertices.length === 6, "矩形 +1 柱 → 6 頂點");
  assert(polygonArea(p) === 400 * 300 - 50 * 40, "矩形 +1 柱面積");
}
{
  const p = buildPlatformPolygon({
    shape: "rect",
    widthCm: 400,
    depthCm: 300,
    pillars: [
      { corner: "tl", widthCm: 50, depthCm: 40 },
      { corner: "br", widthCm: 60, depthCm: 30 },
    ],
  });
  assert(p.vertices.length === 8, "矩形 +2 柱 → 8 頂點");
  assert(polygonArea(p) === 400 * 300 - 50 * 40 - 60 * 30, "矩形 +2 柱面積");
}

// ────────── joistRunLengthsM:矩形 ──────────
{
  // 矩形 400×300:短軸=Y(300cm),角材沿 Y 走、間距沿 X 量
  // perimeter = 1400cm = 14m
  // middleCount = floor(400/30) = 13 條,每條 sl=300cm = 3m,middle=39m
  // total = 14 + 39 = 53m, rowCount(含兩端邊框) = 15
  const r = joistRunLengthsM(rectPolygon(400, 300), 30);
  assert(r.middleCount === 13, `矩形 400×300 @30cm middleCount=${r.middleCount} 預期 13`);
  assert(r.rowCount === 15, `矩形 400×300 @30cm rowCount=${r.rowCount} 預期 15`);
  assert(approx(r.perimeterM, 14, 0.01), `perimeter=${r.perimeterM}m 預期 14`);
  assert(approx(r.totalLengthM, 53, 0.1), `total=${r.totalLengthM}m 預期 53`);
}

// ────────── joistRunLengthsM:挖洞後變短 ──────────
{
  // 矩形 400×300 挖 tl 100×60 → 部分掃描線在挖洞區 → 該段較短
  // axis-aligned 挖洞周長不變(進出兩段抵消原段),所以 perimeter 仍 14
  const before = joistRunLengthsM(rectPolygon(400, 300), 30);
  const after = joistRunLengthsM(
    subtractCornerRect(rectPolygon(400, 300), "tl", 100, 60),
    30,
  );
  assert(after.middleCount === before.middleCount, "挖洞 middle 數不變(同 bbox)");
  assert(
    approx(after.perimeterM, before.perimeterM, 0.01),
    "axis-aligned 挖洞 perimeter 不變",
  );
  assert(
    after.totalLengthM < before.totalLengthM,
    `挖洞後骨架總長應變短:before=${before.totalLengthM} after=${after.totalLengthM}`,
  );
}

// ────────── 兩柱不同邊角,周長計算 ──────────
{
  const p = buildPlatformPolygon({
    shape: "rect",
    widthCm: 400,
    depthCm: 300,
    pillars: [
      { corner: "tl", widthCm: 50, depthCm: 50 },
      { corner: "tr", widthCm: 50, depthCm: 50 },
    ],
  });
  // axis-aligned 挖角周長不變,兩柱仍 1400
  assert(polygonPerimeter(p) === 1400, `兩柱周長預期 1400 實際 ${polygonPerimeter(p)}`);
}

// ────────── joistRunLengthsM 回傳 mainJoistCentersCm ──────────
{
  const r = joistRunLengthsM(rectPolygon(400, 300), 30);
  assert(
    r.mainJoistCentersCm.length === r.middleCount,
    `mainCenters.length=${r.mainJoistCentersCm.length} 預期 = middleCount=${r.middleCount}`,
  );
  // 矩形 400×300:short=Y=300、long=X=400,centers 沿 X(長軸)分布在 (0, 400) 內
  for (const c of r.mainJoistCentersCm) {
    assert(c > 0 && c < 400, `center ${c} 應落在 (0, 400) 內`);
  }
}

// ────────── subJoistRunLengthsM:矩形 400×300 預期 count>0 ──────────
{
  const r = joistRunLengthsM(rectPolygon(400, 300), 30);
  const sub = subJoistRunLengthsM(rectPolygon(400, 300), r.mainJoistCentersCm, 40);
  assert(sub.count > 0, `矩形 sub.count > 0, 實際 ${sub.count}`);
  assert(sub.totalLengthM > 0, `sub.totalLengthM > 0, 實際 ${sub.totalLengthM}`);
  assert(sub.typicalLengthCm > 0, `sub.typicalLengthCm > 0, 實際 ${sub.typicalLengthCm}`);
}

// ────────── subJoistRunLengthsM:間距減半,count 約翻倍 ──────────
{
  const r = joistRunLengthsM(rectPolygon(400, 300), 30);
  const wide = subJoistRunLengthsM(rectPolygon(400, 300), r.mainJoistCentersCm, 40);
  const dense = subJoistRunLengthsM(rectPolygon(400, 300), r.mainJoistCentersCm, 20);
  assert(
    dense.count > wide.count,
    `subSpacing 20 (${dense.count}) > 40 (${wide.count})`,
  );
  // 約翻倍:dense >= 1.5 * wide(floor 取整有 +/- 一根)
  assert(
    dense.count >= wide.count * 1.5,
    `密副支至少 1.5x:wide=${wide.count} dense=${dense.count}`,
  );
}

// ────────── subJoistRunLengthsM:typicalLengthCm 約等於主支間距 ──────────
{
  // 矩形 400×300,short=300,long=400,主支間距 30 → middleCount=13
  // slot 寬大約 = 400/14 ≈ 28.57cm
  const main = joistRunLengthsM(rectPolygon(400, 300), 30);
  const sub = subJoistRunLengthsM(rectPolygon(400, 300), main.mainJoistCentersCm, 40);
  const expectedSlot = 400 / (main.middleCount + 1);
  assert(
    approx(sub.typicalLengthCm, expectedSlot, 0.5),
    `typicalLength ${sub.typicalLengthCm} 預期 ≈ ${expectedSlot}`,
  );
}

// ────────── subJoistRunLengthsM:L 形 count > 0 不報錯 ──────────
{
  const lPoly = lShapePolygon(400, 300, 160, 120);
  const main = joistRunLengthsM(lPoly, 30);
  const sub = subJoistRunLengthsM(lPoly, main.mainJoistCentersCm, 40);
  assert(sub.count > 0, `L 形 sub.count > 0, 實際 ${sub.count}`);
  assert(sub.totalLengthM > 0, `L 形 sub.totalLengthM > 0, 實際 ${sub.totalLengthM}`);
}

// ────────── subJoistRunLengthsM:主支 0 條(極小平台)仍能算 ──────────
{
  // 50×50 小平台、間距 100 → middleCount=0 → 整片 1 個 slot
  const poly = rectPolygon(50, 50);
  const main = joistRunLengthsM(poly, 100);
  assert(main.mainJoistCentersCm.length === 0, "極小平台無中間主支");
  const sub = subJoistRunLengthsM(poly, main.mainJoistCentersCm, 40);
  // 1 個 slot 寬 50,short 50 / 40 = 1 排,1×50=50cm=0.5m
  assert(sub.count >= 0, "極小平台 sub.count >= 0 不報錯");
}

console.log(`✅ geometry: ${passed} passed`);
