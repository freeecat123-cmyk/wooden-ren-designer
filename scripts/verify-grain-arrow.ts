import { strict as assert } from "node:assert";
import { grainArrowPlacement } from "../components/GrainArrow";

// 方料、紋沿長邊：箭頭沿 local X，長度 = size[0] * 0.8，貼在 Y 法線面
const a = grainArrowPlacement("length", "box", [4, 0.18, 3]);
assert.equal(a.axis, "x");
assert.ok(Math.abs(a.length - 3.2) < 1e-9, `expected 3.2, got ${a.length}`);
assert.equal(a.normalAxis, "y");

// 方料、紋沿寬邊：箭頭沿 local Z
const b = grainArrowPlacement("width", undefined, [4, 0.18, 3]);
assert.equal(b.axis, "z");
assert.ok(Math.abs(b.length - 2.4) < 1e-9, `expected 2.4, got ${b.length}`);
assert.equal(b.normalAxis, "y");

// 圓料：沒有平面，紋沿圓柱長軸 local Y，偏移沿 X（柱面外）
const c = grainArrowPlacement("length", "round", [0.5, 4, 0.5]);
assert.equal(c.axis, "y");
assert.ok(Math.abs(c.length - 3.2) < 1e-9, `expected 3.2, got ${c.length}`);
assert.equal(c.normalAxis, "x");

// 車旋件也走圓料路徑
const d = grainArrowPlacement("length", "lathe-turned", [0.6, 5, 0.6]);
assert.equal(d.axis, "y");

// grainDirection undefined → fallback 當 length
const e = grainArrowPlacement(undefined, "box", [2, 0.2, 1]);
assert.equal(e.axis, "x");

console.log("✅ grainArrowPlacement OK");
