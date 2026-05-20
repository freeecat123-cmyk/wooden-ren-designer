/**
 * lib/export/flat-layout.ts 驗證腳本
 * 跑法：npx tsx lib/export/flat-layout.test.ts
 */
import { packShelves } from "./flat-layout";

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

// --- 收尾 ---
if (failed > 0) {
  console.error(`\n${failed} 個測試失敗`);
  process.exit(1);
}
console.log("\n全部通過");
