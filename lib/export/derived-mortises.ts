/**
 * 從公榫（榫頭）反推母件榫孔 —— 給「腳身沒建母榫」的腳型（如弧肩斜腳 curved-taper）
 * 用：找出每個榫頭插進哪個母件、在母件哪個面、多大的孔，當成 implied mortise 餵進
 * face 投影。這樣不管腳型有沒有在資料裡挖母榫，CNC 都拿得到腳孔。
 *
 * 座標：沿用 projectPartSilhouette 的世界擺放（Euler XYZ 依序 Rx→Ry→Rz，
 * wx=x+origin.x、wy=y+origin.y+yExt/2、wz=z+origin.z；local 為置中）。
 * 反推 = 榫頭 box 8 角 → world → 母件 local → AABB 成 box；depthAxis 取榫頭
 * 穿透方向在母件 local 的主軸。box 落在入榫面附近，中心 sign 決定哪一面
 * （與真母榫同一套 boxToRawHoles）。
 *
 * ⚠️ 只套用在「沒有真母榫」的母件（如弧肩斜腳腳），避免直腳等已有真母榫的零件被重複挖。
 */
import type { Part } from "@/lib/types";
import { worldExtents } from "@/lib/render/geometry";
import { tenonLocalBox } from "@/lib/render/svg-views";
import type { DerivedMortise } from "@/lib/export/mortise-faces";

type V3 = { x: number; y: number; z: number };

const TENON_EXT_AXIS: Record<string, "x" | "y" | "z"> = {
  start: "x", end: "x", top: "y", bottom: "y", left: "z", right: "z",
};

/** Euler XYZ 正轉（Rx→Ry→Rz），對齊 projectPartSilhouette 的 pushPoint。 */
function rot(p: V3, rx: number, ry: number, rz: number): V3 {
  const cx = Math.cos(rx), sx = Math.sin(rx);
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const cz = Math.cos(rz), sz = Math.sin(rz);
  let { x, y, z } = p;
  let y2 = y * cx - z * sx, z2 = y * sx + z * cx; y = y2; z = z2;      // Rx
  let x2 = x * cy + z * sy; z2 = -x * sy + z * cy; x = x2; z = z2;      // Ry
  x2 = x * cz - y * sz; y2 = x * sz + y * cz; x = x2; y = y2;           // Rz
  return { x, y, z };
}

/** 反轉（Rz⁻¹→Ry⁻¹→Rx⁻¹）。 */
function rotInv(p: V3, rx: number, ry: number, rz: number): V3 {
  const cx = Math.cos(rx), sx = Math.sin(rx);
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const cz = Math.cos(rz), sz = Math.sin(rz);
  let { x, y, z } = p;
  { const x2 = x * cz + y * sz, y2 = -x * sz + y * cz; x = x2; y = y2; } // Rz⁻¹
  { const x2 = x * cy - z * sy, z2 = x * sy + z * cy; x = x2; z = z2; }  // Ry⁻¹
  { const y2 = y * cx + z * sx, z2 = -y * sx + z * cx; y = y2; z = z2; } // Rx⁻¹
  return { x, y, z };
}

function rotOf(part: Part) {
  return [part.rotation?.x ?? 0, part.rotation?.y ?? 0, part.rotation?.z ?? 0] as const;
}

function worldPoint(part: Part, local: V3): V3 {
  const [rx, ry, rz] = rotOf(part);
  const r = rot(local, rx, ry, rz);
  const yExt = worldExtents(part).yExt;
  return { x: r.x + part.origin.x, y: r.y + part.origin.y + yExt / 2, z: r.z + part.origin.z };
}

function worldToLocal(part: Part, w: V3): V3 {
  const [rx, ry, rz] = rotOf(part);
  const yExt = worldExtents(part).yExt;
  const t = { x: w.x - part.origin.x, y: w.y - part.origin.y - yExt / 2, z: w.z - part.origin.z };
  return rotInv(t, rx, ry, rz);
}

interface AABB { min: V3; max: V3 }

/** 零件本體（visible 置中 box）的世界 AABB。 */
function partWorldAABB(part: Part): AABB {
  const hx = part.visible.length / 2, hy = part.visible.thickness / 2, hz = part.visible.width / 2;
  const min: V3 = { x: Infinity, y: Infinity, z: Infinity };
  const max: V3 = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const w = worldPoint(part, { x: sx * hx, y: sy * hy, z: sz * hz });
    min.x = Math.min(min.x, w.x); min.y = Math.min(min.y, w.y); min.z = Math.min(min.z, w.z);
    max.x = Math.max(max.x, w.x); max.y = Math.max(max.y, w.y); max.z = Math.max(max.z, w.z);
  }
  return { min, max };
}

