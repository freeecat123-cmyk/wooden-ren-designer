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
import { mortiseLocalBox } from "@/lib/render/svg-views";

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

export interface MachiningFace {
  /** "top" | "bottom" | "front" | "back" | "left" | "right" */
  faceKey: string;
  faceLabelZh: string;
  /** 外框輪廓（歸一化 SVG mm 框，左上原點、Y 向下）。 */
  outline: Array<{ x: number; y: number }>;
  holes: FaceHole[];
  /** 外框寬 / 高（mm）。 */
  w: number;
  h: number;
}

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

/**
 * 一個零件 → 它所有母榫的加工面清單（每個入榫面一項，含外框 + 榫孔內框）。
 * 沒有母榫的零件回 []（呼叫端可 fallback 到單純外框）。
 */
export function partMachiningFaces(part: Part): MachiningFace[] {
  const mortises = part.mortises ?? [];
  if (mortises.length === 0) return [];

  // 依加工面把 raw 榫孔分組
  const byFace = new Map<string, RawHole[]>();
  mortises.forEach((m, i) => {
    for (const h of mortiseToRawHoles(part, m, i)) {
      const arr = byFace.get(h.faceKey);
      if (arr) arr.push(h);
      else byFace.set(h.faceKey, [h]);
    }
  });

  const lp = toLocalPart(part);
  const faces: MachiningFace[] = [];
  // 面順序穩定輸出
  const ORDER = ["front", "back", "left", "right", "top", "bottom"];
  const keys = [...byFace.keys()].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));

  for (const faceKey of keys) {
    const holesRaw = byFace.get(faceKey)!;
    const view = holesRaw[0].view;
    const mirrorU = holesRaw[0].mirrorU;
    const ol = outlineRaw(lp, view);
    if (!ol) continue;
    const { pts: rawPts, minX, maxY } = ol;
    const w = ol.maxX - ol.minX;
    const h = ol.maxY - ol.minY;

    // 歸一化：X = u - minX；Y = maxY - v（翻 Y）。負向面再鏡射 U：X = w - X。
    const nx = (u: number) => {
      const x = u - minX;
      return mirrorU ? w - x : x;
    };
    const ny = (v: number) => maxY - v;

    const outline = rawPts.map((p) => ({ x: nx(p.x), y: ny(p.y) }));

    const holes: FaceHole[] = holesRaw.map((hr) => {
      if (hr.kind === "circle") {
        const cxN = (nx(hr.uMin) + nx(hr.uMax)) / 2;
        const cyN = (ny(hr.vMin) + ny(hr.vMax)) / 2;
        const r = Math.min(Math.abs(hr.uMax - hr.uMin), Math.abs(hr.vMax - hr.vMin)) / 2;
        return { kind: "circle", cx: cxN, cy: cyN, r, through: hr.through, label: hr.label };
      }
      // rect 4 角（nx 已含鏡射，順序仍構成合法閉合矩形）
      const x1 = nx(hr.uMin), x2 = nx(hr.uMax);
      const y1 = ny(hr.vMin), y2 = ny(hr.vMax);
      const xa = Math.min(x1, x2), xb = Math.max(x1, x2);
      const ya = Math.min(y1, y2), yb = Math.max(y1, y2);
      return {
        kind: "rect",
        pts: [ { x: xa, y: ya }, { x: xb, y: ya }, { x: xb, y: yb }, { x: xa, y: yb } ],
        through: hr.through,
        label: hr.label,
      };
    });

    faces.push({ faceKey, faceLabelZh: FACE_LABELS[faceKey] ?? faceKey, outline, holes, w, h });
  }
  return faces;
}
