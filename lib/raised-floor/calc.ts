/**
 * 和室架高平台算料引擎 — 4 大材料 BOM + 估價
 *
 * 公式:
 *   平台面積 = polygonArea / 10000 (m²)
 *   坪數 = m² / 3.305
 *   周長 = polygonPerimeter / 100 (m)
 *   面材片數 = 複用 /floor 的 computeFloorLayout(把平台當地板房間)
 *   角材總 m = polygonPerimeter 邊框 + 中間短向支撐(joistRunLengthsM)
 *   夾板片數 = ceil(平台 m² ÷ 單片 m² × (1 + waste))
 *   踢腳板 m = 平台周長
 */
import type { RaisedFloorBom, RaisedFloorBomItem, RaisedFloorInput } from "./types";
import { polygonArea, polygonPerimeter } from "@/lib/floor/geometry";
import { computeFloorLayout } from "@/lib/floor/layout";
import { optimizeOffcuts } from "@/lib/floor/cutting";
import { buildPlatformPolygon, joistRunLengthsM, subJoistRunLengthsM } from "./geometry";
import type { FloorInput } from "@/lib/floor/types";

const PING_M2 = 3.305;

export function computeRaisedFloorBom(input: RaisedFloorInput): RaisedFloorBom {
  // 1. 平台多邊形
  const platform = buildPlatformPolygon({
    shape: input.shape,
    widthCm: input.widthCm,
    depthCm: input.depthCm,
    lCutXCm: input.lCutXCm,
    lCutYCm: input.lCutYCm,
    pillars: input.pillars,
  });
  const platformAreaM2 = polygonArea(platform) / 10000;
  const pingShu = platformAreaM2 / PING_M2;
  const perimeterM = polygonPerimeter(platform) / 100;

  // 2. 面材:重用 /floor layout(把平台當作鋪地板的房間)
  const floorInput: FloorInput = {
    room: platform,
    pattern: "straight",
    plankLengthCm: input.plankLengthCm,
    plankWidthCm: input.plankWidthCm,
    direction: "long-axis",
    stagger: "half",
    startCorner: "top-left",
    expansionGapMm: input.plankGapMm,
    wasteMode: "computed",
    reuseOffcuts: true,
    skirtingType: "none",
    doorCount: 0,
    doorWidthCm: 0,
    plankPricePerPing: 0,
    skirtingPricePerM: 0,
    underlayPricePerPing: 0,
  };
  const layout = computeFloorLayout(floorInput);
  const fullPlanks = layout.planks.filter((p) => p.kind === "full");
  const cutPlanks = layout.planks.filter((p) => p.kind === "cut");
  const plankFullCount = fullPlanks.length;
  const plankCutCount = cutPlanks.length;
  const plankTotalCount = plankFullCount + plankCutCount;
  // 餘料再利用 — 算「裁切片實際消耗的全新片數」與紀錄
  const cutResult = optimizeOffcuts(
    cutPlanks.map((p) => p.effectiveLengthCm),
    input.plankLengthCm,
  );
  const plankCutNewCount = cutResult.cutPlankCount;
  const offcutReuseLog = cutResult.reuseLog;
  const plankNominalCm2 =
    plankTotalCount * input.plankLengthCm * input.plankWidthCm;
  const plankUsedCm2 = layout.planks.reduce((s, p) => s + p.usedAreaCm2, 0);
  const plankWastePercent =
    plankUsedCm2 > 0
      ? ((plankNominalCm2 - plankUsedCm2) / plankUsedCm2) * 100
      : 0;

  // 3. 骨架(主支:邊框 + 中間短向支撐)
  const joist = joistRunLengthsM(platform, input.joistSpacingCm);
  const joistTotalM = joist.totalLengthM;

  // 3b. 副支(垂直主支、跨 slot,沿短軸方向每 subSpacingCm 一排)
  const subJoist = subJoistRunLengthsM(
    platform,
    joist.mainJoistCentersCm,
    input.subJoistSpacingCm,
  );
  const subJoistTotalM = subJoist.totalLengthM;

  // 4. 夾板
  const sheetAreaM2 =
    (input.plywood.sheetLengthCm * input.plywood.sheetWidthCm) / 10000;
  const plywoodSheetCount = Math.max(
    1,
    Math.ceil((platformAreaM2 / sheetAreaM2) * (1 + Math.max(0, input.plywoodWaste))),
  );

  // 5. 估價
  const boughtPing = plankNominalCm2 / 10000 / PING_M2;
  const plankCost =
    input.plankPricePerPing > 0 ? boughtPing * input.plankPricePerPing : 0;
  const mainJoistCost =
    input.joistPricePerM > 0 ? joistTotalM * input.joistPricePerM : 0;
  const subJoistCost =
    input.joistPricePerM > 0 ? subJoistTotalM * input.joistPricePerM : 0;
  // cost.joist = 主 + 副(共用同單價;UI 想拆顯示走 trace)
  const joistCost = mainJoistCost + subJoistCost;
  const plywoodCost =
    input.plywoodPricePerSheet > 0
      ? plywoodSheetCount * input.plywoodPricePerSheet
      : 0;
  const skirtingCost =
    input.skirtingPricePerM > 0 ? perimeterM * input.skirtingPricePerM : 0;
  const totalCost = plankCost + joistCost + plywoodCost + skirtingCost;
  const hasUnpriced =
    input.plankPricePerPing <= 0 ||
    input.joistPricePerM <= 0 ||
    input.plywoodPricePerSheet <= 0 ||
    input.skirtingPricePerM <= 0;

  // 6. BOM items
  const items: RaisedFloorBomItem[] = [
    {
      category: "plank",
      nameZh: "面材(地板片)",
      spec: `${input.plankLengthCm}×${input.plankWidthCm} cm`,
      count: plankTotalCount,
      note: `整片 ${plankFullCount} + 裁切 ${plankCutCount}(實算損耗 ${plankWastePercent.toFixed(1)}%)`,
      subtotal: plankCost > 0 ? plankCost : undefined,
    },
    {
      category: "joist",
      nameZh: "主支(骨架)",
      spec: `${input.mainJoist.nameZh} @ ${input.joistSpacingCm}cm`,
      totalLengthM: joistTotalM,
      note: `井字邊框 ${joist.perimeterM.toFixed(1)}m + 中間主支 ${joist.middleCount} 條`,
      subtotal: mainJoistCost > 0 ? mainJoistCost : undefined,
    },
    {
      category: "sub-joist",
      nameZh: "副支(密底)",
      spec: `${input.subJoist.nameZh} @ ${input.subJoistSpacingCm}cm`,
      totalLengthM: subJoistTotalM,
      note: `${subJoist.count} 根 × 平均 ${subJoist.typicalLengthCm.toFixed(0)}cm`,
      subtotal: subJoistCost > 0 ? subJoistCost : undefined,
    },
    {
      category: "plywood",
      nameZh: "底層夾板",
      spec: `${input.plywood.nameZh} ${input.plywood.sheetLengthCm}×${input.plywood.sheetWidthCm}cm`,
      count: plywoodSheetCount,
      note: `平台 ${platformAreaM2.toFixed(2)}m² ÷ 單片 ${sheetAreaM2.toFixed(2)}m² × 1+${Math.round(input.plywoodWaste * 100)}%損耗`,
      subtotal: plywoodCost > 0 ? plywoodCost : undefined,
    },
    {
      category: "skirting",
      nameZh: "踢腳/收邊",
      spec: "沿平台周長",
      totalLengthM: perimeterM,
      subtotal: skirtingCost > 0 ? skirtingCost : undefined,
    },
  ];

  return {
    input,
    platform,
    layout,
    items,
    auto: { platformAreaM2, pingShu, perimeterM },
    cost: {
      plank: plankCost,
      joist: joistCost,
      plywood: plywoodCost,
      skirting: skirtingCost,
      total: totalCost,
      hasUnpriced,
    },
    trace: {
      plankFullCount,
      plankCutCount,
      plankCutNewCount,
      offcutReuseLog,
      plankTotalCount,
      plankWastePercent,
      joistTotalM,
      joistRowCount: joist.middleCount,
      mainJoistCentersCm: joist.mainJoistCentersCm,
      subJoistCount: subJoist.count,
      subJoistTotalM,
      subJoistLengthCm: subJoist.typicalLengthCm,
      plywoodSheetCount,
      perimeterM,
    },
  };
}
