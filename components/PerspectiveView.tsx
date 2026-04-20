"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import { Euler } from "three";
import type { FurnitureDesign } from "@/lib/types";
import { MATERIALS } from "@/lib/materials";
import { worldExtents } from "@/lib/render/geometry";

function Part({
  position,
  size,
  rotation,
  color,
}: {
  position: [number, number, number];
  size: [number, number, number];
  rotation: Euler;
  color: string;
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        roughness={0.55}
        metalness={0.05}
      />
    </mesh>
  );
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
        camera={{
          position: [
            (design.overall.length * SCALE) * 1.7,
            (design.overall.thickness * SCALE) * 1.1,
            (design.overall.width * SCALE) * 1.9,
          ],
          fov: 32,
        }}
      >
        <ambientLight intensity={0.45} />
        <directionalLight
          position={[maxDim * 1.5, maxDim * 2, maxDim * 1.2]}
          intensity={1.0}
          castShadow
          shadow-mapSize={[2048, 2048]}
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
          maxPolarAngle={Math.PI / 2 - 0.05}
        />
      </Canvas>
    </div>
  );
}
