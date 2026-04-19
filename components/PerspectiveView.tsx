"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { FurnitureDesign } from "@/lib/types";
import { MATERIALS } from "@/lib/materials";

function Part({
  position,
  size,
  rotation,
  color,
}: {
  position: [number, number, number];
  size: [number, number, number];
  rotation: [number, number, number];
  color: string;
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.7} />
    </mesh>
  );
}

export function PerspectiveView({ design }: { design: FurnitureDesign }) {
  // 將 mm 縮放成 Three.js 單位（1 unit = 100mm）
  const SCALE = 0.01;

  return (
    <div className="w-full h-[500px] bg-zinc-100 rounded-lg overflow-hidden">
      <Canvas
        shadows
        camera={{
          position: [
            (design.overall.length * SCALE) * 1.8,
            (design.overall.thickness * SCALE) * 1.5,
            (design.overall.width * SCALE) * 1.8,
          ],
          fov: 35,
        }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[10, 15, 10]}
          intensity={0.8}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <gridHelper
          args={[
            (Math.max(design.overall.length, design.overall.width) * SCALE) * 3,
            20,
            "#bbb",
            "#ddd",
          ]}
        />

        {design.parts.map((part) => {
          const color = MATERIALS[part.material].color;
          // Three.js: y is up, our domain: y is up. x = length, z = depth.
          const px = part.origin.x * SCALE;
          const py = (part.origin.y + part.visible.thickness / 2) * SCALE;
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
              rotation={[
                part.rotation?.x ?? 0,
                part.rotation?.y ?? 0,
                part.rotation?.z ?? 0,
              ]}
              color={color}
            />
          );
        })}

        <OrbitControls makeDefault enablePan enableZoom enableRotate />
      </Canvas>
    </div>
  );
}
