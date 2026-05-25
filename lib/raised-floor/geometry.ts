/**
 * 和室架高平台 — 平面多邊形產生
 *
 * 流程:
 *   1. shape=rect → 直接矩形
 *      shape=l-shape → 右下凹角 L 形(順時針)
 *   2. 對每個挨柱套 subtractCornerRect,從 corner 往內挖矩形
 * 所有頂點 cm,順時針。
 */
import type { Pillar, PillarCorner, PlatformShape, RoomPolygon } from "./types";
import type { Point } from "@/lib/floor/types";
import { polygonPerimeter } from "@/lib/floor/geometry";

const EPS = 0.001;

/** 矩形 → 順時針 4 點 */
export function rectPolygon(widthCm: number, depthCm: number): RoomPolygon {
  return {
    vertices: [
      { x: 0, y: 0 },
      { x: widthCm, y: 0 },
      { x: widthCm, y: depthCm },
      { x: 0, y: depthCm },
    ],
  };
}

/**
 * L 形:從矩形右下角內凹 (lCutX × lCutY) 的缺口。順時針 6 點。
 * 視覺:
 *   ┌──────────┐
 *   │          │
 *   │          │
 *   │     ┌────┘  ← 凹進來
 *   │     │
 *   └─────┘
 * 凹角夾限在 [10, width-10] × [10, depth-10] 避免退化。
 */
export function lShapePolygon(
  widthCm: number,
  depthCm: number,
  lCutXCm: number,
  lCutYCm: number,
): RoomPolygon {
  const cutX = clamp(lCutXCm, 10, widthCm - 10);
  const cutY = clamp(lCutYCm, 10, depthCm - 10);
  return {
    vertices: [
      { x: 0, y: 0 },
      { x: widthCm, y: 0 },
      { x: widthCm, y: depthCm - cutY },
      { x: widthCm - cutX, y: depthCm - cutY },
      { x: widthCm - cutX, y: depthCm },
      { x: 0, y: depthCm },
    ],
  };
}

/**
 * 從指定 corner 往內挖一塊矩形(挨柱凹陷)。
 * corner=tl/tr/bl/br 指原平台 bbox 角;挖洞後該角換成 3 個新頂點。
 *
 * 演算法:對每條邊判斷是否在 corner 附近 → 將 corner 頂點換成
 * 3 個點(沿邊 1→凹角→沿邊 2)。
 */
export function subtractCornerRect(
  poly: RoomPolygon,
  corner: PillarCorner,
  pillarWidthCm: number,
  pillarDepthCm: number,
): RoomPolygon {
  const bb = bbox(poly);
  const w = pillarWidthCm;
  const d = pillarDepthCm;
  const cornerXY = cornerPoint(bb, corner);

  // 找最接近 corner 的頂點(只在頂點處挖,不切中段邊)
  const idx = nearestVertex(poly.vertices, cornerXY);
  if (idx < 0) return poly;

  // corner 方向:挖洞時新角朝向平台「內部」
  const dirX = corner === "tl" || corner === "bl" ? +1 : -1;
  const dirY = corner === "tl" || corner === "tr" ? +1 : -1;

  const cv = poly.vertices[idx];
  // 三個新點:沿 X 邊→內凹角→沿 Y 邊
  // 順時針保持:依 corner 決定先 X 或先 Y
  const pX: Point = { x: cv.x + dirX * w, y: cv.y };
  const pIn: Point = { x: cv.x + dirX * w, y: cv.y + dirY * d };
  const pY: Point = { x: cv.x, y: cv.y + dirY * d };

  // 順時針多邊形,prev→cv→next 連接;
  // 把 cv 替換成 3 點,中段 pIn 是新角,
  // 兩邊 pY/pX 必須跟 prev/next 邊方向接得起來:
  //   next 邊沿 X(水平) → pX 必須接 next → 順序 prev→pY→pIn→pX→next
  //   next 邊沿 Y(垂直) → pY 必須接 next → 順序 prev→pX→pIn→pY→next
  const next = poly.vertices[(idx + 1) % poly.vertices.length];
  const nextAlongX = Math.abs(next.y - cv.y) < EPS;
  const replacement: Point[] = nextAlongX ? [pY, pIn, pX] : [pX, pIn, pY];

  const out = [...poly.vertices];
  out.splice(idx, 1, ...replacement);
  return { vertices: out };
}

