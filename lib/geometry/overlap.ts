import type { Part } from "@/lib/types";
import { projectPartSilhouette, worldExtents } from "@/lib/render/geometry";
import { partAabbAtY, precomputeSilhouettes, sliceOverlapAtY } from "@/lib/geometry/y-slice";
import { profileWidthAt, sweptSurfaceRings } from "@/lib/geometry/swept-curve";
import { obstacleInShelf } from "./shelf-clearance";
import { mortiseLocalBox } from "@/lib/render/svg-views";
import { Euler, Vector3 } from "three";
import { separatedFromTurnedColumn } from "./turned-column-clearance";
import { constructionCutBox, constructionCutsCoverPair, constructionLimits, constructionStockBounds } from "./construction-cuts";
import { clearedByRenderedDovetail } from "./dovetail-clearance";
import { clearedByHoofSections } from "./hoof-clearance";
import { clearedByCabinetPanelGrooves } from "./cabinet-panel-clearance";

const AXES = ["x", "y", "z"] as const;
const CUT_EPSILON = 0.001;

function rectangularWorldCuts(part: Part, bounds: AABB3D): AABB3D[] {
  // Restrict to undeformed stock and quarter turns. Confirm the renderer's
  // transformed stock agrees with the audit bounds before trusting its cuts.
  if (part.shape && !["box", "mitered-ends", "chamfered-edges", "dovetail-ends"].includes(part.shape.kind)) return [];
  if (part.shape?.kind === "mitered-ends"
    && (part.shape.tiltAngle || part.shape.bevelAngle || part.shape.vertices)) return [];
  const angles = AXES.map(axis => part.rotation?.[axis] ?? 0);
  if (angles.some(a => !Number.isFinite(a) || Math.abs(a / (Math.PI / 2) - Math.round(a / (Math.PI / 2))) > 1e-8)) return [];
  const rotation = new Euler(angles[0], angles[1], angles[2], "ZYX");
  const center = new Vector3(part.origin.x, part.origin.y + worldExtents(part).yExt / 2, part.origin.z);
  const halfAxes = [new Vector3(part.visible.length / 2, 0, 0), new Vector3(0, part.visible.thickness / 2, 0), new Vector3(0, 0, part.visible.width / 2)]
    .map(v => v.applyEuler(rotation));
  if (AXES.some(axis => {
    const extent = halfAxes.reduce((sum, v) => sum + Math.abs(v[axis]), 0);
    return Math.abs(center[axis] - extent - bounds.min[axis]) > CUT_EPSILON
      || Math.abs(center[axis] + extent - bounds.max[axis]) > CUT_EPSILON;
  })) return [];
  return part.mortises.filter(m => m.cosmetic && m.shape !== "round"
    && !m.rotX && !m.rotY && !m.rotZ && !m.axis && !(m.label ?? "").startsWith("百葉槽")).flatMap(m => {
    const b = mortiseLocalBox(part, m);
    if (![b.cx, b.cy, b.cz, b.hx, b.hy, b.hz].every(Number.isFinite) || Math.min(b.hx, b.hy, b.hz) <= 0) return [];
    const corners: Vector3[] = [];
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
      corners.push(new Vector3(b.cx + x * b.hx, b.cy + y * b.hy, b.cz + z * b.hz).applyEuler(rotation).add(center));
    }
    return [{
      min: { x: Math.min(...corners.map(p => p.x)), y: Math.min(...corners.map(p => p.y)), z: Math.min(...corners.map(p => p.z)) },
      max: { x: Math.max(...corners.map(p => p.x)), y: Math.max(...corners.map(p => p.y)), z: Math.max(...corners.map(p => p.z)) },
    }];
  });
}

