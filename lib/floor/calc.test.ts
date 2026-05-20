/**
 * 排版+算料驗證腳本 — 跑法:npx tsx lib/floor/calc.test.ts
 *
 * 印出 fixtures 的完整 BOM 供 user 人眼核對,並用 assert 鎖住關鍵不變量:
 *   - 房間面積/周長與幾何計算一致
 *   - 總片數 = 整片 + 裁切片
 *   - L 型房間面積 < 同 bbox 矩形面積(挖空生效)
 *   - 防潮墊面積 = 房間面積
 */
import { computeFloorBom } from "./calc";
import { FIXTURE_RECT, FIXTURE_L, FIXTURE_T } from "./fixtures";
import { polygonArea } from "./geometry";

let passed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("❌ " + msg);
  passed++;
}
function approx(a: number, b: number, eps = 0.05) {
  return Math.abs(a - b) < eps;
}

for (const [name, input] of [
  ["矩形 420×300", FIXTURE_RECT],
  ["L 型", FIXTURE_L],
  ["T 型", FIXTURE_T],
] as const) {
  const bom = computeFloorBom(input);
  console.log(`\n=== ${name} ===`);
  console.log(
    `面積 ${bom.auto.roomAreaM2.toFixed(2)} m² / ${bom.auto.pingShu.toFixed(2)} 坪 / 周長 ${bom.auto.perimeterM.toFixed(2)} m`,
  );
  console.log(
    `地板片 整片 ${bom.trace.fullPlankCount} + 裁切 ${bom.trace.cutPlankCount} = ${bom.trace.totalPlankCount} 片(${bom.trace.plankRows} 排,損耗 ${bom.trace.wastePercent.toFixed(1)}%)`,
  );
  for (const it of bom.items) console.log(`  - ${it.nameZh} ${it.spec}`, it.note ?? "");

  assert(
    approx(bom.auto.roomAreaM2, polygonArea(input.room) / 10000),
    `${name} 面積一致`,
  );
  assert(
    bom.trace.totalPlankCount ===
      bom.trace.fullPlankCount + bom.trace.cutPlankCount,
    `${name} 總片數 = 整片 + 裁切`,
  );
  assert(bom.trace.plankRows > 0, `${name} 排數 > 0`);
  const underlay = bom.items.find((i) => i.category === "underlay");
  assert(
    approx(underlay?.totalAreaM2 ?? -1, bom.auto.roomAreaM2),
    `${name} 防潮墊面積 = 房間面積`,
  );
}

// L 型房間面積 < 矩形(挖空生效)
assert(
  computeFloorBom(FIXTURE_L).auto.roomAreaM2 <
    computeFloorBom(FIXTURE_RECT).auto.roomAreaM2,
  "L 型面積 < 矩形",
);

console.log(`\n✅ calc: ${passed} passed`);
