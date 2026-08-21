/**
 * 榫孔加工面 —— 把一個零件身上的「母榫（榫眼 / 榫孔）」投影到它所在的那一面，
 * 產出「外框輪廓 + 榫孔內框」的 2D 幾何，供 CNC 連榫孔一起洗。
 *
 * 為什麼要「每個加工面各一張」：一個零件（例如桌腳）常常兩個相鄰內側面各有一個
 * 榫孔接不同牙板。CNC 一次只能把一面朝上放平，所以每個入榫面各出一張圖，
 * 使用者翻面分兩次裝夾。外框與榫孔在同一次裝夾、同一座標原點 → 榫孔相對邊緣
 * 是機器保證的，不必畫線放樣。
 *
 * 幾何來源：
 *   - 外框＝projectPartSilhouette(localPart, view)（含錐腳 / 弧肩 / 倒角等造型）
 *   - 榫孔＝mortiseLocalBox(part, m)（零件圖紅框同一套邏輯，含 depthAxis 入榫軸）
 *
 * 座標對齊（關鍵）：projectPartSilhouette 的 per-vertex 映射（rotation 歸零後）：
 *   top  : (u,v) = (-x,        z)
 *   front: (u,v) = (-x,  y + ly/2)
 *   side : (u,v) = (-z,  y + ly/2)
 * 榫孔 box 中心 (cx,cy,cz)（cy 以厚度置中）用同一映射即與外框同框，
 * 再套 partFlatOutline 相同的歸一化（減 minX、翻 Y = maxY - v）→ 常數位移自動抵銷。
 *
 * 限制（v1）：只處理軸對齊的矩形零件榫孔（腳 / 牙板 / 橫撐）。box 帶 rotX/rotY/rotZ
 * 的傾斜榫孔（外撇 splayed / tilt）畫成 axis-aligned 近似；圓料腳的圓榫走 round 圓孔。
 * 榫頭（公榫）不併進外框（外框維持肩到肩）——tenon union 另做。
 */
import type { Part } from "@/lib/types";
import { projectPartSilhouette, type OrthoView } from "@/lib/render/geometry";
import { mortiseLocalBox, tenonLocalBox } from "@/lib/render/svg-views";

export interface FaceHole {
  kind: "rect" | "circle";
  /** rect：4 角（已歸一化到 SVG mm 框，Y 向下）。 */
  pts?: Array<{ x: number; y: number }>;
  /** circle：中心 + 半徑（已歸一化）。 */
  cx?: number;
  cy?: number;
  r?: number;
  /** 是否打穿（display hint；深度仍在 CAM 端設）。 */
  through: boolean;
  label: string;
  /**
   * 鑿孔角度（度，相對於面的法線；0＝垂直進去）。
   *
   * 外斜腳的牙板／橫撐榫眼不是垂直進料的——在方料上鑿的時候必須知道歪幾度，
   * 否則組起來牙條會頂不緊（木頭仁 2026-08-21：「榫孔旁邊必須要標出這個口要鑿
   * 什麼角度」）。角度來源是 Mortise 的 rotX / rotZ，模板早就算好了。
   */
  angleDeg?: number;
}

/** 公榫（榫頭）在該面上的凸出矩形——沿在平面內的軸伸出外框，供切外形時一起切出。 */
export interface FaceTenon {
  pts: Array<{ x: number; y: number }>;
  label: string;
}

export interface MachiningFace {
  /** "top" | "bottom" | "front" | "back" | "left" | "right" | "flat" */
  faceKey: string;
  faceLabelZh: string;
  /** 外框輪廓（歸一化 SVG mm 框，左上原點、Y 向下）。 */
  outline: Array<{ x: number; y: number }>;
  holes: FaceHole[];
  /** 該面上的公榫凸出（矩形，已歸一化）。 */
  tenons: FaceTenon[];
  /**
   * 成型輪廓（切完造型之後的形狀），已歸一化到跟 outline 同一個框。
   *
   * outline 畫的是**方料**（翻型階段那根方的），這條是要鋸掉的線。木工實務是
   * 「方料時先把孔找好、鑿好，之後才把造型切出來」（木頭仁 2026-08-21），所以
   * 樣板貼上方料 → 照 outline 對齊、照 holes 鑿孔 → 再沿這條線鋸造型。
   *
   * 只有「造型落在方料範圍內」（＝真的是要鋸掉的切線）才有值。外斜腳那種
   * shape 描述的是「裝上去之後歪掉的樣子」而不是切線，投影會超出方料，這時
   * 不給值——把 72mm 寬的傾斜平行四邊形畫在 35mm 的方料上只會害人。
   */
  shapeOutline?: Array<{ x: number; y: number }>;
  /** 外框寬 / 高（mm）。 */
  w: number;
  h: number;
}