/**
 * 主入口:依 input 產出最終平台多邊形(含挨柱挖洞)。
 */
export function buildPlatformPolygon(opts: {
  shape: PlatformShape;
  widthCm: number;
  depthCm: number;
  lCutXCm?: number;
  lCutYCm?: number;
  pillars?: Pillar[];
}): RoomPolygon {
  let poly: RoomPolygon =
    opts.shape === "l-shape"
      ? lShapePolygon(
          opts.widthCm,
          opts.depthCm,
          opts.lCutXCm ?? Math.round(opts.widthCm * 0.4),
          opts.lCutYCm ?? Math.round(opts.depthCm * 0.4),
        )
      : rectPolygon(opts.widthCm, opts.depthCm);
  for (const p of opts.pillars ?? []) {
    poly = subtractCornerRect(poly, p.corner, p.widthCm, p.depthCm);
  }
  return poly;
}

/**
 * 算主支(main-joist)總公尺數:平台周長(井字邊框)+ 中間短向支撐 N 條。
 *
 * 規矩:
 *   - 主支沿「短軸」走(短軸=每根角材長度方向),平台短邊長則 →每條更短。
 *   - 沿「長軸」每 spacingCm 一條中間支撐(不含兩端,兩端是邊框)。
 *   - 中間條數 N = floor(longAxisCm / spacingCm)
 *   - 每條長度 = 平台 polygon 在該掃描線位置的橫切長度(corner 挖洞自動扣)
 *
 * 回傳:
 *   - `mainJoistCentersCm` = 中間主支沿長軸方向的中心座標(cm,bbox 相對),
 *     讓 SVG / 副支算法共用,別重算。
 */
export function joistRunLengthsM(
  poly: RoomPolygon,
  spacingCm: number,
): {
  rowCount: number;
  totalLengthM: number;
  perimeterM: number;
  middleCount: number;
  mainJoistCentersCm: number[];
} {
  const perimeterM = polygonPerimeter(poly) / 100;
  const bb = bbox(poly);
  const w = bb.maxX - bb.minX;
  const d = bb.maxY - bb.minY;
  // 短軸 = 角材方向,長軸 = 排列方向
  const shortAlongX = w <= d; // true → 角材沿 X 走、間距沿 Y 量
  const longSpan = shortAlongX ? d : w;
  const middleCount = Math.max(0, Math.floor(longSpan / Math.max(spacingCm, 1)));
  const mainJoistCentersCm: number[] = [];
  let middleCm = 0;
  for (let i = 1; i <= middleCount; i++) {
    const t = (i * longSpan) / (middleCount + 1);
    mainJoistCentersCm.push(t);
    // 掃描線基準:沿長軸走 → 基準軸跟長軸同
    const base = shortAlongX ? bb.minY : bb.minX;
    middleCm += scanlineLength(poly, shortAlongX, base + t);
  }
  const totalLengthM = perimeterM + middleCm / 100;
  // rowCount 對外暴露含兩端邊框的「角材條數」,UI 顯示用
  const rowCount = middleCount + 2;
  return { rowCount, totalLengthM, perimeterM, middleCount, mainJoistCentersCm };
}

/**
 * 算副支(sub-joist)總公尺數。副支用來把夾板底層支撐密度提高。
 *
 * 拓樸(對標 ceiling §CE.5 model):
 *   - 主支沿「短軸」走,垂直排列 N 條中間主支 → 把平台沿「長軸」切成 N+1 個 slot。
 *   - 副支沿「長軸」走(垂直主支),被主支夾在 slot 內,長度 = slot 寬(相鄰主支中心距)。
 *   - 副支沿「短軸」方向以 subSpacingCm 為間距排列,排數一致,每個 slot 都同樣多。
 *
 * 演算法:
 *   1. slot 邊界 = [0, ...mainCentersCm, longSpan];共 N+1 個 slot。
 *   2. 每 slot 內副支根數 = floor(shortSpan / subSpacingCm)
 *      (副支沿短軸排,跟掃描線一樣;假設整片平台共用同密度,L/挨柱平台也照這個基線估)。
 *   3. 每根副支長 = slot 寬(相鄰主支中心距)。
 *   4. 總公尺 = Σ(slot 寬 × 排數)/ 100。
 *   5. typicalLengthCm = 取中段 slot 的副支長(沒有就第一個 slot)。
 *
 * 簡化假設(跟 ceiling 一樣):這版固定「sub 走長軸 / main 走短軸」,不過度通用化。
 *   L 形/挨柱平台,slot 寬是「相鄰主支中心距」而不是實際扣洞長度,
 *   會略高估副支長(可接受誤差,跟 ceiling 同尺度)。
 *
 * @param poly 平台多邊形(bbox 用來推 short/long 軸)
 * @param mainCentersCm 中間主支沿長軸的中心座標(joistRunLengthsM 回傳)
 * @param subSpacingCm 副支間距(cm,沿短軸方向)
 */
