"use client";

/**
 * 喝咖啡的鴨子 —— 組裝動畫旁邊的吉祥物。
 *
 * 造型照木頭仁女兒的手繪（2026-09-02 給的圖）：白色圓頭 + 兩側鼓起的大腮幫、
 * 直立的橘色大嘴、兩顆直立黑眼、粉紅腮紅、方方的白身體、細細的黑色棒棒手腳。
 * 用基本幾何堆出來，每個白色部件外面套一層放大 6% 的黑色反面殼（inverted hull）
 * 當馬克筆描邊，看起來還是她畫的那隻。
 *
 * 動畫只在 `playing` 時跑（跟組裝動畫同步），停下來就是靜態姿勢，不會讓 3D 靜置空燒。
 * 每幀只改 transform / opacity，不重建幾何。
 *
 * 2026-09-02 他改口「改成在旁邊跑來跑去好了」：鴨子在家具側邊（爆炸零件外側）沿 z 來回跑，
 * 腳手擺動、身體上下顛、跑到底轉身；咖啡杯還拿在手上、蒸氣照飄。
 */
import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { BackSide, type Group, type Mesh, type MeshStandardMaterial } from "three";

const INK = "#2b2b2b";
const WHITE = "#fffdf8";
const BEAK = "#e8923a";
const CHEEK = "#e69aa8";
const COFFEE = "#5a3a22";

/** 白色部件 + 描邊殼 */
function Outlined({
  children,
  color = WHITE,
  position,
  scale,
  rotation,
  outline = 1.06,
}: {
  children: React.ReactElement;
  color?: string;
  position?: [number, number, number];
  scale?: [number, number, number] | number;
  rotation?: [number, number, number];
  outline?: number;
}) {
  return (
    <group position={position} scale={scale} rotation={rotation}>
      <mesh castShadow>
        {children}
        <meshStandardMaterial color={color} roughness={0.85} metalness={0} />
      </mesh>
      <mesh scale={outline}>
        {children}
        <meshBasicMaterial color={INK} side={BackSide} />
      </mesh>
    </group>
  );
}

function Stick({ position, rotation, length, radius = 0.014 }: { position: [number, number, number]; rotation?: [number, number, number]; length: number; radius?: number }) {
  return (
    <mesh position={position} rotation={rotation}>
      <cylinderGeometry args={[radius, radius, length, 8]} />
      <meshStandardMaterial color={INK} roughness={0.9} />
    </mesh>
  );
}