/** 榫頭沿哪個 part-local 軸伸出（由 position 決定）。 */
const TENON_EXT_AXIS: Record<string, "x" | "y" | "z"> = {
  start: "x", end: "x", top: "y", bottom: "y", left: "z", right: "z",
};
/** 每個 view 平面內的兩軸（榫頭沿這兩軸伸出才畫得到）。 */
const VIEW_IN_PLANE: Record<string, Array<"x" | "y" | "z">> = {
  top: ["x", "z"], front: ["x", "y"], side: ["z", "y"],
};

function toLocalPart(part: Part): Part {
  return { ...part, rotation: { x: 0, y: 0, z: 0 }, origin: { x: 0, y: 0, z: 0 } };
}

/** depthAxis + 中心 sign → 加工面 key（±方向分開＝不同裝夾）。 */
const FACE_LABELS: Record<string, string> = {
  top: "頂面",
  bottom: "底面",
  front: "正面",
  back: "背面",
  left: "左端",
  right: "右端",
};

interface RawHole {
  faceKey: string;
  view: OrthoView;
  /** 是否為「負向面」（bottom/back/left）→ 放平那面時左右鏡射。 */
  mirrorU: boolean;
  kind: "rect" | "circle";
  /** raw (u,v) 框（歸一化前）。 */
  uMin: number;
  uMax: number;
  vMin: number;
  vMax: number;
  /** 外斜腳剪切後的 4 角 raw(u,v)（平行四邊形，跟腳身斜同角度）；有值時取代 uMin..vMax 的矩形。 */
  quad?: Array<{ u: number; v: number }>;
  through: boolean;
  label: string;
  /** 鑿孔角度（度，相對面法線；0＝垂直）。見 FaceHole.angleDeg。 */
  angleDeg?: number;
}

/**
 * 一個「母件本地 box（含 depthAxis）」→ 它所在加工面 + raw(u,v) 榫孔框。
 * 真母榫、從榫頭反推的母榫共用這支。through-y 榫孔回兩面（翻哪面都在）。
 */
export interface LocalBoxWithAxis {
  cx: number; cy: number; cz: number; hx: number; hy: number; hz: number;
  depthAxis?: "x" | "y" | "z";
}
export function boxToRawHoles(
  lb: LocalBoxWithAxis,
  ly: number,
  through: boolean,
  round: boolean,
  label: string,
): RawHole[] {
  const axis = lb.depthAxis ?? "y";
  const yShift = ly / 2; // front/side 的 v = y + ly/2

  const mk = (
    faceKey: string,
    view: OrthoView,
    mirrorU: boolean,
    uMin: number,
    uMax: number,
    vMin: number,
    vMax: number,
  ): RawHole => ({
    faceKey,
    view,
    mirrorU,
    kind: round ? "circle" : "rect",
    uMin,
    uMax,
    vMin,
    vMax,
    through,
    label,
  });

  if (axis === "y") {
    const uMin = -(lb.cx + lb.hx);
    const uMax = -(lb.cx - lb.hx);
    const vMin = lb.cz - lb.hz;
    const vMax = lb.cz + lb.hz;
    if (through) {
      return [
        mk("top", "top", false, uMin, uMax, vMin, vMax),
        mk("bottom", "top", true, uMin, uMax, vMin, vMax),
      ];
    }
    const top = lb.cy > 0;
    return [mk(top ? "top" : "bottom", "top", !top, uMin, uMax, vMin, vMax)];
  }
  if (axis === "z") {
    const uMin = -(lb.cx + lb.hx);
    const uMax = -(lb.cx - lb.hx);
    const vMin = lb.cy - lb.hy + yShift;
    const vMax = lb.cy + lb.hy + yShift;
    if (through) {
      return [
        mk("front", "front", false, uMin, uMax, vMin, vMax),
        mk("back", "front", true, uMin, uMax, vMin, vMax),
      ];
    }
    const front = lb.cz > 0;
    return [mk(front ? "front" : "back", "front", !front, uMin, uMax, vMin, vMax)];
  }
  const uMin = -(lb.cz + lb.hz);
  const uMax = -(lb.cz - lb.hz);
  const vMin = lb.cy - lb.hy + yShift;
  const vMax = lb.cy + lb.hy + yShift;
  if (through) {
    return [
      mk("right", "side", false, uMin, uMax, vMin, vMax),
      mk("left", "side", true, uMin, uMax, vMin, vMax),
    ];
  }
  const right = lb.cx > 0;
  return [mk(right ? "right" : "left", "side", !right, uMin, uMax, vMin, vMax)];
}

