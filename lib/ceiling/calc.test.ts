/**
 * 算料引擎驗證腳本 — 階段 1 user 核對用
 *
 * 跑法:`npx tsx lib/ceiling/calc.test.ts`
 *
 * 印出 baseline + 3 個 edge case 的完整算料結果,人眼比對真實案場數字。
 * 「期望值」是計算公式推導(寫死),用 assert 鎖住:若公式被誤改,
 * 重跑會 fail。
 */

import { computeCeilingBom } from "./calc";
import { DEFAULT_CEILING_INPUT, type CeilingInput } from "./types";

interface TestCase {
  name: string;
  input: CeilingInput;
  /** 部分期望值(只鎖最關鍵的幾項,user 可核對全表) */
  expect: {
    hangerHeightCm: number;
    pingShu: number;
    leftoverCm: number;
    mainPositionCount: number;
    mainJoistLengthCm: number;
    mainJoistTimberCount: number;
    /** 副支按長度分組 [長度cm, 支數][] */
    subJoistGroups: Array<[number, number]>;
    hangerCount: number;
    boardFullCount: number;
    boardCutCount: number;
  };
}

const CASES: TestCase[] = [
  {
    name: "baseline 500×320(規格預設值)",
    input: { ...DEFAULT_CEILING_INPUT },
    expect: {
      hangerHeightCm: 20,
      pingShu: 4.84,
      leftoverCm: 45.5,
      mainPositionCount: 6,
      mainJoistLengthCm: 312.8,
      mainJoistTimberCount: 6,
      subJoistGroups: [
        [87.3, 45], // 5 主支內 slot × 9 副支(公式 floor+1)
        [19.2, 18], // 2 邊 slot × 9 副支
      ],
      hangerCount: 24, // 6 主支 × 4 (standard, floor(312.8/90)+1=4)
      boardFullCount: 5, // 5 全寬欄(90.9 cm,容差內)× 1 全長列
      boardCutCount: 9, // 7 欄 × 2 列 − 5 = 9(2 邊欄裁切 × 2 列 + 5 全欄 × 1 短列)
    },
  },
  {
    name: "正方形 400×400(臥房常見)",
    input: { ...DEFAULT_CEILING_INPUT, longSideCm: 400, shortSideCm: 400 },
    expect: {
      hangerHeightCm: 20,
      pingShu: 4.84, // 16 / 3.305
      leftoverCm: 36.4, // 400 − 4×90.9 = 36.4
      mainPositionCount: 5, // floor(400/90.9)+1 = 5
      mainJoistLengthCm: 392.8, // 400 − 2×3.6
      mainJoistTimberCount: 5,
      subJoistGroups: [
        [87.3, 44], // 4 內 slot × 11 副支(floor(392.8/36.36)+1=11)
        [14.6, 22], // 2 邊 slot × 11 副支
      ],
      hangerCount: 25, // 5 × 5 (floor(392.8/90)+1 = 5)
      boardFullCount: 8, // 4 全寬欄 × 2 全長列(400/180 → fullRows=2)
      boardCutCount: 10, // 6 欄 × 3 列 − 8 = 10
    },
  },
  {
    name: "超長條 800×200(走道型)",
    input: { ...DEFAULT_CEILING_INPUT, longSideCm: 800, shortSideCm: 200 },
    expect: {
      hangerHeightCm: 20,
      pingShu: 4.84, // 800×200/10000/3.305
      leftoverCm: 72.8, // 800 − 8×90.9 = 800 − 727.2 = 72.8
      mainPositionCount: 9,
      mainJoistLengthCm: 192.8,
      mainJoistTimberCount: 9,
      subJoistGroups: [
        [87.3, 48], // 8 內 slot × 6 副支(floor(192.8/36.36)+1=6)
        [32.8, 12], // 2 邊 slot × 6 副支
      ],
      hangerCount: 27, // 9 × 3 (floor(192.8/90)+1 = 3)
      boardFullCount: 8, // 8 全寬欄 × 1 全長列
      boardCutCount: 12, // 10 欄 × 2 列 − 8 = 12
    },
  },
  {
    name: "超大房間 800×600(客廳)",
    input: { ...DEFAULT_CEILING_INPUT, longSideCm: 800, shortSideCm: 600 },
    expect: {
      hangerHeightCm: 20,
      pingShu: 14.52, // 48 / 3.305
      leftoverCm: 72.8,
      mainPositionCount: 9,
      mainJoistLengthCm: 592.8,
      mainJoistTimberCount: 9,
      subJoistGroups: [
        [87.3, 136], // 8 內 slot × 17 副支(floor(592.8/36.36)+1=17)
        [32.8, 34], // 2 邊 slot × 17 副支
      ],
      hangerCount: 63, // 9 × 7 (floor(592.8/90)+1 = 7)
      boardFullCount: 24, // 8 全寬欄 × 3 全長列
      boardCutCount: 16, // 10 欄 × 4 列 − 24 = 16
    },
  },
];

