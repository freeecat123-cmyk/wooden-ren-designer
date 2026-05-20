/**
 * 正交多邊形幾何工具(地板模擬器)
 *
 * 房間為正交多邊形(所有邊水平或垂直),頂點順時針,單位 cm。
 * 裁切採 Sutherland-Hodgman(對矩形這種凸裁切窗有效,且日後可推廣非正交)。
 */
import type { Point, RoomPolygon } from "./types";

const EPS = 0.001;

/** 鞋帶公式,回傳絕對面積(cm²) */
export function polygonArea(poly: RoomPolygon): number {
  const v = poly.vertices;
  let s = 0;
  for (let i = 0; i < v.length; i++) {
    const a = v[i];
    const b = v[(i + 1) % v.length];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

/** 周長(cm) */
export function polygonPerimeter(poly: RoomPolygon): number {
  const v = poly.vertices;
  let s = 0;
  for (let i = 0; i < v.length; i++) {
    const a = v[i];
    const b = v[(i + 1) % v.length];
    s += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return s;
}

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function boundingBox(poly: RoomPolygon): BBox {
  const xs = poly.vertices.map((p) => p.x);
  const ys = poly.vertices.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

/** 射線法:點是否在多邊形內(邊界視為內) */
export function pointInPolygon(pt: Point, poly: RoomPolygon): boolean {
  const v = poly.vertices;
  let inside = false;
  for (let i = 0, j = v.length - 1; i < v.length; j = i++) {
    const a = v[i];
    const b = v[j];
    const intersect =
      a.y > pt.y !== b.y > pt.y &&
      pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x;
    if (intersect) inside = !inside;
  }
  return inside;
}

// insetPolygon / clipRectToPolygon 在 Task 3 補上。
