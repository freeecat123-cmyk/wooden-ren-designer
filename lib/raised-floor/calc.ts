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

export function computeRaisedFloorBom(
  input: RaisedFloorInput,
  locale: string = "zh-TW",
): RaisedFloorBom {
  const isEn = locale === "en";
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
    direction: input.plankDirection ?? "long-axis",
    stagger: "half",
    startCorner: input.plankStartCorner ?? "top-left",
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
  // 主支對齊夾板:用 plywood.sheetLengthCm(短邊)當 N 等分基準,
  // 確保夾板沿長軸的接縫剛好落在主支中心(消除 snap 浪費)
  const joist = joistRunLengthsM(
    platform,
    input.joistSpacingCm,
    input.plywood.sheetLengthCm,
  );
  const joistTotalM = joist.totalLengthM;

  // 3b. 副支(垂直主支、跨 slot,沿短軸方向每 subSpacingCm 一排)
  // plywood.sheetWidthCm = 夾板長邊(244 或 183);副支會自動對齊夾板接縫
  const subJoist = subJoistRunLengthsM(
    platform,
    joist.mainJoistCentersCm,
    input.subJoistSpacingCm,
    input.plywood.sheetWidthCm,
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
  // 5b. 踢腳板長度 — skirtingType ≠ "none" 才扣門洞,反之沿用舊版「沿平台周長」
  const skirtingType = input.skirtingType ?? "none";
  const doorCount = Math.max(0, input.doorCount ?? 0);
  const doorWidthCm = Math.max(0, input.doorWidthCm ?? 0);
  const doorDeductM =
    skirtingType !== "none" ? (doorCount * doorWidthCm) / 100 : 0;
  const skirtingLengthM = Math.max(0, perimeterM - doorDeductM);
  const skirtingCost =
    input.skirtingPricePerM > 0
      ? skirtingLengthM * input.skirtingPricePerM
      : 0;

  // 5c. 防潮墊 — 平台面積 × (1 + waste) ÷ 單卷面積,卷數無條件進位
  const underlay = input.underlay;
  const underlayWaste = Math.max(0, input.underlayWaste ?? 0.1);
  const underlayRollCount =
    underlay && underlay.rollAreaM2 > 0
      ? Math.max(
          1,
          Math.ceil((platformAreaM2 * (1 + underlayWaste)) / underlay.rollAreaM2),
        )
      : 0;
  const underlayCost =
    underlay && underlay.pricePerRoll > 0
      ? underlayRollCount * underlay.pricePerRoll
      : 0;

  const totalCost =
    plankCost + joistCost + plywoodCost + skirtingCost + underlayCost;
  const hasUnpriced =
    input.plankPricePerPing <= 0 ||
    input.joistPricePerM <= 0 ||
    input.plywoodPricePerSheet <= 0 ||
    input.skirtingPricePerM <= 0 ||
    (underlay !== undefined && underlay.pricePerRoll <= 0);

  // 6. BOM items
  const items: RaisedFloorBomItem[] = [
    {
      category: "plank",
      nameZh: "面材(地板片)",
      nameEn: "Floor planks",
      spec: `${input.plankLengthCm}×${input.plankWidthCm} cm`,
      count: plankTotalCount,
      note: `整片 ${plankFullCount} + 裁切 ${plankCutCount}(實算損耗 ${plankWastePercent.toFixed(1)}%)`,
      noteEn: isEn
        ? `${plankFullCount} full + ${plankCutCount} cut (waste ${plankWastePercent.toFixed(1)}%)`
        : undefined,
      subtotal: plankCost > 0 ? plankCost : undefined,
    },
    {
      category: "joist",
      nameZh: "主支(骨架)",
      nameEn: "Main joists (frame)",
      spec: `${input.mainJoist.nameZh} @ ${input.joistSpacingCm}cm`,
      totalLengthM: joistTotalM,
      note: `井字邊框 ${joist.perimeterM.toFixed(1)}m + 中間主支 ${joist.middleCount} 條`,
      noteEn: isEn
        ? `Perimeter frame ${joist.perimeterM.toFixed(1)} m + ${joist.middleCount} interior runs`
        : undefined,
      subtotal: mainJoistCost > 0 ? mainJoistCost : undefined,
    },
    {
      category: "sub-joist",
      nameZh: "副支(密底)",
      nameEn: "Sub-joists (dense base)",
      spec: `${input.subJoist.nameZh} @ ${input.subJoistSpacingCm}cm`,
      totalLengthM: subJoistTotalM,
      note: `${subJoist.count} 根 × 平均 ${subJoist.typicalLengthCm.toFixed(0)}cm`,
      noteEn: isEn
        ? `${subJoist.count} runs × avg ${subJoist.typicalLengthCm.toFixed(0)} cm`
        : undefined,
      subtotal: subJoistCost > 0 ? subJoistCost : undefined,
    },
    {
      category: "plywood",
      nameZh: "底層夾板",
      nameEn: "Base plywood",
      spec: `${input.plywood.nameZh} ${input.plywood.sheetLengthCm}×${input.plywood.sheetWidthCm}cm`,
      count: plywoodSheetCount,
      note: `平台 ${platformAreaM2.toFixed(2)}m² ÷ 單片 ${sheetAreaM2.toFixed(2)}m² × 1+${Math.round(input.plywoodWaste * 100)}%損耗`,
      noteEn: isEn
        ? `Platform ${platformAreaM2.toFixed(2)} m² ÷ sheet ${sheetAreaM2.toFixed(2)} m² × 1+${Math.round(input.plywoodWaste * 100)}% waste`
        : undefined,
      subtotal: plywoodCost > 0 ? plywoodCost : undefined,
    },
    {
      category: "skirting",
      nameZh:
        skirtingType === "wood"
          ? "踢腳板(木質)"
          : skirtingType === "pvc"
            ? "踢腳板(PVC)"
            : "踢腳/收邊",
      nameEn:
        skirtingType === "wood"
          ? "Baseboard (wood)"
          : skirtingType === "pvc"
            ? "Baseboard (PVC)"
            : "Baseboard / trim",
      spec:
        skirtingType === "none"
          ? isEn
            ? "Along platform perimeter"
            : "沿平台周長"
          : isEn
            ? `H ${input.skirtingHeightCm ?? 8} cm × perimeter`
            : `高 ${input.skirtingHeightCm ?? 8}cm × 沿平台周長`,
      totalLengthM: skirtingLengthM,
      note:
        skirtingType !== "none" && doorCount > 0
          ? `已扣 ${doorCount} 個門洞 × ${doorWidthCm}cm`
          : undefined,
      noteEn:
        isEn && skirtingType !== "none" && doorCount > 0
          ? `Deducted ${doorCount} door openings × ${doorWidthCm} cm`
          : undefined,
      subtotal: skirtingCost > 0 ? skirtingCost : undefined,
    },
  ];

  if (underlay) {
    const rollM2Total = underlayRollCount * underlay.rollAreaM2;
    items.push({
      category: "underlay",
      nameZh: "防潮墊",
      nameEn: "Vapor barrier",
      spec: `${underlay.nameZh} ${underlay.rollAreaM2.toFixed(0)}m²/卷`,
      count: underlayRollCount,
      note: `平台 ${platformAreaM2.toFixed(2)}m² × 1+${Math.round(underlayWaste * 100)}%損耗 → ${underlayRollCount} 卷(${rollM2Total.toFixed(0)}m²)`,
      noteEn: isEn
        ? `Platform ${platformAreaM2.toFixed(2)} m² × 1+${Math.round(underlayWaste * 100)}% waste → ${underlayRollCount} rolls (${rollM2Total.toFixed(0)} m²)`
        : undefined,
      subtotal: underlayCost > 0 ? underlayCost : undefined,
    });
  }

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
      underlay: underlayCost,
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
      skirtingLengthM,
      underlayRollCount,
    },
  };
}
