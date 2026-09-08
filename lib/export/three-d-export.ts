"use client";

import { BoxGeometry, BufferGeometry, Euler, Group, Mesh, MeshBasicMaterial } from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js";
import type { FurnitureDesign, Part } from "@/lib/types";
import { worldExtents } from "@/lib/render/geometry";
import { type ShapeSpec, buildShapeGeometry } from "@/lib/render/part-geometry";
import { validateGroup, MIN_PRINTABLE_MM, type GroupValidation } from "./export-checks";
import { buildFlatLayoutGroup } from "./flat-layout";
import { groupToModelXml, buildThreeMfZip } from "./three-mf";
import { subtractMortisesFromGeometry, buildOrdinaryTenonGeometry, evaluateJoineryGeometry, buildDovetailCutBrushes,
  dovetailCutsForPart, isDovetailReceiver, partMachiningMatrix, subtractDovetailReceiverGeometry, partForJoineryView } from "@/lib/render/mortise-csg";
import { mortiseLocalBox, tenonLocalBox } from "@/lib/render/svg-views";
import { buildWorldMortiseIndex, matchMortiseForTenon, tenonWorld } from "@/lib/assembly/joint-world";
import { constructionCutBox } from "@/lib/geometry/construction-cuts";

/** Accurate stock and explicit mortises only, NOT complete joinery/CNC tooling. */
export type ExportMode = "printable" | "mortise-accurate" | "joinery-accurate";
export const MORTISE_EXPORT_LIMITATIONS = "Explicit mortise cuts only; tenon protrusions and derived mating dovetail cuts are not included. Round cuts use 24 segments. Not a complete machining model or toolpath.";
export const JOINERY_EXPORT_LIMITATIONS = "Supported joinery only: ordinary rectangular tenons on box stock, axial round tenons on round stock, and renderer-defined dovetail receivers. No visual shrink or tip allowance. Compound-axis and special-profile tenons are rejected. Round geometry is polygonal; not a complete machining model or toolpath.";

export function assertExportOptions(scale: number, mode: ExportMode) {
  if (!Number.isFinite(scale) || scale <= 0) throw new Error("Invalid export scale");
  if (mode !== "printable" && mode !== "mortise-accurate" && mode !== "joinery-accurate") throw new Error("Unknown export mode");
}

// 預設 10:1 縮小（model 1mm = 實際 10mm）—— 適合家用 3D 列印機印
// 一張 200×200mm 床的方凳實體 400mm 高 → 模型 40mm。
const DEFAULT_SCALE = 0.1;

/**
 * 把 `part.shape`（Part["shape"]，mm 單位）對應成 part-geometry 的 ShapeSpec。
 *
 * PerspectiveView 的對應邏輯把 chamferMm / dxMm / dzMm 等乘了 SCALE（three-units）；
 * 匯出器整條 pipeline 走 mm，所以這裡等價於 SCALE=1——所有 mm 欄位直接帶過、
 * 不乘倍率。size 也用 mm（[visible.length, visible.thickness, visible.width]）。
 *
 * 對應不到（box / tilt-z / 無 shape）回傳 null → caller fallback 方塊。
 */
