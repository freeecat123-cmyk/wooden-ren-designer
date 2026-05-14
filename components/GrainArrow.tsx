"use client";

import { useMemo } from "react";
import { Euler, CylinderGeometry, ConeGeometry, type BufferGeometry } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Part } from "@/lib/types";

/**
 * 木紋走向箭頭。?grain=1 時每個木製零件疊一支沿 grain 軸的雙向箭頭。
 *
 * 慣例：<Part> 的 size = [length, thickness, width]（three-units），
 * 即 local X=長、Y=厚、Z=寬。grainDirection="length" → 紋沿 X、
 * "width" → 沿 Z（與 wood-shader 的 woodCompileX/Z 同慣例）。
 * 圓料/車旋件沒有平面，紋沿圓柱長軸 local Y。
 */

/** shape.kind 屬於「圓柱狀」的——沒有平面可貼，箭頭走圓柱長軸 */
const ROUND_SHAPE_KINDS = new Set<string>([
  "round",
  "round-tapered",
  "splayed-round-tapered",
  "shaker",
  "lathe-turned",
]);

/** ShapeSpec 是 Part["shape"] 的非空版——重用 lib/types 裡的 inline union，無需重複定義。 */
type ShapeSpec = NonNullable<Part["shape"]>;

export interface GrainArrowPlacement {
  /** 箭頭沿哪個 local 軸 */
  axis: "x" | "y" | "z";
  /** 箭頭總長（three-units）= 該軸零件長度 × 0.8 */
  length: number;
  /** 箭頭貼在哪個 local 軸的面上（往該方向 +offset 浮出避免 z-fighting） */
  normalAxis: "x" | "y" | "z";
}

/** 純函式：依 grainDirection + shape + size 算出箭頭的軸 / 長度 / 貼面法線。 */
export function grainArrowPlacement(
  grainDirection: "length" | "width" | undefined,
  shapeKind: ShapeSpec["kind"] | undefined,
  size: [number, number, number],
): GrainArrowPlacement {
  // 圓料 / 車旋件：紋沿圓柱長軸（local Y），箭頭浮在柱面外（沿 X 偏移）
  if (shapeKind && ROUND_SHAPE_KINDS.has(shapeKind)) {
    return { axis: "y", length: size[1] * 0.8, normalAxis: "x" };
  }
  // 方料：grainDirection "width" → local Z；其餘（含 undefined）→ local X
  if (grainDirection === "width") {
    return { axis: "z", length: size[2] * 0.8, normalAxis: "y" };
  }
  return { axis: "x", length: size[0] * 0.8, normalAxis: "y" };
}

/** 建一支沿 +X 的雙向箭頭（細軸 + 兩端錐頭），合成單一 BufferGeometry。 */
function buildDoubleArrowGeometry(length: number): BufferGeometry {
  const shaftR = Math.max(length * 0.012, 0.01); // 最小可見下限
  const headLen = Math.min(length * 0.2, 0.25);
  const headR = shaftR * 3.2;
  const shaftLen = Math.max(length - 2 * headLen, length * 0.1);

  // CylinderGeometry 預設軸沿 Y → rotateZ 90° 轉成沿 X
  const shaft = new CylinderGeometry(shaftR, shaftR, shaftLen, 10);
  shaft.rotateZ(Math.PI / 2);

  // ConeGeometry 預設尖端朝 +Y → 旋轉成朝 ±X，再平移到兩端
  const headPos = new ConeGeometry(headR, headLen, 12);
  headPos.rotateZ(-Math.PI / 2);
  headPos.translate(length / 2 - headLen / 2, 0, 0);

  const headNeg = new ConeGeometry(headR, headLen, 12);
  headNeg.rotateZ(Math.PI / 2);
  headNeg.translate(-(length / 2 - headLen / 2), 0, 0);

  const merged = mergeGeometries([shaft, headPos, headNeg], false);
  shaft.dispose();
  headPos.dispose();
  headNeg.dispose();
  return merged ?? shaft;
}

/** 把箭頭幾何（沿 +X）轉到目標 local 軸的旋轉。 */
function localRotationForAxis(axis: "x" | "y" | "z"): Euler {
  if (axis === "z") return new Euler(0, Math.PI / 2, 0); // +X → +Z
  if (axis === "y") return new Euler(0, 0, Math.PI / 2); // +X → +Y
  return new Euler(0, 0, 0); // 已沿 +X
}

export function GrainArrow({
  position,
  rotation,
  size,
  grainDirection,
  shapeKind,
}: {
  /** 零件世界座標（與 <Part> 同一組 px,py,pz） */
  position: [number, number, number];
  /** 零件旋轉（與 <Part> 同一顆 Euler） */
  rotation: Euler;
  /** 零件 size [length, thickness, width]，已乘 SCALE */
  size: [number, number, number];
  grainDirection?: "length" | "width";
  shapeKind?: ShapeSpec["kind"];
}) {
  const { axis, length, normalAxis } = grainArrowPlacement(
    grainDirection,
    shapeKind,
    size,
  );
  const geometry = useMemo(() => buildDoubleArrowGeometry(length), [length]);
  const localRot = useMemo(() => localRotationForAxis(axis), [axis]);

  // 沿貼面法線往外浮一點點，避免 z-fighting
  const GAP = 0.02;
  const offset: [number, number, number] =
    normalAxis === "y"
      ? [0, size[1] / 2 + GAP, 0]
      : [size[0] / 2 + GAP, 0, 0];

  return (
    <group position={position} rotation={rotation}>
      <group position={offset} rotation={localRot}>
        <mesh geometry={geometry} renderOrder={3}>
          <meshStandardMaterial
            color="#27272a"
            emissive="#27272a"
            emissiveIntensity={0.15}
            roughness={0.6}
            metalness={0}
          />
        </mesh>
      </group>
    </group>
  );
}
