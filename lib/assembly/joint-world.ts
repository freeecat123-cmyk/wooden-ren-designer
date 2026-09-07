/**
 * 榫頭 / 榫眼在「世界座標」的位置與方向 —— 3D 預覽與組裝動畫共用的唯一一份。
 *
 * 原本整段寫在 components/PerspectiveView.tsx（榫接模式畫紅色榫頭時要配對母件
 * 榫眼），2026-09-02 做組裝動畫時抽出來：動畫要靠「榫頭往哪個方向插進哪一件」
 * 決定零件的組裝順序與滑入路徑，若在 lib 再抄一份，兩邊遲早漂移
 * （AGENTS.md：同一個判斷只能有一套）。
 *
 * 純函式，無 three.js / React 依賴，server / test 都能跑。
 * 規則出處：docs/drafting-math.md §H8（組裝動畫）、§B（榫卯）。
 */
import type { Part, Tenon } from "@/lib/types";
import { worldExtents } from "@/lib/render/geometry";

export type Vec3 = { x: number; y: number; z: number };
export type Axis = "x" | "y" | "z";
export type Sign = 1 | -1;

/** Euler ZYX（先 X 再 Y 再 Z）把 part-local 向量轉到世界座標。與 3D mesh 的
 *  `new Euler(rx, ry, rz, "ZYX")` 同一套順序。 */
export function rotateXYZ(
  rx: number, ry: number, rz: number,
  lx: number, ly: number, lz: number,
): Vec3 {
  const cosX = Math.cos(rx), sinX = Math.sin(rx);
  const cosY = Math.cos(ry), sinY = Math.sin(ry);
  const cosZ = Math.cos(rz), sinZ = Math.sin(rz);
  let x = lx, y = ly, z = lz;
  const y1 = y * cosX - z * sinX;
  const z1 = y * sinX + z * cosX;
  y = y1; z = z1;
  const x2 = x * cosY + z * sinY;
  const z2 = -x * sinY + z * cosY;
  x = x2; z = z2;
  const x3 = x * cosZ - y * sinZ;
  const y3 = x * sinZ + y * cosZ;
  x = x3; y = y3;
  return { x, y, z };
}

/** 母件榫眼的世界入口點 + 開口方向。 */
export type WorldMortise = {
  partId: string;
  entryX: number; entryY: number; entryZ: number;
  axis: Axis;
  sign: Sign;
  depth: number;
  through: boolean;
  // World-space unit vector pointing OUT of the leg (opening direction).
  // Negated copy of the rotated m.axis (since m.axis points INTO leg).
  // Only set when the source Mortise carried an explicit axis override
  // (compound splay). When null, fall back to dominant-axis legacy path.
  axisUnit?: Vec3 | null;
};

/** 零件的世界中心（mm）。origin.x / z 是中心，origin.y 是底面 → 加半個世界高。 */
export function partWorldCenter(part: Part): Vec3 {
  const yExt = worldExtents(part).yExt;
  return { x: part.origin.x, y: part.origin.y + yExt / 2, z: part.origin.z };
}

function dominantAxis(v: Vec3): { axis: Axis; sign: Sign } {
  const aX = Math.abs(v.x), aY = Math.abs(v.y), aZ = Math.abs(v.z);
  if (aX >= aY && aX >= aZ) return { axis: "x", sign: v.x >= 0 ? 1 : -1 };
  if (aY >= aZ) return { axis: "y", sign: v.y >= 0 ? 1 : -1 };
  return { axis: "z", sign: v.z >= 0 ? 1 : -1 };
}

/**
 * 把所有零件的榫眼攤成世界座標索引（每個榫眼一筆）。
 * 榫眼開口在哪個面：看 mortise.origin 離哪個面最近；y 面上的榫眼（origin.y 剛好
 * 0 或 ly）若同時很貼近 x / z 端面，優先當側面榫眼（腳頂端那種特例）。
 */
