/**
 * geometry 自我斷言腳本 — 跑法:npx tsx lib/floor/geometry.test.ts
 * 全綠印 "✅ geometry: N passed";任何 assert 失敗 throw。
 */
// insetPolygon / clipRectToPolygon will be restored in Task 3
import {
  polygonArea,
  polygonPerimeter,
  boundingBox,
  pointInPolygon,
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

console.log(`✅ geometry: ${passed} passed`);
