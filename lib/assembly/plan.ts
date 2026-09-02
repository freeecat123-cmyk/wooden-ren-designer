/**
 * 組裝動畫排程（docs/drafting-math.md §H8）。
 *
 * 輸入一份 FurnitureDesign，輸出「每個零件從哪裡、何時、沿哪個方向滑進定位」。
 * 順序不用模板手填：靠 joint-world.ts 把每支榫頭配到母件榫眼，就知道
 * 「誰插進誰、往哪個方向插」。
 *
 * 規則（§H8.1）：
 * 1. 先後順序 = 零件類別優先序（腳 → 牙條/橫撐 → 箱體板 → 層板/隔板 → 座板/靠背
 *    → 抽屜 → 門 → 其他），同類別再依高度（低的先）、id。
 * 2. 同一類別（抽屜/門再依「同一個抽屜/同一扇門」）合成一步，步內逐件錯開 120ms。
 * 3. 滑入方向：
 *    - 跟「已經放好的零件」之間有榫接 → 沿榫頭方向插入
 *      （自己是公榫：從 −out 滑到定位；自己是母件：從 +out 套上去）。
 *    - 多支榫頭方向互相打架（牙條兩端各插一支腳）→ 取「離家具中心往外」
 *      投影到垂直於榫軸的平面；投影太短（正中央的橫撐）→ 從上方落下。
 *    - 完全沒榫接（面板、五金、玻璃、第一步的腳）→ 離中心往外的方向；
 *      正在中心的 → 從上方落下。
 * 4. 位移量 = clamp(0.4 × 最大外形尺寸, 80, 450) mm，只影響視覺，不碰幾何。
 *
 * 純函式，無 three.js / React。每幀的位置由 `offsetsAt()` 算，
 * 3D 只改 group.position，零件幾何 / 材質一律不重建。
 */
import type { FurnitureDesign, Part } from "@/lib/types";
import { categorizePart, type PartCategory } from "@/lib/render/categorize-part";
import {
  buildWorldMortiseIndex,
  matchMortiseForTenon,
  partWorldCenter,
  tenonWorld,
  type Vec3,
} from "./joint-world";

export type MoveKind = "tenon" | "radial" | "drop";

export interface AssemblyMove {
  partId: string;
  /** t=0 時相對定位點的位移（mm）。動畫把它線性收斂到 0。 */
  from: Vec3;
  kind: MoveKind;
  stepIndex: number;
  startMs: number;
  endMs: number;
}

export interface AssemblyStep {
  index: number;
  partIds: string[];
  startMs: number;
  endMs: number;
}

export interface AssemblyPlan {
  steps: AssemblyStep[];
  moves: Record<string, AssemblyMove>;
  totalMs: number;
}

/** 每件滑入的時間 */
export const MOVE_MS = 900;
/** 同一步裡逐件錯開 */
export const STAGGER_MS = 120;
/** 步與步之間的停頓 */
export const STEP_GAP_MS = 250;
/** 最後一件到位後多停一下再算結束（錄影收尾用） */
export const TAIL_MS = 500;

const CATEGORY_RANK: Record<PartCategory, number> = {
  leg: 0,
  apron: 1,
  case: 2,
  divider: 3,
  seat: 4,
  drawer: 5,
  door: 6,
  misc: 7,
};

/**
 * 類別優先序，少數零件另外指定：椅背立柱（back-post）分類上是 misc，
 * 但結構上跟腳同級（靠背橫料 / 背板都插在它身上），要先立起來。
 */
function rankOf(id: string, cat: PartCategory): number {
  if (/^back-post/.test(id)) return CATEGORY_RANK.leg;
  return CATEGORY_RANK[cat];
}

function norm(v: Vec3): Vec3 {
  const m = Math.hypot(v.x, v.y, v.z);
  return m > 1e-9 ? { x: v.x / m, y: v.y / m, z: v.z / m } : { x: 0, y: 0, z: 0 };
}
function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
function scale(v: Vec3, k: number): Vec3 {
  return { x: v.x * k, y: v.y * k, z: v.z * k };
}
function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}
function len(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z);
}

