/**
 * 地板排版引擎(直鋪錯縫)
 *
 * 流程:
 *   1. 房間向內縮伸縮縫 → 可鋪區域 layableRegion
 *   2. 取 bbox,依 direction 決定 run 軸(地板片長度方向)
 *   3. 逐排鋪滿 bbox:每排寬 = plankWidthCm,排間依 stagger 偏移起點
 *   4. 每片矩形對 layableRegion 裁切 → full / cut / 丟棄
 *
 * ASSUMPTION(user 核對後鎖定):
 *   - 地板片固定矩形、同規格
 *   - run 軸為 bbox 較長(long-axis)或較短(short-axis)邊方向
 *   - cut 片有效長度 = 交集面積 / plankWidthCm(近似:視為單一橫切)
 */
import type { FloorInput, FloorLayout, PlacedPlank, RoomPolygon } from "./types";
import { boundingBox, clipRectToPolygon, insetPolygon } from "./geometry";
import { computeHerringboneLayout } from "./herringbone";

const EPS = 0.001;

/** 依 stagger 模式回傳第 row 排的起點偏移(cm) */
function staggerOffset(row: number, mode: FloorInput["stagger"], plankLen: number): number {
  if (mode === "half") return (row % 2) * (plankLen / 2);
  if (mode === "third") return (row % 3) * (plankLen / 3);
  // random:固定種子,結果可重現
  let seed = (row + 1) * 2654435761;
  seed = (seed ^ (seed >>> 15)) >>> 0;
  return (seed / 0xffffffff) * plankLen;
}

export function computeFloorLayout(input: FloorInput): FloorLayout {
  // 人字拼走獨立排版引擎
  if (input.pattern === "herringbone") return computeHerringboneLayout(input);

  // startCorner:用鏡射房間達成「從不同角落起鋪」,排完再把座標鏡射回來。
  const origBb = boundingBox(input.room);
  const sumX = origBb.minX + origBb.maxX;
  const sumY = origBb.minY + origBb.maxY;
  const fromRight =
    input.startCorner === "top-right" || input.startCorner === "bottom-right";
  const fromBottom =
    input.startCorner === "bottom-left" || input.startCorner === "bottom-right";
  const mirror = (poly: RoomPolygon): RoomPolygon => ({
    vertices: poly.vertices.map((v) => ({
      x: fromRight ? sumX - v.x : v.x,
      y: fromBottom ? sumY - v.y : v.y,
    })),
  });
  const room = fromRight || fromBottom ? mirror(input.room) : input.room;

  // 伸縮縫夾到安全範圍:超過房間半邊長會讓 insetPolygon 翻面 → BOM 失真
  const roomBb = boundingBox(room);
  const maxGapCm =
    Math.min(roomBb.maxX - roomBb.minX, roomBb.maxY - roomBb.minY) / 2 - 1;
  const gapCm = Math.min(
    Math.max(input.expansionGapMm / 10, 0),
    Math.max(maxGapCm, 0),
  );
  let layableRegion: RoomPolygon =
    gapCm > 0 ? insetPolygon(room, gapCm) : room;
  const bb = boundingBox(layableRegion);
  const spanX = bb.maxX - bb.minX;
  const spanY = bb.maxY - bb.minY;

  // run 軸 = 地板片「長度」方向。long-axis → 沿 bbox 較長邊
  const runAlongX =
    input.direction === "long-axis" ? spanX >= spanY : spanX < spanY;

  const plankLen = input.plankLengthCm;
  const plankW = input.plankWidthCm;

  // rowSpan 是「排堆疊」方向的總長度
  const rowSpan = runAlongX ? spanY : spanX;
  const rows = Math.ceil(rowSpan / plankW - EPS);

  const planks: PlacedPlank[] = [];
  for (let r = 0; r < rows; r++) {
    const off = staggerOffset(r, input.stagger, plankLen);
    // 沿 run 軸從 bbox 起點 - off 開始,逐片 plankLen 步進直到蓋過 bbox
    const runStart = (runAlongX ? bb.minX : bb.minY) - off;
    const runEnd = runAlongX ? bb.maxX : bb.maxY;
    const rowPos = (runAlongX ? bb.minY : bb.minX) + r * plankW;
    for (let s = runStart; s < runEnd - EPS; s += plankLen) {
      const rect = runAlongX
        ? { x: s, y: rowPos, w: plankLen, h: plankW }
        : { x: rowPos, y: s, w: plankW, h: plankLen };
      const clip = clipRectToPolygon(rect, layableRegion);
      if (clip.usedAreaCm2 < EPS) continue; // 完全在外,丟棄
      planks.push({
        x: rect.x,
        y: rect.y,
        lengthCm: plankLen,
        widthCm: plankW,
        kind: clip.fullyInside ? "full" : "cut",
        row: r,
        usedAreaCm2: clip.usedAreaCm2,
        effectiveLengthCm: clip.fullyInside
          ? plankLen
          : clip.usedAreaCm2 / plankW,
        // 裁切片存裁切後形狀,預覽才不會畫到房間外
        shape: clip.fullyInside ? undefined : clip.clipped,
      });
    }
  }

  // 排完:把座標鏡射回真實房間方向
  if (fromRight || fromBottom) {
    for (const pk of planks) {
      const xExt = runAlongX ? pk.lengthCm : pk.widthCm;
      const yExt = runAlongX ? pk.widthCm : pk.lengthCm;
      if (fromRight) pk.x = sumX - pk.x - xExt;
      if (fromBottom) pk.y = sumY - pk.y - yExt;
      if (pk.shape) {
        pk.shape = pk.shape.map((v) => ({
          x: fromRight ? sumX - v.x : v.x,
          y: fromBottom ? sumY - v.y : v.y,
        }));
      }
    }
    layableRegion = mirror(layableRegion);
  }

  return { planks, rows, layableRegion };
}
