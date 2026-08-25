/**
 * 「點零件」的選取語意 —— 3D 透視圖與材料單**必須共用這一條**。
 *
 * 規則:點目前已選的那個 → 取消選取;點別的 → 換成它。
 *
 * ⚠️ 為什麼要抽出來共用:
 * 2026-08-25 木頭仁回報「表面不見了,變透視」。原因是兩邊各寫各的 ——
 * `MaterialListWithSelection.tsx` 一直有 toggle,`PerspectiveView.tsx` 的 3D
 * onClick 卻是無條件 `onPartSelect(part.id)`。選了之後其他零件會被打成 18%
 * 半透明(DIM_OPACITY),再點同一個也解不掉;空白處雖然會清,但按「填滿」
 * 放大後手機上幾乎沒有空白可點 → 使用者以為是渲染壞掉。
 *
 * 兩邊都呼叫這一支,就不會再出現「一邊有 toggle 一邊沒有」。
 */
export function nextPartSelection(
  current: string | null,
  clicked: string,
): string | null {
  return clicked === current ? null : clicked;
}

/**
 * 手指/滑鼠從按下到放開的位移超過這個距離,就視為「轉動模型」而不是「點選零件」。
 *
 * 8px:一般手指點擊會抖 2~5px,轉動 3D 的位移遠大於此。
 */
export const DRAG_SLOP_PX = 8;

/**
 * ⭐ 轉動模型 ≠ 點選零件。
 *
 * R3F 的 onClick 是在 pointerup 觸發的,**中間拖了多遠它都不管** ——
 * 所以用手指轉一下 3D,放手時就會選到手指下面那個零件,其他零件全被打成
 * 18% 半透明。使用者的感受是「我根本沒點,畫面自己變透視」。
 * (2026-08-25 木頭仁回報;Canvas 那層的註解早就寫了「OrbitControls 拖動結束
 *  會 fire click」,但零件那層漏了同一道防護。)
 *
 * `down` 為 null(例如程式觸發的 click)時回 false = 當成正常點選。
 */
export function isDragRelease(
  down: { x: number; y: number } | null,
  up: { x: number; y: number },
): boolean {
  if (!down) return false;
  return Math.hypot(up.x - down.x, up.y - down.y) > DRAG_SLOP_PX;
}
