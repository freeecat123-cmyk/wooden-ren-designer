/**
 * Drawer tenon/mortise pairing dump for nightstand (surface vs rebated).
 *
 * Mirrors PerspectiveView pairing logic to find every red-mesh leak.
 *
 * Run: npx tsx scripts/debug-drawer-joints.ts
 */
import { FURNITURE_CATALOG } from "../lib/templates";
import { mortiseLocalBox } from "../lib/render/svg-views";
import { worldExtents } from "../lib/render/geometry";
import type { FurnitureDesign, MaterialId, Part } from "../lib/types";

const entry = FURNITURE_CATALOG.find((e) => e.category === "nightstand")!;
const baseOpts = (entry.optionSchema ?? []).reduce<
  Record<string, string | number | boolean>
>((acc, spec) => {
  acc[spec.key] = spec.defaultValue;
  return acc;
}, {});

function build(drawerBottomMode: "surface" | "rebated"): FurnitureDesign {
  return entry.template!({
    length: entry.defaults.length,
    width: entry.defaults.width,
    height: entry.defaults.height,
    material: "maple" as MaterialId,
    options: { ...baseOpts, drawerBottomMode },
  });
}

function rotateXYZ(rx: number, ry: number, rz: number, x: number, y: number, z: number) {
  const cosX = Math.cos(rx), sinX = Math.sin(rx);
  const cosY = Math.cos(ry), sinY = Math.sin(ry);
  const cosZ = Math.cos(rz), sinZ = Math.sin(rz);
  let X = x, Y = y, Z = z;
  let Y2 = Y * cosX - Z * sinX;
  let Z2 = Y * sinX + Z * cosX;
  Y = Y2; Z = Z2;
  let X2 = X * cosY + Z * sinY;
  Z2 = -X * sinY + Z * cosY;
  X = X2; Z = Z2;
  X2 = X * cosZ - Y * sinZ;
  Y2 = X * sinZ + Y * cosZ;
  X = X2; Y = Y2;
  return { x: X, y: Y, z: Z };
}

interface WorldMortise {
  partId: string;
  mIdx: number;
  entryX: number;
  entryY: number;
  entryZ: number;
  axis: "x" | "y" | "z";
  sign: 1 | -1;
  depth: number;
  length: number;
  width: number;
  through: boolean;
  cosmetic?: boolean;
  rawOrigin: { x: number; y: number; z: number };
  motherPart: Part;
}

function indexMortises(parts: Part[]): WorldMortise[] {
  const idx: WorldMortise[] = [];
  for (const part of parts) {
    if (!part.mortises || part.mortises.length === 0) continue;
    const rx = part.rotation?.x ?? 0;
    const ry = part.rotation?.y ?? 0;
    const rz = part.rotation?.z ?? 0;
    const lx = part.visible.length;
    const ly = part.visible.thickness;
    const lz = part.visible.width;
    const yExt = worldExtents(part).yExt;
    const pcx = part.origin.x;
    const pcy = part.origin.y + yExt / 2;
    const pcz = part.origin.z;
    for (let mIdx = 0; mIdx < part.mortises.length; mIdx++) {
      const m = part.mortises[mIdx];
      const yToFace = Math.min(Math.abs(m.origin.y), Math.abs(m.origin.y - ly));
      const xToFace = Math.min(Math.abs(m.origin.x - lx / 2), Math.abs(m.origin.x + lx / 2));
      const zToFace = Math.min(Math.abs(m.origin.z - lz / 2), Math.abs(m.origin.z + lz / 2));
      let lex = 0, ley = 0, lez = 0;
      let localAxis: "x" | "y" | "z";
      let localSign: 1 | -1;
      if (yToFace <= xToFace && yToFace <= zToFace) {
        localAxis = "y";
        localSign = m.origin.y >= ly - 1 ? 1 : -1;
        lex = m.origin.x; ley = localSign === 1 ? ly / 2 : -ly / 2; lez = m.origin.z;
      } else if (xToFace <= zToFace) {
        localAxis = "x";
        localSign = m.origin.x >= 0 ? 1 : -1;
        lex = localSign === 1 ? lx / 2 : -lx / 2; ley = m.origin.y - ly / 2; lez = m.origin.z;
      } else {
        localAxis = "z";
        localSign = m.origin.z >= 0 ? 1 : -1;
        lex = m.origin.x; ley = m.origin.y - ly / 2; lez = localSign === 1 ? lz / 2 : -lz / 2;
      }
      const e = rotateXYZ(rx, ry, rz, lex, ley, lez);
      const ax = localAxis === "x" ? localSign : 0;
      const ay = localAxis === "y" ? localSign : 0;
      const az = localAxis === "z" ? localSign : 0;
      const a = rotateXYZ(rx, ry, rz, ax, ay, az);
      const aX = Math.abs(a.x), aY = Math.abs(a.y), aZ = Math.abs(a.z);
      let worldAxis: "x" | "y" | "z";
      let worldSign: 1 | -1;
      if (aX >= aY && aX >= aZ) { worldAxis = "x"; worldSign = a.x >= 0 ? 1 : -1; }
      else if (aY >= aZ) { worldAxis = "y"; worldSign = a.y >= 0 ? 1 : -1; }
      else { worldAxis = "z"; worldSign = a.z >= 0 ? 1 : -1; }
      idx.push({
        partId: part.id, mIdx,
        entryX: pcx + e.x, entryY: pcy + e.y, entryZ: pcz + e.z,
        axis: worldAxis, sign: worldSign,
        depth: m.depth, length: m.length, width: m.width,
        through: m.through ?? false,
        cosmetic: m.cosmetic,
        rawOrigin: m.origin,
        motherPart: part,
      });
    }
  }
  return idx;
}

