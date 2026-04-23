"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import { BufferGeometry, Euler, Float32BufferAttribute } from "three";
import type { FurnitureDesign } from "@/lib/types";
import { MATERIALS } from "@/lib/materials";
import { worldExtents } from "@/lib/render/geometry";

type ShapeSpec =
  | { kind: "box" }
  | { kind: "tapered"; bottomScale: number }
  | { kind: "splayed"; dx: number; dz: number }
  | { kind: "hoof"; hoofHeight: number; hoofScale: number };

function Part({
  position,
  size,
  rotation,
  color,
  shape,
}: {
  position: [number, number, number];
  size: [number, number, number];
  rotation: Euler;
  color: string;
  shape?: ShapeSpec;
}) {
  const geometry = useMemo(() => {
    if (!shape || shape.kind === "box") return null;
    if (shape.kind === "tapered") {
      if (shape.bottomScale === 1) return null;
      return buildTaperedGeometry(size, shape.bottomScale);
    }
    if (shape.kind === "splayed") {
      return buildSplayedGeometry(size, shape.dx, shape.dz);
    }
    if (shape.kind === "hoof") {
      return buildHoofGeometry(size, shape.hoofHeight, shape.hoofScale);
    }
    return null;
  }, [size, shape]);

  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      {geometry ? (
        <primitive attach="geometry" object={geometry} />
      ) : (
        <boxGeometry args={size} />
      )}
      <meshStandardMaterial
        color={color}
        roughness={0.55}
        metalness={0.05}
      />
    </mesh>
  );
}

/**
 * Truncated pyramid: top face is full size (length × width), bottom face is
 * scaled by `scale`. Height axis is Y (local thickness in our part convention
 * maps to Y in three.js box). 8 vertices, 12 triangles.
 */