export function buildWorldMortiseIndex(parts: Part[]): WorldMortise[] {
  const idx: WorldMortise[] = [];
  for (const part of parts) {
    if (!part.mortises || part.mortises.length === 0) continue;
    const rx = part.rotation?.x ?? 0;
    const ry = part.rotation?.y ?? 0;
    const rz = part.rotation?.z ?? 0;
    const lx = part.visible.length;
    const ly = part.visible.thickness;
    const lz = part.visible.width;
    const pc = partWorldCenter(part);
    for (const m of part.mortises) {
      const yToFace = Math.min(Math.abs(m.origin.y), Math.abs(m.origin.y - ly));
      const xToFace = Math.min(Math.abs(m.origin.x - lx / 2), Math.abs(m.origin.x + lx / 2));
      const zToFace = Math.min(Math.abs(m.origin.z - lz / 2), Math.abs(m.origin.z + lz / 2));
      const yIsCanonical = m.origin.y === 0 || m.origin.y === ly;
      let lex = 0, ley = 0, lez = 0;
      let localAxis: Axis;
      let localSign: Sign;
      if (yIsCanonical && (xToFace < ly / 2 || zToFace < ly / 2)) {
        if (xToFace <= zToFace) {
          localAxis = "x";
          localSign = m.origin.x >= 0 ? 1 : -1;
          lex = localSign === 1 ? lx / 2 : -lx / 2;
          ley = m.origin.y - ly / 2;
          lez = m.origin.z;
        } else {
          localAxis = "z";
          localSign = m.origin.z >= 0 ? 1 : -1;
          lex = m.origin.x;
          ley = m.origin.y - ly / 2;
          lez = localSign === 1 ? lz / 2 : -lz / 2;
        }
      } else if (yToFace <= xToFace && yToFace <= zToFace) {
        localAxis = "y";
        localSign = m.origin.y >= ly - 1 ? 1 : -1;
        lex = m.origin.x;
        ley = localSign === 1 ? ly / 2 : -ly / 2;
        lez = m.origin.z;
      } else if (xToFace <= zToFace) {
        localAxis = "x";
        localSign = m.origin.x >= 0 ? 1 : -1;
        lex = localSign === 1 ? lx / 2 : -lx / 2;
        ley = m.origin.y - ly / 2;
        lez = m.origin.z;
      } else {
        localAxis = "z";
        localSign = m.origin.z >= 0 ? 1 : -1;
        lex = m.origin.x;
        ley = m.origin.y - ly / 2;
        lez = localSign === 1 ? lz / 2 : -lz / 2;
      }
      const axisUnit = m.axis
        ? (() => {
            const mag = Math.hypot(m.axis!.x, m.axis!.y, m.axis!.z) || 1;
            return { x: m.axis!.x / mag, y: m.axis!.y / mag, z: m.axis!.z / mag };
          })()
        : null;
      const pushEntry = (la: Axis, ls: Sign, ex: number, ey: number, ez: number) => {
        const e = rotateXYZ(rx, ry, rz, ex, ey, ez);
        const a = rotateXYZ(rx, ry, rz, la === "x" ? ls : 0, la === "y" ? ls : 0, la === "z" ? ls : 0);
        const { axis: worldAxis, sign: worldSign } = dominantAxis(a);
        idx.push({
          partId: part.id,
          entryX: pc.x + e.x,
          entryY: pc.y + e.y,
          entryZ: pc.z + e.z,
          axis: worldAxis,
          sign: worldSign,
          depth: m.depth,
          through: m.through ?? false,
          axisUnit,
        });
      };
      pushEntry(localAxis, localSign, lex, ley, lez);
      /**
       * 🩸 第一次判斷只靠「離哪個面最近」——餐桌側牙條的榫眼在腳頂下 31mm、離側面
       * 35mm，被當成「頂面榫眼」，側牙條的榫頭永遠配不到（2026-09-02 做組裝動畫
       * 時抓到）。補救：另外兩個面也各給一筆候選入口；配對本來就取「開口方向相反
       * 且離榫頭根面最近（< 60mm）」的那筆，多給的入口只有在真的對得上時才會被選到。
       */
      const alts: Array<[Axis, Sign, number, number, number]> = [];
      if (localAxis !== "x") alts.push(["x", m.origin.x >= 0 ? 1 : -1, m.origin.x >= 0 ? lx / 2 : -lx / 2, m.origin.y - ly / 2, m.origin.z]);
      if (localAxis !== "z") alts.push(["z", m.origin.z >= 0 ? 1 : -1, m.origin.x, m.origin.y - ly / 2, m.origin.z >= 0 ? lz / 2 : -lz / 2]);
      if (localAxis !== "y") alts.push(["y", m.origin.y >= ly / 2 ? 1 : -1, m.origin.x, m.origin.y >= ly / 2 ? ly / 2 : -ly / 2, m.origin.z]);
      for (const [la, ls, ex, ey, ez] of alts) pushEntry(la, ls, ex, ey, ez);
      /**
       * 通孔兩面都是入口（2026-09-02）：餐椅座板的腳榫眼是通孔，腳從下面進、背柱從上面進
       * 「共用同一個榫眼」。只給主面入口時，背柱下端榫頭（朝下）配不到座板、反而配到 25mm 下面的
       * 後腳榫眼——三視圖實畫稽核把它報成「背柱跟腳差 25mm」。配對本來就要求方向相反且距離 < 60mm，
       * 多給的對面入口只有真的從那面進來的榫頭會選到。
       */
      if (m.through) {
        const opp: Sign = localSign === 1 ? -1 : 1;
        if (localAxis === "y") pushEntry("y", opp, lex, opp === 1 ? ly / 2 : -ly / 2, lez);
        else if (localAxis === "x") pushEntry("x", opp, opp === 1 ? lx / 2 : -lx / 2, ley, lez);
        else pushEntry("z", opp, lex, ley, opp === 1 ? lz / 2 : -lz / 2);
      }
    }
  }
  return idx;
}