function contains(b: AABB, p: V3, eps = 1): boolean {
  return p.x >= b.min.x - eps && p.x <= b.max.x + eps &&
    p.y >= b.min.y - eps && p.y <= b.max.y + eps &&
    p.z >= b.min.z - eps && p.z <= b.max.z + eps;
}
function volume(b: AABB): number {
  return (b.max.x - b.min.x) * (b.max.y - b.min.y) * (b.max.z - b.min.z);
}

/**
 * 每個「母件 id → 從插進它的榫頭反推的母榫清單」。
 * 呼叫端只對「沒有真母榫」的母件套用（避免直腳等重複挖）。
 */
export function deriveMortisesByPart(parts: Part[]): Map<string, DerivedMortise[]> {
  const aabbs = parts.map(partWorldAABB);
  const result = new Map<string, DerivedMortise[]>();

  parts.forEach((child, ci) => {
    for (const t of child.tenons ?? []) {
      const ext = TENON_EXT_AXIS[t.position];
      if (!ext) continue;
      const lb = tenonLocalBox(child, t);
      const center: V3 = { x: lb.cx, y: lb.cy, z: lb.cz };
      const half: Record<"x" | "y" | "z", number> = { x: lb.hx, y: lb.hy, z: lb.hz };
      const sgn = Math.sign(center[ext]) || 1;

      // 榫頭外端（插進母件最深處）與肩端（母件表面）
      const tip: V3 = { ...center }; tip[ext] = center[ext] + sgn * half[ext];
      const shoulder: V3 = { ...center }; shoulder[ext] = center[ext] - sgn * half[ext];
      const tipW = worldPoint(child, tip);

      // 找母件：世界 AABB 包住榫頭外端、體積最小者（最貼合）
      let mi = -1, bestVol = Infinity;
      parts.forEach((p, pi) => {
        if (pi === ci) return;
        if (contains(aabbs[pi], tipW)) {
          const v = volume(aabbs[pi]);
          if (v < bestVol) { bestVol = v; mi = pi; }
        }
      });
      if (mi < 0) continue;
      const mother = parts[mi];

      // 榫頭 8 角 → world → 母件 local → AABB
      let mnx = Infinity, mny = Infinity, mnz = Infinity, mxx = -Infinity, mxy = -Infinity, mxz = -Infinity;
      for (const ex of [-1, 1]) for (const ey of [-1, 1]) for (const ez of [-1, 1]) {
        const cW = worldPoint(child, { x: lb.cx + ex * lb.hx, y: lb.cy + ey * lb.hy, z: lb.cz + ez * lb.hz });
        const cL = worldToLocal(mother, cW);
        mnx = Math.min(mnx, cL.x); mny = Math.min(mny, cL.y); mnz = Math.min(mnz, cL.z);
        mxx = Math.max(mxx, cL.x); mxy = Math.max(mxy, cL.y); mxz = Math.max(mxz, cL.z);
      }
      const box = {
        cx: (mnx + mxx) / 2, cy: (mny + mxy) / 2, cz: (mnz + mxz) / 2,
        hx: (mxx - mnx) / 2, hy: (mxy - mny) / 2, hz: (mxz - mnz) / 2,
      };

      // 穿透方向（tip - shoulder）在母件 local 的主軸 = depthAxis
      const dW: V3 = {
        x: tipW.x - worldPoint(child, shoulder).x,
        y: tipW.y - worldPoint(child, shoulder).y,
        z: tipW.z - worldPoint(child, shoulder).z,
      };
      const dL = rotInv(dW, ...rotOf(mother));
      const ax = Math.abs(dL.x), ay = Math.abs(dL.y), az = Math.abs(dL.z);
      const depthAxis: "x" | "y" | "z" = ax >= ay && ax >= az ? "x" : ay >= az ? "y" : "z";

      const arr = result.get(mother.id) ?? [];
      arr.push({ lb: { ...box, depthAxis }, through: false, label: "榫孔" });
      result.set(mother.id, arr);
    }
  });

  return result;
}
