import type { Part } from "@/lib/types";
import { projectPartSilhouette } from "@/lib/render/geometry";
import { xRangeAtY } from "./y-slice";

export interface HorizontalBounds { minX: number; maxX: number; minZ: number; maxZ: number }

/** Bound the obstacle over the shelf's height, including every silhouette corner. */
export function obstacleInShelf(shelf: Part, obstacle: Part): HorizontalBounds | null {
  if ((shelf.rotation?.x ?? 0) !== 0 || (shelf.rotation?.z ?? 0) !== 0) return null;
  const front = projectPartSilhouette(obstacle, "front");
  const side = projectPartSilhouette(obstacle, "side");
  const points = [...front, ...side];
  const low = Math.max(shelf.origin.y, Math.min(...points.map(p => p.y)));
  const high = Math.min(shelf.origin.y + shelf.visible.thickness, Math.max(...points.map(p => p.y)));
  if (high - low < 0.001) return null;
  const heights = [low, high, ...points.map(p => p.y).filter(y => y > low && y < high)];
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  const angle = shelf.rotation?.y ?? 0;
  const c = Math.cos(angle), s = Math.sin(angle);
  for (const height of heights) {
    const xr = xRangeAtY(front, height), zr = xRangeAtY(side, height);
    if (!xr || !zr) continue;
    // Both front and side project their horizontal world axis with a minus sign.
    for (const x of [-xr[1], -xr[0]]) for (const z of [-zr[1], -zr[0]]) {
      const dx = x - shelf.origin.x, dz = z - shelf.origin.z;
      const localX = c * dx - s * dz, localZ = s * dx + c * dz;
      minX = Math.min(minX, localX); maxX = Math.max(maxX, localX);
      minZ = Math.min(minZ, localZ); maxZ = Math.max(maxZ, localZ);
    }
  }
  minX = Math.max(minX, -shelf.visible.length / 2); maxX = Math.min(maxX, shelf.visible.length / 2);
  minZ = Math.max(minZ, -shelf.visible.width / 2); maxZ = Math.min(maxZ, shelf.visible.width / 2);
  return maxX - minX > 0.001 && maxZ - minZ > 0.001 ? { minX, maxX, minZ, maxZ } : null;
}

export function shelfClearanceMortises(shelf: Part, legs: Part[], label = "避腳缺角"): Part["mortises"] {
  return legs.flatMap(leg => {
    const bounds = obstacleInShelf(shelf, leg);
    if (!bounds) return [];
    const minX = Math.max(-shelf.visible.length / 2, bounds.minX - 0.5);
    const maxX = Math.min(shelf.visible.length / 2, bounds.maxX + 0.5);
    const minZ = Math.max(-shelf.visible.width / 2, bounds.minZ - 0.5);
    const maxZ = Math.min(shelf.visible.width / 2, bounds.maxZ + 0.5);
    return [{ origin: { x: (minX + maxX) / 2, y: 0, z: (minZ + maxZ) / 2 },
      length: maxX - minX, width: maxZ - minZ, depth: shelf.visible.thickness,
      through: true, cosmetic: true, label, axis: { x: 0, y: 1, z: 0 } }];
  });
}
