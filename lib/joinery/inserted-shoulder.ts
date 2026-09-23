/**
 * 夾頭榫 / 插肩榫的結構限制。規格見 `docs/drafting-math.md` §JT1–JT3。
 *
 * 這兩條公式是「插肩榫腳」能不能安全做出來的關卡：
 *   JT1 腿開槽後抗彎剛度剩多少 → 決定腳料要多粗
 *   JT2 斜肩角上限 → 由牙條的楔尖厚度反解，不寫死角度
 *
 * ⚠️ 為什麼要獨立成一支：doc 寫了規格但沒有程式驗，下一個人（或下次的我）
 *    憑印象改比例時不會有任何東西擋。這裡的每個函式都有對應測試。
 */

/** 硬木刨到這個厚度以下，楔尖一夾就碎（§JT2） */
export const MIN_WEDGE_TIP_MM = 3;

/**
 * 腿開兩道槽（接兩根牙條）之後，剩下的抗彎剛度比例。
 *
 * 保守模型：有效斷面 = 兩片「頰」，每片厚 (W−t)/2、全深 W，角上殘料不計。
 *   I_剩 / I_原 = 1 − t/W
 * ⭐ 只跟「牙條厚 ÷ 腿料」有關，跟腿多粗無關。
 */
export function slottedLegStiffnessRatio(legWidthMm: number, apronThicknessMm: number): number {
  if (legWidthMm <= 0) return 0;
  const r = apronThicknessMm / legWidthMm;
  return Math.max(0, Math.min(1, 1 - r));
}

/**
 * 要維持開槽前的抗彎剛度，腿料要放大幾倍。
 * I ∝ W⁴ → scale = (I_剩/I_原)^(−1/4)
 */
export function legUpsizeFactor(legWidthMm: number, apronThicknessMm: number): number {
  const keep = slottedLegStiffnessRatio(legWidthMm, apronThicknessMm);
  if (keep <= 0) return Infinity;
  return Math.pow(1 / keep, 0.25);
}

/** 斜肩角 α 之下，牙條端頭楔尖剩下多厚（§JT2） */
export function wedgeTipThicknessMm(
  apronThicknessMm: number,
  shoulderHeightMm: number,
  alphaDeg: number,
): number {
  return apronThicknessMm - shoulderHeightMm * Math.tan((alphaDeg * Math.PI) / 180);
}

/**
 * 斜肩角上限：由「楔尖 ≥ MIN_WEDGE_TIP_MM」反解，不是寫死的角度。
 * 回傳度數；牙條太薄時可能是 0（代表根本不能斜肩）。
 */
export function maxShoulderAngleDeg(
  apronThicknessMm: number,
  shoulderHeightMm: number,
  minTipMm: number = MIN_WEDGE_TIP_MM,
): number {
  if (shoulderHeightMm <= 0) return 0;
  const usable = apronThicknessMm - minTipMm;
  if (usable <= 0) return 0;
  return (Math.atan(usable / shoulderHeightMm) * 180) / Math.PI;
}

/** 一次算完，給模板產警告用 */
export function checkInsertedShoulder(o: {
  legWidthMm: number;
  apronThicknessMm: number;
  shoulderHeightMm: number;
  alphaDeg: number;
}): { ok: boolean; warnings: string[]; stiffnessRatio: number; upsizeFactor: number; maxAlphaDeg: number } {
  const stiffnessRatio = slottedLegStiffnessRatio(o.legWidthMm, o.apronThicknessMm);
  const upsizeFactor = legUpsizeFactor(o.legWidthMm, o.apronThicknessMm);
  const maxAlphaDeg = maxShoulderAngleDeg(o.apronThicknessMm, o.shoulderHeightMm);
  const warnings: string[] = [];

  if (stiffnessRatio < 0.5) {
    warnings.push(
      `腿開兩道槽後抗彎剛度只剩 ${Math.round(stiffnessRatio * 100)}%（牙條厚 ${o.apronThicknessMm}mm ÷ 腿料 ${o.legWidthMm}mm）。` +
        `要維持原本的剛度，腿料要加粗到約 ${Math.ceil(o.legWidthMm * upsizeFactor)}mm，或把牙條做薄一點。（§JT1）`,
    );
  }
  if (o.alphaDeg > maxAlphaDeg) {
    const tip = wedgeTipThicknessMm(o.apronThicknessMm, o.shoulderHeightMm, o.alphaDeg);
    warnings.push(
      `斜肩 ${o.alphaDeg}° 會把牙條楔尖削到 ${tip.toFixed(1)}mm，` +
        `${tip <= 0 ? "幾何上根本做不出來" : `低於 ${MIN_WEDGE_TIP_MM}mm 就一夾就碎`}。` +
        `這個牙條厚（${o.apronThicknessMm}mm）搭肩高 ${o.shoulderHeightMm}mm 的上限是 ${maxAlphaDeg.toFixed(1)}°。（§JT2）`,
    );
  }
  return { ok: warnings.length === 0, warnings, stiffnessRatio, upsizeFactor, maxAlphaDeg };
}