/** 位移量：跟家具大小走，太小看不出來、太大鏡頭容不下。 */
export function travelMm(design: FurnitureDesign): number {
  const maxDim = Math.max(design.overall.length, design.overall.width, design.overall.thickness);
  return Math.min(450, Math.max(80, 0.4 * maxDim));
}

/** 抽屜 / 門的家族前綴（同一個抽屜的五塊板算一步） */
function familyKey(part: Part, cat: PartCategory): string {
  if (cat === "drawer") {
    const m = part.id.match(/^(.*?drawer-\d+)-/);
    if (m) return m[1];
  }
  if (cat === "door") {
    const m = part.id.match(/^(.*?door(?:-\d+)?)-/);
    if (m) return m[1];
  }
  return "";
}

/** 榫接邊：`child` 的榫頭沿 `out` 插進 `mother` */
interface JointEdge {
  child: string;
  mother: string;
  out: Vec3;
}

export function planAssembly(design: FurnitureDesign): AssemblyPlan {
  const parts = design.parts;
  const index = buildWorldMortiseIndex(parts);
  const edges: JointEdge[] = [];
  for (const part of parts) {
    for (const t of part.tenons) {
      if (t.length <= 0) continue;
      const tw = tenonWorld(part, t);
      const mw = matchMortiseForTenon(part, t, tw, index);
      if (!mw) continue;
      edges.push({ child: part.id, mother: mw.partId, out: tw.outUnit });
    }
  }

  // 家具中心：所有零件中心的平均（不用 overall，有些家具不是對稱擺在原點）
  const centers = new Map<string, Vec3>();
  const centroid = { x: 0, y: 0, z: 0 };
  for (const p of parts) {
    const c = partWorldCenter(p);
    centers.set(p.id, c);
    centroid.x += c.x; centroid.y += c.y; centroid.z += c.z;
  }
  if (parts.length > 0) {
    centroid.x /= parts.length; centroid.y /= parts.length; centroid.z /= parts.length;
  }

  // 1. 排序：類別優先序 → 家族 → 高度 → id
  const meta = parts.map((p) => {
    const cat = categorizePart(p.id);
    return { part: p, cat, rank: rankOf(p.id, cat), family: familyKey(p, cat), y: centers.get(p.id)!.y };
  });
  // 抽屜 / 門的「往外」以該抽屜自己的中心算：五塊板往抽屜中心合攏成一個箱子，
  // 而不是從整座櫃子的中心四散（那樣看起來像爆炸不像組裝）。
  const familyCentroid = new Map<string, Vec3>();
  {
    const acc = new Map<string, { s: Vec3; n: number }>();
    for (const m of meta) {
      if (!m.family) continue;
      const c = centers.get(m.part.id)!;
      const a = acc.get(m.family) ?? { s: { x: 0, y: 0, z: 0 }, n: 0 };
      a.s.x += c.x; a.s.y += c.y; a.s.z += c.z; a.n += 1;
      acc.set(m.family, a);
    }
    for (const [k, a] of acc) familyCentroid.set(k, { x: a.s.x / a.n, y: a.s.y / a.n, z: a.s.z / a.n });
  }
  const familyOf = new Map(meta.map((m) => [m.part.id, m.family] as const));
  meta.sort((a, b) =>
    a.rank - b.rank ||
    a.family.localeCompare(b.family) ||
    a.y - b.y ||
    a.part.id.localeCompare(b.part.id),
  );

  // 2. 分步：同 rank + 同家族一步
  const steps: AssemblyStep[] = [];
  let cur: { key: string; ids: string[] } | null = null;
  for (const m of meta) {
    const key = `${m.rank}|${m.family}`;
    if (!cur || cur.key !== key) {
      cur = { key, ids: [] };
      steps.push({ index: steps.length, partIds: cur.ids, startMs: 0, endMs: 0 });
    }
    cur.ids.push(m.part.id);
  }

  // 3. 方向 + 4. 時間
  const travel = travelMm(design);
  const moves: Record<string, AssemblyMove> = {};
  const placed = new Set<string>();
  let clock = 0;
  for (const step of steps) {
    step.startMs = clock;
    step.partIds.forEach((id, i) => {
      const center = centers.get(id)!;
      const fam = familyOf.get(id);
      const origin = (fam && familyCentroid.get(fam)) || centroid;
      const { dir, kind } = insertionDirection(id, center, origin, edges, placed);
      const startMs = step.startMs + i * STAGGER_MS;
      moves[id] = {
        partId: id,
        from: scale(dir, -travel),   // 從 −dir × travel 滑到 0（dir = 插入方向）
        kind,
        stepIndex: step.index,
        startMs,
        endMs: startMs + MOVE_MS,
      };
    });
    for (const id of step.partIds) placed.add(id);
    step.endMs = step.startMs + (step.partIds.length - 1) * STAGGER_MS + MOVE_MS;
    clock = step.endMs + STEP_GAP_MS;
  }
  const totalMs = steps.length > 0 ? steps[steps.length - 1].endMs + TAIL_MS : 0;
  return { steps, moves, totalMs };
}