/**
 * 外斜腳（splayed 家族）補償：silhouette 把腳身沿高度線性剪切
 * （projectFeaturePolygon 同款：xL += dx·t、zL += dz·t，t = 1 − (y+ly/2)/ly = 1 − v/ly），
 * 但 boxToRawHoles 出的是軸對齊矩形 → 榫孔畫成正的、跟斜腳外框不一致（且會落到腳外）。
 * user 要求：榫孔要畫成「跟著腳斜、但仍是 90° 直角的長方形」（＝剛性旋轉，不是剪切／平行四邊形），
 * 因為榫孔是實體矩形槽，斜腳只是把它整個轉了個角度。這裡把矩形榫孔**繞它（已位移到腳上的）
 * 中心剛性旋轉** θ＝atan(−D/ly)（＝腳身傾角），4 角仍成直角矩形、長邊平行腳身。
 * 只動匯出（不改 mortiseLocalBox，避免影響 3D / 零件圖紅框）。前/後面用 dx、左/右面用 dz；
 * 俯視面（top）長軸在孔內不變化 → 不旋轉。圓榫（circle）維持圓孔不動。
 */
function applySplayTilt(part: Part, holes: RawHole[]): RawHole[] {
  const sh = part.shape as { kind?: string; dxMm?: number; dzMm?: number } | undefined;
  if (!sh || (sh.kind !== "splayed" && sh.kind !== "splayed-tapered" && sh.kind !== "splayed-round-tapered")) return holes;
  const ly = part.visible.thickness;
  if (ly <= 0) return holes;
  return holes.map((h) => {
    if (h.kind !== "rect") return h;
    const D = h.view === "front" ? (sh.dxMm ?? 0) : h.view === "side" ? (sh.dzMm ?? 0) : 0;
    if (D === 0) return h;
    const theta = Math.atan(-D / ly);                          // 腳身傾角（讓長邊平行腳身）
    const cs = Math.cos(theta), sn = Math.sin(theta);
    const vc = (h.vMin + h.vMax) / 2;
    const uc = (h.uMin + h.uMax) / 2 - D * (1 - vc / ly);      // 中心位移到腳上（跟 shear/零件圖同位置）
    const hw = (h.uMax - h.uMin) / 2, hh = (h.vMax - h.vMin) / 2;
    // 繞中心剛性旋轉真實尺寸矩形（4 角維持 90°）
    const rot = (du: number, dv: number) => ({ u: uc + du * cs - dv * sn, v: vc + du * sn + dv * cs });
    return { ...h, quad: [rot(-hw, -hh), rot(hw, -hh), rot(hw, hh), rot(-hw, hh)] };
  });
}

/** 一個母榫 → raw 榫孔框（wrapper：算 box → boxToRawHoles → 外斜腳旋轉成傾斜長方形）。 */
function mortiseToRawHoles(
  part: Part,
  m: Part["mortises"][number],
  idx: number,
  blankFrame: boolean,
): RawHole[] {
  const lb = mortiseLocalBox(part, m);
  const raw = boxToRawHoles(lb, part.visible.thickness, m.through, m.shape === "round", m.label ?? `榫孔${idx + 1}`);
  // 方料座標系刻意**不套** applySplayTilt。那個剪切是把榫眼畫成「外斜腳裝上去
  // 之後歪掉的平行四邊形」——成品／CNC 是對的，但 1:1 樣板貼在方料上用：方料
  // 階段那個孔的開口就是正矩形，歪的是鑿進去的方向（改用 angleDeg 標註）。
  // 套了剪切會讓同一條中線上的兩個孔在紙上橫移（實測外斜方凳差 23mm），貼到
  // 方料上直接鑿錯位（木頭仁 2026-08-21 實際印出來抓到）。
  const tilted = blankFrame ? raw : applySplayTilt(part, raw);
  const angleDeg = mortiseAngleDeg(m);
  return angleDeg === 0 ? tilted : tilted.map((h) => ({ ...h, angleDeg }));
}

/** 榫眼相對面法線的傾角（度）。模板把外斜補償寫在 rotX / rotZ，取非零的那個。 */
function mortiseAngleDeg(m: Part["mortises"][number]): number {
  const r = Math.abs(m.rotX ?? 0) > Math.abs(m.rotZ ?? 0) ? (m.rotX ?? 0) : (m.rotZ ?? 0);
  const deg = Math.abs((r * 180) / Math.PI);
  // 小於 0.1° 當垂直——浮點殘差不該印出「斜 0.03°」這種沒有意義的標註。
  return deg < 0.1 ? 0 : Math.round(deg * 10) / 10;
}