function buildTaperedGeometry(
  size: [number, number, number],
  scale: number,
): BufferGeometry {
  const [lx, ly, lz] = size;
  const hx = lx / 2;
  const hy = ly / 2;
  const hz = lz / 2;
  const bx = hx * scale;
  const bz = hz * scale;
  // 8 verts: 0..3 bottom (y=-hy), 4..7 top (y=+hy), order: -x-z, +x-z, +x+z, -x+z
  const v: number[] = [
    -bx, -hy, -bz,
    bx, -hy, -bz,
    bx, -hy, bz,
    -bx, -hy, bz,
    -hx, hy, -hz,
    hx, hy, -hz,
    hx, hy, hz,
    -hx, hy, hz,
  ];
  // Three.js uses right-handed coords with CCW winding = front face. Each
  // quad (a,b,c,d) is listed so the normal points outward.
  const f = (a: number, b: number, c: number, d: number) => [a, b, c, a, c, d];
  const idx = [
    ...f(0, 1, 2, 3), // bottom (-y outward)
    ...f(4, 7, 6, 5), // top (+y outward)
    ...f(0, 4, 5, 1), // front (-z outward)
    ...f(1, 5, 6, 2), // right (+x outward)
    ...f(2, 6, 7, 3), // back (+z outward)
    ...f(3, 7, 4, 0), // left (-x outward)
  ];
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(v, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Splayed box: same length/width/height as a box, but the 4 bottom vertices
 * are shifted by (dx, dz) relative to the 4 top vertices, so the whole leg
 * leans in the (dx, dz) direction. dx/dz are in three.js units (already
 * scaled).
 */
function buildSplayedGeometry(
  size: [number, number, number],
  dx: number,
  dz: number,
): BufferGeometry {
  const [lx, ly, lz] = size;
  const hx = lx / 2;
  const hy = ly / 2;
  const hz = lz / 2;
  const v: number[] = [
    // bottom (y = -hy), shifted by (dx, dz)
    -hx + dx, -hy, -hz + dz,
    hx + dx, -hy, -hz + dz,
    hx + dx, -hy, hz + dz,
    -hx + dx, -hy, hz + dz,
    // top (y = +hy)
    -hx, hy, -hz,
    hx, hy, -hz,
    hx, hy, hz,
    -hx, hy, hz,
  ];
  const f = (a: number, b: number, c: number, d: number) => [a, b, c, a, c, d];
  const idx = [
    ...f(0, 1, 2, 3),
    ...f(4, 7, 6, 5),
    ...f(0, 4, 5, 1),
    ...f(1, 5, 6, 2),
    ...f(2, 6, 7, 3),
    ...f(3, 7, 4, 0),
  ];
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(v, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Hoof leg: straight full-width box from top down to (hoofHeight above the
 * bottom), then flares outward linearly to (hoofScale × full-width) at the
 * very bottom. 12 vertices, 3 horizontal rings.
 */
function buildHoofGeometry(
  size: [number, number, number],
  hoofHeight: number,
  hoofScale: number,
): BufferGeometry {
  const [lx, ly, lz] = size;
  const hx = lx / 2;
  const hy = ly / 2;
  const hz = lz / 2;
  const flareY = -hy + Math.min(hoofHeight, ly); // start of flare (above bottom)
  const bx = hx * hoofScale;
  const bz = hz * hoofScale;
  const v: number[] = [
    // 0..3 bottom (widest)
    -bx, -hy, -bz,
    bx, -hy, -bz,
    bx, -hy, bz,
    -bx, -hy, bz,
    // 4..7 flare start (= full width)
    -hx, flareY, -hz,
    hx, flareY, -hz,
    hx, flareY, hz,
    -hx, flareY, hz,
    // 8..11 top (= full width)
    -hx, hy, -hz,
    hx, hy, -hz,
    hx, hy, hz,
    -hx, hy, hz,
  ];
  const f = (a: number, b: number, c: number, d: number) => [a, b, c, a, c, d];
  const idx = [
    ...f(0, 1, 2, 3), // bottom
    ...f(8, 11, 10, 9), // top
    // flare section (bottom ring 0..3 → flare ring 4..7)
    ...f(0, 4, 5, 1),
    ...f(1, 5, 6, 2),
    ...f(2, 6, 7, 3),
    ...f(3, 7, 4, 0),
    // straight section (flare ring 4..7 → top ring 8..11)
    ...f(4, 8, 9, 5),
    ...f(5, 9, 10, 6),
    ...f(6, 10, 11, 7),
    ...f(7, 11, 8, 4),
  ];
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(v, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function PerspectiveView({ design }: { design: FurnitureDesign }) {
  // 將 mm 縮放成 Three.js 單位（1 unit = 100mm）
  const SCALE = 0.01;
  const maxDim = Math.max(
    design.overall.length,
    design.overall.width,
    design.overall.thickness,
  ) * SCALE;

  return (
    <div className="w-full h-[520px] rounded-xl overflow-hidden border border-zinc-200 shadow-sm bg-gradient-to-b from-zinc-50 to-zinc-200">
      <Canvas
        shadows
        // frameloop="demand" → 只在互動時渲染，沒動的時候 0 fps。
        // 避免 3D 畫面持續 60fps 搶 main thread，解決滾動卡頓。
        frameloop="demand"
        // dpr 上限 1.5 防止 Retina 螢幕 4× 像素做 shadow map。
        dpr={[1, 1.5]}
        camera={{
          // Distance driven by the piece's LARGEST dimension so tall furniture
          // (wardrobe, open-bookshelf) doesn't get clipped top/bottom even
          // when its length/width is small.
          position: [maxDim * 1.8, maxDim * 1.3, -maxDim * 2.0],
          fov: 38,
        }}
      >
        <ambientLight intensity={0.45} />
        <directionalLight
          position={[maxDim * 1.5, maxDim * 2, maxDim * 1.2]}
          intensity={1.0}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-maxDim * 2}
          shadow-camera-right={maxDim * 2}
          shadow-camera-top={maxDim * 2}
          shadow-camera-bottom={-maxDim * 2}
          shadow-bias={-0.0005}
        />
        <directionalLight
          position={[-maxDim, maxDim, -maxDim]}
          intensity={0.3}
        />

        <Environment preset="apartment" />

        <ContactShadows
          position={[0, 0.001, 0]}
          opacity={0.35}
          blur={2}
          far={maxDim * 2}
          scale={maxDim * 3}
        />

        <gridHelper
          args={[
            (Math.max(design.overall.length, design.overall.width) * SCALE) * 3,
            20,
            "#aaa",
            "#ddd",
          ]}
        />

        {design.parts.map((part) => {
          const color = MATERIALS[part.material].color;
          const { yExt } = worldExtents(part);
          const px = part.origin.x * SCALE;
          const py = (part.origin.y + yExt / 2) * SCALE;
          const pz = part.origin.z * SCALE;
          let shape: ShapeSpec | undefined;
          if (part.shape?.kind === "tapered") {
            shape = { kind: "tapered", bottomScale: part.shape.bottomScale };
          } else if (part.shape?.kind === "splayed") {
            shape = {
              kind: "splayed",
              dx: part.shape.dxMm * SCALE,
              dz: part.shape.dzMm * SCALE,
            };
          } else if (part.shape?.kind === "hoof") {
            shape = {
              kind: "hoof",
              hoofHeight: part.shape.hoofMm * SCALE,
              hoofScale: part.shape.hoofScale,
            };
          }
          return (
            <Part
              key={part.id}
              position={[px, py, pz]}
              size={[
                part.visible.length * SCALE,
                part.visible.thickness * SCALE,
                part.visible.width * SCALE,
              ]}
              rotation={new Euler(
                part.rotation?.x ?? 0,
                part.rotation?.y ?? 0,
                part.rotation?.z ?? 0,
                "ZYX",
              )}
              color={color}
              shape={shape}
            />
          );
        })}

        <OrbitControls
          makeDefault
          enablePan
          enableZoom
          enableRotate
          target={[0, (design.overall.thickness * SCALE) / 2, 0]}
          minDistance={maxDim * 1.2}
          maxDistance={maxDim * 6}
          // 允許從底下往上看（到近乎正下方），只留極小的安全邊避免 gimbal-lock
          maxPolarAngle={Math.PI - 0.02}
          minPolarAngle={0.02}
        />
      </Canvas>
    </div>
  );
}