/** 公榫件上一支榫頭的根面世界座標 + 往外（插進母件）的世界單位向量。 */
export type TenonWorld = {
  root: Vec3;
  outUnit: Vec3;
  outAxis: Axis;
  outSign: Sign;
  /** 榫頭斷面「寬」方向的世界單位向量（螺絲排位用） */
  widthUnit: Vec3;
  /** 榫頭斷面「厚」方向的世界單位向量 */
  thickUnit: Vec3;
};

export function tenonWorld(part: Part, t: Tenon): TenonWorld {
  const lx = part.visible.length;
  const ly = part.visible.thickness;
  const lz = part.visible.width;
  const oW = t.offsetWidth ?? 0;
  const oT = t.offsetThickness ?? 0;
  const rxP = part.rotation?.x ?? 0;
  const ryP = part.rotation?.y ?? 0;
  const rzP = part.rotation?.z ?? 0;
  let lrx = 0, lry = 0, lrz = 0;
  let lox = 0, loy = 0, loz = 0;
  switch (t.position) {
    case "start":  lrx = -lx / 2; lry = oT; lrz = oW; lox = -1; break;
    case "end":    lrx = +lx / 2; lry = oT; lrz = oW; lox = +1; break;
    case "top":    lrx = oW; lry = +ly / 2; lrz = oT; loy = +1; break;
    case "bottom": lrx = oW; lry = -ly / 2; lrz = oT; loy = -1; break;
    case "left":   lrx = oW; lry = oT; lrz = -lz / 2; loz = -1; break;
    case "right":  lrx = oW; lry = oT; lrz = +lz / 2; loz = +1; break;
  }
  // Compute root position in world (always via part rotation).
  const rRoot = rotateXYZ(rxP, ryP, rzP, lrx, lry, lrz);
  const pc = partWorldCenter(part);
  const root = { x: pc.x + rRoot.x, y: pc.y + rRoot.y, z: pc.z + rRoot.z };
  // outUnit / outAxis: tenon outward direction in WORLD frame.
  // - With t.axis present (compound splay): t.axis IS world; use directly.
  // - Without t.axis: rotate position-default local outward through partQ.
  let outUnit: Vec3;
  if (t.axis) {
    const m = Math.hypot(t.axis.x, t.axis.y, t.axis.z) || 1;
    outUnit = { x: t.axis.x / m, y: t.axis.y / m, z: t.axis.z / m };
  } else {
    const rOut = rotateXYZ(rxP, ryP, rzP, lox, loy, loz);
    const mag = Math.hypot(rOut.x, rOut.y, rOut.z) || 1;
    outUnit = { x: rOut.x / mag, y: rOut.y / mag, z: rOut.z / mag };
  }
  const { axis: outAxis, sign: outSign } = dominantAxis(outUnit);
  // 斷面軸：start/end → 寬=local z、厚=local y；top/bottom → 寬=local x、厚=local z；
  // left/right → 寬=local x、厚=local y（跟上面 lrx/lry/lrz 的 oW/oT 擺法一致）
  const [wl, tl]: [Vec3, Vec3] =
    t.position === "start" || t.position === "end"
      ? [{ x: 0, y: 0, z: 1 }, { x: 0, y: 1, z: 0 }]
      : t.position === "top" || t.position === "bottom"
        ? [{ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }]
        : [{ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }];
  const wr = rotateXYZ(rxP, ryP, rzP, wl.x, wl.y, wl.z);
  const tr = rotateXYZ(rxP, ryP, rzP, tl.x, tl.y, tl.z);
  const wm = Math.hypot(wr.x, wr.y, wr.z) || 1;
  const tm = Math.hypot(tr.x, tr.y, tr.z) || 1;
  return {
    root, outUnit, outAxis, outSign,
    widthUnit: { x: wr.x / wm, y: wr.y / wm, z: wr.z / wm },
    thickUnit: { x: tr.x / tm, y: tr.y / tm, z: tr.z / tm },
  };
}

