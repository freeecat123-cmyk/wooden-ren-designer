/**
 * lib/export/flat-layout.ts 驗證腳本
 * 跑法：npx tsx lib/export/flat-layout.test.ts
 */
import { packShelves, orientFlat, buildFlatLayoutGroup } from "./flat-layout";
import { BoxGeometry, Box3, Mesh } from "three";
import type { FurnitureDesign } from "@/lib/types";

let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) console.log(`✅ ${name}`);
  else {
    console.error(`❌ ${name}`);
    failed++;
  }
}

// --- packShelves ---
// 3 件各 100×50，床寬 250、間隔 10：前 2 件同列（0..210 < 250），第 3 件換列
const p = packShelves(
  [
    { w: 100, d: 50 },
    { w: 100, d: 50 },
    { w: 100, d: 50 },
  ],
  250,
  10,
);
check("第 1 件中心 x=50 z=25", p[0].x === 50 && p[0].z === 25);
check("第 2 件中心 x=160 z=25（同列）", p[1].x === 160 && p[1].z === 25);
check("第 3 件換列 x=50 z=85", p[2].x === 50 && p[2].z === 85);

// 順序：回傳順序對應輸入順序（內部依大小排但輸出位置回填原 index）
const p2 = packShelves([{ w: 200, d: 30 }, { w: 40, d: 30 }], 250, 10);
check("回傳對應輸入順序、件數一致", p2.length === 2);
check("窄件與寬件不重疊（x 不同）", p2[0].x !== p2[1].x);

// --- orientFlat ---
// 方塊 300×18×200（X×Y×Z）：Y 最小（18）→ 已攤平、不轉
const d1 = orientFlat(new BoxGeometry(300, 18, 200));
check("Y 最薄→不轉，footprint 300×200 高 18", d1.footprintX === 300 && d1.footprintZ === 200 && d1.height === 18);

// 方塊 400×35×20：Z 最小（20）→ 繞 X 轉，Z→Y
const d2 = orientFlat(new BoxGeometry(400, 35, 20));
check("Z 最薄→轉平，footprint 400×35 高 20", d2.footprintX === 400 && d2.footprintZ === 35 && d2.height === 20);

// 方塊 35×400×35：X 最小（與 Z 並列，取 X）→ 繞 Z 轉，X→Y
const d3 = orientFlat(new BoxGeometry(35, 400, 35));
check("長軸在 Y→轉平，高度=35（最薄）", d3.height === 35 && Math.max(d3.footprintX, d3.footprintZ) === 400);

// --- buildFlatLayoutGroup ---
const flatDesign = {
  category: "stool",
  parts: [
    { id: "a", nameZh: "板A", visible: { length: 200, width: 150, thickness: 18 } },
    { id: "b", nameZh: "板B", visible: { length: 200, width: 150, thickness: 18 } },
    { id: "glass", nameZh: "玻璃", visual: true, visible: { length: 10, width: 10, thickness: 2 } },
  ],
} as unknown as FurnitureDesign;

const group = buildFlatLayoutGroup(flatDesign, 1);
const meshes: Mesh[] = [];
group.traverse((o) => {
  if ((o as Mesh).isMesh) meshes.push(o as Mesh);
});
check("攤平 group 跳過 visual 件、剩 2 件", meshes.length === 2);

// 兩件世界 AABB 不重疊（group 已套 Z-up 旋轉 + scale=1）
group.updateMatrixWorld(true);
const box0 = new Box3().setFromObject(meshes[0]);
const box1 = new Box3().setFromObject(meshes[1]);
const overlap =
  box0.max.x > box1.min.x + 1e-6 &&
  box1.max.x > box0.min.x + 1e-6 &&
  box0.max.y > box1.min.y + 1e-6 &&
  box1.max.y > box0.min.y + 1e-6;
check("兩件攤平後互不重疊", !overlap);

// 攤平後所有件坐在床面（Z-up 後最低點 z ≈ 0）
const minZ = Math.min(box0.min.z, box1.min.z);
check("零件底面坐列印床 z≈0", Math.abs(minZ) < 1e-3);

// --- 收尾 ---
if (failed > 0) {
  console.error(`\n${failed} 個測試失敗`);
  process.exit(1);
}
console.log("\n全部通過");
