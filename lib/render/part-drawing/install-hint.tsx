/**
 * <InstallHintMini> — 安裝位置縮圖（Phase 2.5 Task 1）。
 *
 * 在每張零件圖卡右上角，畫一個 80×80px 的小 SVG，秀出整個家具的「正視 bbox
 * 投影」、把當前 part 用紅色 fill 標出來，方便木匠一眼看出這個零件裝在哪。
 *
 * **避 Three.js**：純 SVG / 純 SSR-safe，不依賴 `<PerspectiveView>` 或 R3F。
 * **算法**：把所有 part 的 origin + visible.length / visible.thickness 投影到 X-Y 平面
 * （front view 的橫 = world X，縱 = world Y）。target part 紅色 fill，其他細灰
 * outline 當參考。
 *
 * Spec: docs/superpowers/specs/2026-05-17-part-drawings-phase-2-5-design.md §1
 */
import React from "react";
import type { FurnitureDesign, Part } from "@/lib/types";
import { worldExtents, convexHull2D } from "@/lib/render/geometry";

/**
 * 零件在「俯視（X-Z 平面）」的真實佔地多邊形（含 rotation）。
 * worldExtents 只給軸對齊 AABB，旋轉件（六/八角盒壁、斜置隔板）會被畫成
 * 外接方框、整圈疊成方塊（user 2026-06-15「右上角六/八角小圖不對」）。
 * 這裡把 8 個 local 角經 Euler(XYZ) + origin 投影到世界 X-Z 取凸包，得到
 * 旋轉後的真實footprint。回傳 {x: 世界 X, y: 世界 Z}。
 */
function topFootprint(p: Part): Array<{ x: number; y: number }> {
  const lx = p.visible.length, ly = p.visible.thickness, lz = p.visible.width;
  const rx = p.rotation?.x ?? 0, ry = p.rotation?.y ?? 0, rz = p.rotation?.z ?? 0;
  const cx = Math.cos(rx), sx = Math.sin(rx);
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const cz = Math.cos(rz), sz = Math.sin(rz);
  const ox = p.origin?.x ?? 0, oz = p.origin?.z ?? 0;
  const pts: Array<{ x: number; y: number }> = [];
  for (const xs of [-1, 1]) for (const ys of [-1, 1]) for (const zs of [-1, 1]) {
    let x = (xs * lx) / 2, y = (ys * ly) / 2, z = (zs * lz) / 2;
    // Rx → Ry → Rz（同 projectPartSilhouette 的 pushPoint 順序）
    let y2 = y * cx - z * sx, z2 = y * sx + z * cx; y = y2; z = z2;
    let x2 = x * cy + z * sy; z2 = -x * sy + z * cy; x = x2; z = z2;
    x2 = x * cz - y * sz; y2 = x * sz + y * cz; x = x2; y = y2;
    pts.push({ x: x + ox, y: z + oz });
  }
  return convexHull2D(pts);
}

interface Props {
  design: FurnitureDesign;
  /** 單一 part id，或同組多個 part id（×N 群組件時把所有 sibling id 傳進來，
   *  4 個角落都用紅色標出，木匠看一張圖能對到全部裝位 */
  highlightPartId: string | string[];
  className?: string;
}

export function InstallHintMini({ design, highlightPartId, className }: Props) {
  const targetIds = Array.isArray(highlightPartId) ? highlightPartId : [highlightPartId];
  const targets = design.parts.filter((p) => targetIds.includes(p.id));
  if (targets.length === 0) return null;

  // 算整家具 bbox（top view = X-Z 平面，從上往下看）
  // top view 對家具裝位最直觀：座板、4 腳、4 牙條、橫撐 全部 horizontal 投影
  // 都能看清位置（不像 front view 側牙條被擠成小方塊）
  let minX = Infinity,
    maxX = -Infinity;
  let minZ = Infinity,
    maxZ = -Infinity;
  for (const p of design.parts) {
    const o = p.origin ?? { x: 0, y: 0, z: 0 };
    const ext = worldExtents(p);
    const halfX = ext.xExt / 2;
    const halfZ = ext.zExt / 2;
    minX = Math.min(minX, (o.x ?? 0) - halfX);
    maxX = Math.max(maxX, (o.x ?? 0) + halfX);
    minZ = Math.min(minZ, (o.z ?? 0) - halfZ);
    maxZ = Math.max(maxZ, (o.z ?? 0) + halfZ);
  }
  // 為了沿用後段 minY/maxY 變數名，這裡 alias Z → Y
  const minY = minZ;
  const maxY = maxZ;
  if (!isFinite(minX) || !isFinite(maxX) || maxX - minX < 1) return null;
  if (!isFinite(minY) || !isFinite(maxY) || maxY - minY < 1) return null;

  const W = 80,
    H = 80;
  const pad = 4;
  const scaleX = (W - 2 * pad) / (maxX - minX);
  const scaleY = (H - 2 * pad) / Math.max(maxY - minY, 1);
  const scale = Math.min(scaleX, scaleY);

  // 置中：把投影 bbox 在 viewBox 內水平/垂直 center
  const projW = (maxX - minX) * scale;
  const projH = (maxY - minY) * scale;
  const offX = (W - projW) / 2;
  const offY = (H - projH) / 2;

  const tx = (mm: number) => offX + (mm - minX) * scale;
  // SVG Y 軸下增、part-local Y 軸上增 → 翻轉
  const ty = (mm: number) => H - offY - (mm - minY) * scale;

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className={`install-hint-mini ${className ?? ""}`}
      style={{
        background: "#fafafa",
        border: "1px solid #d4d4d8",
        borderRadius: 4,
      }}
    >
      {/* Pass 1: 所有 part 畫淡色 footprint 多邊形當家具參考骨架（含 target，先打底）。
          用真實俯視 footprint（含 rotation），旋轉件（六/八角壁）才不會畫成方框。 */}
      {design.parts.map((p, i) => {
        const poly = topFootprint(p)
          .map((pt) => `${tx(pt.x)},${ty(pt.y)}`)
          .join(" ");
        return (
          <polygon
            key={`bg-${p.id}-${i}`}
            points={poly}
            fill="none"
            stroke="#6b7280"
            strokeWidth={0.5}
          />
        );
      })}
      {/* Pass 2: target parts 用紅色半透明 fill + 紅 outline 蓋在最上層
          —— 半透明確保大型 part（如背板/側板）不會把家具骨架完全遮掉
          —— ×N 群組件（4 腳/4 牙條等）所有 sibling 都紅標，讓木匠一張圖看到全部裝位 */}
      {targets.map((target, idx) => {
        const poly = topFootprint(target)
          .map((pt) => `${tx(pt.x)},${ty(pt.y)}`)
          .join(" ");
        return (
          <polygon
            key={`hl-${target.id}-${idx}`}
            points={poly}
            fill="#dc2626"
            fillOpacity={0.35}
            stroke="#991b1b"
            strokeWidth={1.2}
          />
        );
      })}
    </svg>
  );
}
