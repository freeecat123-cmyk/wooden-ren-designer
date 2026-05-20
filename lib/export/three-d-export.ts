"use client";

import { BoxGeometry, BufferGeometry, Euler, Group, Mesh, MeshBasicMaterial } from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js";
import type { FurnitureDesign, Part } from "@/lib/types";
import { worldExtents } from "@/lib/render/geometry";
import { type ShapeSpec, buildShapeGeometry } from "@/lib/render/part-geometry";
import { validateGroup, type GroupValidation } from "./export-checks";

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
      bevelMode: shape.bevelMode,
    };
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
  // box / tilt-z / 未知 → 走方塊 fallback
  return null;
}

/**
 * 把單一零件轉成匯出用 geometry（mm 單位）：有對應 shape 走 buildShapeGeometry，
 * 否則 fallback 方塊。組裝匯出與攤平匯出共用，確保兩者幾何一致。
 */
export function partExportGeometry(part: Part): BufferGeometry {
  const sizeMm: [number, number, number] = [
    part.visible.length,
    part.visible.thickness,
    part.visible.width,
  ];
  const spec = toShapeSpec(part.shape);
  const shapeGeom = spec ? buildShapeGeometry(spec, sizeMm) : null;
  return shapeGeom ?? new BoxGeometry(sizeMm[0], sizeMm[1], sizeMm[2]);
}

// 簡化版：每件 part 用 part.shape 對應的幾何（方塊件走 BoxGeometry）。
// - 形狀建模與 3D 預覽共用 lib/render/part-geometry.ts 的 buildShapeGeometry，
//   斜度（tapered/splayed/hoof…）/弧度（round/lathe-turned/arch-bent…）件
//   匯出後形狀正確、不再變方塊。
// - origin 慣例：Y 軸 origin 在 part 底面 → 套 +yExt/2 補回中心
// - rotation：Euler ZYX（與 PerspectiveView 一致）
// - 三視圖 Y up（three.js native）→ 套 group.rotation.x = -90° 換成 Z up
//   讓 slicer / SketchUp 匯入時直接站立、不用使用者再 rotate。
// - 略過 visual 五金件（玻璃/金屬/絨布等）。
// - 簡化：不匯出榫頭凸出 / 榫眼 CSG 挖洞。
function buildGroup(design: FurnitureDesign, scale: number): Group {
  const root = new Group();
  const mat = new MeshBasicMaterial();

  for (const part of design.parts) {
    if (part.visual) continue;
    const p: Part = part;
    const geom = partExportGeometry(p);
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
export function validateDesignExport(design: FurnitureDesign): GroupValidation {
  const group = buildGroup(design, 1);
  const result = validateGroup(group);
  // 自檢用的 group 是暫時的——驗完即釋放各零件 geometry，避免 UI 每次
  // 改設計都在 useMemo 裡建一份不回收。
  group.traverse((obj) => {
    const mesh = obj as Mesh;
    if (mesh.isMesh) mesh.geometry.dispose();
  });
  return result;
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
function safeStem(design: FurnitureDesign, scale: number) {
  const today = new Date().toISOString().slice(0, 10);
  return `${design.category}_${suffix(scale)}_${today}`;
}

export function downloadSTL(design: FurnitureDesign, scale: number = DEFAULT_SCALE) {
  const group = buildGroup(design, scale);
  warnIfInvalid(group);
  const data = new STLExporter().parse(group, { binary: true }) as DataView;
  const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  const blob = new Blob([buffer], { type: "model/stl" });
  triggerDownload(blob, `${safeStem(design, scale)}.stl`);
}

export function downloadOBJ(design: FurnitureDesign, scale: number = DEFAULT_SCALE) {
  const group = buildGroup(design, scale);
  warnIfInvalid(group);
  const data = new OBJExporter().parse(group);
  const blob = new Blob([data], { type: "model/obj" });
  triggerDownload(blob, `${safeStem(design, scale)}.obj`);
}

// 測試 / 驗證用：取得未縮放的零件 Group（mm 單位、Z-up）。
export { buildGroup };