function toShapeSpec(shape: Part["shape"]): ShapeSpec | null {
  if (!shape) return null;
  if (shape.kind === "tapered") {
    return {
      kind: "tapered",
      bottomScale: shape.bottomScale,
      chamferMm: shape.chamferMm ? shape.chamferMm : undefined,
      chamferStyle: shape.chamferStyle,
    };
  }
  if (shape.kind === "splayed") {
    return {
      kind: "splayed",
      dx: shape.dxMm,
      dz: shape.dzMm,
      chamferMm: shape.chamferMm ? shape.chamferMm : undefined,
      chamferStyle: shape.chamferStyle,
    };
  }
  if (shape.kind === "hoof") {
    return {
      kind: "hoof",
      hoofHeight: shape.hoofMm,
      hoofScale: shape.hoofScale,
      dirX: shape.dirX ?? 0,
      dirZ: shape.dirZ ?? 0,
    };
  }
  if (shape.kind === "round") {
    return {
      kind: "round",
      chamferMm: shape.chamferMm ? shape.chamferMm : undefined,
      bottomChamferMm: shape.bottomChamferMm ? shape.bottomChamferMm : undefined,
      chamferStyle: shape.chamferStyle,
      axis: shape.axis,
    };
  }
  if (shape.kind === "round-tapered") {
    return { kind: "round-tapered", bottomScale: shape.bottomScale };
  }
  if (shape.kind === "shaker") {
    return {
      kind: "shaker",
      squareFrac: shape.squareFrac,
      bottomScale: shape.bottomScale,
    };
  }
  if (shape.kind === "lathe-turned") {
    return { kind: "lathe-turned" };
  }
  if (shape.kind === "splayed-tapered") {
    return {
      kind: "splayed-tapered",
      bottomScale: shape.bottomScale,
      dx: shape.dxMm,
      dz: shape.dzMm,
    };
  }
  if (shape.kind === "splayed-round-tapered") {
    return {
      kind: "splayed-round-tapered",
      bottomScale: shape.bottomScale,
      dx: shape.dxMm,
      dz: shape.dzMm,
    };
  }
  if (shape.kind === "apron-trapezoid") {
    return {
      kind: "apron-trapezoid",
      bevelAngle: shape.bevelAngle,
      topLengthScale: shape.topLengthScale,
      bottomLengthScale: shape.bottomLengthScale,
      taperSpanMm: shape.taperSpanMm,
      bevelMode: shape.bevelMode,
      anchor: shape.anchor,
    };
  }
  if (shape.kind === "quad") {
    return { kind: "quad", corners: shape.corners };
  }
  if (shape.kind === "apron-beveled") {
    return { kind: "apron-beveled", bevelAngle: shape.bevelAngle };
  }
  if (shape.kind === "apron-half-beveled") {
    return { kind: "apron-half-beveled", bevelAngle: shape.bevelAngle };
  }
  if (shape.kind === "chamfered-top") {
    return {
      kind: "chamfered-top",
      chamferMm: shape.chamferMm,
      bottomChamferMm: shape.bottomChamferMm ? shape.bottomChamferMm : undefined,
      style: shape.style,
      cornerR: shape.cornerR ? shape.cornerR : undefined,
    };
  }
  if (shape.kind === "chamfered-edges") {
    return { kind: "chamfered-edges", chamferMm: shape.chamferMm, style: shape.style };
  }
  if (shape.kind === "notched-corners") {
    return {
      kind: "notched-corners",
      notchLengthMm: shape.notchLengthMm,
      notchWidthMm: shape.notchWidthMm,
    };
  }
  if (shape.kind === "arch-bent") {
    return { kind: "arch-bent", bendMm: shape.bendMm, segments: shape.segments };
  }
  if (shape.kind === "live-edge") {
    return { kind: "live-edge", amplitudeMm: shape.amplitudeMm ?? 12 };
  }
  if (shape.kind === "seat-scoop") {
    return { kind: "seat-scoop", profile: shape.profile, depth: shape.depthMm };
  }
  if (shape.kind === "face-rounded") {
    return {
      kind: "face-rounded",
      cornerR: shape.cornerR,
      topArchMm: shape.topArchMm ?? 0,
      bottomArchMm: shape.bottomArchMm ?? 0,
      bendMm: shape.bendMm ?? 0,
      bendAxis: shape.bendAxis ?? "z",
    };
  }
  if (shape.kind === "mitered-ends") {
    return {
      kind: "mitered-ends",
      insetEach: shape.insetEach,
      outerSide: shape.outerSide,
      tiltAngle: shape.tiltAngle,
      bevelAngle: shape.bevelAngle,
      vertices: shape.vertices?.map(
        ([x, y, z]) => [x, y, z] as [number, number, number],
      ),
    };
  }
  if (shape.kind === "finger-joint-ends") {
    return {
      kind: "finger-joint-ends",
      segmentCount: shape.segmentCount,
      phase: shape.phase,
      fingerDepth: shape.fingerDepth,
      edgeChamferMm: shape.edgeChamferMm,
    };
  }
  if (shape.kind === "dovetail-ends") {
    return {
      kind: "dovetail-ends",
      segmentCount: shape.segmentCount,
      phase: shape.phase,
      angleDeg: shape.angleDeg,
      pinDepth: shape.pinDepth,
      halfPin: shape.halfPin,
    };
  }
  if (shape.kind === "regular-polygon") {
    return {
      kind: "regular-polygon",
      sides: shape.sides,
      outerRadius: shape.outerRadius,
      angleOffsetDeg: shape.angleOffsetDeg,
    };
  }
  if (shape.kind === "right-triangle") {
    return { kind: "right-triangle", corner: shape.corner };
  }
  if (shape.kind === "mitered-corner") {
    return {
      kind: "mitered-corner",
      axis: shape.axis,
      corner: shape.corner,
      depthMm: shape.depthMm,
      chamferMm: shape.chamferMm ? shape.chamferMm : undefined,
    };
  }
  if (shape.kind === "curved-taper") {
    return {
      kind: "curved-taper",
      blockHeightMm: shape.blockHeightMm,
      shoulderMm: shape.shoulderMm,
      insetMm: shape.insetMm,
      dir: shape.dir,
      dxMm: shape.dxMm,
      dzMm: shape.dzMm,
    };
  }
  if (shape.kind === "edge-profile") {
    return {
      kind: "edge-profile",
      profilePoints: shape.profilePoints,
      style: shape.style,
      depthMm: shape.depthMm,
      waveCount: shape.waveCount,
      topLengthScale: shape.topLengthScale,
      bottomLengthScale: shape.bottomLengthScale,
    };
  }
  if (shape.kind === "top-outline") {
    /**
     * ⛔ 原本只帶 `style` 與 `sizeMm`,**漏掉另外 4 個造型參數**
     *    (sizeZMm / squareness / archSides / lobes,見 lib/types/index.ts:352-353)。
     *    結果:任何有「椅面/桌面輪廓」選項的模板(餐桌 / 書桌 / 矮桌 / 茶几 / 邊桌 /
     *    餐椅 / 長凳 / 吧檯椅 / 方凳)只要選了 海棠形 8 瓣、或 圓形+方圓程度、
     *    或 外凸弧「四邊(枕形)/左右緣」、或 切角+切角深 Z,
     *    **匯出的 STL / OBJ / 3MF 桌面輪廓就跟畫面上的設計不一樣**——
     *    3D 列印或送 CNC 出來的形狀是錯的。(2026-08-21 稽核發現。)
     * ✅ 四個都帶上;它們在型別上是 optional,undefined 傳下去等同沒設,不影響既有行為。
     */
    return {
      kind: "top-outline",
      style: shape.style,
      sizeMm: shape.sizeMm,
      sizeZMm: shape.sizeZMm,
      squareness: shape.squareness,
      archSides: shape.archSides,
      lobes: shape.lobes,
    };
  }
  if (shape.kind === "pointed-ends") {
    return { kind: "pointed-ends" };
  }
  if (shape.kind === "french-cleat") {
    return { kind: "french-cleat", bevelAngle: shape.bevelAngle, orientation: shape.orientation };
  }
  // box / tilt-z / 未知 → 走方塊 fallback
  return null;
}