function clearedByRectangularCuts(a: Part, b: Part, boxA: AABB3D, boxB: AABB3D): boolean {
  const cutsA = rectangularWorldCuts(a, boxA), cutsB = rectangularWorldCuts(b, boxB);
  if (!cutsA.length && !cutsB.length) return false;
  const min = { x: Math.max(boxA.min.x, boxB.min.x), y: Math.max(boxA.min.y, boxB.min.y), z: Math.max(boxA.min.z, boxB.min.z) };
  const max = { x: Math.min(boxA.max.x, boxB.max.x), y: Math.min(boxA.max.y, boxB.max.y), z: Math.min(boxA.max.z, boxB.max.z) };
  // A ∩ B is empty only if cuts from either stock cover the entire intersection.
  // Require complete cross-sections; disconnected/mosaic cuts stay conservative.
  return AXES.some(axis => {
    const intervals = [...cutsA, ...cutsB].filter(cut => AXES.every(other => other === axis
      || (cut.min[other] <= min[other] + CUT_EPSILON && cut.max[other] >= max[other] - CUT_EPSILON)))
      .map(cut => [Math.max(min[axis], cut.min[axis]), Math.min(max[axis], cut.max[axis])])
      .filter(([start, end]) => end > start).sort((a, b) => a[0] - b[0]);
    let covered = min[axis];
    for (const [start, end] of intervals) {
      if (start > covered + CUT_EPSILON) return false;
      covered = Math.max(covered, end);
      if (covered >= max[axis] - CUT_EPSILON) return true;
    }
    return false;
  });
}

function clearedByThroughCut(part: Part, obstacle: Part): boolean {
  const cornerShape = part.shape?.kind === "notched-corners" ? part.shape : null;
  if (!cornerShape && !part.mortises.some(m => m.cosmetic && m.through && m.shape !== "round")) return false;
  const bounds = obstacleInShelf(part, obstacle);
  if (!bounds) return false;
  if (cornerShape) {
    const { notchLengthMm: length, notchWidthMm: width } = cornerShape;
    // Only recognize the range where both 2D and 3D use the requested cut size.
    // Their extreme-size clamps differ; do not silently approve that ambiguity.
    if (length > 0 && width > 0 && length <= part.visible.length * 0.45 && width <= part.visible.width * 0.45) {
      const hx = part.visible.length / 2, hz = part.visible.width / 2;
      const inEndX = bounds.maxX <= -hx + length + 0.001 || bounds.minX >= hx - length - 0.001;
      const inEndZ = bounds.maxZ <= -hz + width + 0.001 || bounds.minZ >= hz - width - 0.001;
      if (inEndX && inEndZ) return true;
    }
  }
  return part.mortises.some(m => {
    if (!m.cosmetic || !m.through || m.shape === "round" || m.rotX || m.rotY || m.rotZ) return false;
    const box = mortiseLocalBox(part, m);
    if (box.depthAxis !== "y" || box.hy * 2 < part.visible.thickness - 0.001 || Math.abs(box.cy) > 0.001) return false;
    return box.cx - box.hx <= bounds.minX + 0.001 && box.cx + box.hx >= bounds.maxX - 0.001
      && box.cz - box.hz <= bounds.minZ + 0.001 && box.cz + box.hz >= bounds.maxZ - 0.001;
  });
}

