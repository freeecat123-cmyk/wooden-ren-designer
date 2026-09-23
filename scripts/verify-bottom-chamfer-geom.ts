/**
 * 驗證「下緣倒角」幾何層：buildShapeGeometry 對 round / chamfered-top shape
 * 是否真的把下緣倒角做進 mesh 頂點。
 * Run: npx tsx scripts/verify-bottom-chamfer-geom.ts
 */
import { buildShapeGeometry } from "../lib/render/part-geometry";
import { FURNITURE_CATALOG } from "../lib/templates";

/** 取 mesh 在 y≈minY（底面）那層頂點的最大半徑（XZ 平面），與整體最大半徑比較。 */
function bottomRingRadius(geo: { attributes: { position: { count: number; getX(i: number): number; getY(i: number): number; getZ(i: number): number } } }) {
  const pos = geo.attributes.position;
  let minY = Infinity, maxY = -Infinity, maxR = 0;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const eps = (maxY - minY) * 0.02 + 0.01;
  let bottomMaxR = 0;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const r = Math.hypot(pos.getX(i), pos.getZ(i));
    if (r > maxR) maxR = r;
    if (y <= minY + eps && r > bottomMaxR) bottomMaxR = r;
  }
  return { minY, maxY, maxR, bottomMaxR };
}

let fail = 0;
const ok = (l: string, c: boolean, d: string) => { console.log(`  ${c ? "✅" : "❌"} ${l} — ${d}`); if (!c) fail++; };

console.log("=== 下緣倒角幾何層驗證 ===\n");

// 1) 直接對 round shape 建幾何：有 vs 無 bottomChamferMm
console.log("■ round shape 直接測（diameter 300 / thickness 25）");
const size: [number, number, number] = [300, 25, 300];
const gA = buildShapeGeometry({ kind: "round", chamferMm: 5 }, size)!;
const gB = buildShapeGeometry({ kind: "round", chamferMm: 5, bottomChamferMm: 11.25 }, size)!;
const rA = bottomRingRadius(gA);
const rB = bottomRingRadius(gB);
console.log(`  無下緣倒角: 底環半徑=${rA.bottomMaxR.toFixed(2)} / 整體最大=${rA.maxR.toFixed(2)}`);
console.log(`  有下緣倒角: 底環半徑=${rB.bottomMaxR.toFixed(2)} / 整體最大=${rB.maxR.toFixed(2)}`);
ok("無倒角時底環貼齊外緣", Math.abs(rA.bottomMaxR - rA.maxR) < 0.5, `差 ${(rA.maxR - rA.bottomMaxR).toFixed(2)}`);
ok("有下緣倒角時底環內縮", rB.maxR - rB.bottomMaxR > 8, `底環比外緣縮 ${(rB.maxR - rB.bottomMaxR).toFixed(2)}mm（期望 ≈11.25）`);
ok("兩者幾何不同（倒角真的進 mesh）", rB.bottomMaxR < rA.bottomMaxR - 8, `${rB.bottomMaxR.toFixed(2)} < ${rA.bottomMaxR.toFixed(2)}`);

// 2) 走完整 round-stool template → seat part → buildShapeGeometry
console.log("\n■ round-stool 完整鏈（legInset 80, seatEdgeBottom 14）");
const entry = FURNITURE_CATALOG.find((e) => (e as { category?: string }).category === "round-stool")!;
const opts = (entry.optionSchema ?? []).reduce<Record<string, string | number | boolean>>((a, s) => { a[s.key] = s.defaultValue; return a; }, {});
Object.assign(opts, { legInset: 80, seatEdge: 0, seatEdgeBottom: 14, seatEdgeStyle: "chamfered" });
const design = entry.template({ length: entry.defaults.length, width: entry.defaults.width, height: entry.defaults.height, material: "maple" as never, options: opts });
const seat = design.parts.find((p) => p.shape?.kind === "round")!;
console.log(`  seat part: ${seat.nameZh}, shape=${JSON.stringify(seat.shape)}`);
const sz: [number, number, number] = [seat.visible.length, seat.visible.thickness, seat.visible.width];
const gSeat = buildShapeGeometry(seat.shape, sz)!;
const rSeat = bottomRingRadius(gSeat);
console.log(`  seat mesh: 底環半徑=${rSeat.bottomMaxR.toFixed(2)} / 整體最大=${rSeat.maxR.toFixed(2)} / y=[${rSeat.minY.toFixed(1)},${rSeat.maxY.toFixed(1)}]`);
ok("round-stool seat mesh 底環內縮（下緣倒角有進幾何）", rSeat.maxR - rSeat.bottomMaxR > 5, `縮 ${(rSeat.maxR - rSeat.bottomMaxR).toFixed(2)}mm`);

console.log("\n" + (fail === 0 ? "🎉 幾何層全部通過 — 下緣倒角確實做進 mesh" : `❌ ${fail} 項失敗`));
process.exit(fail === 0 ? 0 : 1);
