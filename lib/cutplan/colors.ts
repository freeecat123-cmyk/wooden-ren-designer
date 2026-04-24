/** 零件色盤（與 PiecesEditor、SheetBinSvg 共用，確保清單的 # 方塊顏色 = 板上零件顏色） */
export const PART_COLORS = [
  "#fde68a",
  "#fca5a5",
  "#a5f3fc",
  "#bef264",
  "#c4b5fd",
  "#f9a8d4",
  "#fdba74",
  "#86efac",
  "#93c5fd",
  "#f0abfc",
];

/** 以代號（去尾數字：B1/B2→B、AA3→AA）hash 選色；同 spec 零件共用同一色 */
export function colorForCode(code: string): string {
  const base = code.replace(/\d+$/, "") || code;
  let h = 0;
  for (let i = 0; i < base.length; i++) h = (h * 31 + base.charCodeAt(i)) >>> 0;
  return PART_COLORS[h % PART_COLORS.length];
}