export interface AABB3D {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

interface V3 {
  x: number;
  y: number;
  z: number;
}

interface OBB {
  /** mesh 在世界座標的中心點（= origin.x, origin.y + yExt/2, origin.z） */
  center: V3;
  /** 3 個正交單位向量（local X/Y/Z 軸經過 rotation 後的世界方向） */
  axes: [V3, V3, V3];
  /** 3 軸 half-extent (visible.length/2, visible.thickness/2, visible.width/2) */
  halfExtents: [number, number, number];
}

export interface Overlap {
  a: string;
  b: string;
  intersectionMm: { x: number; y: number; z: number };
  worstAxis: "x" | "y" | "z";
}

/**
 * 估算零件世界座標 AABB。
 *
 * 用 front + top + side 三個視圖的 silhouette polygon 取 min/max 拼出 3D AABB。
 * projectPartSilhouette 已經處理：
 *   - 正常 box / 旋轉
 *   - tapered / splayed / splayed-tapered（外斜底面偏移）
 *   - apron-trapezoid（梯形牙條）
 *   - apron-beveled（傾斜牙條）
 *   - arch-bent / face-rounded / tilt-z
 *   - 圓料（round / round-tapered / lathe-turned）
 *
 * 投影座標慣例（見 lib/render/geometry.ts pushPoint）：
 *   front: vx = -worldX, vy = worldY
 *   side:  vx = -worldZ, vy = worldY   ← 是負的(geometry.ts:422)。這裡本來寫成
 *                                          `vx = worldZ`,取 min/max 對稱所以沒出錯,
 *                                          但照抄去量「單一面」會看到反面。
 *   top:   vx = -worldX, vy = worldZ
 *
 * 因此 worldX 從 front 或 top 的 -vx 取，worldY 從 front/side 的 vy 取，worldZ
 * 從 top 的 vy 或 side 的 -vx 取。
 */
export function worldAABB(part: Part): AABB3D {
  const front = projectPartSilhouette(part, "front");
  const side = projectPartSilhouette(part, "side");
  const top = projectPartSilhouette(part, "top");
  const xs = [...front.map((p) => -p.x), ...top.map((p) => -p.x)];
  const ys = [...front.map((p) => p.y), ...side.map((p) => p.y)];
  const zs = [...top.map((p) => p.y), ...side.map((p) => -p.x)];
  return {
    min: { x: Math.min(...xs), y: Math.min(...ys), z: Math.min(...zs) },
    max: { x: Math.max(...xs), y: Math.max(...ys), z: Math.max(...zs) },
  };
}

export function aabbIntersection(
  a: AABB3D,
  b: AABB3D,
): { x: number; y: number; z: number } | null {
  const minX = Math.max(a.min.x, b.min.x);
  const maxX = Math.min(a.max.x, b.max.x);
  if (maxX <= minX) return null;
  const minY = Math.max(a.min.y, b.min.y);
  const maxY = Math.min(a.max.y, b.max.y);
  if (maxY <= minY) return null;
  const minZ = Math.max(a.min.z, b.min.z);
  const maxZ = Math.min(a.max.z, b.max.z);
  if (maxZ <= minZ) return null;
  return { x: maxX - minX, y: maxY - minY, z: maxZ - minZ };
}

/**
 * 從 Part 算出 OBB（Oriented Bounding Box，含旋轉）。
 *
 * 中心對齊 PerspectiveView 渲染慣例：mesh.position = (origin.x,
 * origin.y + yExt/2, origin.z)，yExt 來自 worldExtents（quarter rotation 精
 * 確、非 quarter 用 unrotated 近似——這跟 renderer 一致）。
 */
export function obbFromPart(part: Part): OBB {
  const rx = part.rotation?.x ?? 0;
  const ry = part.rotation?.y ?? 0;
  const rz = part.rotation?.z ?? 0;
  const cx = Math.cos(rx),
    sx = Math.sin(rx);
  const cy = Math.cos(ry),
    sy = Math.sin(ry);
  const cz = Math.cos(rz),
    sz = Math.sin(rz);
  // Three.js Euler order='XYZ': v' = Rx * Ry * Rz * v（先繞 Z、再 Y、再 X）
  const rotate = (x: number, y: number, z: number): V3 => {
    // Rz
    const x1 = x * cz - y * sz;
    const y1 = x * sz + y * cz;
    const z1 = z;
    // Ry
    const x2 = x1 * cy + z1 * sy;
    const y2 = y1;
    const z2 = -x1 * sy + z1 * cy;
    // Rx
    const x3 = x2;
    const y3 = y2 * cx - z2 * sx;
    const z3 = y2 * sx + z2 * cx;
    return { x: x3, y: y3, z: z3 };
  };
  const { yExt } = worldExtents(part);
  return {
    center: {
      x: part.origin.x,
      y: part.origin.y + yExt / 2,
      z: part.origin.z,
    },
    axes: [rotate(1, 0, 0), rotate(0, 1, 0), rotate(0, 0, 1)],
    halfExtents: [
      part.visible.length / 2,
      part.visible.thickness / 2,
      part.visible.width / 2,
    ],
  };
}

const cross = (a: V3, b: V3): V3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const dot = (a: V3, b: V3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a: V3): number => Math.hypot(a.x, a.y, a.z);

/**
 * Project an OBB onto a unit vector axis. Returns { min, max } interval.
 *   center 在軸上的投影 c = center · axis
 *   半徑 r = Σ |axis_i · axis| × halfExtent_i
 *   interval = [c - r, c + r]
 */
function projectOBB(obb: OBB, axis: V3): { min: number; max: number } {
  const c = dot(obb.center, axis);
  const r =
    Math.abs(dot(obb.axes[0], axis)) * obb.halfExtents[0] +
    Math.abs(dot(obb.axes[1], axis)) * obb.halfExtents[1] +
    Math.abs(dot(obb.axes[2], axis)) * obb.halfExtents[2];
  return { min: c - r, max: c + r };
}

/**
 * 3D OBB 相交檢查（Separating Axis Theorem）。
 *
 * 15 條候選 separating axis：
 *   - A 的 3 個面法線 (= A 的軸)
 *   - B 的 3 個面法線
 *   - 9 個 A_i × B_j 的 cross product
 * 任一軸找到 separating（交集 ≤ tolerance）→ 不相交。
 */
export function obbIntersect(a: OBB, b: OBB, toleranceMm = 1): boolean {
  const axes: V3[] = [a.axes[0], a.axes[1], a.axes[2], b.axes[0], b.axes[1], b.axes[2]];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const c = cross(a.axes[i], b.axes[j]);
      const l = len(c);
      if (l < 1e-6) continue; // 平行軸跳過
      axes.push({ x: c.x / l, y: c.y / l, z: c.z / l });
    }
  }
  for (const axis of axes) {
    const pa = projectOBB(a, axis);
    const pb = projectOBB(b, axis);
    const overlap = Math.min(pa.max, pb.max) - Math.max(pa.min, pb.min);
    if (overlap <= toleranceMm) return false; // 找到 separating axis
  }
  return true;
}

