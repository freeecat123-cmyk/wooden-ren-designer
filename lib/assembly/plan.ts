/**
 * 組裝動畫排程（docs/drafting-math.md §H8）。
 *
 * 輸入一份 FurnitureDesign（要帶榫頭／榫眼——組裝版請餵 toBeginnerMode 之前的
 * 原始設計），輸出「每個零件（或子組件）從哪裡、何時、沿哪個方向滑進定位」。
 *
 * 核心：**零件只能沿榫的軸向插入**。牙條兩端各有一支榫、分別插進兩支腳，
 * 它不可能側著塞進兩支已經站好的腳；真實組法是「先組一面框（腳 → 牙條沿軸
 * 插入 → 另一支腳套上），側牙條插進去，另一面框整組滑上來，最後座板從上方壓下」。
 * （2026-09-02 木頭仁回報第一版「沒考慮到榫卯的組合方向」，就是這個。）
 *
 * 作法 = 拆解反推（assembly-by-disassembly，§H8.1）：
 * 1. 對目前這堆零件 S，找一個子集合 G 和方向 d，使得「G 沿 d 平移離開」時，
 *    所有跨越 G / 其餘 的榫接都平行於 d 且方向正確（公榫件往 −out、母件往 +out）。
 *    做法：把不平行於 d 的榫接當成「黏死」的邊做連通分量，再從每個分量出發做閉包。
 * 2. 挑「最該先拆」的 G：優先序低的先（五金 → 門 → 抽屜 → 座板 → 層板 → 箱體板
 *    → 牙條 → 腳），件數少的先，含錨件（優先序最高、id 最小的那件）的最後拆；
 *    同方向、互不相鄰、同優先序的其他候選一起拆（四支側牙條同一步）。
 * 3. 拆掉的 G 遞迴再拆；剩下的 S∖G 遞迴再拆。得到一棵樹。
 * 4. 組裝 = 樹的後序反轉：先組好「剩下的」、再在爆炸位置組好 G、最後 G 整組沿 −d 滑入。
 * 5. 沒有任何榫接跨越（S 本身不連通）：G = 一個連通分量，方向 = 六個軸向裡
 *    「離 S 中心往外」且**掃過去不會撞到別的零件**的那個（層板不准從背板穿過來；
 *    2026-09-02 木頭仁回報）。
 * 6. 抽屜 / 門（同一個 family 前綴）永遠當一個單位：在外面組好再整組滑進櫃體
 *    （2026-09-02 木頭仁：「抽屜跟櫃門應該是在外面組合好 再一起滑進櫃體」）。
 * 7. 找不到合法拆法（榫接互鎖）：硬拆優先序最低的一件，標 `forced`。
 *
 * 組裝版（`screws: true`）：每個榫接「合上」的那一步之後，從母件外側鎖入螺絲
 * （母件沿軸厚度 + 30mm，榫寬 ≥ 40 排兩支），螺絲在鎖入前隱藏。
 *
 * 純函式、無 three.js / React；在 server component 算好傳給 3D 就行。
 * 每幀位置由 `offsetsAt()` 給，3D 只改 group.position。
 */
import type { FurnitureDesign, Part } from "@/lib/types";
import { categorizePart, type PartCategory } from "@/lib/render/categorize-part";
import { worldExtents } from "@/lib/render/geometry";
import {
  buildWorldMortiseIndex,
  matchMortiseForTenon,
  partWorldCenter,
  rotateXYZ,
  tenonWorld,
  type Vec3,
} from "./joint-world";

export type MoveKind = "appear" | "join" | "forced" | "screw";

export interface AssemblyMove {
  kind: MoveKind;
  /** 一起動的零件（或螺絲）id */
  partIds: string[];
  /** t=0 時相對定位點的位移（mm）。動畫把它收斂到 0。 */
  from: Vec3;
  stepIndex: number;
  startMs: number;
  endMs: number;
}

export interface AssemblyStep {
  index: number;
  /** 這一步滑入的零件（不含螺絲） */
  partIds: string[];
  startMs: number;
  endMs: number;
}

export interface ScrewSpec {
  id: string;
  /** 掛在哪個零件的 group 底下（母件） */
  motherId: string;
  /** 螺絲頭中心（世界 mm） */
  head: Vec3;
  /** 鎖入方向（單位向量，指向木頭裡） */
  axis: Vec3;
  lengthMm: number;
  /** 這個時間之前不顯示 */
  appearMs: number;
}

