/**
 * 裁切餘料再利用(1D,地板片用)
 *
 * 每片 cut 地板片需要一段「有效長度」。若先前裁切剩下的餘料
 *(plankLength - 已用長度)≥ 需求長度,就拿餘料拼,不開新片。
 * 否則開一片新地板片,其餘料進池。
 *
 * 貪婪 FFD 風:餘料池中找「最小但夠用」的餘料(best-fit),降低浪費。
 * sawKerf 鋸路(地板片裁切 ~2mm = 0.2cm)。
 *
 * ASSUMPTION:cut 片只橫切一刀,餘料 ≥ MIN_REUSE_CM 才回收。
 */

const SAW_KERF_CM = 0.2;
const MIN_REUSE_CM = 20; // 餘料短於此視為廢料不回收

export interface CuttingResult {
  /** 裁切片實際消耗的全新地板片數 */
  cutPlankCount: number;
  /** 人類可讀的再利用紀錄 */
  reuseLog: string[];
}

/**
 * @param cutLengths 每片 cut 地板片需要的有效長度(cm),由 layout 提供
 * @param plankLengthCm 全新地板片長度
 */
export function optimizeOffcuts(
  cutLengths: number[],
  plankLengthCm: number,
): CuttingResult {
  // 長的先排(FFD):大塊先吃掉,小餘料才好填縫
  const needs = [...cutLengths].sort((a, b) => b - a);
  const offcutPool: number[] = [];
  let cutPlankCount = 0;
  const reuseLog: string[] = [];

  for (const need of needs) {
    // best-fit:池中找最小但 ≥ need 的餘料
    let bestIdx = -1;
    for (let i = 0; i < offcutPool.length; i++) {
      if (offcutPool[i] >= need - 0.001) {
        if (bestIdx === -1 || offcutPool[i] < offcutPool[bestIdx]) bestIdx = i;
      }
    }
    if (bestIdx >= 0) {
      const remain = offcutPool[bestIdx] - need - SAW_KERF_CM;
      reuseLog.push(
        `裁切片 ${need.toFixed(1)}cm 由餘料 ${offcutPool[bestIdx].toFixed(1)}cm 拼出`,
      );
      offcutPool.splice(bestIdx, 1);
      if (remain >= MIN_REUSE_CM) offcutPool.push(remain);
    } else {
      cutPlankCount++;
      const remain = plankLengthCm - need - SAW_KERF_CM;
      if (remain >= MIN_REUSE_CM) offcutPool.push(remain);
    }
  }
  return { cutPlankCount, reuseLog };
}

/**
 * 人字拼斜切餘料配對(2D)
 *
 * 人字拼的裁切片是斜切的三角/平行四邊形,餘料不是乾淨長條,不能套 1D 模型。
 * 物理約束:一道直切 = 2 片 → 每塊新板最多供 2 片裁切片,且兩片用料面積和
 * 必須 ≤ 整片面積(互補斜切才能共板)。比純面積打包嚴謹,不會高估再利用。
 *
 * FFD:大片先排,塞進「還有空位(<2 片)且面積夠」的既有板,否則開新板。
 *
 * @param usedAreas 每片裁切片實際用到的面積(cm²)
 * @param plankAreaCm2 整片地板面積 = 片長 × 片寬
 */
export function pairHerringboneOffcuts(
  usedAreas: number[],
  plankAreaCm2: number,
): CuttingResult {
  const items = [...usedAreas].sort((a, b) => b - a);
  const bins: { used: number; count: number }[] = [];
  for (const area of items) {
    let placed = false;
    for (const bin of bins) {
      if (bin.count < 2 && bin.used + area <= plankAreaCm2 + 0.001) {
        bin.used += area;
        bin.count++;
        placed = true;
        break;
      }
    }
    if (!placed) bins.push({ used: area, count: 1 });
  }
  const paired = bins.filter((b) => b.count === 2).length;
  const reuseLog =
    paired > 0
      ? [`${paired} 塊板由兩片互補斜切共用(人字拼斜切餘料配對)`]
      : [];
  return { cutPlankCount: bins.length, reuseLog };
}