/**
 * 偵測零件互相 overlap。
 *
 * 三階段檢查：
 *   1. AABB 體積相交（快速 reject 遠方對；用 silhouette 拼出的 world AABB）
 *   2. Y-segmented silhouette contact（drafting-math §A11 D.2）：在 Y 交集
 *      區間採樣 N 層，每層用 front silhouette 取 X 區間 + side silhouette 取
 *      Z 區間 = 該層 AABB-at-Y。任一層 X∩Z 都 > tolerance 才算真 overlap。
 *      tapered/splayed 腳的截面隨 Y 變化會自動反映在每層 AABB-at-Y。
 *   3. OBB SAT 備援（保留以防 silhouette 退化或非 quarter 旋轉沒覆蓋到的
 *      case，但目前 Stage 2 通過後會直接接受結果）。
 *
 * 過濾規則：任一軸交集 ≤ tolerance 視為「面對面 butt joint 貼合」（容許
 * 浮點誤差），不算 overlap。要 3 軸都有實質交集才算「真的穿模」。
 *
 * 玻璃片（visual="glass"）跳過：玻璃裝在門框內、層板上是設計上正常重疊。
 */
const Y_SLICE_SAMPLES: number = 24;

/**
 * swept-curve 曲料的逐站「有向」小盒子（世界座標；每站一個，沿切線 T 的長度 = 到下一站的距離，
 * 斷面半寬 hw（沿 N）、半厚 hb（沿 B）＝該站斷面）。
 *
 * 為什麼不用 Y-slice：「front X 區間 × side Z 區間」對彎曲的椅圈是整條弧的外接矩形——
 * 後高前低的扶手在某個高度同時出現在 z=−340（鱔魚頭）和 z=−140（聯幫棍頂），拼出來的
 * AABB 把弧內側整塊算成木頭，聯幫棍頂貼在扶手底卻被報成穿模 4mm；改成逐站 AABB 又會把
 * 傾斜接觸面（柱頂貼在下降的扶手底、棖端貼在收分腿面）的薄薄一層算成整層重疊（2026-09-23 實測）。
 * 所以曲料改量「真正的穿深」：對方的表面採樣點鑽進這些有向小盒子多深，> tolerance 才算穿模。
 */
