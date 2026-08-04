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
  through: boolean;
  label: string;
}

/** 一個母榫 → 它所在加工面 + raw(u,v) 榫孔框。through-y 榫孔回兩面（翻哪面都在）。 */
function mortiseToRawHoles(part: Part, m: Part["mortises"][number], idx: number): RawHole[] {
  const lb = mortiseLocalBox(part, m);
  const axis = lb.depthAxis ?? "y";
  const ly = part.visible.thickness;
  const yShift = ly / 2; // front/side 的 v = y + ly/2
  const label = m.label ?? `榫孔${idx + 1}`;
  const round = m.shape === "round";

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
    through: m.through,
    label,
  });

  if (axis === "y") {
    // 頂/底面：view=top，(u,v)=(-x, z)
    const uMin = -(lb.cx + lb.hx);
    const uMax = -(lb.cx - lb.hx);
    const vMin = lb.cz - lb.hz;
    const vMax = lb.cz + lb.hz;
    if (m.through) {
      // 打穿：翻哪一面都在 → 頂 + 底各給一份
      return [
        mk("top", "top", false, uMin, uMax, vMin, vMax),
        mk("bottom", "top", true, uMin, uMax, vMin, vMax),
      ];
    }
    const top = lb.cy > 0;
    return [mk(top ? "top" : "bottom", "top", !top, uMin, uMax, vMin, vMax)];
  }
  if (axis === "z") {
    // 正/背面：view=front，(u,v)=(-x, y+ly/2)
    const uMin = -(lb.cx + lb.hx);
    const uMax = -(lb.cx - lb.hx);
    const vMin = lb.cy - lb.hy + yShift;
    const vMax = lb.cy + lb.hy + yShift;
    if (m.through) {
      return [
        mk("front", "front", false, uMin, uMax, vMin, vMax),
        mk("back", "front", true, uMin, uMax, vMin, vMax),
      ];
    }
    const front = lb.cz > 0;
    return [mk(front ? "front" : "back", "front", !front, uMin, uMax, vMin, vMax)];
  }
  // axis === "x"：左/右端面：view=side，(u,v)=(-z, y+ly/2)
  const uMin = -(lb.cz + lb.hz);
  const uMax = -(lb.cz - lb.hz);
  const vMin = lb.cy - lb.hy + yShift;
  const vMax = lb.cy + lb.hy + yShift;
  if (m.through) {
    return [
      mk("right", "side", false, uMin, uMax, vMin, vMax),
      mk("left", "side", true, uMin, uMax, vMin, vMax),
    ];
  }
  const right = lb.cx > 0;
  return [mk(right ? "right" : "left", "side", !right, uMin, uMax, vMin, vMax)];
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
      return { kind: "circle", cx: cxN, cy: cyN, r, through: hr.through, label: hr.label };
    }
    return { kind: "rect", pts: rectPts(hr.uMin, hr.uMax, hr.vMin, hr.vMax), through: hr.through, label: hr.label };
  });

  // 該面平面內的公榫凸出
  const tenons: FaceTenon[] = [];
  (part.tenons ?? []).forEach((t, i) => {
    const r = tenonRawRect(part, t, view);
    if (r) tenons.push({ pts: rectPts(r.uMin, r.uMax, r.vMin, r.vMax), label: `榫頭${i + 1}` });
  });

  // 榫頭會凸出外框（負座標或 > w/h）→ 把邊界含榫頭一起算、整體平移歸零，
  // 否則套料 packing 只用外框 bbox 會讓榫頭撞到隔壁片。
  if (tenons.length > 0) {
    let bx0 = 0, by0 = 0, bx1 = w, by1 = h;
    for (const t of tenons) for (const p of t.pts) {
      if (p.x < bx0) bx0 = p.x; if (p.x > bx1) bx1 = p.x;
      if (p.y < by0) by0 = p.y; if (p.y > by1) by1 = p.y;
    }
    if (bx0 !== 0 || by0 !== 0 || bx1 !== w || by1 !== h) {
      const sh = (p: { x: number; y: number }) => ({ x: p.x - bx0, y: p.y - by0 });
      const shifted = { w: bx1 - bx0, h: by1 - by0 };
      return {
        faceKey, faceLabelZh: FACE_LABELS[faceKey] ?? faceKey,
        outline: outline.map(sh),
        holes: holes.map((hle) => hle.kind === "circle"
          ? { ...hle, cx: (hle.cx ?? 0) - bx0, cy: (hle.cy ?? 0) - by0 }
          : { ...hle, pts: hle.pts!.map(sh) }),
        tenons: tenons.map((t) => ({ ...t, pts: t.pts.map(sh) })),
        w: shifted.w, h: shifted.h,
      };
    }
  }

  return { faceKey, faceLabelZh: FACE_LABELS[faceKey] ?? faceKey, outline, holes, tenons, w, h };
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
export function partMachiningFaces(part: Part): MachiningFace[] {
  const mortises = part.mortises ?? [];
  const tenons = part.tenons ?? [];
  const lp = toLocalPart(part);

  // 依加工面把 raw 榫孔分組
  const byFace = new Map<string, RawHole[]>();
  mortises.forEach((m, i) => {
    for (const h of mortiseToRawHoles(part, m, i)) {
      const arr = byFace.get(h.faceKey);
      if (arr) arr.push(h);
      else byFace.set(h.faceKey, [h]);
    }
  });

  const faces: MachiningFace[] = [];

  if (byFace.size > 0) {
    const ORDER = ["front", "back", "left", "right", "top", "bottom"];
    const keys = [...byFace.keys()].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
    for (const faceKey of keys) {
      const holesRaw = byFace.get(faceKey)!;
      const f = buildFace(lp, part, faceKey, holesRaw[0].view, holesRaw[0].mirrorU, holesRaw);
      if (f) faces.push(f);
    }
    return faces;
  }

  // 無母榫但有榫頭 → 一片攤平面（外框 + 榫頭凸出）
  if (tenons.length > 0) {
    const view = bestFlatView(lp, part);
    const f = buildFace(lp, part, "flat", view, false, []);
    if (f) { f.faceLabelZh = "攤平面"; faces.push(f); }
  }
  return faces;
}
