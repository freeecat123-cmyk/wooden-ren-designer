import type { Part } from "../types";
import { hoofSections as cabinetHoofSections } from "../geometry/hoof-clearance";

export { cabinetHoofSections };
/** Stepped receiver rebates follow the hoof within 0.5mm, retaining the blank.
 * Each cut is an explicit rectangular machining operation, not an audit flag.
 * A maximum 0.25mm profile increment plus 0.25mm running clearance bounds waste.
 */
export function cabinetHoofNotches(receiver: Part, posts: Part[]): Part["mortises"] {
  const cuts: Part["mortises"] = [];
  const angle = receiver.rotation?.y ?? 0, c = Math.cos(angle), s = Math.sin(angle);
  const hx = receiver.visible.length / 2, hz = receiver.visible.width / 2;
  for (const post of posts) {
    const passes: { minX: number; maxX: number; minZ: number; maxZ: number; y0: number; y1: number }[] = [];
    const rings = cabinetHoofSections(post);
    for (let i = 1; i < rings.length; i++) {
      const a = rings[i - 1], b = rings[i];
      const low = Math.max(a.y, receiver.origin.y), high = Math.min(b.y, receiver.origin.y + receiver.visible.thickness);
      if (high <= low) continue;
      const at = (y: number) => {
        const t = (y - a.y) / (b.y - a.y);
        return { minX: a.minX + t * (b.minX - a.minX), maxX: a.maxX + t * (b.maxX - a.maxX),
          minZ: a.minZ + t * (b.minZ - a.minZ), maxZ: a.maxZ + t * (b.maxZ - a.maxZ) };
      };
      const lower = at(low), upper = at(high);
      const movement = Math.max(...(["minX", "maxX", "minZ", "maxZ"] as const).map(k => Math.abs(lower[k] - upper[k])));
      const count = Math.max(1, Math.ceil(movement / 0.25), Math.ceil((high - low) / (receiver.visible.thickness / 2)));
      for (let step = 0; step < count; step++) {
        const y0 = low + (high - low) * step / count, y1 = low + (high - low) * (step + 1) / count;
        const p = at(y0), q = at(y1);
        const xs: number[] = [], zs: number[] = [];
        for (const x of [Math.min(p.minX, q.minX), Math.max(p.maxX, q.maxX)]) {
          for (const z of [Math.min(p.minZ, q.minZ), Math.max(p.maxZ, q.maxZ)]) {
            const dx = x - receiver.origin.x, dz = z - receiver.origin.z;
            xs.push(c * dx - s * dz); zs.push(s * dx + c * dz);
          }
        }
        let minX = Math.max(-hx, Math.min(...xs)), maxX = Math.min(hx, Math.max(...xs));
        let minZ = Math.max(-hz, Math.min(...zs)), maxZ = Math.min(hz, Math.max(...zs));
        if (maxX - minX < 0.001 || maxZ - minZ < 0.001) continue;
        minX = Math.max(-hx, minX - 0.25); maxX = Math.min(hx, maxX + 0.25);
        minZ = Math.max(-hz, minZ - 0.25); maxZ = Math.min(hz, maxZ + 0.25);
        passes.push({ minX, maxX, minZ, maxZ, y0, y1 });
      }
    }
    // Extend each pass only through adjacent passes that already contain its
    // footprint. This is the same removal union, with overlapping tool paths
    // instead of hundreds of exactly coplanar cutter boundaries.
    for (let index = 0; index < passes.length; index++) {
        const pass = passes[index];
        const { minX, maxX, minZ, maxZ } = pass;
        let { y0, y1 } = pass;
        const contains = (q: typeof pass) => q.minX <= minX + 1e-8 && q.maxX >= maxX - 1e-8
          && q.minZ <= minZ + 1e-8 && q.maxZ >= maxZ - 1e-8;
        for (let j = index - 1; j >= 0 && Math.abs(passes[j].y1 - y0) < 1e-8 && contains(passes[j]); j--) y0 = passes[j].y0;
        for (let j = index + 1; j < passes.length && Math.abs(passes[j].y0 - y1) < 1e-8 && contains(passes[j]); j++) y1 = passes[j].y1;
        const x = (minX + maxX) / 2, y = (y0 + y1) / 2 - receiver.origin.y;
        const length = maxX - minX, height = y1 - y0;
        // Route from the broad face. Swapping the in-face axes is explicit;
        // do not rely on world-axis hints, which older rotated stock ignores.
        const longOnX = hx - Math.abs(x) > Math.min(y, receiver.visible.thickness - y);
        const rotate = longOnX !== (length >= height);
        cuts.push({ origin: { x, y, z: minZ + maxZ >= 0 ? hz : -hz },
          length, width: height, depth: maxZ - minZ,
          through: maxZ - minZ >= receiver.visible.width - 0.001, cosmetic: true,
          ...(rotate ? { rotZ: Math.PI / 2 } : {}), label: `馬蹄避讓 ${post.id}` });
    }
  }
  return cuts;
}