type Vec3 = V3;
type StationBox = { c: Vec3; T: Vec3; N: Vec3; B: Vec3; hl: number; hw: number; hb: number };

function sweptStationBoxes(part: Part): StationBox[] {
  if (part.shape?.kind !== "swept-curve") return [];
  const shape = part.shape;
  const surf = sweptSurfaceRings(shape);
  const yOff = part.origin.y + part.visible.thickness / 2;
  const n = surf.sample.points.length;
  const total = surf.sample.s[n - 1] || 1;
  const out: StationBox[] = [];
  for (let i = 0; i + 1 < n; i++) {
    const a = surf.sample.points[i], b = surf.sample.points[i + 1];
    const d = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const L = Math.hypot(d.x, d.y, d.z);
    if (L < 1e-9) continue;
    const T = { x: d.x / L, y: d.y / L, z: d.z / L };
    const { N, B } = surf.frames[i];
    const t01 = (surf.sample.s[i] + surf.sample.s[i + 1]) / 2 / total;
    const w = profileWidthAt(shape.profile, t01) / 2;
    const hb = shape.profile.type === "round" ? w : shape.profile.thickness / 2;
    out.push({
      c: { x: part.origin.x + (a.x + b.x) / 2, y: yOff + (a.y + b.y) / 2, z: part.origin.z + (a.z + b.z) / 2 },
      T, N, B, hl: L / 2, hw: w, hb,
    });
  }
  return out;
}

/** 曲料的表面採樣點（世界）——當「對方」的探針 */
function sweptSurfacePoints(part: Part): Vec3[] {
  if (part.shape?.kind !== "swept-curve") return [];
  const surf = sweptSurfaceRings(part.shape);
  const yOff = part.origin.y + part.visible.thickness / 2;
  const out: Vec3[] = [];
  for (const st of surf.rings) for (const loop of st) for (const q of loop) {
    out.push({ x: part.origin.x + q.x, y: yOff + q.y, z: part.origin.z + q.z });
  }
  return out;
}

/** 點鑽進曲料有向小盒子的深度（0 = 在外面） */
function penetrationIntoSwept(boxes: StationBox[], p: Vec3): number {
  let best = 0;
  for (const bx of boxes) {
    const d = { x: p.x - bx.c.x, y: p.y - bx.c.y, z: p.z - bx.c.z };
    const dl = bx.hl - Math.abs(d.x * bx.T.x + d.y * bx.T.y + d.z * bx.T.z);
    if (dl <= 0) continue;
    const dn = bx.hw - Math.abs(d.x * bx.N.x + d.y * bx.N.y + d.z * bx.N.z);
    if (dn <= 0) continue;
    const db = bx.hb - Math.abs(d.x * bx.B.x + d.y * bx.B.y + d.z * bx.B.z);
    if (db <= 0) continue;
    // 沿切線方向的「深度」不算（那是相鄰站的木頭），只看斷面方向
    const pen = Math.min(dn, db);
    if (pen > best) best = pen;
  }
  return best;
}

