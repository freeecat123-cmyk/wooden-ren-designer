/**
 * 跑法:npx tsx lib/raised-floor/calc.test.ts
 */
import { computeRaisedFloorBom } from "./calc";
import { DEFAULT_RAISED_FLOOR_INPUT, type RaisedFloorInput } from "./types";

let passed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("❌ " + msg);
  passed++;
}
function approx(a: number, b: number, eps = 0.5) {
  return Math.abs(a - b) < eps;
}

// ────────── 預設輸入 ──────────
{
  const bom = computeRaisedFloorBom(DEFAULT_RAISED_FLOOR_INPUT);
  // 300×400 = 12 m² = 3.63 坪;周長 1400cm = 14m
  assert(approx(bom.auto.platformAreaM2, 12, 0.01), `面積 = 12, 實際 ${bom.auto.platformAreaM2}`);
  assert(approx(bom.auto.pingShu, 3.63, 0.05), `坪 ≈ 3.63, 實際 ${bom.auto.pingShu}`);
  assert(approx(bom.auto.perimeterM, 14, 0.01), `周長 = 14m`);
  assert(bom.items.length === 5, "5 大材料品項(含副支)");
  assert(bom.items[0].category === "plank", "[0] plank");
  assert(bom.items[1].category === "joist", "[1] joist");
  assert(bom.items[2].category === "sub-joist", "[2] sub-joist");
  assert(bom.items[3].category === "plywood", "[3] plywood");
  assert(bom.items[4].category === "skirting", "[4] skirting");
}

// ────────── 4 大數量 sanity ──────────
{
  const bom = computeRaisedFloorBom(DEFAULT_RAISED_FLOOR_INPUT);
  // 面材 12m²/0.236m²(121*19.5cm) ≈ 52 片基線
  assert(bom.trace.plankTotalCount > 30, `面材 > 30 片, 實際 ${bom.trace.plankTotalCount}`);
  assert(bom.trace.plankTotalCount < 80, `面材 < 80 片, 實際 ${bom.trace.plankTotalCount}`);
  // 骨架:300×400/30 spacing,期望 35-65m
  assert(
    bom.trace.joistTotalM > 30,
    `骨架 > 30m, 實際 ${bom.trace.joistTotalM}`,
  );
  // 夾板:12m²/2.98m² * 1.2 = 4.83 → ceil = 5
  assert(bom.trace.plywoodSheetCount === 5, `夾板 5 片, 實際 ${bom.trace.plywoodSheetCount}`);
  // 踢腳:14m
  assert(approx(bom.trace.perimeterM, 14, 0.01), `踢腳 14m`);
}

// ────────── 未報價時 hasUnpriced=true ──────────
{
  const bom = computeRaisedFloorBom(DEFAULT_RAISED_FLOOR_INPUT);
  assert(bom.cost.total === 0, "未報價 total=0");
  assert(bom.cost.hasUnpriced === true, "hasUnpriced=true");
}

// ────────── 全報價 hasUnpriced=false ──────────
{
  const input: RaisedFloorInput = {
    ...DEFAULT_RAISED_FLOOR_INPUT,
    plankPricePerPing: 3000,
    joistPricePerM: 80,
    plywoodPricePerSheet: 800,
    skirtingPricePerM: 200,
  };
  const bom = computeRaisedFloorBom(input);
  assert(bom.cost.total > 0, "總價 > 0");
  assert(bom.cost.hasUnpriced === false, "hasUnpriced=false");
  assert(bom.cost.plank > 0 && bom.cost.joist > 0 && bom.cost.plywood > 0 && bom.cost.skirting > 0, "4 項都有金額");
  // 踢腳:14m * 200 = 2800
  assert(approx(bom.cost.skirting, 2800, 1), `踢腳 2800, 實際 ${bom.cost.skirting}`);
}

// ────────── L 形面積較小 ──────────
{
  const rect = computeRaisedFloorBom(DEFAULT_RAISED_FLOOR_INPUT);
  const lInput: RaisedFloorInput = {
    ...DEFAULT_RAISED_FLOOR_INPUT,
    shape: "l-shape",
    widthCm: 300,
    depthCm: 400,
    lCutXCm: 120,
    lCutYCm: 160,
  };
  const l = computeRaisedFloorBom(lInput);
  // L 切角 120×160 = 19200 cm² = 1.92 m²,平台 = 12 - 1.92 = 10.08 m²
  assert(approx(l.auto.platformAreaM2, 10.08, 0.01), `L 面積 ≈ 10.08, 實際 ${l.auto.platformAreaM2}`);
  // L 平台周長 > 矩形(凹角多 1 個直角)
  assert(l.auto.perimeterM > rect.auto.perimeterM - 0.5, "L 周長不小於矩形扣 cut");
  // 面材 L < 矩形
  assert(l.trace.plankTotalCount < rect.trace.plankTotalCount, "L 面材片數 < 矩形");
}

// ────────── 加 1 柱 → 面積/材料減少 ──────────
{
  const base = computeRaisedFloorBom(DEFAULT_RAISED_FLOOR_INPUT);
  const withPillar: RaisedFloorInput = {
    ...DEFAULT_RAISED_FLOOR_INPUT,
    pillars: [{ corner: "tl", widthCm: 30, depthCm: 30 }],
  };
  const p = computeRaisedFloorBom(withPillar);
  // 挖 30×30 = 900 cm² = 0.09 m²
  assert(approx(p.auto.platformAreaM2, 12 - 0.09, 0.01), `1 柱面積 11.91`);
  // 面材片數 <= 矩形(可能不變,因為小柱可能落在某片裁切片內)
  assert(p.trace.plankTotalCount <= base.trace.plankTotalCount, "1 柱面材片數不大於矩形");
}