export function subJoistRunLengthsM(
  poly: RoomPolygon,
  mainCentersCm: number[],
  subSpacingCm: number,
): { totalLengthM: number; count: number; typicalLengthCm: number } {
  const bb = bbox(poly);
  const w = bb.maxX - bb.minX;
  const d = bb.maxY - bb.minY;
  const shortAlongX = w <= d; // 主支沿 X → 短軸 = X,長軸 = Y
  const longSpan = shortAlongX ? d : w;
  const shortSpan = shortAlongX ? w : d;
  const spacing = Math.max(subSpacingCm, 1);

  // slot 邊界陣列(沿長軸):0 → 每根主支中心 → longSpan
  const boundaries = [0, ...mainCentersCm, longSpan];

  // 每 slot 副支排數 = 沿短軸方向 floor(shortSpan / spacing)
  const subRowsPerSlot = Math.max(0, Math.floor(shortSpan / spacing));

  let totalCm = 0;
  let count = 0;
  const slotWidths: number[] = [];

  for (let s = 0; s + 1 < boundaries.length; s++) {
    const slotLo = boundaries[s];
    const slotHi = boundaries[s + 1];
    const slotWidth = slotHi - slotLo;
    if (slotWidth <= 0) continue;

    count += subRowsPerSlot;
    totalCm += subRowsPerSlot * slotWidth;
    slotWidths.push(slotWidth);
  }

  // typicalLengthCm:取中段 slot 寬(=典型副支長)
  let typicalLengthCm = 0;
  if (slotWidths.length > 0) {
    typicalLengthCm = slotWidths[Math.floor(slotWidths.length / 2)];
  }

  return {
    totalLengthM: totalCm / 100,
    count,
    typicalLengthCm,
  };
}

/**
 * 掃描線跟多邊形邊的交集總長(cm)。
 * runAlongX=true → 水平線 y=const,回傳交集 x 區間總長。
 * runAlongX=false → 垂直線 x=const,回傳交集 y 區間總長。
 */
function scanlineLength(
  poly: RoomPolygon,
  runAlongX: boolean,
  level: number,
): number {
  const xs: number[] = [];
  const v = poly.vertices;
  for (let i = 0; i < v.length; i++) {
    const a = v[i];
    const b = v[(i + 1) % v.length];
    const ay = runAlongX ? a.y : a.x;
    const by = runAlongX ? b.y : b.x;
    const ax = runAlongX ? a.x : a.y;
    const bx = runAlongX ? b.x : b.y;
    if ((ay <= level && by > level) || (by <= level && ay > level)) {
      const t = (level - ay) / (by - ay);
      xs.push(ax + t * (bx - ax));
    }
  }
  xs.sort((a, b) => a - b);
  let s = 0;
  for (let i = 0; i + 1 < xs.length; i += 2) s += xs[i + 1] - xs[i];
  return s;
}

// ────────── utils ──────────

function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}

function bbox(poly: RoomPolygon) {
  const xs = poly.vertices.map((p) => p.x);
  const ys = poly.vertices.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function cornerPoint(bb: ReturnType<typeof bbox>, corner: PillarCorner): Point {
  return {
    x: corner === "tl" || corner === "bl" ? bb.minX : bb.maxX,
    y: corner === "tl" || corner === "tr" ? bb.minY : bb.maxY,
  };
}

function nearestVertex(verts: Point[], target: Point): number {
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < verts.length; i++) {
    const dx = verts[i].x - target.x;
    const dy = verts[i].y - target.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD) {
      bestD = d2;
      best = i;
    }
  }
  return best;
}
