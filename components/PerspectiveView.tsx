"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import { BufferGeometry, Euler, Float32BufferAttribute } from "three";
import type { FurnitureDesign } from "@/lib/types";
import { MATERIALS } from "@/lib/materials";
import { worldExtents } from "@/lib/render/geometry";
import { categorizePart } from "@/lib/render/svg-views";

/**
 * Blend a hex color toward a tint. amount=0 → original, 1 → tint.
 * Used to highlight drawer / door parts so they're easy to spot against
 * the rest of the cabinet (which all share the same wood color).
 */
function tintHex(baseHex: string, tintHex: string, amount: number): string {
  const parse = (h: string) => {
    const s = h.replace("#", "");
    return [
      parseInt(s.slice(0, 2), 16),
      parseInt(s.slice(2, 4), 16),
      parseInt(s.slice(4, 6), 16),
    ];
  };
  const [br, bg, bb] = parse(baseHex);
  const [tr, tg, tb] = parse(tintHex);
  const mix = (a: number, b: number) =>
    Math.round(a * (1 - amount) + b * amount);
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(mix(br, tr))}${toHex(mix(bg, tg))}${toHex(mix(bb, tb))}`;
}

// 抽屜 / 門（夾板貼皮 / 鑲板 / 玻璃）統一暖橘色微染——
// 跟櫃體結構區隔，一眼看出哪些零件是可動面板。
const DRAWER_TINT = "#ff9a3d";
const DOOR_TINT = "#ff9a3d";
const TINT_AMOUNT = 0.32;

type ShapeSpec =
  | { kind: "box" }
  | { kind: "tapered"; bottomScale: number }
  | { kind: "splayed"; dx: number; dz: number }
  | { kind: "hoof"; hoofHeight: number; hoofScale: number }
  | { kind: "round" }
  | { kind: "round-tapered"; bottomScale: number }
  | { kind: "shaker" }
  | { kind: "splayed-tapered"; bottomScale: number; dx: number; dz: number }
  | { kind: "splayed-round-tapered"; bottomScale: number; dx: number; dz: number }
  | { kind: "apron-trapezoid"; topLengthScale: number; bottomLengthScale: number }
  | { kind: "apron-beveled"; bevelAngle: number };

function Part({
  position,
  size,
  rotation,
  color,
  shape,
  isGlass,
}: {
  position: [number, number, number];
  size: [number, number, number];
  rotation: Euler;
  color: string;
  shape?: ShapeSpec;
  isGlass?: boolean;
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
    if (shape.kind === "splayed-tapered") {
      return buildSplayedTaperedGeometry(size, shape.bottomScale, shape.dx, shape.dz);
    }
    if (shape.kind === "apron-trapezoid") {
      return buildApronTrapezoidGeometry(size, shape.topLengthScale, shape.bottomLengthScale);
    }
    if (shape.kind === "apron-beveled") {
      return buildBeveledApronGeometry(size, shape.bevelAngle);
    }
    return null;
  }, [size, shape]);

  if (isGlass) {
    return (
      <mesh position={position} rotation={rotation}>
        <boxGeometry args={size} />
        <meshPhysicalMaterial
          color="#b8d9e8"
          roughness={0.05}
          transmission={0.9}
          thickness={0.05}
          ior={1.45}
          transparent
          opacity={0.25}
          metalness={0}
        />
      </mesh>
    );
  }

  // 圓盤：直徑 = size[0]（length），厚 = size[1]（thickness/Y）
  // CylinderGeometry 預設立軸沿 Y，剛好對應 size[1]
  if (shape?.kind === "round") {
    const radius = size[0] / 2;
    return (
      <mesh position={position} rotation={rotation} castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius, size[1], 48]} />
        <meshStandardMaterial color={color} roughness={0.55} metalness={0.05} />
      </mesh>
    );
  }

  // 圓錐腳：上 radius = size[0]/2，下 radius = 上 × bottomScale
  if (shape?.kind === "round-tapered") {
    const topR = size[0] / 2;
    const botR = topR * shape.bottomScale;
    return (
      <mesh position={position} rotation={rotation} castShadow receiveShadow>
        <cylinderGeometry args={[topR, botR, size[1], 48]} />
        <meshStandardMaterial color={color} roughness={0.55} metalness={0.05} />
      </mesh>
    );
  }

  // 外斜圓錐腳：圓料 + tapered + splay（底部偏移）
  if (shape?.kind === "splayed-round-tapered") {
    const geo = buildSplayedRoundTaperedGeometry(size, shape.bottomScale, shape.dx, shape.dz, 48);
    return (
      <mesh position={position} rotation={rotation} castShadow receiveShadow>
        <primitive attach="geometry" object={geo} />
        <meshStandardMaterial color={color} roughness={0.55} metalness={0.05} />
      </mesh>
    );
  }

  // 夏克風腳：上方 25% 方頂 + 下方 75% 圓錐（bottomScale 0.6）
  // 用 group 組合兩個 mesh：上方 BoxGeometry + 下方 CylinderGeometry tapered
  if (shape?.kind === "shaker") {
    const SQUARE_FRAC = 0.25;
    const TAPER_BOT_SCALE = 0.6;
    const fullH = size[1];
    const squareH = fullH * SQUARE_FRAC;
    const taperH = fullH * (1 - SQUARE_FRAC);
    const fullR = size[0] / 2;
    const botR = fullR * TAPER_BOT_SCALE;
    // 方頂中心相對於整支腳中心的 Y 偏移：上半 25% 的中心 = +37.5% 的 fullH
    // 整支中心在 size[1]/2，方頂中心 = size[1]/2 + (1-SQUARE_FRAC)/2 * size[1]
    // 但 CylinderGeometry 也以中心為原點。所以兩個 mesh 都相對 group 中心定位。
    // group 中心對齊整支腳中心。方頂中心 = +taperH/2，圓錐中心 = -squareH/2。
    const squareYOffset = taperH / 2;
    const taperYOffset = -squareH / 2;
    return (
      <group position={position} rotation={rotation}>
        <mesh position={[0, squareYOffset, 0]} castShadow receiveShadow>
          <boxGeometry args={[size[0], squareH, size[2]]} />
          <meshStandardMaterial color={color} roughness={0.55} metalness={0.05} />
        </mesh>
        <mesh position={[0, taperYOffset, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[fullR, botR, taperH, 48]} />
          <meshStandardMaterial color={color} roughness={0.55} metalness={0.05} />
        </mesh>
      </group>
    );
  }

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
 * 牙條梯形：上窄下寬（或反之）的 box，length 軸在 ±width/2 端不同尺寸。
 * 用於外斜腳家具的 apron——讓 apron 的左右端跟著腳的中心軸傾斜對齊。
 * 8 corners: 上 (local Z=-hz) 用 topScale 縮 length，下 (local Z=+hz) 用 bottomScale。
 */
function buildApronTrapezoidGeometry(
  size: [number, number, number],
  topScale: number,
  bottomScale: number,
): BufferGeometry {
  const [lx, ly, lz] = size;
  const hx = lx / 2;
  const hy = ly / 2;
  const hz = lz / 2;
  const topX = hx * topScale;
  const botX = hx * bottomScale;
  // local Z=-hz (top of apron in world Y after rotation): topScale length
  // local Z=+hz (bottom): bottomScale length
  const v: number[] = [
    // 4 corners at z = -hz (top) — order: -x-y, +x-y, +x+y, -x+y
    -topX, -hy, -hz,
    topX, -hy, -hz,
    topX, hy, -hz,
    -topX, hy, -hz,
    // 4 corners at z = +hz (bottom)
    -botX, -hy, hz,
    botX, -hy, hz,
    botX, hy, hz,
    -botX, hy, hz,
  ];
  // 6 faces, CCW from outside
  const f = (a: number, b: number, c: number, d: number) => [a, b, c, a, c, d];
  const idx = [
    ...f(0, 3, 2, 1), // -z face (top of apron in world)
    ...f(4, 5, 6, 7), // +z face (bottom of apron in world)
    ...f(0, 1, 5, 4), // -y face
    ...f(2, 3, 7, 6), // +y face
    ...f(1, 2, 6, 5), // +x face
    ...f(3, 0, 4, 7), // -x face
  ];
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(v, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * 牙條斜邊（apron beveled）：上下緣切斜面，跟外斜腳 apron tilt 互補。
 * Local 截面從矩形變平行四邊形：所有 corner 的 z 偏移 -y × tan(bevelAngle)。
 * 套用 part rotation 後上下緣面在世界中保持水平（可貼緊椅面 / 地面）。
 *
 * bevelAngle = 牙條繞 local X 軸的「補償用」旋轉量（signed radians）。
 *   X 軸 apron（前/後）：bevelAngle = (-sz) × tilt
 *   Z 軸 apron（左/右）：bevelAngle = -(sx) × tilt
 */
function buildBeveledApronGeometry(
  size: [number, number, number],
  bevelAngle: number,
): BufferGeometry {
  const [lx, ly, lz] = size;
  const hx = lx / 2;
  const hy = ly / 2;
  const hz = lz / 2;
  const shear = Math.tan(bevelAngle);
  // For corner (x, y, z): z' = z - y × shear. Top z = -hz, bottom z = +hz.
  // 8 verts in same order as buildApronTrapezoidGeometry：z=-hz first, z=+hz second
  const v: number[] = [
    -hx, -hy, -hz - (-hy) * shear, // 0: -x, -y, top  → z' = -hz + hy*shear
    +hx, -hy, -hz - (-hy) * shear, // 1: +x, -y, top
    +hx, +hy, -hz - (+hy) * shear, // 2: +x, +y, top  → z' = -hz - hy*shear
    -hx, +hy, -hz - (+hy) * shear, // 3: -x, +y, top
    -hx, -hy, +hz - (-hy) * shear, // 4: -x, -y, bot  → z' = +hz + hy*shear
    +hx, -hy, +hz - (-hy) * shear, // 5: +x, -y, bot
    +hx, +hy, +hz - (+hy) * shear, // 6: +x, +y, bot  → z' = +hz - hy*shear
    -hx, +hy, +hz - (+hy) * shear, // 7: -x, +y, bot
  ];
  const f = (a: number, b: number, c: number, d: number) => [a, b, c, a, c, d];
  const idx = [
    ...f(0, 3, 2, 1), // -z face (top of apron in world)
    ...f(4, 5, 6, 7), // +z face (bottom of apron in world)
    ...f(0, 1, 5, 4), // -y face
    ...f(2, 3, 7, 6), // +y face
    ...f(1, 2, 6, 5), // +x face
    ...f(3, 0, 4, 7), // -x face
  ];
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(v, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * 外斜方錐：方料 + 上下不同尺寸 + 底部偏移。
 * 上方面 (lx × lz) 在 y=+hy（無偏移），下方面 (lx*scale × lz*scale) 在 y=-hy
 * 偏移 (dx, dz)。
 */
function buildSplayedTaperedGeometry(
  size: [number, number, number],
  scale: number,
  dx: number,
  dz: number,
): BufferGeometry {
  const [lx, ly, lz] = size;
  const hx = lx / 2;
  const hy = ly / 2;
  const hz = lz / 2;
  const bx = hx * scale;
  const bz = hz * scale;
  const v: number[] = [
    -bx + dx, -hy, -bz + dz,
    bx + dx, -hy, -bz + dz,
    bx + dx, -hy, bz + dz,
    -bx + dx, -hy, bz + dz,
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
 * 外斜圓錐：圓料（直徑 = lx）+ 上下不同半徑 + 底部偏移。
 * segments 段邊（48 段視覺平滑），加上下 cap 中心點。
 */
function buildSplayedRoundTaperedGeometry(
  size: [number, number, number],
  scale: number,
  dx: number,
  dz: number,
  segments = 48,
): BufferGeometry {
  const [lx, ly] = size;
  const r = lx / 2;
  const hy = ly / 2;
  const rTop = r;
  const rBot = r * scale;
  const v: number[] = [];
  for (let i = 0; i < segments; i++) {
    const theta = (i / segments) * 2 * Math.PI;
    v.push(Math.cos(theta) * rTop, hy, Math.sin(theta) * rTop);
  }
  for (let i = 0; i < segments; i++) {
    const theta = (i / segments) * 2 * Math.PI;
    v.push(Math.cos(theta) * rBot + dx, -hy, Math.sin(theta) * rBot + dz);
  }
  const topCenter = segments * 2;
  const botCenter = segments * 2 + 1;
  v.push(0, hy, 0);
  v.push(dx, -hy, dz);
  const idx: number[] = [];
  for (let i = 0; i < segments; i++) {
    const i0 = i;
    const i1 = (i + 1) % segments;
    const j0 = segments + i;
    const j1 = segments + ((i + 1) % segments);
    // 側面：CCW from outside（法線朝外）
    // theta 由小到大走 CCW 從上往下看（+Y），但側面要從外側看 CCW
    // 順序：i0 (top θ) → i1 (top θ+δ) → j1 (bot θ+δ) → j0 (bot θ)
    idx.push(i0, i1, j1, i0, j1, j0);
    // 上 cap（CCW from above looking +Y down）：center → i0 → i1
    idx.push(topCenter, i0, i1);
    // 下 cap（CCW from below looking -Y up）：center → j1 → j0
    idx.push(botCenter, j1, j0);
  }
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
          const baseColor = MATERIALS[part.material].color;
          const category = categorizePart(part.id);
          const color =
            category === "drawer"
              ? tintHex(baseColor, DRAWER_TINT, TINT_AMOUNT)
              : category === "door"
                ? tintHex(baseColor, DOOR_TINT, TINT_AMOUNT)
                : baseColor;
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
          } else if (part.shape?.kind === "round") {
            shape = { kind: "round" };
          } else if (part.shape?.kind === "round-tapered") {
            shape = { kind: "round-tapered", bottomScale: part.shape.bottomScale };
          } else if (part.shape?.kind === "shaker") {
            shape = { kind: "shaker" };
          } else if (part.shape?.kind === "splayed-tapered") {
            shape = {
              kind: "splayed-tapered",
              bottomScale: part.shape.bottomScale,
              dx: part.shape.dxMm * SCALE,
              dz: part.shape.dzMm * SCALE,
            };
          } else if (part.shape?.kind === "splayed-round-tapered") {
            shape = {
              kind: "splayed-round-tapered",
              bottomScale: part.shape.bottomScale,
              dx: part.shape.dxMm * SCALE,
              dz: part.shape.dzMm * SCALE,
            };
          } else if (part.shape?.kind === "apron-trapezoid") {
            shape = {
              kind: "apron-trapezoid",
              topLengthScale: part.shape.topLengthScale,
              bottomLengthScale: part.shape.bottomLengthScale,
            };
          } else if (part.shape?.kind === "apron-beveled") {
            shape = { kind: "apron-beveled", bevelAngle: part.shape.bevelAngle };
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
              isGlass={part.visual === "glass"}
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