export interface AssemblyPlan {
  steps: AssemblyStep[];
  moves: AssemblyMove[];
  screws: ScrewSpec[];
  totalMs: number;
  /** id（零件或螺絲）→ 含它的 move 索引 */
  partMoves: Record<string, number[]>;
}

export interface PlanOptions {
  /** 組裝版：合上榫接後鎖螺絲 */
  screws?: boolean;
}

/** 每件滑入的時間 */
export const MOVE_MS = 800;
/** 同一步裡逐件錯開 */
export const STAGGER_MS = 100;
/** 步與步之間的停頓 */
export const STEP_GAP_MS = 200;
/** 螺絲鎖入 */
export const SCREW_MS = 350;
export const SCREW_STAGGER_MS = 70;
/** 螺絲鎖入前懸在外面多遠（mm） */
export const SCREW_HOVER_MM = 40;
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

/** 椅背立柱分類上是 misc，結構上跟腳同級（靠背橫料 / 背板都插在它身上）。 */
function rankOf(id: string, cat: PartCategory): number {
  if (/^back-post/.test(id)) return CATEGORY_RANK.leg;
  return CATEGORY_RANK[cat];
}

/** 抽屜 / 門的家族前綴：同一個抽屜的五塊板 + 把手是一個單位 */
export function familyKey(id: string): string {
  const cat = categorizePart(id);
  if (cat === "drawer" || /-drawer-\d+-/.test(id)) {
    const m = id.match(/^(.*?drawer-\d+)-/);
    if (m) return m[1];
  }
  if (cat === "door" || /-door(-\d+)?-/.test(id)) {
    const m = id.match(/^(.*?door(?:-\d+)?)-/);
    if (m && !/-door-inner-/.test(id)) return m[1];
  }
  // 掀蓋式木盒：lid + 四段上壁（wall-*-lid）+ lid-plug / lid-hinge 是一個蓋子單位
  if (id === "lid" || /^lid-/.test(id) || /-lid$/.test(id)) return "lid-group";
  return "";
}

