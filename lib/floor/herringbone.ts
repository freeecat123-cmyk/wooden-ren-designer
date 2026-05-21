/**
 * 人字拼排版引擎(對牆 45° 斜鋪)
 *
 * 演算法(2026-05 查證 Wikipedia 鄰接規則後推導):
 *   在「板軸對齊」的 local 座標系生成標準人字拼板陣,再整體旋轉 45° 進房間座標。
 *   - 一個課程(course)沿 s = (L+W, L−W) 步進,每步一對 V+H 板互鎖。
 *   - 平行課程間偏移 r = (W, −W)(經驗證:r 對 s 的垂直分量恰為課程間距 2LW/|s|)。
 *   - base(k,c) = k·s + c·r;該點放一片直立 V 板(W×L),
 *     其右上接一片水平 H 板(L×W),H 左下角 = base + (W, L−W)。
 *
 * 每片板旋轉 45° 後是凸四邊形,用 clipConvexToPolygon 對房間裁切,分整片/裁切片。
 */
import type {
  FloorInput,
  FloorLayout,
  PlacedPlank,
  Point,
  RoomPolygon,
} from "./types";
import { boundingBox, clipConvexToPolygon, insetPolygon } from "./geometry";

const EPS = 0.001;

export function computeHerringboneLayout(input: FloorInput): FloorLayout {
  // 伸縮縫向內縮(同直鋪)
  const roomBb = boundingBox(input.room);
  const maxGapCm =
    Math.min(roomBb.maxX - roomBb.minX, roomBb.maxY - roomBb.minY) / 2 - 1;
  const gapCm = Math.min(
    Math.max(input.expansionGapMm / 10, 0),
    Math.max(maxGapCm, 0),
  );
  const layableRegion: RoomPolygon =
    gapCm > 0 ? insetPolygon(input.room, gapCm) : input.room;
  const bb = boundingBox(layableRegion);

  const L = input.plankLengthCm;
  const W = input.plankWidthCm;
  if (L <= EPS || W <= EPS) {
    return { planks: [], rows: 0, layableRegion };
  }

  // 整體旋轉 45°,旋轉中心 = 房間中心
  const cx = (bb.minX + bb.maxX) / 2;
  const cy = (bb.minY + bb.maxY) / 2;
  const cos = Math.SQRT1_2; // cos 45°
  const sin = Math.SQRT1_2; // sin 45°
  const toRoom = (p: Point): Point => ({
    x: cx + p.x * cos - p.y * sin,
    y: cy + p.x * sin + p.y * cos,
  });
  const toLocal = (p: Point): Point => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    return { x: dx * cos + dy * sin, y: -dx * sin + dy * cos };
  };

  // 房間 bbox 四角轉進 local → 反解 (k,c) 範圍
  // base = M·(k,c),M = [[L+W, W],[L−W, −W]],det = −2LW
  const det = -2 * L * W;
  const toKC = (x: number, y: number) => ({
    k: (-W * x - W * y) / det,
    c: (-(L - W) * x + (L + W) * y) / det,
  });
  const roomCorners: Point[] = [
    { x: bb.minX, y: bb.minY },
    { x: bb.maxX, y: bb.minY },
    { x: bb.maxX, y: bb.maxY },
    { x: bb.minX, y: bb.maxY },
  ];
  const kcs = roomCorners.map((p) => {
    const lp = toLocal(p);
    return toKC(lp.x, lp.y);
  });
  const kMin = Math.floor(Math.min(...kcs.map((p) => p.k))) - 2;
  const kMax = Math.ceil(Math.max(...kcs.map((p) => p.k))) + 2;
  const cMin = Math.floor(Math.min(...kcs.map((p) => p.c))) - 2;
  const cMax = Math.ceil(Math.max(...kcs.map((p) => p.c))) + 2;

  const planks: PlacedPlank[] = [];
  const usedCourses = new Set<number>();

  for (let k = kMin; k <= kMax; k++) {
    for (let c = cMin; c <= cMax; c++) {
      const bx = k * (L + W) + c * W;
      const by = k * (L - W) - c * W;
      // V 板(直立 W×L)、H 板(水平 L×W,左下 = base+(W, L−W))
      const localRects = [
        { x: bx, y: by, w: W, h: L },
        { x: bx + W, y: by + L - W, w: L, h: W },
      ];
      for (const r of localRects) {
        const quad: Point[] = [
          toRoom({ x: r.x, y: r.y }),
          toRoom({ x: r.x + r.w, y: r.y }),
          toRoom({ x: r.x + r.w, y: r.y + r.h }),
          toRoom({ x: r.x, y: r.y + r.h }),
        ];
        const clip = clipConvexToPolygon(quad, layableRegion);
        if (clip.usedAreaCm2 < EPS || clip.clipped.length < 3) continue;
        const qb = boundingBox({ vertices: clip.clipped });
        planks.push({
          x: qb.minX,
          y: qb.minY,
          lengthCm: L,
          widthCm: W,
          kind: clip.fullyInside ? "full" : "cut",
          row: c,
          usedAreaCm2: clip.usedAreaCm2,
          effectiveLengthCm: clip.fullyInside ? L : clip.usedAreaCm2 / W,
          shape: clip.clipped,
        });
        usedCourses.add(c);
      }
    }
  }

  return { planks, rows: usedCourses.size, layableRegion };
}