/** 判斷輪廓是不是軸對齊矩形（4 點、邊全水平/垂直）。 */
function isAxisRect(pts: Array<{ x: number; y: number }>): boolean {
  if (pts.length !== 4) return false;
  for (let i = 0; i < 4; i++) {
    const a = pts[i], b = pts[(i + 1) % 4];
    if (Math.abs(a.x - b.x) > 0.01 && Math.abs(a.y - b.y) > 0.01) return false;
  }
  return true;
}

interface Rect { x0: number; y0: number; x1: number; y1: number }

/**
 * 一組軸對齊矩形的聯集外輪廓（單一封閉多邊形）。給「body 矩形 + 榫頭矩形」用，
 * 把榫頭併進外框成一條線。用 rectilinear grid：格心在任一矩形內 = 實體，
 * 收集實體/非實體交界的格線段，串成環，再消除共線點。
 */
function rectUnionOutline(rects: Rect[]): Array<{ x: number; y: number }> | null {
  const xs = [...new Set(rects.flatMap((r) => [r.x0, r.x1]))].sort((a, b) => a - b);
  const ys = [...new Set(rects.flatMap((r) => [r.y0, r.y1]))].sort((a, b) => a - b);
  const nx = xs.length - 1, ny = ys.length - 1;
  const inside = (i: number, j: number) => {
    if (i < 0 || j < 0 || i >= nx || j >= ny) return false;
    const cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2;
    return rects.some((r) => cx > r.x0 && cx < r.x1 && cy > r.y0 && cy < r.y1);
  };
  // 交界格線段（無向）
  const segs: Array<[[number, number], [number, number]]> = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    if (!inside(i, j)) continue;
    if (!inside(i, j - 1)) segs.push([[xs[i], ys[j]], [xs[i + 1], ys[j]]]);
    if (!inside(i, j + 1)) segs.push([[xs[i], ys[j + 1]], [xs[i + 1], ys[j + 1]]]);
    if (!inside(i - 1, j)) segs.push([[xs[i], ys[j]], [xs[i], ys[j + 1]]]);
    if (!inside(i + 1, j)) segs.push([[xs[i + 1], ys[j]], [xs[i + 1], ys[j + 1]]]);
  }
  if (segs.length === 0) return null;
  // 串環：每點度數 2（simply-connected），從任一點走到回起點
  const K = (p: [number, number]) => `${p[0]}|${p[1]}`;
  const adj = new Map<string, Array<[number, number]>>();
  for (const [a, b] of segs) {
    (adj.get(K(a)) ?? adj.set(K(a), []).get(K(a))!).push(b);
    (adj.get(K(b)) ?? adj.set(K(b), []).get(K(b))!).push(a);
  }
  const startKey = K(segs[0][0]);
  const startPt = segs[0][0];
  const loop: Array<{ x: number; y: number }> = [];
  let prevKey = "";
  let curKey = startKey;
  let curPt = startPt;
  const MAX = segs.length * 2 + 10;
  for (let step = 0; step < MAX; step++) {
    loop.push({ x: curPt[0], y: curPt[1] });
    const nbrs = adj.get(curKey) ?? [];
    const next = nbrs.find((n) => K(n) !== prevKey);
    if (!next) break;
    prevKey = curKey;
    curKey = K(next);
    curPt = next;
    if (curKey === startKey) break;
  }
  if (loop.length < 4) return null;
  // 消除共線中間點
  const out: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < loop.length; i++) {
    const a = loop[(i - 1 + loop.length) % loop.length];
    const b = loop[i];
    const c = loop[(i + 1) % loop.length];
    const collinear = (Math.abs(a.x - b.x) < 0.01 && Math.abs(b.x - c.x) < 0.01) ||
      (Math.abs(a.y - b.y) < 0.01 && Math.abs(b.y - c.y) < 0.01);
    if (!collinear) out.push(b);
  }
  return out.length >= 4 ? out : loop;
}

type Pt = { x: number; y: number };

/** 榫頭矩形往哪一側伸出本體（超出 body bbox 最多的那一軸向）。 */
function tenonOutwardDir(
  t: Rect,
  bbMinX: number, bbMaxX: number, bbMinY: number, bbMaxY: number,
): { ext: "x" | "y"; s: 1 | -1 } | null {
  const overR = t.x1 - bbMaxX, overL = bbMinX - t.x0;
  const overD = t.y1 - bbMaxY, overU = bbMinY - t.y0;
  const m = Math.max(overR, overL, overD, overU);
  if (m <= 0.1) return null;                 // 榫頭沒明顯凸出本體 → 不嵌
  if (m === overR) return { ext: "x", s: 1 };
  if (m === overL) return { ext: "x", s: -1 };
  if (m === overD) return { ext: "y", s: 1 };
  return { ext: "y", s: -1 };
}

