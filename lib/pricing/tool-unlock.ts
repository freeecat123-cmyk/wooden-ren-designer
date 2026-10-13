/**
 * 工具單次買斷定價
 * 跟範本 unlock 同思路:不訂閱也能單買某個工具永久使用
 */

export type ToolId = "ceiling" | "floor" | "raised-floor" | "cnc";

// 木頭仁 2026-10-13「都改成 390」：原本程式收 499、三個裝潢工具行銷頁卻寫 590、CNC 頁寫 499，
// 三個數字互打 ⇒ 統一 390（文案那邊也一起改了，改價記得兩邊一起動）。
export const TOOL_UNLOCK_PRICES: Record<ToolId, number> = {
  ceiling: 390,
  floor: 390,
  "raised-floor": 390,
  cnc: 390,
};

export const TOOL_LABEL_ZH: Record<ToolId, string> = {
  ceiling: "木作天花板骨架施工模擬器",
  floor: "地板施工模擬器",
  "raised-floor": "和室架高平台施工模擬器",
  cnc: "CNC 刀路產生器",
};

export const TOOL_DESC_ZH: Record<ToolId, string> = {
  ceiling: "輸入長寬高、3 秒算主骨/副骨/矽酸鈣板/螺絲、列印 A4 清單帶到工地",
  floor: "輸入空間尺寸、自動排版、估超耐磨/海島型/實木地板用料、含人字拼演算",
  "raised-floor": "輸入空間尺寸、自動算主支/副支/夾板/防潮墊、含 2D shelf-packing 拼板優化",
  cnc: "SVG/DXF 拖進去、3 秒產出 CNC 能跑的 G-code，省掉 Fusion 360 CAM 設定流程",
};

export const VALID_TOOL_IDS: ToolId[] = ["ceiling", "floor", "raised-floor", "cnc"];

export function isValidTool(t: string): t is ToolId {
  return (VALID_TOOL_IDS as string[]).includes(t);
}
