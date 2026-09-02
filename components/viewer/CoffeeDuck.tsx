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
  position,
  scale,
  playing,
  facing = 0.55,
}: {
  /** 腳底站的位置（場景單位） */
  position: [number, number, number];
  /** 鴨子總高（場景單位）；模型本身高約 1.08 */
  scale: number;
  playing: boolean;
  /** 繞 y 轉的角度：正值＝轉向 −x 那側（家具在那邊） */
  facing?: number;
}) {
  const invalidate = useThree((s) => s.invalidate);
  const root = useRef<Group>(null);
  const head = useRef<Group>(null);
  const armR = useRef<Group>(null);
  const mug = useRef<Group>(null);
  const steam = useRef<Mesh[]>([]);
  const t = useRef(Math.random() * 10);
  const steamPhase = useMemo(() => [0, 0.33, 0.66], []);

  const pose = (time: number) => {
    // 呼吸 / 輕晃
    if (root.current) root.current.position.y = position[1] + Math.sin(time * 2.1) * 0.012 * scale;
    if (head.current) head.current.rotation.z = Math.sin(time * 1.3) * 0.05;
    // 每 5 秒喝一口：0.6s 舉杯到嘴、停 0.5s、0.6s 放下
    const cycle = time % 5;
    let sip = 0;
    if (cycle < 0.6) sip = cycle / 0.6;
    else if (cycle < 1.1) sip = 1;
    else if (cycle < 1.7) sip = 1 - (cycle - 1.1) / 0.6;
    const e = sip * sip * (3 - 2 * sip);
    if (armR.current) armR.current.rotation.x = -0.35 - e * 0.9;
    if (mug.current) mug.current.rotation.x = -e * 0.6;
    // 蒸氣：往上飄、淡出、左右搖
    steam.current.forEach((m, i) => {
      if (!m) return;
      const p = (time * 0.35 + steamPhase[i]) % 1;
      m.position.set(Math.sin((time + i) * 2.5) * 0.015, 0.05 + p * 0.16, 0);
      const s = 0.6 + p * 0.8;
      m.scale.set(s, s, s);
      (m.material as MeshStandardMaterial).opacity = 0.55 * (1 - p);
    });
  };

  useFrame((_, delta) => {
    if (!playing) return;
    t.current += Math.min(delta, 0.1);
    pose(t.current);
    invalidate();
  });

  return (
    <group ref={root} position={position} rotation={[0, facing, 0]} scale={scale}>
      {/* 腳 */}
      <Stick position={[-0.08, 0.05, 0]} length={0.11} />
      <Stick position={[0.08, 0.05, 0]} length={0.11} />
      {/* 身體：方方的，微微上窄下寬 */}
      <Outlined position={[0, 0.28, 0]} outline={1.05}>
        <boxGeometry args={[0.4, 0.36, 0.3]} />
      </Outlined>
      {/* 左手：細棒往外下 */}
      <Stick position={[-0.26, 0.36, 0]} rotation={[0, 0, 1.1]} length={0.16} />
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
              <sphereGeometry args={[0.014, 8, 8]} />
              <meshStandardMaterial color="#ffffff" transparent opacity={0.4} depthWrite={false} />
            </mesh>
          ))}
        </group>
      </group>
      {/* 頭 */}
      <group ref={head} position={[0, 0.46, 0]}>
        {/* 兩側鼓起的大腮幫（頭的下半部又寬又扁） */}
        <Outlined position={[0, 0.14, 0]} scale={[1.75, 0.55, 0.9]}>
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
        {[-0.36, 0.36].map((x) => (
          <Outlined key={x} position={[x, 0.12, -0.19]} scale={[1.4, 0.9, 0.5]} color={CHEEK} outline={1.12}>
            <sphereGeometry args={[0.07, 20, 14]} />
          </Outlined>
        ))}
      </group>
    </group>
  );
}
