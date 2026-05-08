import type { Part, MaterialId } from "@/lib/types";

/**
 * Polygon stave builder：N 段直立壁拼成正多邊形容器（六角 / 八角等）
 *
 * 適用於：pencil-holder 六角款 / tray 八角盤 / dovetail-box 八角盒 /
 *        wine-rack 蜂巢格 / photo-frame 八角框
 *
 * 慣例：
 *   - 軸：底面在 Y=0、高度沿 +Y、徑向沿 X-Z 平面
 *   - 多邊形外接圓半徑 = `outerD / 2`，內接圓半徑 = `outerD/2 × cos(π/N)`
 *   - 每片壁是矩形 visible，長度 = 邊長 = 2 × 內接半徑 × tan(π/N)
 *   - 每片壁外側面對應多邊形邊，旋轉 (i × 360/N)°
 *
 * 不負責：底板（呼叫端決定要矩形 box 底還是 polygon notched-corners 底），
 *         蓋子、握把、絨布內襯。只生 N 段直立壁。
 */
export function polygonStaves(opts: {
  sides: 4 | 6 | 8 | 12;
  outerD: number;       // 外接圓直徑（mm）
  outerH: number;       // 容器外高（mm）
  wallT: number;        // 壁厚（mm）
  botT: number;         // 底厚（mm，影響 wall 高度）
  material: MaterialId;
  idPrefix?: string;    // 預設 "wall"，會生 wall-1 ... wall-N
  baseY?: number;       // 壁底 Y（預設 = botT，貼齊底板上緣）
}): Part[] {
  const { sides, outerD, outerH, wallT, botT, material, idPrefix = "wall", baseY } = opts;
  const radius = outerD / 2;                             // 外接圓
  const apothem = radius * Math.cos(Math.PI / sides);    // 內接圓（壁外側面到中心）
  const edgeLen = 2 * radius * Math.sin(Math.PI / sides); // 邊長
  const wallH = outerH - botT;
  const baseYUse = baseY ?? botT;
  const parts: Part[] = [];
  for (let i = 0; i < sides; i++) {
    // 第 i 片壁的外側面中心方位角（從 +X 軸起算，逆時針）
    // 預設第 0 片在 +Z 方向（z 正 = 後方），讓多邊形對稱於 X 軸
    const ang = (Math.PI * 2 * i) / sides + Math.PI / 2;
    const cx = (apothem - wallT / 2) * Math.cos(ang); // 壁中心離中心 = 內接圓 - 壁厚一半
    const cz = (apothem - wallT / 2) * Math.sin(ang);
    // rotation 推導：visible 預設 length→X、width→Z、thickness→Y
    // 目標：length→tangent(-sin θ, 0, cos θ), width→+Y, thickness→radial(cos θ, 0, sin θ)
    // pushPoint 順序 Rz·Ry·Rx，先 Rx(-π/2) 把 width 從 Z 軸轉到 +Y、thickness 從 Y 轉到 -Z
    // 再 Ry(-θ-π/2) 把 length 從 X 軸轉到 tangent、thickness 從 -Z 轉到 radial
    parts.push({
      id: `${idPrefix}-${i + 1}`,
      nameZh: `第 ${i + 1} 片壁（${sides}角）`,
      material,
      grainDirection: "length",
      visible: { length: edgeLen, width: wallH, thickness: wallT },
      origin: { x: cx, y: baseYUse, z: cz },
      rotation: { x: -Math.PI / 2, y: -ang - Math.PI / 2, z: 0 },
      tenons: [],
      mortises: [],
    });
  }
  return parts;
}
