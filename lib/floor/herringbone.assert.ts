/**
 * 人字拼自我斷言腳本 — 跑法:npx tsx lib/floor/herringbone.test.ts
 * 全綠印 "✅ herringbone: N passed";任何 assert 失敗 throw。
 *
 * 核心驗證:人字拼板陣必須「滿覆蓋 + 不重疊」(每個內部點恰落在一片板裡)。
 */
import { computeHerringboneLayout } from "./herringbone";
import { computeFloorBom } from "./calc";
import { polygonArea } from "./geometry";
import { DEFAULT_FLOOR_INPUT, type FloorInput, type RoomPolygon } from "./types";

let passed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  passed++;
}

/** local-frame 人字拼板生成(與 herringbone.ts 同公式,旋轉前) */
function localPlanks(L: number, W: number, kc: number) {
  const rects: { x: number; y: number; w: number; h: number }[] = [];
  for (let k = -kc; k <= kc; k++) {
    for (let c = -kc; c <= kc; c++) {
      const bx = k * (L + W) + c * W;
      const by = k * (L - W) - c * W;
      rects.push({ x: bx, y: by, w: W, h: L }); // V 板
      rects.push({ x: bx + W, y: by + L - W, w: L, h: W }); // H 板
    }
  }
  return rects;
}

/** 確定性 PRNG(可重現) */
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

// 測 1:多種長寬比的板陣都必須滿覆蓋且不重疊
for (const [L, W] of [
  [2, 1],
  [3, 1],
  [120, 19],
  [121, 19.5],
  [150, 21.7],
]) {
  const rects = localPlanks(L, W, 9);
  const rng = makeRng(12345 + L * 7 + W);
  // 在原點附近 [-L,L]² 取樣 —— 該區由 |k|,|c|≤9 的板必定覆蓋
  let checked = 0;
  for (let n = 0; n < 4000; n++) {
    const px = (rng() * 2 - 1) * L;
    const py = (rng() * 2 - 1) * L;
    let count = 0;
    for (const r of rects) {
      if (px > r.x && px < r.x + r.w && py > r.y && py < r.y + r.h) count++;
    }
    // 命中板邊(count 0 可能落在縫上)→ 跳過,只驗真內部點
    if (count === 0) continue;
    if (count !== 1) {
      throw new Error(
        `FAIL: L=${L} W=${W} 點(${px.toFixed(2)},${py.toFixed(2)})落在 ${count} 片板裡(應為 1)`,
      );
    }
    checked++;
  }
  assert(checked > 3000, `L=${L} W=${W} 有效取樣點 ${checked} 應 >3000`);
}

// 測 2:整房間人字拼排版 → 板裁切面積總和 ≈ 可鋪區域面積(無漏鋪/無重疊)
function rect(w: number, d: number): RoomPolygon {
  return {
    vertices: [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: d },
      { x: 0, y: d },
    ],
  };
}
for (const [w, d] of [
  [420, 300],
  [500, 360],
]) {
  const input: FloorInput = {
    ...DEFAULT_FLOOR_INPUT,
    pattern: "herringbone",
    room: rect(w, d),
  };
  const layout = computeHerringboneLayout(input);
  const used = layout.planks.reduce((s, p) => s + p.usedAreaCm2, 0);
  const target = polygonArea(layout.layableRegion);
  const err = Math.abs(used - target) / target;
  assert(
    err < 0.005,
    `${w}×${d} 人字拼覆蓋誤差 ${(err * 100).toFixed(3)}% 應 <0.5%`,
  );
  assert(layout.planks.length > 0, `${w}×${d} 應排出板`);
}

// 測 3:六角型(含斜邊)也能跑人字拼不爆
{
  const hexInput: FloorInput = {
    ...DEFAULT_FLOOR_INPUT,
    pattern: "herringbone",
    room: {
      vertices: [
        { x: 100, y: 0 },
        { x: 420, y: 0 },
        { x: 420, y: 260 },
        { x: 320, y: 360 },
        { x: 0, y: 360 },
        { x: 0, y: 100 },
      ],
    },
  };
  const layout = computeHerringboneLayout(hexInput);
  const used = layout.planks.reduce((s, p) => s + p.usedAreaCm2, 0);
  const target = polygonArea(layout.layableRegion);
  assert(
    Math.abs(used - target) / target < 0.01,
    `六角型人字拼覆蓋誤差應 <1%`,
  );
}

// 測 4:人字拼損耗必須 > 直鋪,且落在業界合理區間(斜切餘料配對 2D 模型)
for (const [w, d] of [
  [420, 300],
  [500, 360],
  [360, 360],
]) {
  const room = rect(w, d);
  const straight = computeFloorBom({
    ...DEFAULT_FLOOR_INPUT,
    pattern: "straight",
    room,
  });
  const herringbone = computeFloorBom({
    ...DEFAULT_FLOOR_INPUT,
    pattern: "herringbone",
    room,
  });
  const hw = herringbone.trace.wastePercent;
  assert(
    hw > straight.trace.wastePercent,
    `${w}×${d} 人字拼損耗 ${hw.toFixed(1)}% 應 > 直鋪 ${straight.trace.wastePercent.toFixed(1)}%`,
  );
  assert(
    hw >= 8 && hw <= 30,
    `${w}×${d} 人字拼損耗 ${hw.toFixed(1)}% 應落在 8–30%`,
  );
}

console.log(`✅ herringbone: ${passed} passed`);
