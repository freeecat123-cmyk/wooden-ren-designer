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
import { buildPlatformPolygon, joistRunLengthsM } from "./geometry";
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
  const plankFullCount = layout.planks.filter((p) => p.kind === "full").length;
  const plankCutCount = layout.planks.filter((p) => p.kind === "cut").length;
  const plankTotalCount = plankFullCount + plankCutCount;
  const plankNominalCm2 =
    plankTotalCount * input.plankLengthCm * input.plankWidthCm;
  const plankUsedCm2 = layout.planks.reduce((s, p) => s + p.usedAreaCm2, 0);
  const plankWastePercent =
    plankUsedCm2 > 0
      ? ((plankNominalCm2 - plankUsedCm2) / plankUsedCm2) * 100
      : 0;

  // 3. 骨架
  const joist = joistRunLengthsM(platform, input.joistSpacingCm);
  const joistTotalM = joist.totalLengthM;

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
  const joistCost =
    input.joistPricePerM > 0 ? joistTotalM * input.joistPricePerM : 0;
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
      nameZh: "骨架角材",
      spec: `${input.joist.nameZh} @ ${input.joistSpacingCm}cm`,
      totalLengthM: joistTotalM,
      note: `井字邊框 ${joist.perimeterM.toFixed(1)}m + 中間支撐 ${joist.middleCount} 條`,
      subtotal: joistCost > 0 ? joistCost : undefined,
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
      plankTotalCount,
      plankWastePercent,
      joistTotalM,
      joistRowCount: joist.middleCount,
      plywoodSheetCount,
      perimeterM,
    },
  };
}