/**
 * 把單一零件轉成匯出用 geometry（mm 單位）：有對應 shape 走 buildShapeGeometry，
 * 否則 fallback 方塊。組裝匯出與攤平匯出共用，確保兩者幾何一致。
 */
export function partExportGeometry(part: Part, mode: ExportMode = "printable", context?: readonly Part[]): BufferGeometry {
  assertExportOptions(1, mode);
  if (mode === "joinery-accurate") return partJoineryGeometry(partForJoineryView(part), context);
  const sizeMm: [number, number, number] = [
    part.visible.length,
    part.visible.thickness,
    part.visible.width,
  ];
  if (mode === "mortise-accurate") {
    if (!sizeMm.every(n => Number.isFinite(n) && n > 0)
      || !Object.values(part.origin).every(Number.isFinite)
      || !Object.values(part.rotation ?? {}).every(Number.isFinite)) throw new Error(`${part.id}: invalid stock dimensions/position`);
    for (const m of part.mortises) {
      if ("constructionCut" in m && !constructionCutBox(m)) throw new Error(`${part.id}: invalid explicit construction cut`);
      if (![m.depth, m.length, m.width].every(n => Number.isFinite(n) && n > 0)
        || ![m.rotX ?? 0, m.rotY ?? 0, m.rotZ ?? 0, ...Object.values(m.origin)].every(Number.isFinite)) throw new Error(`${part.id}: invalid mortise dimensions/rotation`);
      if (m.axis) throw new Error(`${part.id}: world-axis mortises are not supported by accurate export`);
      if (m.shape && m.shape !== "rect" && m.shape !== "round") throw new Error(`${part.id}: unsupported mortise shape`);
    }
  }
  const spec = toShapeSpec(part.shape);
  const shapeGeom = spec ? buildShapeGeometry(spec, sizeMm) : null;
  if (mode === "mortise-accurate" && part.shape && part.shape.kind !== "box" && !shapeGeom) {
    throw new Error(`${part.id}: unsupported export shape ${part.shape.kind}`);
  }
  const base = shapeGeom ?? new BoxGeometry(...sizeMm);
  if (mode === "printable") return base;
  if (part.mortises.length === 0) {
    const pos = base.getAttribute("position");
    if (!pos?.count || !Array.from(pos.array).every(Number.isFinite)) {
      base.dispose();
      throw new Error(`${part.id}: invalid stock geometry`);
    }
    return base;
  }
  try {
    const boxes = part.mortises.map(m => {
      const box = mortiseLocalBox(part, m);
      for (const axis of ["rotX", "rotY", "rotZ"] as const) {
        if ((m[axis] ?? 0) !== (box[axis] ?? 0)) throw new Error(`${part.id}: unsupported mortise rotation ${axis}`);
      }
      return box;
    });
    const result = subtractMortisesFromGeometry(base, boxes,
      part.mortises.map(m => m.shape === "round" ? "round" : "rect"), { strict: true, unitsPerMm: 1 });
    return result;
  } finally { base.dispose(); }
}