export function CoffeeDuck({
  path,
  scale,
  playing,
}: {
  /** 跑步路線：固定 x，在 zMin ~ zMax 之間來回（場景單位，y = 地面） */
  path: { x: number; zMin: number; zMax: number };
  /** 鴨子總高（場景單位）；模型本身高約 1.08 */
  scale: number;
  playing: boolean;
}) {
  const invalidate = useThree((s) => s.invalidate);
  const root = useRef<Group>(null);
  const head = useRef<Group>(null);
  const armR = useRef<Group>(null);
  const armL = useRef<Group>(null);
  const legL = useRef<Group>(null);
  const legR = useRef<Group>(null);
  const mug = useRef<Group>(null);
  const steam = useRef<Mesh[]>([]);
  const t = useRef(Math.random() * 10);
  const heading = useRef(0);
  // 蒸氣：5 團、大一點、淡灰藍（純白在淺灰背景上看不到；2026-09-02 他：「蒸氣要明顯一點」）
  const steamPhase = useMemo(() => [0, 0.2, 0.4, 0.6, 0.8], []);

  /** 來回一趟的時間（秒）：路線越長跑越久，但最少 2 秒 */
  const lapSec = Math.max(2, (path.zMax - path.zMin) / (0.9 * scale));

  const pose = (time: number) => {
    // 位置：三角波在 zMin ~ zMax 來回
    const u = (time / lapSec) % 2;
    const f = u < 1 ? u : 2 - u;          // 0→1→0
    const z = path.zMin + (path.zMax - path.zMin) * f;
    const dir = u < 1 ? 1 : -1;            // +z 或 −z
    // 轉身：朝行進方向（模型預設面向 −z）
    const target = dir > 0 ? Math.PI : 0;
    let d = target - heading.current;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    heading.current += d * 0.15;
    // 步伐
    const stride = time * 11;
    const bounce = Math.abs(Math.sin(stride)) * 0.03;
    if (root.current) {
      root.current.position.set(path.x, bounce * scale, z);
      root.current.rotation.set(0, heading.current, 0);
    }
    if (head.current) head.current.rotation.z = Math.sin(stride * 0.5) * 0.08;
    if (legL.current) legL.current.rotation.x = Math.sin(stride) * 0.7;
    if (legR.current) legR.current.rotation.x = -Math.sin(stride) * 0.7;
    if (armL.current) armL.current.rotation.x = -Math.sin(stride) * 0.5;
    if (armR.current) armR.current.rotation.x = -0.6 + Math.sin(stride) * 0.35;
    if (mug.current) mug.current.rotation.x = Math.sin(stride) * 0.15;
    // 蒸氣：往上飄、淡出、左右搖
    steam.current.forEach((m, i) => {
      if (!m) return;
      const p = (time * 0.4 + steamPhase[i]) % 1;
      m.position.set(Math.sin((time + i) * 2.5) * 0.03 * p, 0.06 + p * 0.34, Math.cos((time + i) * 1.7) * 0.02 * p);
      const s = 0.7 + p * 1.3;
      m.scale.set(s, s, s);
      (m.material as MeshStandardMaterial).opacity = 0.95 * (1 - p * p);
    });
  };

  useFrame((_, delta) => {
    if (!playing) return;
    t.current += Math.min(delta, 0.1);
    pose(t.current);
    invalidate();
  });

  return (
    <group ref={root} position={[path.x, 0, path.zMin]} scale={scale}>
      {/* 腳：以髖為軸前後擺 */}
      <group ref={legL} position={[-0.08, 0.11, 0]}>
        <Stick position={[0, -0.055, 0]} length={0.11} />
      </group>
      <group ref={legR} position={[0.08, 0.11, 0]}>
        <Stick position={[0, -0.055, 0]} length={0.11} />
      </group>
      {/* 身體：方方的，微微上窄下寬 */}
      <Outlined position={[0, 0.28, 0]} outline={1.05}>
        <boxGeometry args={[0.4, 0.36, 0.3]} />
      </Outlined>
      {/* 左手：細棒往外下，跑步時前後擺 */}
      <group ref={armL} position={[-0.2, 0.4, 0]}>
        <Stick position={[-0.06, -0.05, 0]} rotation={[0, 0, 1.1]} length={0.16} />
      </group>
      {/* 右手 + 馬克杯（會舉起來喝） */}
      <group ref={armR} position={[0.2, 0.36, 0]} rotation={[-0.35, 0, 0]}>
        <Stick position={[0.06, 0.02, -0.07]} rotation={[1.2, 0, -0.6]} length={0.17} />
        <group ref={mug} position={[0.1, 0.06, -0.15]}>
          <Outlined outline={1.08}>
            <cylinderGeometry args={[0.05, 0.045, 0.085, 20]} />
          </Outlined>
          {/* 咖啡面 */}
          <mesh position={[0, 0.038, 0]}>
            <cylinderGeometry args={[0.042, 0.042, 0.006, 20]} />
            <meshStandardMaterial color={COFFEE} roughness={0.4} />
          </mesh>
          {/* 杯耳 */}
          <mesh position={[0.058, 0, 0]} rotation={[0, 0, 0]}>
            <torusGeometry args={[0.028, 0.008, 8, 16]} />
            <meshStandardMaterial color={WHITE} roughness={0.85} />
          </mesh>
          <mesh position={[0.058, 0, 0]} scale={1.25}>
            <torusGeometry args={[0.028, 0.008, 8, 16]} />
            <meshBasicMaterial color={INK} side={BackSide} />
          </mesh>
          {/* 蒸氣 */}
          {steamPhase.map((_, i) => (
            <mesh key={i} ref={(m) => { if (m) steam.current[i] = m; }} position={[0, 0.08 + i * 0.05, 0]}>
              <sphereGeometry args={[0.03, 10, 10]} />
              <meshStandardMaterial color="#c9d6e2" emissive="#dfe8f0" emissiveIntensity={0.35} transparent opacity={0.8} depthWrite={false} />
            </mesh>
          ))}
        </group>
      </group>
      {/* 頭 */}
      <group ref={head} position={[0, 0.46, 0]}>
        {/* 兩側鼓起的腮幫（頭的下半部較寬較扁；2026-09-02 他：「腮幫子太寬了」→ 1.75 縮到 1.35） */}
        <Outlined position={[0, 0.14, 0]} scale={[1.35, 0.55, 0.9]}>
          <sphereGeometry args={[0.28, 32, 24]} />
        </Outlined>
        {/* 圓頭 */}
        <Outlined position={[0, 0.34, 0]} scale={[1, 0.95, 0.85]}>
          <sphereGeometry args={[0.28, 32, 24]} />
        </Outlined>
        {/* 嘴：直立的橘色橢圓 */}
        <Outlined position={[0, 0.14, -0.3]} scale={[0.85, 1.25, 0.6]} color={BEAK} outline={1.07}>
          <sphereGeometry args={[0.11, 24, 16]} />
        </Outlined>
        {/* 鼻孔 */}
        {[-0.025, 0.025].map((x) => (
          <mesh key={x} position={[x, 0.17, -0.365]}>
            <sphereGeometry args={[0.009, 8, 8]} />
            <meshBasicMaterial color={INK} />
          </mesh>
        ))}
        {/* 眼睛：直立的黑色小膠囊 */}
        {[-0.13, 0.13].map((x) => (
          <mesh key={x} position={[x, 0.3, -0.235]} scale={[1, 1.8, 1]}>
            <sphereGeometry args={[0.028, 12, 12]} />
            <meshBasicMaterial color={INK} />
          </mesh>
        ))}
        {/* 腮紅 */}
        {[-0.27, 0.27].map((x) => (
          <Outlined key={x} position={[x, 0.12, -0.19]} scale={[1.2, 0.85, 0.5]} color={CHEEK} outline={1.12}>
            <sphereGeometry args={[0.07, 20, 14]} />
          </Outlined>
        ))}
      </group>
    </group>
  );
}
