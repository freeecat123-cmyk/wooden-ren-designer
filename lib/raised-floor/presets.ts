/**
 * 和室架高平台 — 規格 catalog
 *
 * 角材尺寸取自台灣木材行常規(2026-05 查證):
 *   - 1寸×1.2:約 30×36mm,輕量用、低台座
 *   - 2寸×1.2:約 60×36mm,標準和室
 *   - 3寸×3寸:約 90×90mm,人坐重載/榻榻米下
 * 夾板取 122×244cm 樺木板(4×8 尺)為通用底襯。
 */
import type { JoistPreset, PlywoodPreset, UnderlayPreset } from "./types";

export const JOIST_PRESETS: JoistPreset[] = [
  { id: "joist-1x1.2", nameZh: "1寸×1.2(30×36mm)", widthMm: 30, thicknessMm: 36 },
  { id: "joist-2x1.2", nameZh: "2寸×1.2(60×36mm)", widthMm: 60, thicknessMm: 36 },
  { id: "joist-3x3", nameZh: "3寸×3寸(90×90mm)", widthMm: 90, thicknessMm: 90 },
];

/**
 * 夾板規格 — 兩種尺寸:
 *   4×8 台尺(122×244 cm)— 台灣最通用,料行喊「一張 4×8」就這個
 *   3×6 台尺(91×183 cm)— 小坪數和室、車載好搬
 * 木紋慣例:長邊(244 or 183)沿 X、短邊(122 or 91)沿 Z 鋪。
 */
export const PLYWOOD_PRESETS: PlywoodPreset[] = [
  { id: "ply18-4x8", nameZh: "普通夾板 18mm (4×8 尺)", thicknessMm: 18, sheetLengthCm: 122, sheetWidthCm: 244 },
  { id: "ply15-4x8", nameZh: "普通夾板 15mm (4×8 尺)", thicknessMm: 15, sheetLengthCm: 122, sheetWidthCm: 244 },
  { id: "ply12-4x8", nameZh: "普通夾板 12mm (4×8 尺)", thicknessMm: 12, sheetLengthCm: 122, sheetWidthCm: 244 },
  { id: "ply18-3x6", nameZh: "普通夾板 18mm (3×6 尺)", thicknessMm: 18, sheetLengthCm: 91, sheetWidthCm: 183 },
  { id: "ply15-3x6", nameZh: "普通夾板 15mm (3×6 尺)", thicknessMm: 15, sheetLengthCm: 91, sheetWidthCm: 183 },
  { id: "ply12-3x6", nameZh: "普通夾板 12mm (3×6 尺)", thicknessMm: 12, sheetLengthCm: 91, sheetWidthCm: 183 },
];

export function getJoistPreset(id: string): JoistPreset {
  return JOIST_PRESETS.find((j) => j.id === id) ?? JOIST_PRESETS[0];
}

export function getPlywoodPreset(id: string): PlywoodPreset {
  return PLYWOOD_PRESETS.find((p) => p.id === id) ?? PLYWOOD_PRESETS[1];
}

/**
 * 防潮墊 catalog(2026-05 市場行情查證):
 *   - PE 防潮布:厚 0.2mm、1×50m 卷(50 m²)、約 NT$ 600,木地板下層常用
 *   - EPE 珍珠棉:厚 2mm、1.2×40m 卷(48 m²)、約 NT$ 1200,緩衝兼隔音
 *   - Tyvek 透濕膜:幅寬 1.5×50m(75 m²)、約 NT$ 3500,高階防水透濕
 */
export const UNDERLAY_PRESETS: UnderlayPreset[] = [
  {
    id: "underlay-pe",
    nameZh: "PE 防潮布 0.2mm",
    rollAreaM2: 50,
    thicknessMm: 0.2,
    pricePerRoll: 600,
  },
  {
    id: "underlay-epe",
    nameZh: "EPE 珍珠棉 2mm",
    rollAreaM2: 48,
    thicknessMm: 2,
    pricePerRoll: 1200,
  },
  {
    id: "underlay-tyvek",
    nameZh: "Tyvek 透濕膜",
    rollAreaM2: 75,
    thicknessMm: 0.4,
    pricePerRoll: 3500,
  },
];

export function getUnderlayPreset(id: string): UnderlayPreset | undefined {
  return UNDERLAY_PRESETS.find((u) => u.id === id);
}