/**
 * 把一個「垂直於本體某條周界邊、往外伸出」的榫頭矩形嵌接進本體外框，成為單一封閉輪廓。
 * 通用版：支援 4 個伸出方向（±x / ±y）與「微斜端邊」（梯形補償牙板端邊可斜 ~2mm）。
 * 做法＝找出朝伸出方向、且橫跨涵蓋榫頭的那條 body 邊，把榫頭兩條長邊與該 body 邊求交
 * 得 Q1/Q2（落在真實邊上，斜邊也貼齊），在 Q1→外角→外角→Q2 之間鑿出外凸繞道。
 * 嵌不進（找不到吻合邊）回 null → 呼叫端 fallback 保留獨立矩形。
 */
function spliceTenonGeneral(outline: Pt[], t: Rect): Pt[] | null {
  const xs = outline.map((p) => p.x), ys = outline.map((p) => p.y);
  const bbMinX = Math.min(...xs), bbMaxX = Math.max(...xs);
  const bbMinY = Math.min(...ys), bbMaxY = Math.max(...ys);
  const dir = tenonOutwardDir(t, bbMinX, bbMaxX, bbMinY, bbMaxY);
  if (!dir) return null;
  const { ext, s } = dir;
  const getExt = (p: Pt) => (ext === "x" ? p.x : p.y);
  const getCross = (p: Pt) => (ext === "x" ? p.y : p.x);
  const mk = (cross: number, extv: number): Pt => (ext === "x" ? { x: extv, y: cross } : { x: cross, y: extv });

  let crossLo: number, crossHi: number, outerV: number;
  if (ext === "x") {
    crossLo = Math.min(t.y0, t.y1); crossHi = Math.max(t.y0, t.y1);
    outerV = s > 0 ? Math.max(t.x0, t.x1) : Math.min(t.x0, t.x1);
  } else {
    crossLo = Math.min(t.x0, t.x1); crossHi = Math.max(t.x0, t.x1);
    outerV = s > 0 ? Math.max(t.y0, t.y1) : Math.min(t.y0, t.y1);
  }

  // 找 body 邊：cross 跨距涵蓋榫頭、非平行 ext，取朝伸出方向最外側那條（斜度多大都吃）。
  // 只有兩條「端邊」會跨滿榫頭橫跨，故最外側者＝榫頭該接的那條；造型/端邊多斜都貼齊。
  const n = outline.length;
  let bestI = -1, bestExt = s > 0 ? -Infinity : Infinity;
  for (let i = 0; i < n; i++) {
    const A = outline[i], B = outline[(i + 1) % n];
    const ca = getCross(A), cb = getCross(B);
    if (Math.abs(ca - cb) < 0.5) continue;                       // 與 ext 平行的邊（cross 幾乎不變）跳過
    if (Math.min(ca, cb) > crossLo + 0.5 || Math.max(ca, cb) < crossHi - 0.5) continue; // 未涵蓋榫頭
    const edgeExt = (getExt(A) + getExt(B)) / 2;
    if (s > 0 ? edgeExt > bestExt : edgeExt < bestExt) { bestExt = edgeExt; bestI = i; }
  }
  if (bestI < 0) return null;

  const A = outline[bestI], B = outline[(bestI + 1) % n];
  const at = (cross: number): Pt => {
    const ca = getCross(A), cb = getCross(B);
    const tt = (cross - ca) / (cb - ca);
    return mk(cross, getExt(A) + tt * (getExt(B) - getExt(A)));
  };
  const Qlo = at(crossLo), Qhi = at(crossHi);
  const OuterLo = mk(crossLo, outerV), OuterHi = mk(crossHi, outerV);
  const incr = getCross(B) > getCross(A);                        // A→B cross 遞增 → 先遇 crossLo
  const detour = incr ? [Qlo, OuterLo, OuterHi, Qhi] : [Qhi, OuterHi, OuterLo, Qlo];

  const out: Pt[] = [];
  for (let k = 0; k <= bestI; k++) out.push(outline[k]);
  for (const d of detour) out.push(d);
  for (let k = bestI + 1; k < n; k++) out.push(outline[k]);
  // 去相鄰重複（Q 與端點重合時）
  const dd: Pt[] = [];
  for (const p of out) {
    const q = dd[dd.length - 1];
    if (!q || Math.abs(p.x - q.x) > 0.02 || Math.abs(p.y - q.y) > 0.02) dd.push(p);
  }
  if (dd.length > 1) {
    const f = dd[0], l = dd[dd.length - 1];
    if (Math.abs(f.x - l.x) < 0.02 && Math.abs(f.y - l.y) < 0.02) dd.pop();
  }
  return dd.length >= 4 ? dd : null;
}

