import type { PlacedItem, RoomDimensions } from "./types";

const SNAP_THRESHOLD_MM = 100;

export function getFootprint(item: PlacedItem): { w: number; h: number } {
  const rotated = item.rotation === 90 || item.rotation === 270;
  return rotated
    ? { w: item.footprintMm.width, h: item.footprintMm.length }
    : { w: item.footprintMm.length, h: item.footprintMm.width };
}

export function clampToRoom(
  item: PlacedItem,
  room: RoomDimensions,
  proposedX: number,
  proposedY: number,
): { x: number; y: number } {
  const { w, h } = getFootprint(item);
  const maxX = Math.max(0, room.lengthMm - w);
  const maxY = Math.max(0, room.widthMm - h);
  return {
    x: Math.min(maxX, Math.max(0, proposedX)),
    y: Math.min(maxY, Math.max(0, proposedY)),
  };
}

export function snapToWalls(
  item: PlacedItem,
  room: RoomDimensions,
  x: number,
  y: number,
): { x: number; y: number } {
  const { w, h } = getFootprint(item);
  let snappedX = x;
  let snappedY = y;
  if (Math.abs(x) <= SNAP_THRESHOLD_MM) snappedX = 0;
  else if (Math.abs(room.lengthMm - (x + w)) <= SNAP_THRESHOLD_MM) snappedX = room.lengthMm - w;
  if (Math.abs(y) <= SNAP_THRESHOLD_MM) snappedY = 0;
  else if (Math.abs(room.widthMm - (y + h)) <= SNAP_THRESHOLD_MM) snappedY = room.widthMm - h;
  return { x: snappedX, y: snappedY };
}

export function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function getOverlappingIds(items: PlacedItem[]): Set<string> {
  const out = new Set<string>();
  const rects = items.map((it) => {
    const { w, h } = getFootprint(it);
    return { id: it.id, x: it.xMm, y: it.yMm, w, h };
  });
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      if (rectsOverlap(rects[i], rects[j])) {
        out.add(rects[i].id);
        out.add(rects[j].id);
      }
    }
  }
  return out;
}

export function rotateNext(rotation: PlacedItem["rotation"]): PlacedItem["rotation"] {
  const order: PlacedItem["rotation"][] = [0, 90, 180, 270];
  return order[(order.indexOf(rotation) + 1) % 4];
}

export function centerForNewItem(
  room: RoomDimensions,
  footprint: { length: number; width: number },
): { x: number; y: number } {
  return {
    x: Math.max(0, (room.lengthMm - footprint.length) / 2),
    y: Math.max(0, (room.widthMm - footprint.width) / 2),
  };
}
