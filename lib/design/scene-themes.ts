/**
 * 3D 場景環境主題（per drafting-math.md §AD3）
 *
 * 給家具設計工具的 3D 透視圖加「環境主題」preset：
 * 客戶 3D 不再是孤立家具，而是擺在「他家風格」裡，配色一看就決定。
 *
 * 採 60-30-10 配色：地板 60% + 家具 30% + 點綴 10%。
 * 這個 MVP 版本只切「地板顏色」+「環境光強度」+「色溫」，不加完整 HDR scene。
 */

export type SceneThemeId =
  | "natural"   // 預設：不加場景，純空中懸浮（現況）
  | "nordic"    // 北歐：淺楓地板 + 暖白
  | "japandi"   // 日式：深胡桃地板 + 米色
  | "industrial" // 工業：深木地板 + 中性白
  | "chinese";  // 中式：紫檀地板 + 米杏

export interface SceneTheme {
  id: SceneThemeId;
  nameZh: string;
  /** 地板色（hex）— null = 不加地板 */
  floorColor: string | null;
  /** 環境光強度（multiplier on existing intensity）*/
  ambientMul: number;
  /** 色溫對 RGB 的微調 multiplier */
  lightTint: { r: number; g: number; b: number };
  /** 給 UI 用的 swatch 顏色（地板色，natural 用灰） */
  swatch: string;
}

export const SCENE_THEMES: Record<SceneThemeId, SceneTheme> = {
  natural: {
    id: "natural",
    nameZh: "純白",
    floorColor: null,
    ambientMul: 1.0,
    lightTint: { r: 1.0, g: 1.0, b: 1.0 },
    swatch: "#e5e5e5",
  },
  nordic: {
    id: "nordic",
    nameZh: "北歐",
    floorColor: "#E8D4B0", // 淺楓
    ambientMul: 1.1,
    lightTint: { r: 1.0, g: 0.96, b: 0.90 }, // 3000K 暖白
    swatch: "#E8D4B0",
  },
  japandi: {
    id: "japandi",
    nameZh: "日式",
    floorColor: "#5C4030", // 深胡桃
    ambientMul: 0.9,
    lightTint: { r: 1.0, g: 0.92, b: 0.78 }, // 2700K 暖黃
    swatch: "#5C4030",
  },
  industrial: {
    id: "industrial",
    nameZh: "工業",
    floorColor: "#3A2A20", // 深木 + 黑鐵
    ambientMul: 0.85,
    lightTint: { r: 1.0, g: 0.98, b: 0.92 }, // 4000K 中性
    swatch: "#3A2A20",
  },
  chinese: {
    id: "chinese",
    nameZh: "中式",
    floorColor: "#5A2A24", // 紫檀
    ambientMul: 0.95,
    lightTint: { r: 1.0, g: 0.92, b: 0.78 }, // 2700K 暖
    swatch: "#5A2A24",
  },
};

export const SCENE_THEME_LIST: SceneTheme[] = [
  SCENE_THEMES.natural,
  SCENE_THEMES.nordic,
  SCENE_THEMES.japandi,
  SCENE_THEMES.industrial,
  SCENE_THEMES.chinese,
];