// ────────── 加 2 柱 → 進一步減小 ──────────
{
  const oneP: RaisedFloorInput = {
    ...DEFAULT_RAISED_FLOOR_INPUT,
    pillars: [{ corner: "tl", widthCm: 60, depthCm: 60 }],
  };
  const twoP: RaisedFloorInput = {
    ...DEFAULT_RAISED_FLOOR_INPUT,
    pillars: [
      { corner: "tl", widthCm: 60, depthCm: 60 },
      { corner: "br", widthCm: 60, depthCm: 60 },
    ],
  };
  const one = computeRaisedFloorBom(oneP);
  const two = computeRaisedFloorBom(twoP);
  assert(two.auto.platformAreaM2 < one.auto.platformAreaM2, "2 柱面積 < 1 柱");
  assert(two.trace.plywoodSheetCount <= one.trace.plywoodSheetCount, "2 柱夾板 ≤ 1 柱");
}

// ────────── 改間距 → 骨架數變 ──────────
{
  const dense: RaisedFloorInput = { ...DEFAULT_RAISED_FLOOR_INPUT, joistSpacingCm: 20 };
  const sparse: RaisedFloorInput = { ...DEFAULT_RAISED_FLOOR_INPUT, joistSpacingCm: 50 };
  const d = computeRaisedFloorBom(dense);
  const s = computeRaisedFloorBom(sparse);
  assert(d.trace.joistRowCount > s.trace.joistRowCount, "間距小條數多");
  assert(d.trace.joistTotalM > s.trace.joistTotalM, "間距小總 m 多");
}

// ────────── 改夾板損耗 → 片數變 ──────────
{
  const low: RaisedFloorInput = { ...DEFAULT_RAISED_FLOOR_INPUT, plywoodWaste: 0 };
  const high: RaisedFloorInput = { ...DEFAULT_RAISED_FLOOR_INPUT, plywoodWaste: 0.5 };
  const l = computeRaisedFloorBom(low);
  const h = computeRaisedFloorBom(high);
  assert(h.trace.plywoodSheetCount >= l.trace.plywoodSheetCount, "高損耗 ≥ 低損耗");
}

// ────────── 副支:預設輸入 subJoistTotalM > 0 ──────────
{
  const bom = computeRaisedFloorBom(DEFAULT_RAISED_FLOOR_INPUT);
  assert(bom.trace.subJoistTotalM > 0, `預設副支 totalM > 0, 實際 ${bom.trace.subJoistTotalM}`);
  assert(bom.trace.subJoistCount > 0, `預設副支 count > 0, 實際 ${bom.trace.subJoistCount}`);
}

// ────────── trace.mainJoistCentersCm 跟 joistRowCount 對應 ──────────
{
  const bom = computeRaisedFloorBom(DEFAULT_RAISED_FLOOR_INPUT);
  assert(
    bom.trace.mainJoistCentersCm.length === bom.trace.joistRowCount,
    `mainCenters.length=${bom.trace.mainJoistCentersCm.length} 預期 = joistRowCount=${bom.trace.joistRowCount}`,
  );
}

// ────────── BOM items 含 sub-joist category ──────────
{
  const bom = computeRaisedFloorBom(DEFAULT_RAISED_FLOOR_INPUT);
  const subItem = bom.items.find((i) => i.category === "sub-joist");
  assert(subItem !== undefined, "BOM 含 sub-joist 一行");
  assert(
    (subItem?.totalLengthM ?? 0) > 0,
    `sub-joist totalLengthM > 0, 實際 ${subItem?.totalLengthM}`,
  );
}

// ────────── 副支間距變小 → count/totalM 增加 ──────────
{
  const sparse: RaisedFloorInput = { ...DEFAULT_RAISED_FLOOR_INPUT, subJoistSpacingCm: 60 };
  const dense: RaisedFloorInput = { ...DEFAULT_RAISED_FLOOR_INPUT, subJoistSpacingCm: 20 };
  const sp = computeRaisedFloorBom(sparse);
  const ds = computeRaisedFloorBom(dense);
  assert(
    ds.trace.subJoistCount > sp.trace.subJoistCount,
    `密副支 ${ds.trace.subJoistCount} > 疏副支 ${sp.trace.subJoistCount}`,
  );
  assert(
    ds.trace.subJoistTotalM > sp.trace.subJoistTotalM,
    `密副支 totalM ${ds.trace.subJoistTotalM} > 疏 ${sp.trace.subJoistTotalM}`,
  );
}

// ────────── cost.joist 是「主+副」合計 ──────────
{
  const input: RaisedFloorInput = {
    ...DEFAULT_RAISED_FLOOR_INPUT,
    joistPricePerM: 80,
  };
  const bom = computeRaisedFloorBom(input);
  const expected =
    (bom.trace.joistTotalM + bom.trace.subJoistTotalM) * 80;
  assert(
    approx(bom.cost.joist, expected, 1),
    `cost.joist=${bom.cost.joist} 預期主+副合計 ${expected}`,
  );
}

console.log(`✅ calc: ${passed} passed`);
