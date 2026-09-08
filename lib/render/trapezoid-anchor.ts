/**
 * 梯形零件的「靠邊」：把左右對稱收窄的梯形，改成一邊垂直、另一邊斜的**直角梯形**。
 *
 * 為什麼要這個：`apron-trapezoid` 原本是給外斜腳家具的牙條用的，收窄一定對稱於中心
 * （`x' = x × scale`）。但技術士技能檢定家具木工丙級的側板是**一邊垂直、一邊斜**
 * （01200-100301：上緣 120、下緣 95，左緣整片垂直）——照對稱畫出來尺寸就不對，
 * 而斜切正好是那題的考點。
 *
 * ⭐ 做法刻意選「縮放後補一個位移」而不是把上下緣改成各自的 min/max：
 *    後者要把每個用到 ±topX / ±botX 的地方（3D 幾何、兩條 2D 投影路徑、零件圖標註、
 *    匯出）全部拆成非對稱，動到 29 款既有家具的牙條；補位移只多一個加法項，
 *    數學上完全等價（見下方推導），既有行為在 anchor 省略時一格不變。
 *
 * 推導（hx = 半長，s = 該處的縮放比例）：
 *   靠 −X 邊（左緣固定）：x' = −hx + (x + hx)·s = x·s − hx·(1 − s)
 *   靠 +X 邊（右緣固定）：x' = +hx + (x − hx)·s = x·s + hx·(1 − s)
 *   → 位移 = ±hx·(1 − s)，中心對稱時為 0。
 */
export type TrapAnchor = "center" | "min" | "max";

/**
 * @param halfLx 零件長度的一半（local X 半寬，mm）
 * @param scale  該截面的長度縮放比例（topLengthScale ~ bottomLengthScale 之間內插後的值）
 * @param anchor 靠哪一邊；省略 = "center" = 原本的對稱行為
 * @returns 縮放後要再加上的 local X 位移（mm）
 */
export function trapAnchorOffset(
  halfLx: number,
  scale: number,
  anchor: TrapAnchor = "center",
): number {
  if (anchor === "min") return -halfLx * (1 - scale);
  if (anchor === "max") return halfLx * (1 - scale);
  return 0;
}
