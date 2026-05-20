/**
 * 房間形狀範本 — 使用者點選後帶入頂點,再於畫布微調。
 * 所有範本頂點順時針、單位 cm。
 */
import type { RoomPolygon } from "./types";

export interface ShapePreset {
  id: "rect" | "l-shape" | "t-shape" | "convex";
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
];

export function getPreset(id: ShapePreset["id"]): RoomPolygon {
  const p = SHAPE_PRESETS.find((x) => x.id === id);
  if (!p) throw new Error(`unknown preset: ${id}`);
  return p.build();
}
