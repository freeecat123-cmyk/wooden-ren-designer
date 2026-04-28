"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import { BufferGeometry, Euler, Float32BufferAttribute } from "three";
import type { FurnitureDesign } from "@/lib/types";
import { MATERIALS } from "@/lib/materials";
import { worldExtents } from "@/lib/render/geometry";
import { categorizePart } from "@/lib/render/svg-views";
import { woodCompileX, woodCompileZ } from "@/components/wood-shader";

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

/**
 * 車旋腳輪廓（古典花瓶/baluster 風格）：
 * [topRScale, botRScale, hFrac]，從上到下
 * - 頂部：滿尺寸做榫接區
 * - 上球節：圓潤外凸
 * - 凹頸：明顯收進去
 * - 花瓶腹身：先外擴再內收，像花瓶
 * - 主桿：細長下漸細
 * - 下球節：再次外擴
 * - 足盤：穩定的較粗底座
 * 半徑 scale 全部以 fullR (= legSize/2) 為基準
 */
export const LATHE_TURNED_SEGMENTS: Array<[number, number, number]> = [
  [1.0, 1.0, 0.05],   // 頂端榫接區（直圓柱）
  [1.0, 1.10, 0.04],  // 上球節 ↑
  [1.10, 1.0, 0.04],  // 上球節 ↓
  [1.0, 0.55, 0.10],  // 凹頸 cove
  [0.55, 0.78, 0.18], // 花瓶腹身上半（外擴）
  [0.78, 0.55, 0.20], // 花瓶腹身下半（內收）
  [0.55, 0.50, 0.10], // 主桿（細部）
  [0.50, 0.95, 0.10], // 下球節 ↑
  [0.95, 0.85, 0.05], // 過渡
  [0.85, 0.95, 0.06], // 足盤外擴
  [0.95, 0.95, 0.05], // 足底圓盤
  [0.95, 0.80, 0.03], // 足底斜邊
];

type ShapeSpec =
  | { kind: "box" }
  | { kind: "tapered"; bottomScale: number }
  | { kind: "splayed"; dx: number; dz: number }
  | { kind: "hoof"; hoofHeight: number; hoofScale: number; dirX: -1 | 0 | 1; dirZ: -1 | 0 | 1 }
  | { kind: "round" }
  | { kind: "round-tapered"; bottomScale: number }
  | { kind: "shaker"; squareFrac?: number; bottomScale?: number }
  | { kind: "lathe-turned" }
  | { kind: "splayed-tapered"; bottomScale: number; dx: number; dz: number }
  | { kind: "splayed-round-tapered"; bottomScale: number; dx: number; dz: number }
  | { kind: "apron-trapezoid"; topLengthScale: number; bottomLengthScale: number }
  | { kind: "apron-beveled"; bevelAngle: number }
  | { kind: "chamfered-top"; chamferMm: number; style?: "chamfered" | "rounded" }
  | { kind: "chamfered-edges"; chamferMm: number; style?: "chamfered" | "rounded" }
  | { kind: "live-edge"; amplitudeMm: number }
  | { kind: "seat-scoop"; profile: "saddle" | "scooped"; depth: number };

