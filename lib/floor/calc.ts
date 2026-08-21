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
import { optimizeOffcuts, pairHerringboneOffcuts } from "./cutting";

const EMPIRICAL_WASTE = 0.1;

export function computeFloorBom(input: FloorInput, locale: string = "zh-TW"): FloorBom {
  const isEn = locale === "en";
  const layout = computeFloorLayout(input);

  const fullPlanks = layout.planks.filter((p) => p.kind === "full");
  const cutPlanks = layout.planks.filter((p) => p.kind === "cut");
  const fullPlankCount = fullPlanks.length;
  const cutPieceCount = cutPlanks.length;

  const noReuse = { cutPlankCount: cutPieceCount, reuseLog: [] as string[] };
  const cutResult = !input.reuseOffcuts
    ? noReuse
    : input.pattern === "herringbone"
      ? pairHerringboneOffcuts(
          cutPlanks.map((p) => p.usedAreaCm2),
          input.plankLengthCm * input.plankWidthCm,
        )
      : optimizeOffcuts(
          cutPlanks.map((p) => p.effectiveLengthCm),
          input.plankLengthCm,
        );
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

  // 門洞扣除:踢腳板/收邊條長度
  const doorDeductM =
    (Math.max(0, input.doorCount) * Math.max(0, input.doorWidthCm)) / 100;
  const skirtingActive = input.skirtingType !== "none";
  const skirtingLengthM = Math.max(0, perimeterM - doorDeductM);

  /**
   * 🧷 **要進貨幾片** —— 「經驗 +10%」必須真的加進數量與成本,不能只寫在備註。
   *
   * ⛔ 原本 `wasteMode === "empirical"` 只影響兩個地方:`wastePercent` 顯示成 10%、
   *    以及備註文字「建議進貨 N 片」。**BOM 的 count 與 plankCost 都用未加損耗的片數。**
   *    實測預設房間 420×300、地板 3000/坪:
   *      computed → 56 片 / 材料 NT$11,590 / 總計 NT$16,196
   *      empirical → **完全一樣的三個數字**,只有備註多一句話。
   *    結果是 BOM 叫師傅進 62 片,報價卻按 56 片算(少 9.7%)——
   *    毛利、稅、總價一路連動少收,師傅照報價接單就自己吸收多買的 6 片。
   *    30 坪的案子少收約 1.5 萬。(2026-08-21 稽核發現。)
   *
   * ⚠️ 只加在「要買多少」,不動 layout.planks(那是實際鋪設的排版,本來就該是 56 片)。
   */
  const orderPlankCount =
    input.wasteMode === "empirical"
      ? Math.ceil(totalPlankCount * (1 + EMPIRICAL_WASTE))
      : totalPlankCount;

  // 成本估算 — 地板/防潮墊每坪、踢腳板每米
  const PING_M2 = 3.305;
  const boughtPing =
    (orderPlankCount * input.plankLengthCm * input.plankWidthCm) / 10000 / PING_M2;
  const plankCost =
    input.plankPricePerPing > 0 ? boughtPing * input.plankPricePerPing : 0;
  const skirtingCost =
    skirtingActive && input.skirtingPricePerM > 0
      ? skirtingLengthM * input.skirtingPricePerM
      : 0;
  const underlayCost =
    input.underlayPricePerPing > 0 ? pingShu * input.underlayPricePerPing : 0;
  const totalCost = plankCost + skirtingCost + underlayCost;
  const hasUnpriced =
    input.plankPricePerPing <= 0 ||
    input.underlayPricePerPing <= 0 ||
    (skirtingActive && input.skirtingPricePerM <= 0);

  const items: FloorBomItem[] = [];

  items.push({
    category: "plank",
    nameZh: "地板片",
    nameEn: "Flooring plank",
    spec: `${input.plankLengthCm}×${input.plankWidthCm} cm`,
    // count = **要進貨的片數**(含損耗),跟報價金額同一個數字,不會再兩邊打架
    count: orderPlankCount,
    note:
      input.wasteMode === "empirical"
        ? `排版需 ${totalPlankCount} 片(整片 ${fullPlankCount} + 裁切 ${cutPlankCount}),含經驗損耗 10% 進貨 ${orderPlankCount} 片`
        : `整片 ${fullPlankCount} + 裁切 ${cutPlankCount}(實算損耗 ${wastePercent.toFixed(1)}%)`,
    noteEn:
      input.wasteMode === "empirical"
        ? `Layout needs ${totalPlankCount} (${fullPlankCount} full + ${cutPlankCount} cut); order ${orderPlankCount} with 10% empirical waste`
        : `${fullPlankCount} full + ${cutPlankCount} cut (actual waste ${wastePercent.toFixed(1)}%)`,
    subtotal: plankCost > 0 ? plankCost : undefined,
  });

  if (skirtingActive) {
    items.push({
      category: "skirting",
      nameZh: input.skirtingType === "skirting" ? "踢腳板" : "收邊條",
      nameEn: input.skirtingType === "skirting" ? "Skirting board" : "Edge trim",
      spec: "沿牆周長",
      specEn: "Along wall perimeter",
      totalLengthM: skirtingLengthM,
      note:
        input.doorCount > 0
          ? `已扣 ${input.doorCount} 個門洞 × ${input.doorWidthCm}cm`
          : "未扣門洞",
      noteEn:
        input.doorCount > 0
          ? `Deducted ${input.doorCount} door opening(s) × ${input.doorWidthCm}cm`
          : "No door opening deducted",
      subtotal: skirtingCost > 0 ? skirtingCost : undefined,
    });
  }

  items.push({
    category: "underlay",
    nameZh: "防潮墊",
    nameEn: "Moisture barrier underlay",
    spec: "滿鋪",
    specEn: "Full coverage",
    totalAreaM2: roomAreaM2,
    subtotal: underlayCost > 0 ? underlayCost : undefined,
  });

  return {
    input,
    layout,
    items,
    auto: { roomAreaM2, pingShu, perimeterM },
    cost: {
      plank: plankCost,
      skirting: skirtingCost,
      underlay: underlayCost,
      total: totalCost,
      hasUnpriced,
    },
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
