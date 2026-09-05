/**
 * 夾板疊層在 3D 裡怎麼切成一層一層。
 *
 * 🩸2026-09-05：木頭仁連續十幾輪回報層數數不對，最後量出來的真因是
 * 「在著色器上畫膠合線」這條路本身就不行 —— 桌面上表面與前緣面的**交界稜線**
 * 長得跟膠合線一模一樣，只要看得到桌面就會多一條，所以
 *   正視圖 2 層 → 1 條線 ✅ ／ 45° 同一台 → 2 條線 ❌。
 * 線畫多粗多深都躲不掉。改成每層畫成真的一塊板後，每層有自己的稜線與陰影，
 * 任何角度、任何縮放數到的都是真層數。
 *
 * 這支只做「每層在零件本地厚度方向上的位置與厚度」，給 3D 與測試共用同一份算式。
 */
export type PlyLayer = {
  /** 這一層的中心相對零件中心的位移（同單位進、同單位出） */
  dy: number;
  /** 這一層畫出來的厚度（已扣掉層間縫） */
  thick: number;
};

/** 層間縫：0.4mm，但最多吃掉一層的 6%（很薄的層才不會被縫吃光） */
export const PLY_GAP_MM = 0.4;

/**
 * @param totalThick 零件總厚（任何單位）
 * @param layers     層數（<2 回空陣列＝不拆）
 * @param unitPerMm  1mm 等於多少個 totalThick 的單位（3D 用 SCALE，測試用 1）
 */
export function plyLayers(totalThick: number, layers: number, unitPerMm = 1): PlyLayer[] {
  if (!(layers > 1) || !(totalThick > 0)) return [];
  const each = totalThick / layers;
  const gap = Math.min(PLY_GAP_MM * unitPerMm, each * 0.06);
  return Array.from({ length: layers }, (_, i) => ({
    dy: -totalThick / 2 + each * (i + 0.5),
    thick: each - gap,
  }));
}
