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
