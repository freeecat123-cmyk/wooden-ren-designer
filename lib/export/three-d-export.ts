"use client";

import { BoxGeometry, Euler, Group, Mesh, MeshBasicMaterial } from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js";
import type { FurnitureDesign, Part } from "@/lib/types";
import { worldExtents } from "@/lib/render/geometry";

// 預設 10:1 縮小（model 1mm = 實際 10mm）—— 適合家用 3D 列印機印
// 一張 200×200mm 床的方凳實體 400mm 高 → 模型 40mm。
const DEFAULT_SCALE = 0.1;

// 簡化版：每件 part 用 visible 尺寸做一個 box。
// - origin 慣例：Y 軸 origin 在 part 底面 → 套 +yExt/2 補回中心
// - rotation：Euler ZYX（與 PerspectiveView 一致）
// - 三視圖 Y up（three.js native）→ 套 group.rotation.x = -90° 換成 Z up
//   讓 slicer / SketchUp 匯入時直接站立、不用使用者再 rotate。
// - 略過 visual 五金件（玻璃/金屬/絨布等）；榫頭凸出、倒角、tapered
//   等 shape variant 一律走盒體。
function buildGroup(design: FurnitureDesign, scale: number): Group {
  const root = new Group();
  const mat = new MeshBasicMaterial();

  for (const part of design.parts) {
    if (part.visual) continue;
    const p: Part = part;
    const geom = new BoxGeometry(p.visible.length, p.visible.thickness, p.visible.width);
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
  const data = new STLExporter().parse(group, { binary: true }) as DataView;
  const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  const blob = new Blob([buffer], { type: "model/stl" });
  triggerDownload(blob, `${safeStem(design, scale)}.stl`);
}

export function downloadOBJ(design: FurnitureDesign, scale: number = DEFAULT_SCALE) {
  const group = buildGroup(design, scale);
  const data = new OBJExporter().parse(group);
  const blob = new Blob([data], { type: "model/obj" });
  triggerDownload(blob, `${safeStem(design, scale)}.obj`);
}