// ─────────────────────────────────────────────────────────
// 跑 + 印
// ─────────────────────────────────────────────────────────

let failed = 0;
for (const tc of CASES) {
  console.log(`\n${"━".repeat(72)}`);
  console.log(`▶ ${tc.name}`);
  console.log("━".repeat(72));
  const bom = computeCeilingBom(tc.input);

  // 自動算
  console.log(
    `自動算:吊筋高度=${round(bom.auto.hangerHeightCm)} cm | 房間面積=${round(bom.auto.roomAreaM2)} m² | 坪數=${round(bom.auto.pingShu)} 坪 | 剩餘收邊=${round(bom.auto.leftoverCm)} cm | 主支位置數=${bom.auto.mainPositionCount}`,
  );

  // BOM 表
  console.log(`\n材料表:`);
  for (const it of bom.items) {
    const len = it.unitLengthCm != null ? `${it.unitLengthCm} cm` : "—";
    const tot = it.totalLengthM != null ? `${it.totalLengthM} m` : "—";
    console.log(
      `  ${pad(it.category, 11)} ${pad(it.nameZh, 16)} ${pad(it.spec, 22)} 單長=${pad(len, 8)} 總長=${pad(tot, 7)} 數量=${it.count}`,
    );
    if (it.note) console.log(`      → ${it.note}`);
  }

  // Assert
  const errors: string[] = [];
  check(errors, "hangerHeightCm", round(bom.auto.hangerHeightCm), tc.expect.hangerHeightCm);
  check(errors, "pingShu", round(bom.auto.pingShu), tc.expect.pingShu);
  check(errors, "leftoverCm", round(bom.auto.leftoverCm), tc.expect.leftoverCm);
  check(errors, "mainPositionCount", bom.auto.mainPositionCount, tc.expect.mainPositionCount);
  check(errors, "mainJoistLengthCm", bom.trace.mainJoistLengthCm, tc.expect.mainJoistLengthCm);
  check(errors, "mainJoistTimberCount", bom.trace.mainJoistTimberCount, tc.expect.mainJoistTimberCount);

  const subItems = bom.items.filter((i) => i.category === "sub-joist");
  const subGroupsActual: Array<[number, number]> = subItems.map((i) => [i.unitLengthCm ?? 0, i.count]);
  if (!arraysEqualLoose(subGroupsActual, tc.expect.subJoistGroups)) {
    errors.push(`subJoistGroups expected ${JSON.stringify(tc.expect.subJoistGroups)} got ${JSON.stringify(subGroupsActual)}`);
  }

  const hanger = bom.items.find((i) => i.category === "hanger");
  check(errors, "hangerCount", hanger?.count ?? 0, tc.expect.hangerCount);

  const full = bom.items.find((i) => i.category === "board-full");
  const cut = bom.items.find((i) => i.category === "board-cut");
  check(errors, "boardFullCount", full?.count ?? 0, tc.expect.boardFullCount);
  check(errors, "boardCutCount", cut?.count ?? 0, tc.expect.boardCutCount);

  if (errors.length === 0) {
    console.log(`\n  ✅ 全部對齊期望`);
  } else {
    failed++;
    console.log(`\n  ❌ 對不上(${errors.length} 項):`);
    for (const e of errors) console.log(`    - ${e}`);
  }
}

console.log(`\n${"━".repeat(72)}`);
console.log(failed === 0 ? `✅ 全 ${CASES.length} case 通過` : `❌ ${failed} / ${CASES.length} case 失敗`);
console.log("━".repeat(72));
process.exit(failed === 0 ? 0 : 1);

// ─────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────
function round(n: number): number {
  return Math.round(n * 100) / 100;
}
function pad(s: string, n: number): string {
  // 中文寬度視為 2,英數 1 的近似填空白
  const w = [...s].reduce((acc, c) => acc + (c.charCodeAt(0) > 127 ? 2 : 1), 0);
  return s + " ".repeat(Math.max(0, n - w));
}
function check(errors: string[], name: string, actual: number, expected: number) {
  if (Math.abs(actual - expected) > 0.05) {
    errors.push(`${name} expected ${expected} got ${actual}`);
  }
}
function arraysEqualLoose(a: Array<[number, number]>, b: Array<[number, number]>): boolean {
  if (a.length !== b.length) return false;
  // 比對時容許 0.1 cm 誤差(浮點)
  const sortA = [...a].sort((x, y) => y[0] - x[0]);
  const sortB = [...b].sort((x, y) => y[0] - x[0]);
  for (let i = 0; i < sortA.length; i++) {
    if (Math.abs(sortA[i][0] - sortB[i][0]) > 0.1) return false;
    if (sortA[i][1] !== sortB[i][1]) return false;
  }
  return true;
}