/** Give a side rail a real lengthwise blank/grain axis without moving its solid. */
export function orientCabinetSideRail(rail: Part): void {
  [rail.visible.length, rail.visible.width] = [rail.visible.width, rail.visible.length];
  rail.rotation = { x: 0, y: Math.PI / 2, z: 0 };
  if (rail.shape?.kind === "mitered-ends" && rail.shape.vertices) {
    rail.shape.vertices = rail.shape.vertices.map(([x, y, z]) => [-z, y, x]);
  }
  rail.tenons = rail.tenons.map(t => ({ ...t, position: t.position === "left" ? "end" : t.position === "right" ? "start" : t.position }));
}

/** Raked end faces follow both inner post planes across the whole rail height. */
export function rakeCabinetRail(rail: Part, side: boolean, bottomSpan: number, topSpan: number, bottomShift: number): void {
  const halfNormal = (side ? rail.visible.length : rail.visible.width) / 2;
  const halfHeight = rail.visible.thickness / 2;
  const vertices: [number, number, number][] = [];
  for (const [y, span, shift] of [[halfHeight, topSpan, -bottomShift], [-halfHeight, bottomSpan, bottomShift]]) {
    for (const [sx, sz] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
      vertices.push(side ? [shift + sx * halfNormal, y, sz * span / 2] : [sx * span / 2, y, shift + sz * halfNormal]);
    }
  }
  if (side) rail.visible.width = Math.max(bottomSpan, topSpan);
  else rail.visible.length = Math.max(bottomSpan, topSpan);
  rail.shape = { kind: "mitered-ends", insetEach: 0, outerSide: "+y", vertices };
}

/** The groove encloses the floating panel over its actual 5mm engagement band.
 * Splayed panels change centre and section width with height; their blanks stay
 * unchanged. The 0.5mm total normal clearance also covers seasonal sliding.
 */
export function cabinetPanelGroove(rail: Part, panel: Part, side: boolean, upper: boolean): Part["mortises"][number] {
  const low = upper ? rail.origin.y : rail.origin.y + rail.visible.thickness - 5;
  const high = low + 5;
  const bounds = [low, high].map(y => {
    const t = Math.max(0, Math.min(1, (y - panel.origin.y) / panel.visible.thickness));
    const shape = panel.shape?.kind === "splayed-tapered" ? panel.shape : undefined;
    const scale = 1 + ((shape?.bottomScale ?? 1) - 1) * (1 - t);
    const x = panel.origin.x + (shape?.dxMm ?? 0) * (1 - t) - rail.origin.x;
    const z = panel.origin.z + (shape?.dzMm ?? 0) * (1 - t) - rail.origin.z;
    return { minX: x - panel.visible.length * scale / 2, maxX: x + panel.visible.length * scale / 2,
      minZ: z - panel.visible.width * scale / 2, maxZ: z + panel.visible.width * scale / 2 };
  });
  const minX = Math.min(...bounds.map(b => b.minX)) - (side ? 0.25 : 0);
  const maxX = Math.max(...bounds.map(b => b.maxX)) + (side ? 0.25 : 0);
  const minZ = Math.min(...bounds.map(b => b.minZ)) - (side ? 0 : 0.25);
  const maxZ = Math.max(...bounds.map(b => b.maxZ)) + (side ? 0 : 0.25);
  const angle = rail.rotation?.y ?? 0, c = Math.cos(angle), s = Math.sin(angle);
  const xs: number[] = [], zs: number[] = [];
  for (const x of [minX, maxX]) for (const z of [minZ, maxZ]) { xs.push(c * x - s * z); zs.push(s * x + c * z); }
  return { origin: { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: upper ? 0 : rail.visible.thickness,
      z: (Math.min(...zs) + Math.max(...zs)) / 2 },
    length: Math.max(...xs) - Math.min(...xs), width: Math.max(...zs) - Math.min(...zs), depth: 5,
    through: false, cosmetic: true, label: "板心槽 5mm" };
}