function partJoineryGeometry(part: Part, context?: readonly Part[]): BufferGeometry {
  if (isDovetailReceiver(part) && !context) throw new Error(`${part.id}: dovetail receiver requires design context`);
  if (part.shape?.kind === "dovetail-ends" && (!context || !context.some(isDovetailReceiver))) {
    throw new Error(`${part.id}: unsupported dovetail receiver context`);
  }
  let geometry = partExportGeometry(part, "mortise-accurate");
  try {
    const mortiseIndex = context && part.tenons.length ? buildWorldMortiseIndex([...context]) : [];
    for (const tenon of part.tenons) {
      const topBottom = tenon.position === "top" || tenon.position === "bottom";
      const round = part.shape?.kind === "round" && !part.shape.chamferMm && !part.shape.bottomChamferMm && topBottom &&
        (part.shape.axis === "y" || (!part.shape.axis && part.visible.thickness >= Math.max(part.visible.length, part.visible.width)));
      const boxStock = !part.shape || part.shape.kind === "box";
      if (tenon.axis || (!boxStock && !round) || !["through-tenon", "blind-tenon", "shouldered-tenon", "stub-joint", "tongue-and-groove"].includes(tenon.type)) {
        throw new Error(`${part.id}: unsupported tenon profile/axis/type`);
      }
      if (![tenon.length, tenon.width, tenon.thickness].every(n => Number.isFinite(n) && n >= 0.1)
        || ![tenon.offsetWidth ?? 0, tenon.offsetThickness ?? 0].every(Number.isFinite)) throw new Error(`${part.id}: invalid tenon dimensions`);
      const matched = matchMortiseForTenon(part, tenon, tenonWorld(part, tenon), mortiseIndex);
      if (matched && !matched.through && matched.depth < tenon.length) {
        throw new Error(`${part.id}: tenon exceeds matched blind mortise depth; dimensional export will not apply the renderer's visual clamp`);
      }
      const box = tenonLocalBox(part, tenon);
      const long = tenon.position === "start" || tenon.position === "end" ? "x" : topBottom ? "y" : "z";
      const half = { x: part.visible.length / 2, y: part.visible.thickness / 2, z: part.visible.width / 2 };
      for (const axis of ["x", "y", "z"] as const) {
        if (axis !== long && Math.abs(box[`c${axis}`]) + box[`h${axis}`] > half[axis] + 1e-6) throw new Error(`${part.id}: tenon extends outside shoulder`);
      }
      if (round && (tenon.offsetWidth || tenon.offsetThickness)) throw new Error(`${part.id}: unsupported offset round tenon`);
      const extra = buildOrdinaryTenonGeometry(tenon.position, box, round, 1, 0);
      extra.translate(box.cx, box.cy, box.cz);
      try {
        const joined = evaluateJoineryGeometry(geometry, [extra], "add", 1);
        geometry.dispose(); geometry = joined;
      } finally { extra.dispose(); }
    }
    if (context && isDovetailReceiver(part)) {
      const cutters = buildDovetailCutBrushes(context, 1, 0);
      try {
        const cuts = dovetailCutsForPart(part, cutters);
        if (cuts?.length) {
          const matrix = partMachiningMatrix(part);
          const result = subtractDovetailReceiverGeometry(geometry, matrix, cuts, 1).applyMatrix4(matrix.invert());
          geometry.dispose(); geometry = result;
        }
      } finally {
        for (const { brush } of cutters) { brush.geometry.dispose();
          for (const m of Array.isArray(brush.material) ? brush.material : [brush.material]) m.dispose(); }
      }
    }
    return geometry;
  } catch (err) { geometry.dispose(); throw err; }
}

