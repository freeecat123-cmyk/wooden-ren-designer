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

/**
 * 把多邊形等比縮放到指定外框尺寸(總寬 × 總深)。
 * 軸對齊縮放 → 水平邊仍水平、垂直邊仍垂直,正交不變量保留。
 * 當前外框某軸長度為 0 時該軸不縮放(避免除零)。
 */
export function scalePolygonToBBox(
  poly: RoomPolygon,
  targetW: number,
  targetD: number,
): RoomPolygon {
  const bb = boundingBox(poly);
  const curW = bb.maxX - bb.minX;
  const curD = bb.maxY - bb.minY;
  const sx = curW > EPS ? targetW / curW : 1;
  const sy = curD > EPS ? targetD / curD : 1;
  return {
    vertices: poly.vertices.map((p) => ({
      x: bb.minX + (p.x - bb.minX) * sx,
      y: bb.minY + (p.y - bb.minY) * sy,
    })),
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

/** 軸對齊矩形 */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * 正交多邊形向內 offset:每條邊往內部法線方向平移 gap。
 * 每個頂點是「一條水平邊」與「一條垂直邊」的交點,
 * offset 後新頂點 = 垂直邊提供 x、水平邊提供 y。
 */
export function insetPolygon(poly: RoomPolygon, gap: number): RoomPolygon {
  const v = poly.vertices;
  const n = v.length;
  // 每條邊 i 連接 v[i] → v[i+1]
  // 內部法線:取邊中點往候選法線方向走一小步,測 pointInPolygon
  const offsetEdges: { p1: Point; p2: Point }[] = [];
  for (let i = 0; i < n; i++) {
    const a = v[i];
    const b = v[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    // 兩個垂直方向
    const nx = -dy / len;
    const ny = dx / len;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const probe = { x: mid.x + nx * 0.5, y: mid.y + ny * 0.5 };
    const sign = pointInPolygon(probe, poly) ? 1 : -1;
    offsetEdges.push({
      p1: { x: a.x + nx * gap * sign, y: a.y + ny * gap * sign },
      p2: { x: b.x + nx * gap * sign, y: b.y + ny * gap * sign },
    });
  }
  // 新頂點 i = offsetEdges[i-1] 與 offsetEdges[i] 的交點(都是軸對齊線)
  const out: Point[] = [];
  for (let i = 0; i < n; i++) {
    const prev = offsetEdges[(i - 1 + n) % n];
    const cur = offsetEdges[i];
    // prev 與 cur 一條水平一條垂直 → 交點 = 垂直線的 x + 水平線的 y
    const prevHoriz = Math.abs(prev.p1.y - prev.p2.y) < EPS;
    const x = prevHoriz ? cur.p1.x : prev.p1.x;
    const y = prevHoriz ? prev.p1.y : cur.p1.y;
    out.push({ x, y });
  }
  return { vertices: out };
}

interface ClipResult {
  usedAreaCm2: number;
  fullyInside: boolean;
}

/**
 * 矩形 ∩ 多邊形:Sutherland-Hodgman,以矩形 4 邊為裁切窗,裁切多邊形。
 * 回傳交集面積與是否「矩形完全落在多邊形內」。
 */
export function clipRectToPolygon(rect: Rect, poly: RoomPolygon): ClipResult {
  const clipEdges = [
    { inside: (p: Point) => p.x >= rect.x - EPS, isect: clipX(rect.x) },
    { inside: (p: Point) => p.x <= rect.x + rect.w + EPS, isect: clipX(rect.x + rect.w) },
    { inside: (p: Point) => p.y >= rect.y - EPS, isect: clipY(rect.y) },
    { inside: (p: Point) => p.y <= rect.y + rect.h + EPS, isect: clipY(rect.y + rect.h) },
  ];
  let pts: Point[] = poly.vertices.slice();
  for (const e of clipEdges) {
    const out: Point[] = [];
    for (let i = 0; i < pts.length; i++) {
      const cur = pts[i];
      const prev = pts[(i - 1 + pts.length) % pts.length];
      const curIn = e.inside(cur);
      const prevIn = e.inside(prev);
      if (curIn) {
        if (!prevIn) out.push(e.isect(prev, cur));
        out.push(cur);
      } else if (prevIn) {
        out.push(e.isect(prev, cur));
      }
    }
    pts = out;
    if (pts.length === 0) break;
  }
  const usedAreaCm2 = pts.length >= 3 ? polygonArea({ vertices: pts }) : 0;
  const rectArea = rect.w * rect.h;
  return {
    usedAreaCm2,
    fullyInside: rectArea > EPS && usedAreaCm2 > rectArea - EPS,
  };
}

function clipX(xLine: number) {
  return (a: Point, b: Point): Point => {
    const t = (xLine - a.x) / (b.x - a.x);
    return { x: xLine, y: a.y + t * (b.y - a.y) };
  };
}
function clipY(yLine: number) {
  return (a: Point, b: Point): Point => {
    const t = (yLine - a.y) / (b.y - a.y);
    return { x: a.x + t * (b.x - a.x), y: yLine };
  };
}