// ---------- 向量 ----------
function norm(v: Vec3): Vec3 {
  const m = Math.hypot(v.x, v.y, v.z);
  return m > 1e-9 ? { x: v.x / m, y: v.y / m, z: v.z / m } : { x: 0, y: 0, z: 0 };
}
function dot(a: Vec3, b: Vec3): number { return a.x * b.x + a.y * b.y + a.z * b.z; }
function scale(v: Vec3, k: number): Vec3 { return { x: v.x * k, y: v.y * k, z: v.z * k }; }
function add(a: Vec3, b: Vec3): Vec3 { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
function sub(a: Vec3, b: Vec3): Vec3 { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
function len(v: Vec3): number { return Math.hypot(v.x, v.y, v.z); }
function same(a: Vec3, b: Vec3): boolean { return dot(a, b) > 0.99; }

const AXIS_DIRS: Vec3[] = [
  { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 },
  { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 },
];

/** 位移量：跟家具大小走，太小看不出來、太大鏡頭容不下。 */
export function travelMm(design: FurnitureDesign): number {
  const maxDim = Math.max(design.overall.length, design.overall.width, design.overall.thickness);
  return Math.min(450, Math.max(80, 0.4 * maxDim));
}

/**
 * 「往外」的方向若主要是水平的，就把垂直分量拿掉：腳從四周水平合攏、
 * 看起來才像人在組裝；主要是垂直的（桌面、底板）保留。門檻 0.7 ≈ 44°。
 */
function flattenIfMostlyHorizontal(v: Vec3): Vec3 {
  if (Math.abs(v.y) < 0.7 && Math.hypot(v.x, v.z) > 1e-6) return norm({ x: v.x, y: 0, z: v.z });
  return v;
}

// ---------- 榫接邊 ----------
interface Joint {
  kind: "tenon" | "dovetail" | "finger" | "slide";
  child: string;
  mother: string;
  /**
   * 公榫件可以沿哪些世界方向插進母件（單位向量，含正負號）。
   * - 榫頭：只有榫頭伸出的方向 out
   * - 鳩尾：只有「垂直於公榫板面、由外往內」那一個方向（鳩尾只能從端面套進去）
   * - 指接：板面法線 ±、板長方向 ± 都行（四個）
   * - 滑蓋：從缺口那一側往盒內
   */
  axes: Vec3[];
  /** 主要方向（螺絲用）：axes[0] */
  out: Vec3;
  /** 榫頭根面（= 母件表面上的接合點），世界 mm */
  root: Vec3;
  widthUnit: Vec3;
  widthMm: number;
}
function parallel(j: Joint, d: Vec3): boolean {
  return j.axes.some((a) => Math.abs(dot(a, d)) > 0.9);
}
/** 公榫件在 G、沿 d 離開：需要 d ≈ −a */
function childCanLeave(j: Joint, d: Vec3): boolean {
  return j.axes.some((a) => dot(d, a) < -0.9);
}
/** 母件在 G、沿 d 離開：需要 d ≈ +a */
function motherCanLeave(j: Joint, d: Vec3): boolean {
  return j.axes.some((a) => dot(d, a) > 0.9);
}
/** 零件的世界「長」方向與「厚」方向（rotation 套上 local x / local y） */
function partAxes(p: Part): { lengthUnit: Vec3; thickUnit: Vec3 } {
  const rx = p.rotation?.x ?? 0, ry = p.rotation?.y ?? 0, rz = p.rotation?.z ?? 0;
  return { lengthUnit: norm(rotateXYZ(rx, ry, rz, 1, 0, 0)), thickUnit: norm(rotateXYZ(rx, ry, rz, 0, 1, 0)) };
}
function snapAxis(v: Vec3): Vec3 {
  const ax = Math.abs(v.x), ay = Math.abs(v.y), az = Math.abs(v.z);
  if (ax >= ay && ax >= az) return { x: Math.sign(v.x) || 1, y: 0, z: 0 };
  if (ay >= az) return { x: 0, y: Math.sign(v.y) || 1, z: 0 };
  return { x: 0, y: 0, z: Math.sign(v.z) || 1 };
}
function boxContains(b: Box, pt: Vec3, tol: number): boolean {
  return pt.x >= b.min.x - tol && pt.x <= b.max.x + tol &&
         pt.y >= b.min.y - tol && pt.y <= b.max.y + tol &&
         pt.z >= b.min.z - tol && pt.z <= b.max.z + tol;
}

/**
 * 從造型推出的接合（鳩尾 / 指接 / 滑蓋），模板裡沒有 Tenon 資料、只有 shape + CSG：
 * - `dovetail-ends`（公榫板，前後壁）：兩端各找一塊「端面中心落在它盒子裡」的板當母板，
 *   插入方向 = 公榫板的板面法線、朝母板那一側（鳩尾只能從母板端面套上去）。
 * - `finger-joint-ends`：同上找母板，但四個方向都行（板面法線 ±、板長 ±）。
 * - 滑蓋：`lid` + `wall-<side>-cap`（缺口在 cap 那一側）→ 從 cap 往盒內滑。
 */
function shapeJoints(parts: Part[], center: Map<string, Vec3>, box: Map<string, Box>): Joint[] {
  const out: Joint[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    const kind = p.shape?.kind;
    if (kind !== "dovetail-ends" && kind !== "finger-joint-ends") continue;
    const { lengthUnit, thickUnit } = partAxes(p);
    const c = center.get(p.id)!;
    const tol = Math.max(2, p.visible.thickness / 2);
    for (const sgn of [-1, 1]) {
      const endPt = add(c, scale(lengthUnit, sgn * p.visible.length / 2));
      for (const q of parts) {
        if (q.id === p.id) continue;
        // 指接是雙方都有指，只登記一次（id 小的當公板）
        if (kind === "finger-joint-ends" && q.shape?.kind === "finger-joint-ends" && q.id < p.id) continue;
        if (!boxContains(box.get(q.id)!, endPt, tol)) continue;
        const key = `${p.id}>${q.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const towardQ = dot(thickUnit, sub(center.get(q.id)!, c)) >= 0 ? thickUnit : scale(thickUnit, -1);
        const axes = kind === "dovetail-ends"
          ? [towardQ]
          : [thickUnit, scale(thickUnit, -1), lengthUnit, scale(lengthUnit, -1)];
        out.push({
          kind: kind === "dovetail-ends" ? "dovetail" : "finger",
          child: p.id, mother: q.id, axes, out: axes[0],
          root: endPt, widthUnit: thickUnit, widthMm: 0,
        });
      }
    }
  }
  const lid = parts.find((p) => p.id === "lid");
  const cap = parts.find((p) => /^wall-(front|back|left|right)-cap$/.test(p.id));
  if (lid && cap) {
    const dir = snapAxis({ ...sub(center.get(lid.id)!, center.get(cap.id)!), y: 0 });
    out.push({ kind: "slide", child: lid.id, mother: cap.id, axes: [dir], out: dir, root: center.get(lid.id)!, widthUnit: dir, widthMm: 0 });
  }
  return out;
}

export interface Box { min: Vec3; max: Vec3 }

function partBox(p: Part): Box {
  const c = partWorldCenter(p);
  const { xExt, yExt, zExt } = worldExtents(p);
  return {
    min: { x: c.x - xExt / 2, y: c.y - yExt / 2, z: c.z - zExt / 2 },
    max: { x: c.x + xExt / 2, y: c.y + yExt / 2, z: c.z + zExt / 2 },
  };
}
function unionBox(boxes: Box[]): Box {
  const b: Box = { min: { x: Infinity, y: Infinity, z: Infinity }, max: { x: -Infinity, y: -Infinity, z: -Infinity } };
  for (const x of boxes) {
    b.min.x = Math.min(b.min.x, x.min.x); b.min.y = Math.min(b.min.y, x.min.y); b.min.z = Math.min(b.min.z, x.min.z);
    b.max.x = Math.max(b.max.x, x.max.x); b.max.y = Math.max(b.max.y, x.max.y); b.max.z = Math.max(b.max.z, x.max.z);
  }
  return b;
}
/** 兩個 AABB 是否重疊（縮 eps 後，貼面不算） */
function boxesOverlap(a: Box, b: Box, eps = 0.5): boolean {
  return (
    a.min.x + eps < b.max.x && a.max.x - eps > b.min.x &&
    a.min.y + eps < b.max.y && a.max.y - eps > b.min.y &&
    a.min.z + eps < b.max.z && a.max.z - eps > b.min.z
  );
}
/**
 * G 沿 d 掃 travel 距離會不會撞到 others（AABB 掃掠，軸向精確、斜向保守）。
 * 靜止時就已經跟 G 交疊的零件（鳩尾互咬的相鄰壁、滑蓋卡在槽裡的前後壁）
 * 是「本來就咬合」的，不算撞到——它們的方向限制由榫接規則管。
 */
export function sweepHits(g: Box, d: Vec3, travel: number, others: Box[]): boolean {
  const moved: Box = { min: add(g.min, scale(d, travel)), max: add(g.max, scale(d, travel)) };
  const swept = unionBox([g, moved]);
  return others.some((o) => !boxesOverlap(g, o) && boxesOverlap(swept, o));
}
/** 靜止時就跟 G 交疊的零件數（滑蓋在槽裡 → ≥ 2） */
function engagedCount(g: Box, others: Box[]): number {
  return others.filter((o) => boxesOverlap(g, o)).length;
}

// ---------- 拆解樹 ----------
interface Removal { node: TreeNode; d: Vec3; kind: "join" | "forced" }
interface TreeNode { ids: string[]; rest?: TreeNode; removed?: Removal[] }

interface Ctx {
  parts: Map<string, Part>;
  rank: Map<string, number>;
  family: Map<string, string>;
  center: Map<string, Vec3>;
  box: Map<string, Box>;
  joints: Joint[];
  travel: number;
}

function centroidOf(ids: string[], ctx: Ctx): Vec3 {
  const c = { x: 0, y: 0, z: 0 };
  for (const id of ids) { const p = ctx.center.get(id)!; c.x += p.x; c.y += p.y; c.z += p.z; }
  return ids.length ? scale(c, 1 / ids.length) : c;
}

/** 錨件：優先序最高、id 最小 —— 留到最後、當底座 */
function anchorOf(ids: string[], ctx: Ctx): string {
  return [...ids].sort((a, b) => ctx.rank.get(a)! - ctx.rank.get(b)! || a.localeCompare(b))[0];
}

class UnionFind {
  private p = new Map<string, string>();
  constructor(ids: string[]) { for (const id of ids) this.p.set(id, id); }
  find(x: string): string { let r = x; while (this.p.get(r) !== r) r = this.p.get(r)!; this.p.set(x, r); return r; }
  union(a: string, b: string) { this.p.set(this.find(a), this.find(b)); }
}

interface Candidate { ids: string[]; d: Vec3; key: number[]; collides: boolean }

/** S 裡兩端都在 S 的榫接 */
function internalJoints(S: Set<string>, ctx: Ctx): Joint[] {
  return ctx.joints.filter((j) => S.has(j.child) && S.has(j.mother));
}

/**
 * 連通分量：「不平行於 d 的榫接」黏在一起（d = null → 所有榫接都黏）；
 * 同一個抽屜 / 門家族的零件，只要家族還沒被單獨拿出來拆，一律黏成一個單位。
 */
function components(ids: string[], joints: Joint[], d: Vec3 | null, ctx: Ctx, glueFamilies: boolean): Map<string, string[]> {
  const uf = new UnionFind(ids);
  for (const j of joints) {
    if (d === null || !parallel(j, d)) uf.union(j.child, j.mother);
  }
  if (glueFamilies) {
    const first = new Map<string, string>();
    for (const id of ids) {
      const f = ctx.family.get(id)!;
      if (!f) continue;
      const a = first.get(f);
      if (a) uf.union(a, id); else first.set(f, id);
    }
  }
  const comps = new Map<string, string[]>();
  for (const id of ids) {
    const r = uf.find(id);
    if (!comps.has(r)) comps.set(r, []);
    comps.get(r)!.push(id);
  }
  return comps;
}

/** S 是否「就是一個家族」（此時家族內部要拆開，不再黏） */
function isSingleFamily(S: string[], ctx: Ctx): boolean {
  const f = ctx.family.get(S[0])!;
  return !!f && S.every((id) => ctx.family.get(id) === f);
}

function scoreCandidate(ids: string[], d: Vec3, S: string[], ctx: Ctx, collides: boolean, free = false): number[] {
  const minRank = Math.min(...ids.map((id) => ctx.rank.get(id)!));
  const anchor = anchorOf(S, ctx);
  const dirIdx = AXIS_DIRS.findIndex((a) => same(a, d));
  return [
    collides ? 1 : 0,       // 會撞到東西的最後才考慮
    -minRank,               // 優先序低的（座板、五金）先拆
    // 沒榫接的（箱體板、底板）：上面的先拆 → 底板留到最後當底座（壁立其上）
    free ? -Math.round(centroidOf(ids, ctx).y) : 0,
    ids.length,             // 件數少的先拆
    ids.includes(anchor) ? 1 : 0, // 含錨件的留到最後
    dirIdx < 0 ? 99 : dirIdx,
  ];
}
function cmpKey(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

/** 連通的 S：列出所有 (G, d) 合法拆法 */
function jointCandidates(S: string[], ctx: Ctx, glue: boolean): Candidate[] {
  const Sset = new Set(S);
  const joints = internalJoints(Sset, ctx);
  const dirs: Vec3[] = [...AXIS_DIRS];
  for (const j of joints) {
    for (const a of j.axes) for (const v of [a, scale(a, -1)]) if (!dirs.some((d) => same(d, v))) dirs.push(v);
  }
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const d of dirs) {
    const comps = components(S, joints, d, ctx, glue);
    const compOf = new Map<string, string[]>();
    for (const c of comps.values()) for (const id of c) compOf.set(id, c);
    for (const seed of comps.values()) {
      const G = new Set<string>(seed);
      let changed = true;
      while (changed) {
        changed = false;
        for (const j of joints) {
          const cIn = G.has(j.child), mIn = G.has(j.mother);
          if (cIn === mIn) continue;
          // 跨越的榫接一定平行於 d（不平行的已經黏成同一分量）
          if (cIn) {
            // 公榫件在 G：G 要沿 −axis 離開；不行的話母件也得跟著走
            if (!childCanLeave(j, d)) { for (const id of compOf.get(j.mother)!) G.add(id); changed = true; }
          } else {
            if (!motherCanLeave(j, d)) { for (const id of compOf.get(j.child)!) G.add(id); changed = true; }
          }
        }
      }
      if (G.size === S.length) continue;
      const ids = [...G].sort();
      const k = ids.join("|") + "@" + d.x.toFixed(2) + d.y.toFixed(2) + d.z.toFixed(2);
      if (seen.has(k)) continue;
      seen.add(k);
      const gBox = unionBox(ids.map((id) => ctx.box.get(id)!));
      const others = S.filter((id) => !G.has(id)).map((id) => ctx.box.get(id)!);
      const collides = sweepHits(gBox, d, ctx.travel, others);
      out.push({ ids, d, key: scoreCandidate(ids, d, S, ctx, collides), collides });
    }
  }
  return out;
}

/** 不連通的 S：每個分量都能拆，方向 = 六軸裡「往外」且不撞的 */
function freeCandidates(comps: string[][], S: string[], ctx: Ctx): Candidate[] {
  const center = centroidOf(S, ctx);
  const out: Candidate[] = [];
  for (const ids of comps) {
    const gBox = unionBox(ids.map((id) => ctx.box.get(id)!));
    const others = S.filter((id) => !ids.includes(id)).map((id) => ctx.box.get(id)!);
    const radial = flattenIfMostlyHorizontal(norm(sub(centroidOf(ids, ctx), center)));
    // 候選方向：六個軸向，依「跟往外方向最像」排序；都會撞就取往外那個。
    // 滑蓋（lid 卡在 ≥2 片壁的槽裡）：只能水平滑，從沒被壁擋住的那一側（缺口）出去。
    const isSlidingLid = ids.length === 1 && ids[0] === "lid" && engagedCount(gBox, others) >= 2;
    // 抽屜 / 門整組：水平滑進櫃體（AABB 聯集會把面板的高度算進去、誤判跟頂板咬合，
    // 垂直方向的掃掠因此失準；抽屜本來也只會從正面推進去）
    const fam = ctx.family.get(ids[0]) ?? "";
    const isFamilyUnit = ids.length > 1 && fam !== "" && fam !== "lid-group" && ids.every((id) => ctx.family.get(id) === fam);
    const preferHorizontal = isSlidingLid || isFamilyUnit;
    const horizontal = AXIS_DIRS.filter((a) => a.y === 0).sort((a, b) => dot(b, radial) - dot(a, radial));
    const vertical = AXIS_DIRS.filter((a) => a.y !== 0).sort((a, b) => dot(b, radial) - dot(a, radial));
    const ranked = preferHorizontal
      ? [...horizontal, ...vertical]
      : [...AXIS_DIRS].sort((a, b) => dot(b, radial) - dot(a, radial));
    let pick: Vec3 | null = null;
    for (const d of ranked) if (!sweepHits(gBox, d, ctx.travel, others)) { pick = d; break; }
    const collides = pick === null;
    const d = pick ?? (len(radial) > 0.25 ? radial : { x: 0, y: 1, z: 0 });
    out.push({ ids: [...ids].sort(), d, key: scoreCandidate(ids, d, S, ctx, collides, true), collides });
  }
  return out;
}

function jointBetween(a: Set<string>, b: Set<string>, ctx: Ctx): boolean {
  return ctx.joints.some((j) => (a.has(j.child) && b.has(j.mother)) || (a.has(j.mother) && b.has(j.child)));
}

function disassemble(S: string[], ctx: Ctx): TreeNode {
  if (S.length === 1) return { ids: S };
  const Sset = new Set(S);
  const joints = internalJoints(Sset, ctx);
  const glue = !isSingleFamily(S, ctx);
  const comps = [...components(S, joints, null, ctx, glue).values()];
  let cands: Candidate[];
  let kind: "join" | "forced" = "join";
  if (comps.length > 1) cands = freeCandidates(comps, S, ctx);
  else cands = jointCandidates(S, ctx, glue);
  if (cands.length === 0) {
    // 榫接互鎖：硬拆優先序最低（rank 最大、id 最大）的一件
    const victim = [...S].sort((a, b) => ctx.rank.get(b)! - ctx.rank.get(a)! || b.localeCompare(a))[0];
    const radial = flattenIfMostlyHorizontal(norm(sub(ctx.center.get(victim)!, centroidOf(S, ctx))));
    cands = [{ ids: [victim], d: len(radial) > 0.25 ? radial : { x: 0, y: 1, z: 0 }, key: [], collides: true }];
    kind = "forced";
  }
  cands.sort((a, b) => cmpKey(a.key, b.key) || a.ids.join().localeCompare(b.ids.join()));
  if (process.env.ASM_DEBUG) {
    console.log(`[disassemble] S=${S.length} comps=${comps.length} kind=${kind}`);
    for (const c of cands.slice(0, 6)) console.log(`   key=[${c.key.join(",")}] d=(${c.d.x.toFixed(1)},${c.d.y.toFixed(1)},${c.d.z.toFixed(1)}) ${c.ids.join(",")}`);
  }
  const best = cands[0];
  // 同一步一起拆：同方向、同優先序層、互不相鄰、不重疊
  const picked: Candidate[] = [best];
  const taken = new Set(best.ids);
  for (const c of cands.slice(1)) {
    if (kind === "forced") break;
    if (!same(c.d, best.d)) continue;
    if (c.key[0] !== best.key[0] || c.key[1] !== best.key[1]) continue;
    if (c.ids.some((id) => taken.has(id))) continue;
    const cs = new Set(c.ids);
    if (jointBetween(cs, taken, ctx)) continue;
    if (taken.size + c.ids.length >= S.length) continue;
    picked.push(c);
    for (const id of c.ids) taken.add(id);
  }
  const rest = S.filter((id) => !taken.has(id));
  return {
    ids: S,
    rest: disassemble(rest, ctx),
    removed: picked.map((c) => ({ node: disassemble(c.ids, ctx), d: c.d, kind })),
  };
}

// ---------- 反轉成組裝時間軸 ----------
interface Emitter {
  moves: AssemblyMove[];
  steps: AssemblyStep[];
  screws: ScrewSpec[];
  clock: number;
  ctx: Ctx;
  wantScrews: boolean;
}

function emitScrews(em: Emitter, closing: Joint[], afterMs: number, stepIndex: number): number {
  if (!em.wantScrews || closing.length === 0) return afterMs;
  let t = afterMs;
  let end = afterMs;
  for (const j of closing) {
    if (j.kind !== "tenon") continue;
    const mother = em.ctx.parts.get(j.mother)!;
    const ext = worldExtents(mother);
    const ax = Math.abs(j.out.x), ay = Math.abs(j.out.y), az = Math.abs(j.out.z);
    const motherThick = Math.min(60, ax >= ay && ax >= az ? ext.xExt : ay >= az ? ext.yExt : ext.zExt);
    const lengthMm = Math.min(90, motherThick + 30);
    const offsets = j.widthMm >= 40 ? [-j.widthMm / 4, j.widthMm / 4] : [0];
    for (const o of offsets) {
      const id = `screw:${j.child}>${j.mother}:${em.screws.length}`;
      const head = add(add(j.root, scale(j.out, motherThick)), scale(j.widthUnit, o));
      em.screws.push({ id, motherId: j.mother, head, axis: scale(j.out, -1), lengthMm, appearMs: t });
      em.moves.push({
        kind: "screw",
        partIds: [id],
        from: scale(j.out, SCREW_HOVER_MM),
        stepIndex,
        startMs: t,
        endMs: t + SCREW_MS,
      });
      end = Math.max(end, t + SCREW_MS);
      t += SCREW_STAGGER_MS;
    }
  }
  return end;
}

/** 子組件內部（抽屜的五塊板、側框）的動作快一點，整體才不會拖到 50 秒 */
const NESTED_SPEED = 0.6;

function emit(node: TreeNode, em: Emitter, parentIds: string[], depth = 0): void {
  const ctx = em.ctx;
  const moveMs = depth > 0 ? Math.round(MOVE_MS * NESTED_SPEED) : MOVE_MS;
  const gapMs = depth > 0 ? Math.round(STEP_GAP_MS * NESTED_SPEED) : STEP_GAP_MS;
  if (!node.rest || !node.removed) {
    // 底座那一件：從所在群組的中心往外進場
    const id = node.ids[0];
    const radial = flattenIfMostlyHorizontal(norm(sub(ctx.center.get(id)!, centroidOf(parentIds, ctx))));
    const d = len(radial) > 0.25 ? radial : { x: 0, y: 1, z: 0 };
    const stepIndex = em.steps.length;
    const startMs = em.clock;
    em.moves.push({ kind: "appear", partIds: [id], from: scale(d, ctx.travel), stepIndex, startMs, endMs: startMs + moveMs });
    em.steps.push({ index: stepIndex, partIds: [id], startMs, endMs: startMs + moveMs });
    em.clock = startMs + moveMs + gapMs;
    return;
  }
  // 1. 先組好剩下的（底座側）
  emit(node.rest, em, node.ids, depth);
  // 2. 每個要滑入的子組件先在爆炸位置組好（單一零件不用，直接滑入）
  for (const r of node.removed) if (r.node.rest) emit(r.node, em, r.node.ids, depth + 1);
  // 3. 子組件們同一步沿 −d 滑入（拆解時沿 d 離開）
  const stepIndex = em.steps.length;
  const startMs = em.clock;
  const restSet = new Set(node.rest.ids);
  const movedIds: string[] = [];
  let end = startMs;
  const closing: Joint[] = [];
  node.removed.forEach((r, i) => {
    const s = startMs + i * STAGGER_MS;
    em.moves.push({ kind: r.kind, partIds: r.node.ids, from: scale(r.d, ctx.travel), stepIndex, startMs: s, endMs: s + moveMs });
    movedIds.push(...r.node.ids);
    end = Math.max(end, s + moveMs);
    const g = new Set(r.node.ids);
    for (const j of ctx.joints) {
      if ((g.has(j.child) && restSet.has(j.mother)) || (g.has(j.mother) && restSet.has(j.child))) closing.push(j);
    }
  });
  end = emitScrews(em, closing, end, stepIndex);
  em.steps.push({ index: stepIndex, partIds: movedIds, startMs, endMs: end });
  em.clock = end + gapMs;
}

export function planAssembly(design: FurnitureDesign, opts: PlanOptions = {}): AssemblyPlan {
  const parts = design.parts;
  const index = buildWorldMortiseIndex(parts);
  const joints: Joint[] = [];
  for (const part of parts) {
    for (const t of part.tenons) {
      if (t.length <= 0) continue;
      const tw = tenonWorld(part, t);
      const mw = matchMortiseForTenon(part, t, tw, index);
      if (!mw) continue;
      joints.push({ kind: "tenon", child: part.id, mother: mw.partId, axes: [tw.outUnit], out: tw.outUnit, root: tw.root, widthUnit: tw.widthUnit, widthMm: t.width });
    }
  }
  const center = new Map(parts.map((p) => [p.id, partWorldCenter(p)]));
  const box = new Map(parts.map((p) => [p.id, partBox(p)]));
  joints.push(...shapeJoints(parts, center, box));
  const ctx: Ctx = {
    parts: new Map(parts.map((p) => [p.id, p])),
    rank: new Map(parts.map((p) => [p.id, rankOf(p.id, categorizePart(p.id))])),
    family: new Map(parts.map((p) => [p.id, familyKey(p.id)])),
    center,
    box,
    joints,
    travel: travelMm(design),
  };
  const ids = parts.map((p) => p.id);
  const em: Emitter = { moves: [], steps: [], screws: [], clock: 0, ctx, wantScrews: !!opts.screws };
  if (ids.length > 0) emit(disassemble(ids, ctx), em, ids);
  const partMoves: Record<string, number[]> = {};
  em.moves.forEach((m, i) => { for (const id of m.partIds) (partMoves[id] ??= []).push(i); });
  const totalMs = em.steps.length > 0 ? em.steps[em.steps.length - 1].endMs + TAIL_MS : 0;
  return { steps: em.steps, moves: em.moves, screws: em.screws, totalMs, partMoves };
}

/** 除錯用：列出推出來的接合邊 */
export function debugJoints(design: FurnitureDesign): Array<{ kind: string; child: string; mother: string; axes: Vec3[] }> {
  const parts = design.parts;
  const index = buildWorldMortiseIndex(parts);
  const out: Array<{ kind: string; child: string; mother: string; axes: Vec3[] }> = [];
  for (const part of parts) for (const t of part.tenons) {
    if (t.length <= 0) continue;
    const tw = tenonWorld(part, t);
    const mw = matchMortiseForTenon(part, t, tw, index);
    out.push({ kind: mw ? "tenon" : "tenon-UNMATCHED", child: part.id, mother: mw?.partId ?? "?", axes: [tw.outUnit] });
  }
  const center = new Map(parts.map((p) => [p.id, partWorldCenter(p)]));
  const box = new Map(parts.map((p) => [p.id, partBox(p)]));
  for (const j of shapeJoints(parts, center, box)) out.push({ kind: j.kind, child: j.child, mother: j.mother, axes: j.axes });
  return out;
}

export function easeInOutCubic(p: number): number {
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}

/**
 * 某個時間點每個 id（零件 / 螺絲）相對定位的位移（mm）。
 * 子組件裡的零件 = 自己的位移 + 所在子組件的位移（多層相加）。到位的不出現。
 */
export function offsetsAt(plan: AssemblyPlan, tMs: number): Map<string, Vec3> {
  const out = new Map<string, Vec3>();
  for (const m of plan.moves) {
    if (tMs >= m.endMs) continue;
    const p = tMs <= m.startMs ? 0 : (tMs - m.startMs) / (m.endMs - m.startMs);
    const k = 1 - easeInOutCubic(p);
    const off = scale(m.from, k);
    for (const id of m.partIds) {
      const prev = out.get(id);
      out.set(id, prev ? add(prev, off) : off);
    }
  }
  return out;
}

/** 目前播放到第幾步（0-based；超過尾端回最後一步） */
export function stepIndexAt(plan: AssemblyPlan, tMs: number): number {
  let idx = 0;
  for (const s of plan.steps) if (tMs >= s.startMs) idx = s.index;
  return idx;
}
