/**
 * 地板算料引擎 — 排版結果 → 完整 BOM + trace
 *
 * 公式:
 *   房間面積  = polygonArea / 10000 (m²)
 *   坪數      = 面積 / 3.305
 *   周長      = polygonPerimeter / 100 (m)
 *   損耗率 computed  = (總片名目面積 − 房間鋪用面積) / 房間鋪用面積
 *   損耗率 empirical = 固定 10%
 *
 * ASSUMPTION:
 *   - 收邊條/踢腳板長度 = 房間周長(門洞不自動扣,note 提醒)
 *   - 防潮墊面積 = 房間面積(平鋪需滿鋪)
 */
import type { FloorBom, FloorBomItem, FloorInput } from "./types";
import { polygonArea, polygonPerimeter } from "./geometry";
import { computeFloorLayout } from "./layout";
import { optimizeOffcuts } from "./cutting";

const EMPIRICAL_WASTE = 0.1;

export function computeFloorBom(input: FloorInput): FloorBom {
  const layout = computeFloorLayout(input);

  const fullPlanks = layout.planks.filter((p) => p.kind === "full");
  const cutPlanks = layout.planks.filter((p) => p.kind === "cut");
  const fullPlankCount = fullPlanks.length;
  const cutPieceCount = cutPlanks.length;

  const cutResult = input.reuseOffcuts
    ? optimizeOffcuts(cutPlanks.map((p) => p.effectiveLengthCm), input.plankLengthCm)
    : { cutPlankCount: cutPieceCount, reuseLog: [] as string[] };
  const cutPlankCount = cutResult.cutPlankCount;
  const totalPlankCount = fullPlankCount + cutPlankCount;

  const roomAreaCm2 = polygonArea(input.room);
  const roomAreaM2 = roomAreaCm2 / 10000;
  const pingShu = roomAreaM2 / 3.305;
  const perimeterM = polygonPerimeter(input.room) / 100;

  const plankNominalAreaCm2 =
    totalPlankCount * input.plankLengthCm * input.plankWidthCm;
  const usedAreaCm2 = layout.planks.reduce((s, p) => s + p.usedAreaCm2, 0);
  const wastePercent =
    input.wasteMode === "empirical"
      ? EMPIRICAL_WASTE * 100
      : usedAreaCm2 > 0
        ? ((plankNominalAreaCm2 - usedAreaCm2) / usedAreaCm2) * 100
        : 0;

  const items: FloorBomItem[] = [];

  items.push({
    category: "plank",
    nameZh: "地板片",
    spec: `${input.plankLengthCm}×${input.plankWidthCm} cm`,
    count: totalPlankCount,
    note:
      input.wasteMode === "empirical"
        ? `含經驗損耗 10%;建議進貨 ${Math.ceil(totalPlankCount * 1.1)} 片`
        : `整片 ${fullPlankCount} + 裁切 ${cutPlankCount}(實算損耗 ${wastePercent.toFixed(1)}%)`,
  });

  if (input.skirtingType !== "none") {
    items.push({
      category: "skirting",
      nameZh: input.skirtingType === "skirting" ? "踢腳板" : "收邊條",
      spec: "沿牆周長",
      totalLengthM: perimeterM,
      note: "未扣門洞,請依現場門口數量自行調整",
    });
  }

  items.push({
    category: "underlay",
    nameZh: "防潮墊",
    spec: "滿鋪",
    totalAreaM2: roomAreaM2,
  });

  return {
    input,
    layout,
    items,
    auto: { roomAreaM2, pingShu, perimeterM },
    trace: {
      fullPlankCount,
      cutPieceCount,
      cutPlankCount,
      totalPlankCount,
      wastePercent,
      plankRows: layout.rows,
      offcutReuseLog: cutResult.reuseLog,
    },
  };
}
