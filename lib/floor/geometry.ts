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

/** 兩條直線(各由兩點定義)的交點;平行時退化回傳 b1。 */
function lineIntersect(a1: Point, a2: Point, b1: Point, b2: Point): Point {
  const d1x = a2.x - a1.x;
  const d1y = a2.y - a1.y;
  const d2x = b2.x - b1.x;
  const d2y = b2.y - b1.y;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < EPS) return { x: b1.x, y: b1.y };
  const t = ((b1.x - a1.x) * d2y - (b1.y - a1.y) * d2x) / denom;
  return { x: a1.x + t * d1x, y: a1.y + t * d1y };
}

/**
 * 多邊形向內 offset:每條邊往內部法線方向平移 gap,
 * 相鄰兩條 offset 邊以直線交點求新頂點 —— 正交邊與斜邊(如六角型)皆適用。
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
  // 新頂點 i = offsetEdges[i-1] 與 offsetEdges[i] 的直線交點
  const out: Point[] = [];
  for (let i = 0; i < n; i++) {
    const prev = offsetEdges[(i - 1 + n) % n];
    const cur = offsetEdges[i];
    out.push(lineIntersect(prev.p1, prev.p2, cur.p1, cur.p2));
  }
  return { vertices: out };
}

export interface ClipResult {
  usedAreaCm2: number;
  fullyInside: boolean;
  /** 裁切後落在房間內的多邊形(繪製用);完全在外時為空陣列 */
  clipped: Point[];
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
    clipped: pts,
  };
}

/**
 * 凸多邊形(裁切窗)∩ 房間多邊形:Sutherland-Hodgman,以裁切窗每條邊為裁切線。
 * 用於人字拼:板是旋轉後的凸四邊形,不能用軸對齊的 clipRectToPolygon。
 * clipWindow 頂點需依序(順/逆時針皆可,內側方向以窗形心判定)。
 */
export function clipConvexToPolygon(
  clipWindow: Point[],
  poly: RoomPolygon,
): ClipResult {
  const m = clipWindow.length;
  const cx = clipWindow.reduce((s, p) => s + p.x, 0) / m;
  const cy = clipWindow.reduce((s, p) => s + p.y, 0) / m;
  let pts: Point[] = poly.vertices.slice();
  for (let e = 0; e < m && pts.length > 0; e++) {
    const a = clipWindow[e];
    const b = clipWindow[(e + 1) % m];
    // 點對「邊 a→b」的有號側值;與形心同號為內側
    const side = (p: Point) =>
      (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    const inSign = side({ x: cx, y: cy }) >= 0 ? 1 : -1;
    const inside = (p: Point) => side(p) * inSign >= -EPS;
    const out: Point[] = [];
    for (let i = 0; i < pts.length; i++) {
      const cur = pts[i];
      const prev = pts[(i - 1 + pts.length) % pts.length];
      const curIn = inside(cur);
      const prevIn = inside(prev);
      if (curIn) {
        if (!prevIn) out.push(lineSegSideIsect(prev, cur, side));
        out.push(cur);
      } else if (prevIn) {
        out.push(lineSegSideIsect(prev, cur, side));
      }
    }
    pts = out;
  }
  const usedAreaCm2 = pts.length >= 3 ? polygonArea({ vertices: pts }) : 0;
  const windowArea = polygonArea({ vertices: clipWindow });
  return {
    usedAreaCm2,
    fullyInside: windowArea > EPS && usedAreaCm2 > windowArea - EPS,
    clipped: pts,
  };
}

/** 線段 p1→p2 與「side 函式為 0」的那條直線的交點 */
function lineSegSideIsect(
  p1: Point,
  p2: Point,
  side: (p: Point) => number,
): Point {
  const s1 = side(p1);
  const s2 = side(p2);
  const t = Math.abs(s1 - s2) < EPS ? 0 : s1 / (s1 - s2);
  return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
}

/** 線段 p1p2 與 p3p4 是否「真正交叉」(端點接觸不算,正交多邊形相鄰邊共點屬正常) */
function segmentsCross(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const cross = (a: Point, b: Point, c: Point) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const d1 = cross(p3, p4, p1);
  const d2 = cross(p3, p4, p2);
  const d3 = cross(p1, p2, p3);
  const d4 = cross(p1, p2, p4);
  return (
    ((d1 > EPS && d2 < -EPS) || (d1 < -EPS && d2 > EPS)) &&
    ((d3 > EPS && d4 < -EPS) || (d3 < -EPS && d4 > EPS))
  );
}

/** 多邊形是否自交(任兩條不相鄰的邊交叉)。拖角點/改邊長拉出怪形狀時用來防呆。 */
export function polygonSelfIntersects(poly: RoomPolygon): boolean {
  const v = poly.vertices;
  const n = v.length;
  for (let i = 0; i < n; i++) {
    const a1 = v[i];
    const a2 = v[(i + 1) % n];
    for (let j = i + 2; j < n; j++) {
      if ((j + 1) % n === i) continue; // 跳過與 i 相鄰的邊
      if (segmentsCross(a1, a2, v[j], v[(j + 1) % n])) return true;
    }
  }
  return false;
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
