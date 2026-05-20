/**
 * lib/export/export-checks.ts 驗證腳本
 * 跑法：npx tsx lib/export/export-checks.test.ts
 */
import type { FurnitureDesign } from "@/lib/types";
import { analyzeMinThickness } from "./export-checks";

let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) console.log(`✅ ${name}`);
  else {
    console.error(`❌ ${name}`);
    failed++;
  }
}

// --- analyzeMinThickness ---
const fakeDesign = {
  parts: [
    { id: "leg", nameZh: "腳", visible: { length: 400, width: 35, thickness: 35 } },
    { id: "seat", nameZh: "座板", visible: { length: 300, width: 300, thickness: 18 } },
    { id: "drawer-bottom", nameZh: "抽屜底板", visible: { length: 280, width: 200, thickness: 3 } },
    { id: "glass", nameZh: "玻璃", visual: true, visible: { length: 5, width: 5, thickness: 1 } },
  ],
} as unknown as FurnitureDesign;

const r1 = analyzeMinThickness(fakeDesign, 1);
check("最薄件取最小維度（抽屜底板 3mm）", r1.thinnestMm === 3 && r1.partName === "抽屜底板");

const r2 = analyzeMinThickness(fakeDesign, 0.1);
check("套用 scale 0.1（3mm → 0.3mm）", Math.abs(r2.thinnestMm - 0.3) < 1e-9);

check("跳過 visual 五金件（玻璃不算）", analyzeMinThickness(fakeDesign, 1).partName !== "玻璃");

const empty = { parts: [] } as unknown as FurnitureDesign;
check("空零件回 Infinity", analyzeMinThickness(empty, 1).thinnestMm === Infinity);

// --- 收尾 ---
if (failed > 0) {
  console.error(`\n${failed} 個測試失敗`);
  process.exit(1);
}
console.log("\n全部通過");