/** 取某 view 的外框 raw 點 + bbox。 */
function outlineRaw(lp: Part, view: OrthoView): {
  pts: Array<{ x: number; y: number }>;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} | null {
  const raw = projectPartSilhouette(lp, view);
  if (raw.length < 3) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of raw) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  if (maxX - minX < 0.01 || maxY - minY < 0.01) return null;
  return { pts: raw, minX, minY, maxX, maxY };
}

/** 公榫在某 view 平面內的 raw(u,v) 凸出矩形；沿垂直該面的軸伸出（畫不到）回 null。 */
function tenonRawRect(
  part: Part,
  tenon: Part["tenons"][number],
  view: OrthoView,
): { uMin: number; uMax: number; vMin: number; vMax: number } | null {
  const ext = TENON_EXT_AXIS[tenon.position];
  if (!VIEW_IN_PLANE[view].includes(ext)) return null;
  const lb = tenonLocalBox(part, tenon);
  const ly = part.visible.thickness;
  const yShift = ly / 2;
  if (view === "top") {
    return { uMin: -(lb.cx + lb.hx), uMax: -(lb.cx - lb.hx), vMin: lb.cz - lb.hz, vMax: lb.cz + lb.hz };
  }
  if (view === "front") {
    return { uMin: -(lb.cx + lb.hx), uMax: -(lb.cx - lb.hx), vMin: lb.cy - lb.hy + yShift, vMax: lb.cy + lb.hy + yShift };
  }
  return { uMin: -(lb.cz + lb.hz), uMax: -(lb.cz - lb.hz), vMin: lb.cy - lb.hy + yShift, vMax: lb.cy + lb.hy + yShift };
}

