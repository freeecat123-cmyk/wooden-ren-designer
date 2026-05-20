"use client";

import { BoxGeometry, Euler, Group, Mesh, MeshBasicMaterial } from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js";
import type { FurnitureDesign, Part } from "@/lib/types";

// 簡化版：每件 part 用 visible 尺寸做一個 box，origin 在 part 中心。
// 單位輸出為 mm（slicer 預設、SketchUp 匯入時選 mm）。
// 略過：榫頭凸出、倒角、tapered/splayed/hoof 等 shape variant、玻璃/金屬五金。
function buildGroup(design: FurnitureDesign): Group {
  const root = new Group();
  const mat = new MeshBasicMaterial();

  for (const part of design.parts) {
    if (part.visual) continue; // 跳過玻璃/金屬/絨布等非木件
    const p: Part = part;
    const geom = new BoxGeometry(p.visible.length, p.visible.thickness, p.visible.width);
    const mesh = new Mesh(geom, mat);
    mesh.name = p.nameZh || p.id;
    mesh.position.set(p.origin.x, p.origin.y, p.origin.z);
    const rx = p.rotation?.x ?? 0;
    const ry = p.rotation?.y ?? 0;
    const rz = p.rotation?.z ?? 0;
    mesh.rotation.copy(new Euler(rx, ry, rz, "ZYX"));
    root.add(mesh);
  }
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

export function downloadSTL(design: FurnitureDesign) {
  const group = buildGroup(design);
  const data = new STLExporter().parse(group, { binary: true }) as DataView;
  const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  const blob = new Blob([buffer], { type: "model/stl" });
  const today = new Date().toISOString().slice(0, 10);
  triggerDownload(blob, `${design.nameZh}_${today}.stl`);
}

export function downloadOBJ(design: FurnitureDesign) {
  const group = buildGroup(design);
  const data = new OBJExporter().parse(group);
  const blob = new Blob([data], { type: "model/obj" });
  const today = new Date().toISOString().slice(0, 10);
  triggerDownload(blob, `${design.nameZh}_${today}.obj`);
}
