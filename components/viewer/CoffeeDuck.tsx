"use client";

/**
 * 拿鋸子的鴨子 —— 組裝動畫旁邊的吉祥物（原本拿咖啡杯，2026-09-02 他：「改拿鋸子好了」）。
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
 * 再加「組裝好後跳到家具上」「椅子就可以坐上去」：最後一步結束（jumpAtMs）就從當下位置
 * 拋物線跳上 perch，有座板的坐著（腳往前伸）、沒有的站在頂面，然後喝咖啡。
 *
 * 姿勢全部由組裝時鐘 clockRef（ms）算出來，不累積：拖滑桿倒回去會重新跑，錄影也錄得到。
 */
import { useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { BackSide, type Group } from "three";

const INK = "#2b2b2b";
const WHITE = "#fffdf8";
const BEAK = "#e8923a";
const CHEEK = "#e69aa8";
const HANDLE = "#b07a45";
const BLADE = "#c9ced3";

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

/** 跳上去要多久（ms） */
export const DUCK_JUMP_MS = 900;

export function CoffeeDuck({
  path,
  perch,
  scale,
  playing,
  clockRef,
  jumpAtMs,
}: {
  /** 跑步路線：固定 x，在 zMin ~ zMax 之間來回（場景單位，y = 地面） */
  path: { x: number; zMin: number; zMax: number };
  /** 組裝完跳上去的落點（場景單位）；sit = 有座板 → 坐著，否則站著 */
  perch: { x: number; y: number; z: number; sit: boolean };
  /** 鴨子總高（場景單位）；模型本身高約 1.08 */
  scale: number;
  playing: boolean;
  /** 組裝動畫時鐘（ms），AssemblyDriver 每幀更新 */
  clockRef: MutableRefObject<number>;
  /** 最後一步結束的時間（ms）→ 開始跳 */
  jumpAtMs: number;
}) {
  const invalidate = useThree((s) => s.invalidate);
  const root = useRef<Group>(null);
  const head = useRef<Group>(null);
  const armR = useRef<Group>(null);
  const armL = useRef<Group>(null);
  const legL = useRef<Group>(null);
  const legR = useRef<Group>(null);
  const saw = useRef<Group>(null);
  const heading = useRef(0);

  /** 來回一趟的時間（秒）：路線越長跑越久，但最少 2 秒 */
  const lapSec = Math.max(2, (path.zMax - path.zMin) / (0.9 * scale));

  /** 跑步時在路線上的位置與方向（由時間算，不累積） */
  const runAt = (time: number) => {
    const u = (time / lapSec) % 2;
    const f = u < 1 ? u : 2 - u;          // 0→1→0
    return { z: path.zMin + (path.zMax - path.zMin) * f, dir: u < 1 ? 1 : -1 };
  };
  const turnToward = (target: number, k: number) => {
    let d = target - heading.current;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    heading.current += d * k;
  };

  const pose = (tMs: number) => {
    const time = tMs / 1000;
    const jumpT = (tMs - jumpAtMs) / DUCK_JUMP_MS;
    if (jumpT < 0) {
      // ---- 跑來跑去 ----
      const { z, dir } = runAt(time);
      turnToward(dir > 0 ? Math.PI : 0, 0.15);   // 模型預設面向 −z
      const stride = time * 11;
      const bounce = Math.abs(Math.sin(stride)) * 0.03;
      root.current?.position.set(path.x, bounce * scale, z);
      root.current?.rotation.set(0, heading.current, 0);
      if (head.current) head.current.rotation.z = Math.sin(stride * 0.5) * 0.08;
      if (legL.current) legL.current.rotation.x = Math.sin(stride) * 0.7;
      if (legR.current) legR.current.rotation.x = -Math.sin(stride) * 0.7;
      if (armL.current) armL.current.rotation.x = -Math.sin(stride) * 0.5;
      if (armR.current) armR.current.rotation.x = -0.6 + Math.sin(stride) * 0.35;
      if (saw.current) saw.current.rotation.z = Math.sin(stride) * 0.12;
    } else {
      // ---- 跳上去 → 坐 / 站著喝咖啡 ----
      const start = runAt(jumpAtMs / 1000);
      const p = Math.min(1, jumpT);
      const e = p * p * (3 - 2 * p);
      const landY = perch.sit ? perch.y - 0.1 * scale : perch.y;   // 坐著：屁股貼座面（身體底在模型 0.1）
      const peak = Math.max(0, landY) + 0.45 * scale;
      const x = path.x + (perch.x - path.x) * e;
      const z = start.z + (perch.z - start.z) * e;
      const y = p >= 1 ? landY : (1 - p) * (1 - p) * 0 + 2 * (1 - p) * p * peak + p * p * landY;
      root.current?.position.set(x, y, z);
      turnToward(0, p >= 1 ? 0.2 : 0.35);   // 面向鏡頭（−z）
      root.current?.rotation.set(0, heading.current, 0);
      const inAir = p < 1;
      const legAngle = perch.sit ? 1.4 : 0;   // 坐：腳往前伸
      if (legL.current) legL.current.rotation.x = inAir ? -0.6 : legAngle;
      if (legR.current) legR.current.rotation.x = inAir ? -0.6 : legAngle;
      if (armL.current) armL.current.rotation.x = inAir ? -2.2 : 0;
      if (head.current) head.current.rotation.z = inAir ? 0 : Math.sin(time * 1.3) * 0.05;
      // 每 5 秒把鋸子舉起來揮兩下：0.5s 舉高、揮 1s、0.5s 放下
      const cycle = inAir ? 0 : (time % 5);
      let lift = 0;
      if (cycle < 0.5) lift = cycle / 0.5;
      else if (cycle < 1.5) lift = 1;
      else if (cycle < 2) lift = 1 - (cycle - 1.5) / 0.5;
      const le = inAir ? 0 : lift * lift * (3 - 2 * lift);
      const wave = cycle >= 0.5 && cycle < 1.5 ? Math.sin((cycle - 0.5) * Math.PI * 4) * 0.35 : 0;
      if (armR.current) armR.current.rotation.x = inAir ? -1.6 : -0.35 - le * 1.9;
      if (saw.current) saw.current.rotation.z = wave;
    }
    // 蒸氣：往上飄、淡出、左右搖
  };

  // 每一幀（不論 demand / always）都照時鐘擺姿勢；只有播放中才要求下一幀，靜止時不空燒
  useFrame(() => {
    pose(clockRef.current);
    if (playing) invalidate();
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
      {/* 右手 + 鋸子（跑步時跟著擺，坐好後每 5 秒舉起來揮兩下） */}
      <group ref={armR} position={[0.2, 0.36, 0]} rotation={[-0.35, 0, 0]}>
        <Stick position={[0.06, 0.02, -0.07]} rotation={[1.2, 0, -0.6]} length={0.17} />
        <group ref={saw} position={[0.1, 0.06, -0.15]} rotation={[0, 0.3, 0]}>
          {/* 木柄 */}
          <Outlined position={[0, 0, 0.06]} rotation={[Math.PI / 2, 0, 0]} color={HANDLE} outline={1.1}>
            <cylinderGeometry args={[0.016, 0.02, 0.12, 12]} />
          </Outlined>
          {/* 刀片：薄板，往前伸 */}
          <Outlined position={[0, 0.02, -0.13]} color={BLADE} outline={1.04}>
            <boxGeometry args={[0.004, 0.06, 0.26]} />
          </Outlined>
          {/* 齒緣：刀片下緣一排小三角 */}
          {Array.from({ length: 9 }, (_, i) => (
            <mesh key={i} position={[0, -0.014, -0.02 - i * 0.028]} rotation={[0, Math.PI / 2, 0]}>
              <coneGeometry args={[0.012, 0.014, 3]} />
              <meshStandardMaterial color={INK} roughness={0.8} />
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
