/**
 * geometry 自我斷言腳本 — 跑法:npx tsx lib/floor/geometry.test.ts
 * 全綠印 "✅ geometry: N passed";任何 assert 失敗 throw。
 */
import {
  polygonArea,
  polygonPerimeter,
  boundingBox,
  pointInPolygon,
  insetPolygon,
  clipRectToPolygon,
  scalePolygonToBBox,
} from "./geometry";
import type { RoomPolygon } from "./types";

let passed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("❌ " + msg);
  passed++;
}
function approx(a: number, b: number, eps = 0.01) {
  return Math.abs(a - b) < eps;
}

const rect: RoomPolygon = {
  vertices: [
    { x: 0, y: 0 },
    { x: 400, y: 0 },
    { x: 400, y: 300 },
    { x: 0, y: 300 },
  ],
};
// L 型:外接 400×300,右下挖掉 200×150
const lshape: RoomPolygon = {
  vertices: [
    { x: 0, y: 0 },
    { x: 400, y: 0 },
    { x: 400, y: 150 },
    { x: 200, y: 150 },
    { x: 200, y: 300 },
    { x: 0, y: 300 },
  ],
};

assert(approx(polygonArea(rect), 120000), "rect area = 120000");
assert(approx(polygonArea(lshape), 90000), "L area = 400*300 - 200*150 = 90000");
assert(approx(polygonPerimeter(rect), 1400), "rect perimeter = 1400");
assert(approx(polygonPerimeter(lshape), 1400), "L perimeter = 1400");

const bb = boundingBox(lshape);
assert(bb.minX === 0 && bb.minY === 0 && bb.maxX === 400 && bb.maxY === 300, "L bbox");

assert(pointInPolygon({ x: 100, y: 100 }, lshape), "L 內部點");
assert(!pointInPolygon({ x: 300, y: 250 }, lshape), "L 挖空區點在外");
assert(!pointInPolygon({ x: 500, y: 100 }, lshape), "L 外部點");

// 向內 offset:矩形縮 10cm → 380×280
const inset = insetPolygon(rect, 10);
const ibb = boundingBox(inset);
assert(
  approx(ibb.minX, 10) && approx(ibb.minY, 10) &&
    approx(ibb.maxX, 390) && approx(ibb.maxY, 290),
  "rect inset 10cm",
);
assert(approx(polygonArea(inset), 380 * 280), "inset 面積 380*280");

// L 型 inset 10cm 仍為 6 頂點正交多邊形
const lInset = insetPolygon(lshape, 10);
assert(lInset.vertices.length === 6, "L inset 仍 6 頂點");

// 縮放到指定外框:矩形 400×300 → 800×600
const scaledRect = scalePolygonToBBox(rect, 800, 600);
const sbb = boundingBox(scaledRect);
assert(
  approx(sbb.maxX - sbb.minX, 800) && approx(sbb.maxY - sbb.minY, 600),
  "scale rect → 800×600 外框",
);
assert(approx(polygonArea(scaledRect), 480000), "scale rect 面積 800*600");

// L 型縮放:外框變 800×600,挖空比例維持(原右下挖 200×150 = 半寬半高)
const scaledL = scalePolygonToBBox(lshape, 800, 600);
assert(scaledL.vertices.length === 6, "scale L 仍 6 頂點");
assert(approx(polygonArea(scaledL), 90000 * 4), "scale L 面積等比 ×4");
assert(
  approx(scaledL.vertices[3].x, 400) && approx(scaledL.vertices[3].y, 300),
  "scale L 內凹點仍在半寬半高",
);

// 矩形 ∩ 多邊形裁切
const fully = clipRectToPolygon({ x: 50, y: 50, w: 100, h: 50 }, rect);
assert(approx(fully.usedAreaCm2, 5000), "完全在內 area=5000");
assert(fully.fullyInside, "完全在內 fullyInside=true");

const partial = clipRectToPolygon({ x: 350, y: 50, w: 100, h: 50 }, rect);
assert(approx(partial.usedAreaCm2, 50 * 50), "部分在內 area=2500");
assert(!partial.fullyInside && partial.usedAreaCm2 > 0, "部分在內");

const outside = clipRectToPolygon({ x: 500, y: 50, w: 100, h: 50 }, rect);
assert(approx(outside.usedAreaCm2, 0), "完全在外 area=0");

// L 型挖空區的矩形被裁掉
const inHole = clipRectToPolygon({ x: 250, y: 200, w: 100, h: 50 }, lshape);
assert(approx(inHole.usedAreaCm2, 0), "L 挖空區內矩形 area=0");

console.log(`✅ geometry: ${passed} passed`);
