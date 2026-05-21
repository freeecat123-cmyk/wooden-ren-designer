/**
 * 房間形狀範本 — 使用者點選後帶入頂點,再於畫布微調。
 * 所有範本頂點順時針、單位 cm。
 */
import type { RoomPolygon } from "./types";

export interface ShapePreset {
  id:
    | "rect"
    | "l-shape"
    | "t-shape"
    | "convex"
    | "u-shape"
    | "cross"
    | "z-shape"
    | "hexagon";
  nameZh: string;
  build: () => RoomPolygon;
}

export const SHAPE_PRESETS: ShapePreset[] = [
  {
    id: "rect",
    nameZh: "矩形",
    build: () => ({
      vertices: [
        { x: 0, y: 0 },
        { x: 420, y: 0 },
        { x: 420, y: 300 },
        { x: 0, y: 300 },
      ],
    }),
  },
  {
    id: "l-shape",
    nameZh: "L 型",
    build: () => ({
      vertices: [
        { x: 0, y: 0 },
        { x: 420, y: 0 },
        { x: 420, y: 180 },
        { x: 220, y: 180 },
        { x: 220, y: 360 },
        { x: 0, y: 360 },
      ],
    }),
  },
  {
    id: "t-shape",
    nameZh: "T 型",
    build: () => ({
      vertices: [
        { x: 0, y: 0 },
        { x: 480, y: 0 },
        { x: 480, y: 180 },
        { x: 340, y: 180 },
        { x: 340, y: 360 },
        { x: 140, y: 360 },
        { x: 140, y: 180 },
        { x: 0, y: 180 },
      ],
    }),
  },
  {
    id: "convex",
    nameZh: "凸型",
    build: () => ({
      vertices: [
        { x: 0, y: 0 },
        { x: 300, y: 0 },
        { x: 300, y: 120 },
        { x: 420, y: 120 },
        { x: 420, y: 360 },
        { x: 0, y: 360 },
      ],
    }),
  },
  {
    id: "u-shape",
    nameZh: "ㄇ型",
    build: () => ({
      // 上緣中央向下凹一塊
      vertices: [
        { x: 0, y: 0 },
        { x: 180, y: 0 },
        { x: 180, y: 150 },
        { x: 300, y: 150 },
        { x: 300, y: 0 },
        { x: 480, y: 0 },
        { x: 480, y: 360 },
        { x: 0, y: 360 },
      ],
    }),
  },
  {
    id: "cross",
    nameZh: "十字型",
    build: () => ({
      // 中央主體四向各凸出一塊
      vertices: [
        { x: 120, y: 0 },
        { x: 240, y: 0 },
        { x: 240, y: 120 },
        { x: 360, y: 120 },
        { x: 360, y: 240 },
        { x: 240, y: 240 },
        { x: 240, y: 360 },
        { x: 120, y: 360 },
        { x: 120, y: 240 },
        { x: 0, y: 240 },
        { x: 0, y: 120 },
        { x: 120, y: 120 },
      ],
    }),
  },
  {
    id: "z-shape",
    nameZh: "Z型",
    build: () => ({
      // 兩段矩形對角錯開
      vertices: [
        { x: 0, y: 0 },
        { x: 300, y: 0 },
        { x: 300, y: 180 },
        { x: 480, y: 180 },
        { x: 480, y: 360 },
        { x: 180, y: 360 },
        { x: 180, y: 180 },
        { x: 0, y: 180 },
      ],
    }),
  },
  {
    id: "hexagon",
    nameZh: "六角型",
    build: () => ({
      // 矩形切掉左上、右下兩個對角(45° 斜邊)
      vertices: [
        { x: 100, y: 0 },
        { x: 420, y: 0 },
        { x: 420, y: 260 },
        { x: 320, y: 360 },
        { x: 0, y: 360 },
        { x: 0, y: 100 },
      ],
    }),
  },
];

export function getPreset(id: ShapePreset["id"]): RoomPolygon {
  const p = SHAPE_PRESETS.find((x) => x.id === id);
  if (!p) throw new Error(`unknown preset: ${id}`);
  return p.build();
}

/**
 * 常用地板尺寸快速套用 — 點一下同時帶入片長、片寬、伸縮縫。
 * 尺寸取自台灣市售規格(2026-05 查證):
 *   - 超耐磨標準:長 120–128cm × 寬 19.5cm 級距(信品 120×19.8、Krono 128.8×19.5)
 *   - 超耐磨大尺寸:KD 183.5×19.6cm
 *   - SPC 石塑:三環 122×18.3cm;寬版高可利斯 122×22.8cm
 *   - 海島型:6 寸板寬 ≈ 18cm(實際多為亂尺,此處取代表長度)
 *   - 實木地板(無垢):日規企口 909×91mm(3 寸)為最常見,另有寬版 5 寸
 *     (寬 ≈15cm)與傳統窄版 2 寸(寬 ≈6cm)。
 * 伸縮縫:密集板派(超耐磨/SPC)牆邊留 8mm 起、大尺寸 10mm;
 *         海島型夾板派留 3–5mm;
 *         實木地板含水率變動大,牆邊伸縮縫留較大(窄版 10mm、標準/寬版 12mm)。
 */
export interface PlankPreset {
  id: string;
  nameZh: string;
  lengthCm: number;
  widthCm: number;
  gapMm: number;
}

export const PLANK_PRESETS: PlankPreset[] = [
  { id: "lam-std", nameZh: "超耐磨 標準", lengthCm: 121, widthCm: 19.5, gapMm: 8 },
  { id: "lam-long", nameZh: "超耐磨 大尺寸", lengthCm: 183.5, widthCm: 19.6, gapMm: 10 },
  { id: "spc-std", nameZh: "SPC 石塑", lengthCm: 122, widthCm: 18, gapMm: 8 },
  { id: "spc-wide", nameZh: "SPC 寬版", lengthCm: 122, widthCm: 22.8, gapMm: 8 },
  { id: "island", nameZh: "海島型 6寸", lengthCm: 121, widthCm: 18, gapMm: 5 },
  { id: "solid-std", nameZh: "實木 標準3寸", lengthCm: 91, widthCm: 9.1, gapMm: 12 },
  { id: "solid-wide", nameZh: "實木 寬版5寸", lengthCm: 121, widthCm: 15, gapMm: 12 },
  { id: "solid-narrow", nameZh: "實木 窄版2寸", lengthCm: 60, widthCm: 6, gapMm: 10 },
];