function Part({
  position,
  size,
  rotation,
  color,
  shape,
  isGlass,
  grainDirection,
}: {
  position: [number, number, number];
  size: [number, number, number];
  rotation: Euler;
  color: string;
  shape?: ShapeSpec;
  isGlass?: boolean;
  grainDirection?: "length" | "width";
}) {
  // 木紋順著零件 grain 軸（length 沿 local X、width 沿 local Z）
  const woodCompile = grainDirection === "width" ? woodCompileZ : woodCompileX;
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
      return buildHoofGeometry(size, shape.hoofHeight, shape.hoofScale, shape.dirX, shape.dirZ);
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
    if (shape.kind === "chamfered-top") {
      return buildChamferedTopGeometry(size, shape.chamferMm, shape.style ?? "chamfered");
    }
    if (shape.kind === "chamfered-edges") {
      return buildChamferedEdgesGeometry(size, shape.chamferMm, shape.style ?? "chamfered");
    }
    if (shape.kind === "live-edge") {
      return buildLiveEdgeGeometry(size, shape.amplitudeMm);
    }
    if (shape.kind === "seat-scoop") {
      return buildSeatScoopGeometry(size, shape.profile, shape.depth);
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
        <meshStandardMaterial color={color} roughness={0.55} metalness={0.05} onBeforeCompile={woodCompile} />
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
        <meshStandardMaterial color={color} roughness={0.55} metalness={0.05} onBeforeCompile={woodCompile} />
      </mesh>
    );
  }

  // 外斜圓錐腳：圓料 + tapered + splay（底部偏移）
  if (shape?.kind === "splayed-round-tapered") {
    const geo = buildSplayedRoundTaperedGeometry(size, shape.bottomScale, shape.dx, shape.dz, 48);
    return (
      <mesh position={position} rotation={rotation} castShadow receiveShadow>
        <primitive attach="geometry" object={geo} />
        <meshStandardMaterial color={color} roughness={0.55} metalness={0.05} onBeforeCompile={woodCompile} />
      </mesh>
    );
  }

  // 夏克風腳：上方 squareFrac 方頂 + 下方圓錐（bottomScale）
  // 「胖夏克」傳 squareFrac=0.4, bottomScale=0.75 讓方頂占比大、整支看起來壯
  if (shape?.kind === "shaker") {
    const SQUARE_FRAC = shape.squareFrac ?? 0.25;
    const TAPER_BOT_SCALE = shape.bottomScale ?? 0.6;
    const fullH = size[1];
    const squareH = fullH * SQUARE_FRAC;
    const taperH = fullH * (1 - SQUARE_FRAC);
    const fullR = size[0] / 2;
    const botR = fullR * TAPER_BOT_SCALE;
    const squareYOffset = taperH / 2;
    const taperYOffset = -squareH / 2;
    return (
      <group position={position} rotation={rotation}>
        <mesh position={[0, squareYOffset, 0]} castShadow receiveShadow>
          <boxGeometry args={[size[0], squareH, size[2]]} />
          <meshStandardMaterial color={color} roughness={0.55} metalness={0.05} onBeforeCompile={woodCompile} />
        </mesh>
        <mesh position={[0, taperYOffset, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[fullR, botR, taperH, 48]} />
          <meshStandardMaterial color={color} roughness={0.55} metalness={0.05} onBeforeCompile={woodCompile} />
        </mesh>
      </group>
    );
  }

  // 車旋腳：多段不同半徑的圓柱組合，視覺像車床車出來的
  // 分 6 段（從上到下）：頸圈、上球節、上桿、下桿、下球節、足盤
  // 每段相對 fullR 的半徑跟 fullH 的高度比例都固定
  if (shape?.kind === "lathe-turned") {
    const fullH = size[1];
    const fullR = size[0] / 2;
    let yCursor = fullH / 2;
    return (
      <group position={position} rotation={rotation}>
        {LATHE_TURNED_SEGMENTS.map(([topR, botR, hFrac], i) => {
          const segH = fullH * hFrac;
          const segYCenter = yCursor - segH / 2;
          yCursor -= segH;
          // CylinderGeometry(topRadius, bottomRadius, height, segments)
          // 不同 top/bot 半徑 → cone frustum，多段串起來輪廓平滑
          return (
            <mesh key={i} position={[0, segYCenter, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[fullR * topR, fullR * botR, segH, 32]} />
              <meshStandardMaterial color={color} roughness={0.55} metalness={0.05} onBeforeCompile={woodCompile} />
            </mesh>
          );
        })}
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
        onBeforeCompile={woodCompile}
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
 * 板狀零件頂緣 4 邊倒角（chamfered top）：
 * 座板 / 桌面常見的「邊緣 5×45° 倒角」或「R5/R12 圓角」視覺呈現。
 * 為簡化都用 45° 倒角實作（視覺接近，3D 不真做圓弧）：
 *   - chamfered: chamferMm = 5
 *   - rounded R5: chamferMm = 5（同 chamfered，視覺差異看 SVG label）
 *   - rounded R12: chamferMm = 12
 * Local Y 是厚度軸（origin = 底部），頂面 = +y 那面。
 * 16 vertices: 8 原 box 頂點 + 8 新增（頂面 4 角往內縮、頂面下緣 4 角）
 */
function buildChamferedTopGeometry(
  size: [number, number, number],
  chamferMm: number,
  style: "chamfered" | "rounded" = "chamfered",
): BufferGeometry {
  const [lx, ly, lz] = size;
  const hx = lx / 2;
  const hz = lz / 2;
  const yBot = -ly / 2;
  const yTop = ly / 2;
  const c = Math.min(chamferMm, ly * 0.45, hx * 0.45, hz * 0.45);

  // 圓角用多段 chamfer 拼近似四分圓，45° 用單段斜面
  const segs = style === "rounded" ? 4 : 1;
  // 圓心位於 (hx-c, yTop-c)（角落內側）；θ=0 在側面、θ=π/2 在頂面
  // 為每個段產生一個高度層；level i ∈ [0..segs] 對應 θ=i*(π/2)/segs
  // 內縮量 dx = c - c*cos(θ), 上升量 dy = c*sin(θ)
  // 底層（i=0）= 倒角起點（在側面，y=yTop-c, dx=0）
  // 頂層（i=segs）= 頂面（y=yTop, dx=c）
  const levels: Array<{ y: number; inset: number }> = [];
  for (let i = 0; i <= segs; i++) {
    const θ = (i * Math.PI) / 2 / segs;
    levels.push({
      y: yTop - c + c * Math.sin(θ),
      inset: c - c * Math.cos(θ),
    });
  }

  // Vertex layout:
  //   0..3   底部 (y=yBot)
  //   4..7   倒角底層 (y=yTop-c, 全外緣)（== levels[0]，但 y 跟下方一致）
  //   8..   每個 chamfer level 4 vertices
  //   最後 4   頂面 (內縮 c)
  // 為簡化：用「底部」+ 每個 level 1 組（全部從 levels 取座標，含 i=0 跟 i=segs）
  const v: number[] = [];
  // 底部
  v.push(-hx, yBot, -hz);
  v.push(+hx, yBot, -hz);
  v.push(+hx, yBot, +hz);
  v.push(-hx, yBot, +hz);
  // 每個 level
  for (const L of levels) {
    const x = hx - L.inset;
    const z = hz - L.inset;
    v.push(-x, L.y, -z);
    v.push(+x, L.y, -z);
    v.push(+x, L.y, +z);
    v.push(-x, L.y, +z);
  }

  const f = (a: number, b: number, c: number, d: number) => [a, b, c, a, c, d];
  const idx: number[] = [];

  // 底面 CCW（從下方看）
  idx.push(...f(0, 1, 2, 3));

  // 4 個側面（垂直部分）：底部 → level[0]
  const lv0 = 4; // first level vertex base index
  idx.push(...f(0, lv0 + 0, lv0 + 1, 1));
  idx.push(...f(1, lv0 + 1, lv0 + 2, 2));
  idx.push(...f(2, lv0 + 2, lv0 + 3, 3));
  idx.push(...f(3, lv0 + 3, lv0 + 0, 0));

  // 倒角 / 圓角分段：每兩個相鄰 level 之間 4 個側面
  for (let i = 0; i < segs; i++) {
    const a = 4 + i * 4;
    const b = 4 + (i + 1) * 4;
    idx.push(...f(a + 0, b + 0, b + 1, a + 1));
    idx.push(...f(a + 1, b + 1, b + 2, a + 2));
    idx.push(...f(a + 2, b + 2, b + 3, a + 3));
    idx.push(...f(a + 3, b + 3, b + 0, a + 0));
  }

  // 頂面（最後一個 level）— 從上方看 CCW
  const tv = 4 + segs * 4;
  idx.push(...f(tv + 0, tv + 3, tv + 2, tv + 1));

  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(v, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * 4 條沿最長軸的長邊各倒 45°——cross-section 從正方形變八角形。
 * 自動偵測 size 三軸最大者當「長軸」（腳 = Y、橫撐 = X）。
 * 16 vertices = 8 cross-section corners × 2 ends。
 */
function buildChamferedEdgesGeometry(
  size: [number, number, number],
  chamferMm: number,
  style: "chamfered" | "rounded" = "chamfered",
): BufferGeometry {
  const [lx, ly, lz] = size;
  const longAxis: 0 | 1 | 2 =
    ly > lx && ly > lz ? 1 : lz > lx && lz > ly ? 2 : 0;
  const shortDim = (i: 0 | 1 | 2) => (i === 0 ? lx : i === 1 ? ly : lz);
  const longLen = shortDim(longAxis);
  const sa1 = ((longAxis + 1) % 3) as 0 | 1 | 2;
  const sa2 = ((longAxis + 2) % 3) as 0 | 1 | 2;
  const ha = longLen / 2;
  const hb = shortDim(sa1) / 2;
  const hc = shortDim(sa2) / 2;
  const c = Math.min(chamferMm, hb * 0.45, hc * 0.45);

  // 圓角用 N=4 段 chamfer 拼近似四分圓；45° 用 1 段
  const segs = style === "rounded" ? 4 : 1;
  // 每個 corner 都是凸圓弧，圓心在內側 c 距離處
  // CCW 順序（從 +b 軸看 +long 方向）：NE → NW → SW → SE
  const arcPts = (cx: number, cy: number, θ0: number, θ1: number): Array<[number, number]> => {
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= segs; i++) {
      const θ = θ0 + ((θ1 - θ0) * i) / segs;
      pts.push([cx + c * Math.cos(θ), cy + c * Math.sin(θ)]);
    }
    return pts;
  };
  const ne = arcPts(hb - c, hc - c, 0, Math.PI / 2);            // (hb, hc-c) → (hb-c, hc)
  const nw = arcPts(-hb + c, hc - c, Math.PI / 2, Math.PI);     // (-hb+c, hc) → (-hb, hc-c)
  const sw = arcPts(-hb + c, -hc + c, Math.PI, 3 * Math.PI / 2); // (-hb, -hc+c) → (-hb+c, -hc)
  const se = arcPts(hb - c, -hc + c, 3 * Math.PI / 2, 2 * Math.PI); // (hb-c, -hc) → (hb, -hc+c)
  // 一圈 CCW：ne 末 = (hb-c, hc) → nw 起 = (-hb+c, hc) 之間是 top straight（不加中間點）
  // 完整序列：ne ∪ nw ∪ sw ∪ se
  const cs: Array<[number, number]> = [...ne, ...nw, ...sw, ...se];

  // 每個 cross-section corner 在兩端 (long axis = ±ha) 各一個 vertex → 16 verts
  // vertex layout: 0..7 = 端 -ha 的 8 點，8..15 = 端 +ha 的 8 點
  // 把 (a, b, c) 的 longAxis 座標放對位置
  const place = (axisVal: number, sa1Val: number, sa2Val: number): [number, number, number] => {
    const arr: [number, number, number] = [0, 0, 0];
    arr[longAxis] = axisVal;
    arr[sa1] = sa1Val;
    arr[sa2] = sa2Val;
    return arr;
  };

  const N = cs.length; // chamfered=8, rounded=20
  const v: number[] = [];
  for (const [b, cc] of cs) v.push(...place(-ha, b, cc));
  for (const [b, cc] of cs) v.push(...place(+ha, b, cc));

  const f = (a: number, b: number, c: number, d: number) => [a, b, c, a, c, d];
  const idx: number[] = [];

  // N 個側面（cross-section 邊 × 長軸延伸）
  for (let i = 0; i < N; i++) {
    const next = (i + 1) % N;
    idx.push(...f(i, next, next + N, i + N));
  }
  // 兩個多邊形端面（fan from vertex 0）
  for (let i = 1; i < N - 1; i++) {
    idx.push(0, i + 1, i);          // -ha 端
    idx.push(N, N + i, N + i + 1);  // +ha 端
  }

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
 * Live edge 板狀零件（保留樹皮的原木板桌面）。
 *
 * 兩條長邊（±Z 方向）以多段 sin 組合 noise 做不規則波浪，模擬樹皮的有機曲線。
 * 兩端 (±X) 與上下面 (±Y) 保持平直。
 *
 * 段數固定 32（沿長邊取樣），波形 = 3 個不同週期的 sin 疊加，振幅 = amplitudeMm。
 * 兩條長邊用不同 phase（差 π/3），看起來不會對稱。
 */
function buildLiveEdgeGeometry(
  size: [number, number, number],
  amplitudeMm: number,
): BufferGeometry {
  const [lx, ly, lz] = size;
  const hx = lx / 2;
  const hy = ly / 2;
  const hz = lz / 2;
  const N = 32; // 段數
  const amp = amplitudeMm;

  // 沿 length 軸（X）取樣，每個 x_i 各算 +Z 邊和 -Z 邊的 z 偏移（向外側突出 amp 範圍內）
  const noise = (x: number, phase: number) =>
    amp * 0.6 * Math.sin((x + phase) / (lx * 0.06)) +
    amp * 0.3 * Math.sin((x + phase * 1.7) / (lx * 0.035)) +
    amp * 0.1 * Math.sin((x + phase * 2.3) / (lx * 0.02));

  // 取樣點 (i = 0..N)，端點 (i=0, i=N) 強制 noise=0 讓兩端平整
  const xs: number[] = [];
  const zPos: number[] = []; // +Z 邊
  const zNeg: number[] = []; // -Z 邊
  for (let i = 0; i <= N; i++) {
    const x = -hx + (lx * i) / N;
    xs.push(x);
    const t = i / N;
    // 兩端漸退讓 noise 收斂為 0（避免端面變形）
    const taper = Math.sin(Math.PI * t);
    zPos.push(hz + noise(x, 0) * taper);
    zNeg.push(-hz - noise(x, Math.PI / 3) * taper);
  }

  // Vertex layout：每個取樣點上 4 個 vertex（top-front, top-back, bot-front, bot-back）
  // index = i * 4 + (0=botBack, 1=botFront, 2=topFront, 3=topBack)
  // botBack = (xs[i], -hy, zPos[i])
  // botFront = (xs[i], -hy, zNeg[i])
  // topFront = (xs[i], +hy, zNeg[i])
  // topBack  = (xs[i], +hy, zPos[i])
  const v: number[] = [];
  for (let i = 0; i <= N; i++) {
    v.push(xs[i], -hy, zPos[i]);
    v.push(xs[i], -hy, zNeg[i]);
    v.push(xs[i], hy, zNeg[i]);
    v.push(xs[i], hy, zPos[i]);
  }

  const f = (a: number, b: number, c: number, d: number) => [a, b, c, a, c, d];
  const vi = (i: number, k: number) => i * 4 + k;
  const idx: number[] = [];

  // Side faces between i and i+1
  for (let i = 0; i < N; i++) {
    // bottom face (looking from -Y): vertices at -hy, CCW from -Y
    idx.push(...f(vi(i, 0), vi(i, 1), vi(i + 1, 1), vi(i + 1, 0)));
    // top face (from +Y): CCW from +Y
    idx.push(...f(vi(i, 3), vi(i + 1, 3), vi(i + 1, 2), vi(i, 2)));
    // +Z 長邊（後緣，向 +Z 突出）。normal +Z when viewed from +Z
    idx.push(...f(vi(i, 0), vi(i + 1, 0), vi(i + 1, 3), vi(i, 3)));
    // -Z 長邊（前緣，向 -Z 突出）。normal -Z
    idx.push(...f(vi(i, 1), vi(i, 2), vi(i + 1, 2), vi(i + 1, 1)));
  }
  // 端面 -X (i=0)
  idx.push(...f(vi(0, 0), vi(0, 3), vi(0, 2), vi(0, 1)));
  // 端面 +X (i=N)
  idx.push(...f(vi(N, 0), vi(N, 1), vi(N, 2), vi(N, 3)));

  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(v, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * 明式馬蹄腳。
 *
 * 結構：上方直料 → 馬蹄區段 4 環，外側 2 面做 S 形（上半外凸 → 中段內凹收腰
 * → 下半外撇腳趾），內側 2 面保持直線。dirX/dirZ 決定哪 2 面是「外側」。
 *
 * 為什麼這麼做：原本實作所有 4 面對稱外擴 → 像漏斗，跟明式馬蹄腳完全不像。
 * 真正的馬蹄腳只有「朝家具外」的兩個面才會踢出來，其他 2 面（朝中心）保持
 * 直線——這樣才能把腳趾的方向感做出來。
 *
 * 參數：
 *  hoofHeight = 馬蹄區段總高（從底部往上算）
 *  hoofScale  = 腳趾外側 flare 倍率（>1 = 外撇）
 *  dirX/dirZ  = 外側方向（±1 = 該軸的這個方向是外側、要 flare；0 = 該軸不 flare）
 *
 * 環高度比例：top 50% 直線 / 鼓肚 25% / 收腰 15% / 腳趾 10%
 */
function buildHoofGeometry(
  size: [number, number, number],
  hoofHeight: number,
  hoofScale: number,
  dirX: -1 | 0 | 1,
  dirZ: -1 | 0 | 1,
): BufferGeometry {
  const [lx, ly, lz] = size;
  const hx = lx / 2;
  const hy = ly / 2;
  const hz = lz / 2;
  const hoofH = Math.min(hoofHeight, ly * 0.5);

  // 4 個馬蹄區段環的 Y（從上到下）+ 該環各 4 個 corner 的 X/Z 縮放比
  // 比例是「外側面相對直料寬」的縮放：
  //   start: 1.00（剛離開直料，全寬）
  //   bulge: 1.10（外側面鼓出去——S 上半圓弧）
  //   waist: 0.85（外側面內凹收腰，比直料窄 15%）
  //   toe:   hoofScale（腳趾外撇到最大寬）
  // 內側面所有環都保持 1.0（直料），這樣外側才看得出 S 形腳趾踢出去。
  const rings = [
    { yFrac: 0.00, outerScale: 1.00 },  // 馬蹄頂（與直料銜接）
    { yFrac: 0.45, outerScale: 1.10 },  // 鼓肚
    { yFrac: 0.78, outerScale: 0.85 },  // 收腰（要明顯一點才看得出 S 形）
    { yFrac: 1.00, outerScale: hoofScale }, // 腳趾（最寬）
  ];
  const yTopHoof = -hy + hoofH; // 馬蹄區段的頂端

  // 收 vertex 的 helper：給 ring index + corner sign (sx, sz)，回傳 [x, y, z]
  const cornerVert = (
    ringIdx: number,
    sx: -1 | 1,
    sz: -1 | 1,
  ): [number, number, number] => {
    const ring = rings[ringIdx];
    const y = yTopHoof - hoofH * ring.yFrac;
    // 外側軸（sx === dirX 或 sz === dirZ）才套 outerScale；內側保持 1
    // dirX/dirZ 可能是 0（中柱腳，該軸不外撇），這時跟 sx/sz 都不相等 → 走 1.0
    const xScale = (dirX as number) !== 0 && sx === dirX ? ring.outerScale : 1;
    const zScale = (dirZ as number) !== 0 && sz === dirZ ? ring.outerScale : 1;
    return [sx * hx * xScale, y, sz * hz * zScale];
  };

  const v: number[] = [];
  // 環 0..3：馬蹄區段 4 環，每環 4 個 corner，順序 (-,-) (+,-) (+,+) (-,+)
  // 對應 vertex index：環 r 的 corner i 在 v 的 4*r + i
  for (let r = 0; r < 4; r++) {
    v.push(...cornerVert(r, -1, -1));
    v.push(...cornerVert(r, 1, -1));
    v.push(...cornerVert(r, 1, 1));
    v.push(...cornerVert(r, -1, 1));
  }
  // 環 4：直料頂端（= 馬蹄區段頂端 + 上方直料）。原本 yTopHoof = -hy + hoofH，
  // 直料頂在 +hy。所以 ring 0 (= yTopHoof) 跟 ring 4 (= +hy) 之間是直料。
  v.push(-hx, hy, -hz);
  v.push(hx, hy, -hz);
  v.push(hx, hy, hz);
  v.push(-hx, hy, hz);

  // f(a, b, c, d) → 兩個三角形組成 quad，winding 由 caller 控制
  const f = (a: number, b: number, c: number, d: number) => [a, b, c, a, c, d];
  // 環 r 的 corner 索引：4*r + i (i = 0..3)
  // ring 0 = 馬蹄頂；ring 3 = 腳趾底；ring 4 = 直料頂（最高）。
  const ri = (r: number, i: number) => 4 * r + i;
  const idx: number[] = [];
  // 底面（ring 3 = 腳趾底，normal -Y）
  idx.push(...f(ri(3, 0), ri(3, 1), ri(3, 2), ri(3, 3)));
  // 頂面（ring 4 = 直料頂，normal +Y）
  idx.push(...f(ri(4, 0), ri(4, 3), ri(4, 2), ri(4, 1)));
  // 4 個側面 × 4 個環間區段（ring r 在上、ring r+1 在下；
  // r=3 的時候 r+1=4，這是直料區段—直料頂端 ring 4 在最上方，
  // 但 corner 順序仍對齊 ring 0..3 的 (-,-) (+,-) (+,+) (-,+)）
  // 為避免直料區段方向反，r 從 0 到 2 處理馬蹄區，r=3 額外處理直料區。
  // CCW from outside: bot → top → top_next → bot_next
  for (let r = 0; r < 3; r++) {
    // 馬蹄區段（r 在上、r+1 在下）
    idx.push(...f(ri(r + 1, 0), ri(r, 0), ri(r, 1), ri(r + 1, 1))); // -Z 面
    idx.push(...f(ri(r + 1, 1), ri(r, 1), ri(r, 2), ri(r + 1, 2))); // +X 面
    idx.push(...f(ri(r + 1, 2), ri(r, 2), ri(r, 3), ri(r + 1, 3))); // +Z 面
    idx.push(...f(ri(r + 1, 3), ri(r, 3), ri(r, 0), ri(r + 1, 0))); // -X 面
  }
  // 直料區段：ring 4 在上 (+hy)、ring 0 在下 (yTopHoof = -hy + hoofH)
  idx.push(...f(ri(0, 0), ri(4, 0), ri(4, 1), ri(0, 1)));
  idx.push(...f(ri(0, 1), ri(4, 1), ri(4, 2), ri(0, 2)));
  idx.push(...f(ri(0, 2), ri(4, 2), ri(4, 3), ri(0, 3)));
  idx.push(...f(ri(0, 3), ri(4, 3), ri(4, 0), ri(0, 0)));

  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(v, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * 座面挖型曲面：把座板頂面換成 displaced grid。
 *  saddle  = 中央 paraboloid 凹陷（雙軸）
 *  scooped = 沿 X 軸兩個並列 basin（左右各一個沿 Z 方向延伸的凹槽）
 *
 * 為了讓側面與底面保持平直、不被 grid 平均的 normal 帶歪，側 / 底面用獨立 quad
 * 建立（自帶頂點，不跟 grid 共用），grid 用 32×32 細分套 computeVertexNormals
 * 平滑出曲面。
 */
function buildSeatScoopGeometry(
  size: [number, number, number],
  profile: "saddle" | "scooped",
  depth: number,
): BufferGeometry {
  const [lx, ly, lz] = size;
  const hx = lx / 2;
  const hy = ly / 2;
  const hz = lz / 2;
  const nx = 32;
  const nz = 32;

  // depth 是 scene units（已乘 SCALE）。clip 到不超過厚度 70%
  const maxDip = Math.min(depth, ly * 0.7);

  function dipAt(x: number, z: number): number {
    const rx = (2 * x) / lx; // [-1, 1]
    const rz = (2 * z) / lz;
    if (profile === "saddle") {
      const fx = Math.max(0, 1 - rx * rx);
      const fz = Math.max(0, 1 - rz * rz);
      return -maxDip * fx * fz;
    }
    // scooped: 兩個 basin 中心在 x = ±lx/4，每個寬 lx/2，沿 z 全長延伸（兩端漸收）
    const bw = lx / 4; // basin half-width
    const r1 = (x - lx / 4) / bw;
    const r2 = (x + lx / 4) / bw;
    const f1 = Math.max(0, 1 - r1 * r1);
    const f2 = Math.max(0, 1 - r2 * r2);
    const fz = Math.max(0, 1 - rz * rz * 0.6); // z 方向稍微收（兩端稍淺）
    return -maxDip * Math.max(f1, f2) * fz;
  }

  const v: number[] = [];
  const idx: number[] = [];

  // 1) 頂面 grid（(nx+1) × (nz+1) 個頂點，displaced）
  const topStart = 0;
  for (let i = 0; i <= nx; i++) {
    const x = -hx + (i / nx) * lx;
    for (let j = 0; j <= nz; j++) {
      const z = -hz + (j / nz) * lz;
      v.push(x, hy + dipAt(x, z), z);
    }
  }
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const a = topStart + i * (nz + 1) + j;
      const b = topStart + (i + 1) * (nz + 1) + j;
      const c = topStart + (i + 1) * (nz + 1) + j + 1;
      const d = topStart + i * (nz + 1) + j + 1;
      idx.push(a, b, c, a, c, d);
    }
  }

  // 2) 側面 + 底面：4 個邊牆 + 1 個底面，獨立頂點以保平面 shading
  // 邊牆頂端的 Y 對齊 grid 邊緣，但用獨立 vertex 不分享。
  const sideStart = v.length / 3;

  // -Z 面（front, j=0），i=0..nx
  for (let i = 0; i <= nx; i++) {
    const x = -hx + (i / nx) * lx;
    v.push(x, hy + dipAt(x, -hz), -hz); // 頂
    v.push(x, -hy, -hz);                 // 底
  }
  const negZBase = sideStart;
  for (let i = 0; i < nx; i++) {
    const a = negZBase + i * 2;
    const b = negZBase + (i + 1) * 2;
    const ab = a + 1;
    const bb = b + 1;
    idx.push(a, ab, bb, a, bb, b);
  }

  const posZBase = v.length / 3;
  for (let i = 0; i <= nx; i++) {
    const x = -hx + (i / nx) * lx;
    v.push(x, hy + dipAt(x, hz), hz);
    v.push(x, -hy, hz);
  }
  for (let i = 0; i < nx; i++) {
    const a = posZBase + i * 2;
    const b = posZBase + (i + 1) * 2;
    const ab = a + 1;
    const bb = b + 1;
    idx.push(a, bb, ab, a, b, bb);
  }

  const negXBase = v.length / 3;
  for (let j = 0; j <= nz; j++) {
    const z = -hz + (j / nz) * lz;
    v.push(-hx, hy + dipAt(-hx, z), z);
    v.push(-hx, -hy, z);
  }
  for (let j = 0; j < nz; j++) {
    const a = negXBase + j * 2;
    const b = negXBase + (j + 1) * 2;
    const ab = a + 1;
    const bb = b + 1;
    idx.push(a, bb, ab, a, b, bb);
  }

  const posXBase = v.length / 3;
  for (let j = 0; j <= nz; j++) {
    const z = -hz + (j / nz) * lz;
    v.push(hx, hy + dipAt(hx, z), z);
    v.push(hx, -hy, z);
  }
  for (let j = 0; j < nz; j++) {
    const a = posXBase + j * 2;
    const b = posXBase + (j + 1) * 2;
    const ab = a + 1;
    const bb = b + 1;
    idx.push(a, ab, bb, a, bb, b);
  }

  // 底面 4 角（normal -Y）
  const botBase = v.length / 3;
  v.push(-hx, -hy, -hz);
  v.push(hx, -hy, -hz);
  v.push(hx, -hy, hz);
  v.push(-hx, -hy, hz);
  idx.push(botBase, botBase + 2, botBase + 1);
  idx.push(botBase, botBase + 3, botBase + 2);

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
              dirX: part.shape.dirX ?? 0,
              dirZ: part.shape.dirZ ?? 0,
            };
          } else if (part.shape?.kind === "round") {
            shape = { kind: "round" };
          } else if (part.shape?.kind === "round-tapered") {
            shape = { kind: "round-tapered", bottomScale: part.shape.bottomScale };
          } else if (part.shape?.kind === "shaker") {
            shape = {
              kind: "shaker",
              squareFrac: part.shape.squareFrac,
              bottomScale: part.shape.bottomScale,
            };
          } else if (part.shape?.kind === "lathe-turned") {
            shape = { kind: "lathe-turned" };
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
          } else if (part.shape?.kind === "chamfered-top") {
            shape = { kind: "chamfered-top", chamferMm: part.shape.chamferMm * SCALE, style: part.shape.style };
          } else if (part.shape?.kind === "chamfered-edges") {
            shape = { kind: "chamfered-edges", chamferMm: part.shape.chamferMm * SCALE, style: part.shape.style };
          } else if (part.shape?.kind === "live-edge") {
            shape = { kind: "live-edge", amplitudeMm: (part.shape.amplitudeMm ?? 12) * SCALE };
          } else if (part.shape?.kind === "seat-scoop") {
            shape = { kind: "seat-scoop", profile: part.shape.profile, depth: part.shape.depthMm * SCALE };
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
              grainDirection={part.grainDirection}
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