/** 用 view 的外框 bbox 把一面組成 MachiningFace（外框 + 榫孔 + 榫頭凸出）。 */
function buildFace(
  lp: Part,
  part: Part,
  faceKey: string,
  view: OrthoView,
  mirrorU: boolean,
  holesRaw: RawHole[],
  /** 帶 shape 的同一個零件（用來畫「要鋸掉的成型線」）。不給＝沒有成型線。 */
  shapedLp?: Part,
): MachiningFace | null {
  const ol = outlineRaw(lp, view);
  if (!ol) return null;
  const { pts: rawPts, minX, maxY } = ol;
  const w = ol.maxX - ol.minX;
  const h = ol.maxY - ol.minY;
  const nx = (u: number) => {
    const x = u - minX;
    return mirrorU ? w - x : x;
  };
  const ny = (v: number) => maxY - v;
  const rectPts = (uMin: number, uMax: number, vMin: number, vMax: number) => {
    const x1 = nx(uMin), x2 = nx(uMax), y1 = ny(vMin), y2 = ny(vMax);
    const xa = Math.min(x1, x2), xb = Math.max(x1, x2), ya = Math.min(y1, y2), yb = Math.max(y1, y2);
    return [ { x: xa, y: ya }, { x: xb, y: ya }, { x: xb, y: yb }, { x: xa, y: yb } ];
  };

  const outline = rawPts.map((p) => ({ x: nx(p.x), y: ny(p.y) }));

  const holes: FaceHole[] = holesRaw.map((hr) => {
    if (hr.kind === "circle") {
      const cxN = (nx(hr.uMin) + nx(hr.uMax)) / 2;
      const cyN = (ny(hr.vMin) + ny(hr.vMax)) / 2;
      const r = Math.min(Math.abs(hr.uMax - hr.uMin), Math.abs(hr.vMax - hr.vMin)) / 2;
      return { kind: "circle", cx: cxN, cy: cyN, r, through: hr.through, label: hr.label, angleDeg: hr.angleDeg };
    }
    // 外斜腳剪切後的平行四邊形（4 角各自 nx/ny，含 mirrorU）；否則軸對齊矩形。
    const pts = hr.quad
      ? hr.quad.map((c) => ({ x: nx(c.u), y: ny(c.v) }))
      : rectPts(hr.uMin, hr.uMax, hr.vMin, hr.vMax);
    return { kind: "rect", pts, through: hr.through, label: hr.label, angleDeg: hr.angleDeg };
  });

  // 該面平面內的公榫凸出矩形
  const tenonRects: Array<{ x0: number; y0: number; x1: number; y1: number }> = [];
  (part.tenons ?? []).forEach((t) => {
    const r = tenonRawRect(part, t, view);
    if (!r) return;
    const p = rectPts(r.uMin, r.uMax, r.vMin, r.vMax);
    const xs2 = p.map((q) => q.x), ys2 = p.map((q) => q.y);
    tenonRects.push({ x0: Math.min(...xs2), y0: Math.min(...ys2), x1: Math.max(...xs2), y1: Math.max(...ys2) });
  });

  let finalOutline = outline;
  let tenons: FaceTenon[] = tenonRects.map((r, i) => ({
    pts: [ { x: r.x0, y: r.y0 }, { x: r.x1, y: r.y0 }, { x: r.x1, y: r.y1 }, { x: r.x0, y: r.y1 } ],
    label: `榫頭${i + 1}`,
  }));

  // 榫頭 union 進外框成單一輪廓——修「榫頭跟本體該是一條線 + 缺口」。
  if (tenonRects.length > 0 && isAxisRect(outline)) {
    // 矩形本體（腳等）：格線聯集，可同時併頂/底/端各向榫頭。
    const bxs = outline.map((p) => p.x), bys = outline.map((p) => p.y);
    const bodyRect = { x0: Math.min(...bxs), y0: Math.min(...bys), x1: Math.max(...bxs), y1: Math.max(...bys) };
    const merged = rectUnionOutline([bodyRect, ...tenonRects]);
    if (merged) { finalOutline = merged; tenons = []; }
  } else if (tenonRects.length > 0) {
    // 非矩形本體（造型曲線牙板/橫撐、錐腳/斜腳梯形面）：逐個把榫頭嵌接進外框。
    let cur = outline;
    const leftover: FaceTenon[] = [];
    for (let ti = 0; ti < tenonRects.length; ti++) {
      const spliced = spliceTenonGeneral(cur, tenonRects[ti]);
      if (spliced) cur = spliced;
      else {
        const r = tenonRects[ti];
        leftover.push({ pts: [ { x: r.x0, y: r.y0 }, { x: r.x1, y: r.y0 }, { x: r.x1, y: r.y1 }, { x: r.x0, y: r.y1 } ], label: `榫頭${ti + 1}` });
      }
    }
    finalOutline = cur;
    tenons = leftover; // 嵌接成功的併進外框；嵌不進的（極少）保留獨立矩形
  }

  // 邊界含榫頭一起算、整體平移歸零（union 後外框已含榫頭；未 union 時用榫頭矩形擴框）。
  const allPts = [...finalOutline, ...tenons.flatMap((t) => t.pts)];
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (const p of allPts) {
    if (p.x < bx0) bx0 = p.x; if (p.x > bx1) bx1 = p.x;
    if (p.y < by0) by0 = p.y; if (p.y > by1) by1 = p.y;
  }
  const sh = (p: { x: number; y: number }) => ({ x: p.x - bx0, y: p.y - by0 });

  // 成型線：同一個 view 的「帶 shape」輪廓，套同一組 nx/ny/sh 換算到同一個框。
  // 只有整條線都落在方料範圍內才留——超出去代表那個 shape 描述的不是切線，
  // 而是「裝上去之後歪掉的樣子」（外斜腳），畫上去只會害人。見 MachiningFace.shapeOutline。
  let shapeOutline: Array<{ x: number; y: number }> | undefined;
  if (shapedLp?.shape) {
    const so = outlineRaw(shapedLp, view);
    if (so) {
      const pts = so.pts.map((p) => sh({ x: nx(p.x), y: ny(p.y) }));
      const TOL = 0.05;
      const inside = pts.every(
        (p) => p.x >= -TOL && p.y >= -TOL && p.x <= bx1 - bx0 + TOL && p.y <= by1 - by0 + TOL,
      );
      // 跟方料本體同一條線（shape 在這個 view 看不出差別，例如只倒角一條邊）
      // 就不用多畫一條重疊的線。比的是「併榫頭之前」的本體輪廓——finalOutline
      // 已經把榫頭 union 進去，點數必然對不上，拿它比會永遠判成「有差」。
      const body = outline.map(sh);
      const differs = pts.length !== body.length
        || pts.some((p, i) => Math.abs(p.x - body[i].x) > 0.05 || Math.abs(p.y - body[i].y) > 0.05);
      if (inside && differs) shapeOutline = pts;
    }
  }

  return {
    faceKey, faceLabelZh: FACE_LABELS[faceKey] ?? faceKey,
    outline: finalOutline.map(sh),
    ...(shapeOutline ? { shapeOutline } : {}),
    holes: holes.map((hle) => hle.kind === "circle"
      ? { ...hle, cx: (hle.cx ?? 0) - bx0, cy: (hle.cy ?? 0) - by0 }
      : { ...hle, pts: hle.pts!.map(sh) }),
    tenons: tenons.map((t) => ({ ...t, pts: t.pts.map(sh) })),
    w: bx1 - bx0, h: by1 - by0,
  };
}

