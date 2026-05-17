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
import type { FurnitureDesign } from "@/lib/types";
import { worldExtents } from "@/lib/render/geometry";

interface Props {
  design: FurnitureDesign;
  highlightPartId: string;
  className?: string;
}

export function InstallHintMini({ design, highlightPartId, className }: Props) {
  const target = design.parts.find((p) => p.id === highlightPartId);
  if (!target) return null;

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
      {design.parts.map((p, i) => {
        const o = p.origin ?? { x: 0, y: 0, z: 0 };
        const ext = worldExtents(p);
        // top view (X-Z 平面)：X 水平、Z 垂直
        const x = tx((o.x ?? 0) - ext.xExt / 2);
        const y = ty((o.z ?? 0) + ext.zExt / 2);
        const w = ext.xExt * scale;
        const h = ext.zExt * scale;
        const isTarget = p.id === highlightPartId;
        return (
          <rect
            key={`${p.id}-${i}`}
            x={x}
            y={y}
            width={Math.max(w, 0.5)}
            height={Math.max(h, 0.5)}
            fill={isTarget ? "#dc2626" : "none"}
            stroke={isTarget ? "#991b1b" : "#9ca3af"}
            strokeWidth={isTarget ? 1 : 0.4}
          />
        );
      })}
    </svg>
  );
}