/** 點鑽進直料（用它 front/side silhouette 在該高度的 XZ-AABB）的深度（0 = 在外面） */
function penetrationIntoSlices(front: V2s, side: V2s, p: Vec3): number {
  const a = partAabbAtY(front, side, p.y);
  if (!a) return 0;
  const dx = Math.min(p.x - a.x[0], a.x[1] - p.x);
  const dz = Math.min(p.z - a.z[0], a.z[1] - p.z);
  if (dx <= 0 || dz <= 0) return 0;
  return Math.min(dx, dz);
}

type V2s = Array<{ x: number; y: number }>;
type OverlapEntry = { id: string; aabb: AABB3D; front: V2s; side: V2s; stations: StationBox[]; probes: Vec3[]; part: Part };

/** 有曲料的一對：雙向量穿深（A 的探針鑽進 B、B 的探針鑽進 A），回傳最大值 */
function curvedPairPenetration(a: OverlapEntry, b: OverlapEntry, yMin: number, yMax: number): number {
  const inY = (p: Vec3) => p.y >= yMin - 1 && p.y <= yMax + 1;
  let best = 0;
  const probe = (from: OverlapEntry, into: OverlapEntry) => {
    const pts = from.probes.length ? from.probes : boxProbePoints(from.part);
    for (const p of pts) {
      if (!inY(p)) continue;
      const pen = into.stations.length ? penetrationIntoSwept(into.stations, p) : penetrationIntoSlices(into.front, into.side, p);
      if (pen > best) best = pen;
    }
  };
  probe(a, b);
  probe(b, a);
  return best;
}

/** 直料當探針：用它的 front/side silhouette 頂點反推世界點不可靠，改用 OBB 的 8 角 + 12 邊中點 + 6 面中心 */
function boxProbePoints(part: Part): Vec3[] {
  const o = obbFromPart(part);
  const pts: Vec3[] = [];
  const at = (u: number, v: number, w: number): Vec3 => ({
    x: o.center.x + o.axes[0].x * u * o.halfExtents[0] + o.axes[1].x * v * o.halfExtents[1] + o.axes[2].x * w * o.halfExtents[2],
    y: o.center.y + o.axes[0].y * u * o.halfExtents[0] + o.axes[1].y * v * o.halfExtents[1] + o.axes[2].y * w * o.halfExtents[2],
    z: o.center.z + o.axes[0].z * u * o.halfExtents[0] + o.axes[1].z * v * o.halfExtents[1] + o.axes[2].z * w * o.halfExtents[2],
  });
  for (const u of [-1, 0, 1]) for (const v of [-1, 0, 1]) for (const w of [-1, 0, 1]) {
    if (u === 0 && v === 0 && w === 0) continue;
    pts.push(at(u, v, w));
  }
  return pts;
}