/** 沒有母榫的零件（牙條/橫撐等只有榫頭）→ 挑「榫頭在平面內最多、其次面積最大」的攤平面。 */
function bestFlatView(lp: Part, part: Part): OrthoView {
  const views: OrthoView[] = ["top", "front", "side"];
  let best: OrthoView = "top";
  let bestScore = -1;
  for (const v of views) {
    const ol = outlineRaw(lp, v);
    if (!ol) continue;
    const area = (ol.maxX - ol.minX) * (ol.maxY - ol.minY);
    const nTenon = (part.tenons ?? []).filter((t) => VIEW_IN_PLANE[v].includes(TENON_EXT_AXIS[t.position])).length;
    const score = nTenon * 1e9 + area; // 榫頭數優先，其次面積
    if (score > bestScore) { bestScore = score; best = v; }
  }
  return best;
}

/**
 * 一個零件 → 加工面清單：每個入榫面（含外框 + 榫孔 + 該面榫頭凸出）。
 * 只有榫頭沒母榫的零件（牙條/橫撐）→ 回一片攤平面（外框 + 榫頭）。
 * 完全沒榫接的零件 → 回 []（呼叫端 fallback 到純外框）。
 */
export interface DerivedMortise {
  lb: LocalBoxWithAxis;
  through: boolean;
  label: string;
}

/**
 * 要在哪個座標系描述這個零件。
 *
 * - `"shaped"`（預設）＝**成品**：輪廓是切完造型的形狀，外斜腳的孔跟著剪切。
 *   CNC 匯出要的是這個——機器切的就是成品輪廓。
 * - `"blank"` ＝**方料**（翻型階段那根方的）：輪廓、孔位、榫頭全部在去掉 shape
 *   的座標系裡算，另外附一條 `shapeOutline` 當「要鋸掉的線」。1:1 實尺樣板要的
 *   是這個——木工是「方料時先把孔找好、鑿好，之後才把造型切出來」（木頭仁
 *   2026-08-21，貼到料上才發現對不起來）。
 */
export type FaceFrame = "shaped" | "blank";

export function partMachiningFaces(
  part: Part,
  derived: DerivedMortise[] = [],
  frame: FaceFrame = "shaped",
): MachiningFace[] {
  const mortises = part.mortises ?? [];
  const tenons = part.tenons ?? [];
  const useBlank = frame === "blank";
  const geomPart: Part = useBlank ? { ...part, shape: undefined } : part;
  const lp = toLocalPart(geomPart);
  const lpShaped = useBlank ? toLocalPart(part) : undefined;

  // 依加工面把 raw 榫孔分組（真母榫 + 從榫頭反推的母榫）
  const byFace = new Map<string, RawHole[]>();
  const add = (h: RawHole) => {
    const arr = byFace.get(h.faceKey);
    if (arr) arr.push(h);
    else byFace.set(h.faceKey, [h]);
  };
  mortises.forEach((m, i) => {
    for (const h of mortiseToRawHoles(geomPart, m, i, useBlank)) add(h);
  });
  for (const d of derived) {
    for (const h of boxToRawHoles(d.lb, part.visible.thickness, d.through, false, d.label)) add(h);
  }

  const faces: MachiningFace[] = [];

  if (byFace.size > 0) {
    const ORDER = ["front", "back", "left", "right", "top", "bottom"];
    const keys = [...byFace.keys()].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
    for (const faceKey of keys) {
      const holesRaw = byFace.get(faceKey)!;
      const f = buildFace(lp, geomPart, faceKey, holesRaw[0].view, holesRaw[0].mirrorU, holesRaw, lpShaped);
      if (f) faces.push(f);
    }
    return faces;
  }

  // 無母榫但有榫頭 → 一片攤平面（外框 + 榫頭凸出）
  if (tenons.length > 0) {
    const view = bestFlatView(lp, part);
    const f = buildFace(lp, geomPart, "flat", view, false, [], lpShaped);
    if (f) { f.faceLabelZh = "攤平面"; faces.push(f); }
  }
  return faces;
}
