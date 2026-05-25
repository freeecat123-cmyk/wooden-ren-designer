/**
 * 和室架高平台 — 規格 catalog
 *
 * 角材尺寸取自台灣木材行常規(2026-05 查證):
 *   - 1寸×1.2:約 30×36mm,輕量用、低台座
 *   - 2寸×1.2:約 60×36mm,標準和室
 *   - 3寸×3寸:約 90×90mm,人坐重載/榻榻米下
 * 夾板取 122×244cm 樺木板(4×8 尺)為通用底襯。
 */
import type { JoistPreset, PlywoodPreset } from "./types";

export const JOIST_PRESETS: JoistPreset[] = [
  { id: "joist-1x1.2", nameZh: "1寸×1.2(30×36mm)", widthMm: 30, thicknessMm: 36 },
  { id: "joist-2x1.2", nameZh: "2寸×1.2(60×36mm)", widthMm: 60, thicknessMm: 36 },
  { id: "joist-3x3", nameZh: "3寸×3寸(90×90mm)", widthMm: 90, thicknessMm: 90 },
];

export const PLYWOOD_PRESETS: PlywoodPreset[] = [
  { id: "ply12", nameZh: "樺木夾板 12mm", thicknessMm: 12, sheetLengthCm: 122, sheetWidthCm: 244 },
  { id: "ply15", nameZh: "樺木夾板 15mm", thicknessMm: 15, sheetLengthCm: 122, sheetWidthCm: 244 },
  { id: "ply18", nameZh: "樺木夾板 18mm", thicknessMm: 18, sheetLengthCm: 122, sheetWidthCm: 244 },
];

export function getJoistPreset(id: string): JoistPreset {
  return JOIST_PRESETS.find((j) => j.id === id) ?? JOIST_PRESETS[0];
}

export function getPlywoodPreset(id: string): PlywoodPreset {
  return PLYWOOD_PRESETS.find((p) => p.id === id) ?? PLYWOOD_PRESETS[1];
}