export function findOverlaps(parts: Part[], toleranceMm = 1): Overlap[] {
  const candidates = parts.filter((p) => p.visual !== "glass");
  const entries: OverlapEntry[] = candidates.map((p) => {
    const sil = precomputeSilhouettes(p);
    return {
      id: p.id,
      aabb: worldAABB(p),
      front: sil.front,
      side: sil.side,
      stations: sweptStationBoxes(p),
      probes: sweptSurfacePoints(p),
      part: p,
    };
  });
  const overlaps: Overlap[] = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i];
      const b = entries[j];
      // Stage 1: AABB volume intersection (fast reject)
      const inter = aabbIntersection(a.aabb, b.aabb);
      if (!inter) continue;
      if (
        inter.x <= toleranceMm ||
        inter.y <= toleranceMm ||
        inter.z <= toleranceMm
      )
        continue;
      // Stage 2: Y-segmented silhouette contact check.
      // 在 Y 交集區間 [yMin+ε, yMax-ε] 採樣 N 層（含端點微內縮，避免端點貼合
      // 浮點誤判）；任一層 X∩Z 都 > tolerance 即視為真 overlap，記錄該層的
      // 最大穿深（worst layer）。
      const yMin = Math.max(a.aabb.min.y, b.aabb.min.y);
      const yMax = Math.min(a.aabb.max.y, b.aabb.max.y);
      const ySpan = yMax - yMin;
      if (ySpan <= toleranceMm) continue;
      const yPad = Math.min(0.05, ySpan * 0.01);
      let worstX = 0;
      let worstZ = 0;
      let worstY = 0;
      let foundLayer = false;
      for (let k = 0; k < Y_SLICE_SAMPLES; k++) {
        const t = Y_SLICE_SAMPLES === 1 ? 0.5 : k / (Y_SLICE_SAMPLES - 1);
        const h = yMin + yPad + (ySpan - 2 * yPad) * t;
        const layer = sliceOverlapAtY(
          a.front,
          a.side,
          b.front,
          b.side,
          h,
          toleranceMm,
        );
        if (!layer) continue;
        foundLayer = true;
        // 該層 Y 厚度貢獻：相鄰兩 sample 中點到中點 = ySpan / (N-1)，但為了
        // 給 worstAxis 一個合理的 Y 數值，直接用「Y 交集」的尺寸（保守上限）。
        if (layer.x > worstX) worstX = layer.x;
        if (layer.z > worstZ) worstZ = layer.z;
      }
      if (!foundLayer) continue;
      // 有曲料的一對：Y-slice 的 AABB 對弧形／傾斜接觸面會誤報（見 sweptStationBoxes 註解），
      // 改用真正的穿深判定；直料對直料維持原本行為（其他家具 byte 不變）。
      if (a.stations.length || b.stations.length) {
        const pen = curvedPairPenetration(a, b, yMin, yMax);
        if (pen <= toleranceMm) continue;
        worstX = Math.max(worstX, pen);
        worstZ = Math.max(worstZ, pen);
      }
      // A rejected aggregate excavation must not be re-approved by a later
      // legacy cutter/shape proof. Keep the candidate visible for review.
      const unsafeConstruction = [candidates[i], candidates[j]].some(p => constructionLimits(p).issues.length > 0);
      if (!unsafeConstruction) {
        if (clearedByCabinetPanelGrooves(candidates[i], candidates[j]) || clearedByCabinetPanelGrooves(candidates[j], candidates[i])) continue;
        if (clearedByHoofSections(candidates[i], candidates[j]) || clearedByHoofSections(candidates[j], candidates[i])) continue;
        if (clearedByRenderedDovetail(candidates[i], candidates[j]) || clearedByRenderedDovetail(candidates[j], candidates[i])) continue;
        if ([candidates[i], candidates[j]].some(p => p.mortises.some(m => constructionCutBox(m)))) {
          const intersection = constructionStockBounds(candidates[i]).intersect(constructionStockBounds(candidates[j]));
          if (!intersection.isEmpty() && constructionCutsCoverPair(candidates[i], candidates[j], intersection)) continue;
        }
        if (separatedFromTurnedColumn(candidates[i], candidates[j], yMin, yMax)
          || separatedFromTurnedColumn(candidates[j], candidates[i], yMin, yMax)) continue;
        // Reject only when the actual rectangular through-cut covers the entire overlap.
        if (clearedByThroughCut(candidates[i], candidates[j]) || clearedByThroughCut(candidates[j], candidates[i])) continue;
        if (clearedByRectangularCuts(candidates[i], candidates[j], a.aabb, b.aabb)) continue;
      }
      worstY = ySpan;
      const minDim = Math.min(worstX, worstY, worstZ);
      const worstAxis: "x" | "y" | "z" =
        worstX === minDim ? "x" : worstY === minDim ? "y" : "z";
      overlaps.push({
        a: a.id,
        b: b.id,
        intersectionMm: {
          x: Math.round(worstX * 10) / 10,
          y: Math.round(worstY * 10) / 10,
          z: Math.round(worstZ * 10) / 10,
        },
        worstAxis,
      });
    }
  }
  return overlaps;
}