/** 榫頭根面到榫眼入口的最大配對距離（mm）。 */
export const TENON_MORTISE_MATCH_MM = 60;

/**
 * 替一支榫頭找母件榫眼：開口方向要跟榫頭反向（同一條軸、相反號；有明示 axis 的
 * 用內積 < -0.85），入口點距離榫頭根面 < 60mm 取最近的一筆。
 * 抽屜件只配同一個抽屜家族（`{prefix}drawer-N-` 同前綴），不會配到隔壁抽屜。
 */
export function matchMortiseForTenon(
  part: Part,
  t: Tenon,
  tw: TenonWorld,
  index: WorldMortise[],
): WorldMortise | null {
  const drawerMatch = part.id.match(/^(.*?drawer-\d+)-/);
  const drawerFamily = drawerMatch ? drawerMatch[1] + "-" : null;
  let best: WorldMortise | null = null;
  let bestDist = Infinity;
  for (const mw of index) {
    if (mw.partId === part.id) continue;
    if (drawerFamily && !mw.partId.startsWith(drawerFamily)) continue;
    if (mw.axisUnit && t.axis) {
      const dot =
        mw.axisUnit.x * tw.outUnit.x +
        mw.axisUnit.y * tw.outUnit.y +
        mw.axisUnit.z * tw.outUnit.z;
      if (dot > -0.85) continue;
    } else {
      if (mw.axis !== tw.outAxis) continue;
      if (mw.sign === tw.outSign) continue;
    }
    const dx = mw.entryX - tw.root.x;
    const dy = mw.entryY - tw.root.y;
    const dz = mw.entryZ - tw.root.z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d < bestDist && d < TENON_MORTISE_MATCH_MM) { bestDist = d; best = mw; }
  }
  return best;
}