/**
 * 太薄件自動加厚——逐軸檢查，某維度「縮放後」< MIN_PRINTABLE_MM（噴嘴 2 倍）就把
 * 該軸放大到剛好達標。例：背板 3mm 在 1:10 → 0.3mm，會被撐到 0.8mm 才印得出來。
 * 代價：加厚的件比例略失真，但「印得出來」優先。就地修改 geom。
 */
export function thickenForPrint(geom: BufferGeometry, scale: number) {
  if (scale <= 0) return;
  geom.computeBoundingBox();
  const bb = geom.boundingBox;
  if (!bb) return;
  const size = [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z];
  const minMm = MIN_PRINTABLE_MM / scale; // 縮放前需要的最小 mm
  const f: [number, number, number] = [1, 1, 1];
  let need = false;
  for (let i = 0; i < 3; i++) {
    if (size[i] > 1e-6 && size[i] < minMm) {
      f[i] = minMm / size[i];
      need = true;
    }
  }
  if (need) geom.scale(f[0], f[1], f[2]);
}

// 簡化版：每件 part 用 part.shape 對應的幾何（方塊件走 BoxGeometry）。
// - 形狀建模與 3D 預覽共用 lib/render/part-geometry.ts 的 buildShapeGeometry，
//   斜度（tapered/splayed/hoof…）/弧度（round/lathe-turned/arch-bent…）件
//   匯出後形狀正確、不再變方塊。
// - origin 慣例：Y 軸 origin 在 part 底面 → 套 +yExt/2 補回中心
// - rotation：Euler ZYX（與 PerspectiveView 一致）
// - 三視圖 Y up（three.js native）→ 套 group.rotation.x = -90° 換成 Z up
//   讓 slicer / SketchUp 匯入時直接站立、不用使用者再 rotate。
// - 所有零件都匯出（含五金：把手/玻璃等 visual 件）。
// - 太薄件（縮放後 < 0.8mm）自動加厚到可印厚度。
// - Default printable mode omits joinery; mortise-accurate subtracts explicit cuts only.
function buildGroup(design: FurnitureDesign, scale: number, mode: ExportMode = "printable"): Group {
  assertExportOptions(scale, mode);
  const root = new Group();
  const mat = new MeshBasicMaterial();

  for (const part of design.parts) {
    const p = mode === "joinery-accurate" ? partForJoineryView(part) : part;
    const geom = partExportGeometry(p, mode, design.parts);
    if (mode === "printable") thickenForPrint(geom, scale);
    const mesh = new Mesh(geom, mat);
    mesh.name = p.nameZh || p.id;
    const { yExt } = worldExtents(p);
    mesh.position.set(p.origin.x, p.origin.y + yExt / 2, p.origin.z);
    const rx = p.rotation?.x ?? 0;
    const ry = p.rotation?.y ?? 0;
    const rz = p.rotation?.z ?? 0;
    mesh.rotation.copy(new Euler(rx, ry, rz, "ZYX"));
    root.add(mesh);
  }
  // Y up → Z up（slicer / SketchUp 慣例）
  root.rotation.x = -Math.PI / 2;
  root.scale.setScalar(scale);
  root.updateMatrixWorld(true);
  return root;
}

/**
 * 建出零件 Group 並跑幾何自檢——給 UI 事前顯示「破面零件」提示用。
 * 流形性與比例無關，固定用 scale=1 建。
 */
