/**
 * 工具單次買斷定價
 * 跟範本 unlock 同思路:不訂閱也能單買某個工具永久使用
 */

export type ToolId = "ceiling" | "floor";

export const TOOL_UNLOCK_PRICES: Record<ToolId, number> = {
  ceiling: 599,
  floor: 599,
};

export const TOOL_LABEL_ZH: Record<ToolId, string> = {
  ceiling: "木作天花板骨架施工模擬器",
  floor: "地板施工模擬器",
};

export const TOOL_DESC_ZH: Record<ToolId, string> = {
  ceiling: "輸入長寬高、3 秒算主骨/副骨/矽酸鈣板/螺絲、列印 A4 清單帶到工地",
  floor: "輸入空間尺寸、自動排版、估超耐磨/海島型/實木地板用料、含人字拼演算",
};

export const VALID_TOOL_IDS: ToolId[] = ["ceiling", "floor"];

export function isValidTool(t: string): t is ToolId {
  return (VALID_TOOL_IDS as string[]).includes(t);
}