/**
 * 決定一件零件的「插入方向」（單位向量，零件沿它滑到定位）。
 * 只看跟已放好零件之間的榫接；還沒放的當不存在。
 */
function insertionDirection(
  id: string,
  center: Vec3,
  centroid: Vec3,
  edges: JointEdge[],
  placed: Set<string>,
): { dir: Vec3; kind: MoveKind } {
  const dirs: Vec3[] = [];
  for (const e of edges) {
    if (e.child === id && placed.has(e.mother)) dirs.push(e.out);           // 我是公榫：沿 out 插入
    else if (e.mother === id && placed.has(e.child)) dirs.push(scale(e.out, -1)); // 我是母件：反向套上
  }
  const radialRaw = norm(sub(center, centroid));
  const radial = flattenIfMostlyHorizontal(radialRaw);
  if (dirs.length > 0) {
    // 同向合力；互相打架（合力太短）→ 垂直於榫軸往外
    const sum = dirs.reduce((a, d) => ({ x: a.x + d.x, y: a.y + d.y, z: a.z + d.z }), { x: 0, y: 0, z: 0 });
    if (len(sum) > 0.5 * dirs.length) return { dir: norm(sum), kind: "tenon" };
    const axis = norm(dirs[0]);
    let perp = sub(radialRaw, scale(axis, dot(radialRaw, axis)));
    // 榫軸是水平的（牙條 / 橫撐）→ 零件本身躺平，一律水平滑進，不斜飛
    if (Math.abs(axis.y) < 0.5) perp = { x: perp.x, y: 0, z: perp.z };
    if (len(perp) > 0.25) return { dir: scale(norm(perp), -1), kind: "radial" };
    return { dir: { x: 0, y: -1, z: 0 }, kind: "drop" };
  }
  if (len(radial) > 0.25) return { dir: scale(radial, -1), kind: "radial" };
  return { dir: { x: 0, y: -1, z: 0 }, kind: "drop" };
}

/**
 * 「往外」的方向若主要是水平的，就把垂直分量拿掉：四支腳從四周水平合攏、
 * 牙條水平滑進，看起來才像人在組裝；主要是垂直的（桌面、底板）保留，
 * 從上/下方落下。門檻 0.7 = 約 44° 以內算水平。
 */
function flattenIfMostlyHorizontal(v: Vec3): Vec3 {
  if (Math.abs(v.y) < 0.7 && Math.hypot(v.x, v.z) > 1e-6) return norm({ x: v.x, y: 0, z: v.z });
  return v;
}

export function easeInOutCubic(p: number): number {
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}

/** 某個時間點每件零件相對定位的位移（mm）。到位的零件不會出現在結果裡。 */
export function offsetsAt(plan: AssemblyPlan, tMs: number): Map<string, Vec3> {
  const out = new Map<string, Vec3>();
  for (const id in plan.moves) {
    const m = plan.moves[id];
    if (tMs >= m.endMs) continue;
    const p = tMs <= m.startMs ? 0 : (tMs - m.startMs) / (m.endMs - m.startMs);
    const k = 1 - easeInOutCubic(p);
    out.set(id, scale(m.from, k));
  }
  return out;
}

/** 目前播放到第幾步（0-based；超過尾端回最後一步） */
export function stepIndexAt(plan: AssemblyPlan, tMs: number): number {
  let idx = 0;
  for (const s of plan.steps) {
    if (tMs >= s.startMs) idx = s.index;
  }
  return idx;
}