export function validateDesignExport(design: FurnitureDesign, mode: ExportMode = "printable"): GroupValidation {
  const group = buildGroup(design, 1, mode);
  // 自檢用的 group 是暫時的——驗完即釋放各零件 geometry，避免 UI 每次
  // 改設計都在 useMemo 裡建一份不回收。
  try { return validateGroup(group); }
  finally { disposeExportGroup(group); }
}

export function disposeExportGroup(group: Group) {
  group.traverse((obj) => {
    const mesh = obj as Mesh;
    if (mesh.isMesh) {
      mesh.geometry.dispose();
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose();
    }
  });
}

/** 匯出時對 group 跑自檢，有問題的零件印 console 警告（非阻擋）。 */
function warnIfInvalid(group: Group) {
  const v = validateGroup(group);
  if (v.ok) return;
  for (const p of v.badParts) {
    console.warn(
      `[3D 匯出] 零件「${p.partName}」幾何異常：` +
        `NaN 頂點 ${p.nanVertices}、退化面 ${p.degenerateTris}、非流形邊 ${p.nonManifoldEdges}`,
    );
  }
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function suffix(scale: number) {
  // 0.1 → "1-10"（縮小比例），1 → "1-1"
  if (scale >= 0.999 && scale <= 1.001) return "1-1";
  const ratio = Math.round(1 / scale);
  return `1-${ratio}`;
}

// 中文檔名在 Mac/某些 slicer/雲端服務上會被轉碼成亂碼或被拒；
// 改用 category（"stool"/"dining-table" 等 ASCII id）保證跨平台相容。
function safeStem(design: FurnitureDesign, scale: number, mode: ExportMode) {
  // 本地日期（非 UTC）——台灣清晨匯出時 toISOString() 會少一天。sv-SE locale 給 YYYY-MM-DD。
  const today = new Date().toLocaleDateString("sv-SE");
  return `${design.category}_${suffix(scale)}_${today}${mode === "mortise-accurate" ? "_mortise-only" : mode === "joinery-accurate" ? "_supported-joinery" : ""}`;
}

export function downloadSTL(design: FurnitureDesign, scale: number = DEFAULT_SCALE, mode: ExportMode = "printable") {
  downloadFormat(design, scale, mode, "stl");
}

/**
 * 匯出「攤平排版」STL——所有零件攤平躺平、互不重疊排在虛擬列印床上，
 * 適合直接送切片器免支撐列印。與 downloadSTL（組裝姿態）並存。
 */
export function downloadFlatLayoutSTL(design: FurnitureDesign, scale: number = DEFAULT_SCALE, mode: ExportMode = "printable") {
  downloadFormat(design, scale, mode, "stl", true);
}

export function downloadOBJ(design: FurnitureDesign, scale: number = DEFAULT_SCALE, mode: ExportMode = "printable") {
  downloadFormat(design, scale, mode, "obj");
}

/**
 * 匯出 3MF——切片器（Bambu / Prusa / Cura）偏好的格式，內含單位（mm）、
 * 多物件、零件中文名。組裝姿態。與 STL/OBJ 並存。
 */
export function download3MF(design: FurnitureDesign, scale: number = DEFAULT_SCALE, mode: ExportMode = "printable") {
  downloadFormat(design, scale, mode, "3mf");
}

function downloadFormat(design: FurnitureDesign, scale: number, mode: ExportMode, format: "stl" | "obj" | "3mf", flat = false) {
  const group = flat ? buildFlatLayoutGroup(design, scale, mode) : buildGroup(design, scale, mode);
  try {
    warnIfInvalid(group);
    let data: BlobPart;
    if (format === "stl") {
      const view = new STLExporter().parse(group, { binary: true }) as DataView;
      data = view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
    } else if (format === "obj") data = new OBJExporter().parse(group);
    else data = buildThreeMfZip(groupToModelXml(group)) as BlobPart;
    triggerDownload(new Blob([data], { type: `model/${format}` }), `${safeStem(design, scale, mode)}${flat ? "_flat" : ""}.${format}`);
  } finally { disposeExportGroup(group); }
}

// 測試 / 驗證用：取得未縮放的零件 Group（mm 單位、Z-up）。
export { buildGroup };