interface TenonInfo {
  partId: string;
  tIdx: number;
  position: string;
  type: string;
  length: number;
  width: number;
  thickness: number;
  rootX: number;
  rootY: number;
  rootZ: number;
  outAxis: "x" | "y" | "z";
  outSign: 1 | -1;
  ownerPart: Part;
}

function tenonInfos(parts: Part[]): TenonInfo[] {
  const out: TenonInfo[] = [];
  for (const part of parts) {
    if (!part.tenons || part.tenons.length === 0) continue;
    const rxP = part.rotation?.x ?? 0;
    const ryP = part.rotation?.y ?? 0;
    const rzP = part.rotation?.z ?? 0;
    const lx = part.visible.length, ly = part.visible.thickness, lz = part.visible.width;
    for (let tIdx = 0; tIdx < part.tenons.length; tIdx++) {
      const t = part.tenons[tIdx];
      const oW = (t as any).offsetWidth ?? 0;
      const oT = (t as any).offsetThickness ?? 0;
      let lrx = 0, lry = 0, lrz = 0;
      let lox = 0, loy = 0, loz = 0;
      switch (t.position) {
        case "start":  lrx = -lx / 2; lry = oT; lrz = oW; lox = -1; break;
        case "end":    lrx = +lx / 2; lry = oT; lrz = oW; lox = +1; break;
        case "top":    lrx = oW; lry = +ly / 2; lrz = oT; loy = +1; break;
        case "bottom": lrx = oW; lry = -ly / 2; lrz = oT; loy = -1; break;
        case "left":   lrx = oW; lry = oT; lrz = -lz / 2; loz = -1; break;
        case "right":  lrx = oW; lry = oT; lrz = +lz / 2; loz = +1; break;
      }
      const rRoot = rotateXYZ(rxP, ryP, rzP, lrx, lry, lrz);
      const rOut = rotateXYZ(rxP, ryP, rzP, lox, loy, loz);
      const yExt = worldExtents(part).yExt;
      const wRootX = part.origin.x + rRoot.x;
      const wRootY = part.origin.y + yExt / 2 + rRoot.y;
      const wRootZ = part.origin.z + rRoot.z;
      const aX = Math.abs(rOut.x), aY = Math.abs(rOut.y), aZ = Math.abs(rOut.z);
      let outAxis: "x" | "y" | "z";
      let outSign: 1 | -1;
      if (aX >= aY && aX >= aZ) { outAxis = "x"; outSign = rOut.x >= 0 ? 1 : -1; }
      else if (aY >= aZ) { outAxis = "y"; outSign = rOut.y >= 0 ? 1 : -1; }
      else { outAxis = "z"; outSign = rOut.z >= 0 ? 1 : -1; }
      out.push({
        partId: part.id, tIdx,
        position: t.position, type: t.type,
        length: t.length, width: t.width, thickness: t.thickness,
        rootX: wRootX, rootY: wRootY, rootZ: wRootZ,
        outAxis, outSign,
        ownerPart: part,
      });
    }
  }
  return out;
}

function pairTenon(t: TenonInfo, idx: WorldMortise[]): { m: WorldMortise | null; dist: number } {
  let best: WorldMortise | null = null;
  let bestDist = Infinity;
  for (const mw of idx) {
    if (mw.partId === t.partId) continue;
    if (mw.axis !== t.outAxis) continue;
    if (mw.sign === t.outSign) continue;
    const dx = mw.entryX - t.rootX;
    const dy = mw.entryY - t.rootY;
    const dz = mw.entryZ - t.rootZ;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d < bestDist && d < 50) { bestDist = d; best = mw; }
  }
  return { m: best, dist: bestDist };
}

function fmt(n: number) { return Math.round(n * 100) / 100; }

function dump(mode: "surface" | "rebated") {
  const design = build(mode);
  const drawerParts = design.parts.filter((p) => p.id.includes("drawer"));
  const idx = indexMortises(design.parts);
  const drawerIdx = idx.filter((m) => m.partId.includes("drawer"));
  const tInfos = tenonInfos(design.parts).filter((t) => t.partId.includes("drawer"));

  console.log(`\n========== drawerBottomMode = ${mode} ==========`);
  console.log(`\n--- DRAWER PARTS (${drawerParts.length}) ---`);
  for (const p of drawerParts) {
    const r = p.rotation ?? { x: 0, y: 0, z: 0 };
    console.log(
      `  ${p.id}  visible=${fmt(p.visible.length)}×${fmt(p.visible.width)}×${fmt(p.visible.thickness)}` +
      `  origin=(${fmt(p.origin.x)}, ${fmt(p.origin.y)}, ${fmt(p.origin.z)})` +
      `  rotation=(${fmt(r.x ?? 0)}, ${fmt(r.y ?? 0)}, ${fmt(r.z ?? 0)})`,
    );
  }

  console.log(`\n--- DRAWER TENONS (${tInfos.length}) ---`);
  for (const t of tInfos) {
    console.log(
      `  ${t.partId} [t${t.tIdx}] pos=${t.position} type=${t.type} ` +
      `L×W×T = ${fmt(t.length)}×${fmt(t.width)}×${fmt(t.thickness)}  ` +
      `root=(${fmt(t.rootX)},${fmt(t.rootY)},${fmt(t.rootZ)})  ` +
      `out=${t.outAxis}${t.outSign > 0 ? "+" : "-"}`,
    );
  }

  console.log(`\n--- DRAWER MORTISES (${drawerIdx.length}) ---`);
  for (const m of drawerIdx) {
    const tag = m.through ? " THROUGH" : "";
    const ctag = m.cosmetic ? " COSMETIC" : "";
    console.log(
      `  ${m.partId} [m${m.mIdx}] depth×L×W = ${fmt(m.depth)}×${fmt(m.length)}×${fmt(m.width)}${tag}${ctag}  ` +
      `rawOrigin=(${fmt(m.rawOrigin.x)},${fmt(m.rawOrigin.y)},${fmt(m.rawOrigin.z)})  ` +
      `entry=(${fmt(m.entryX)},${fmt(m.entryY)},${fmt(m.entryZ)})  axis=${m.axis}${m.sign > 0 ? "+" : "-"}`,
    );
  }

  console.log(`\n--- TENON ↔ MORTISE PAIRS ---`);
  const mismatches: string[] = [];
  for (const t of tInfos) {
    const { m, dist } = pairTenon(t, idx);
    if (!m) {
      console.log(`  ${t.partId}[t${t.tIdx}] ${t.position} ${t.type}  → NO MATCH (dist > 50mm)`);
      mismatches.push(`UNMATCHED: ${t.partId}[t${t.tIdx}] ${t.position} ${t.type} L=${t.length} W=${t.width} T=${t.thickness}`);
      continue;
    }
    // Compare dimensions
    const tEffLen = m.through ? t.length : Math.min(t.length, m.depth);
    // local-box for mortise to see actual cut size
    const lb = mortiseLocalBox(m.motherPart, m.motherPart.mortises[m.mIdx]);
    const mortiseLong = Math.max(m.length, m.width);
    const mortiseShort = Math.min(m.length, m.width);
    const tenonLong = Math.max(t.width, t.thickness);
    const tenonShort = Math.min(t.width, t.thickness);
    const longDiff = tenonLong - mortiseLong;
    const shortDiff = tenonShort - mortiseShort;
    const depthDiff = m.through ? 0 : t.length - m.depth;
    const status: string[] = [];
    if (Math.abs(longDiff) > 0.5) status.push(`LONG ${longDiff > 0 ? "+" : ""}${fmt(longDiff)}mm`);
    if (Math.abs(shortDiff) > 0.5) status.push(`SHORT ${shortDiff > 0 ? "+" : ""}${fmt(shortDiff)}mm`);
    if (!m.through && depthDiff > 0.5) status.push(`DEPTH +${fmt(depthDiff)}mm (tenon longer than mortise)`);
    if (dist > 5) status.push(`DIST ${fmt(dist)}mm`);
    const flag = status.length ? `  ⚠ ${status.join(", ")}` : "  ✓";
    console.log(
      `  ${t.partId}[t${t.tIdx}] ${t.position} (out=${t.outAxis}${t.outSign>0?"+":"-"})  →  PARTNER=${m.partId}[m${m.mIdx}] (axis=${m.axis}${m.sign>0?"+":"-"})  dist=${fmt(dist)}mm` +
      `\n      tenon  L×W×T = ${fmt(t.length)}×${fmt(t.width)}×${fmt(t.thickness)} (effLen=${fmt(tEffLen)})` +
      `\n      mort   d×L×W = ${fmt(m.depth)}×${fmt(m.length)}×${fmt(m.width)}${m.through ? " THROUGH" : ""}` +
      `\n      CSG box hx,hy,hz = ${fmt(lb.hx)},${fmt(lb.hy)},${fmt(lb.hz)}  cx,cy,cz=${fmt(lb.cx)},${fmt(lb.cy)},${fmt(lb.cz)}` +
      `${flag}`,
    );
    if (status.length) {
      mismatches.push(`MISMATCH ${t.partId}[t${t.tIdx}] vs ${m.partId}[m${m.mIdx}]: ${status.join(", ")}`);
    }
  }

  console.log(`\n--- SUMMARY ---`);
  if (mismatches.length === 0) console.log("  ✅ no mismatches");
  else for (const m of mismatches) console.log("  • " + m);
}

dump("surface");
dump("rebated");
