// 選出零件要拿來當樣板的那些面 —— 每個「入榫面」各一張樣板。
import type { Part } from "@/lib/types";
import { partMachiningFaces, type MachiningFace, type DerivedMortise } from "@/lib/export/mortise-faces";
import { partFlatOutline } from "@/lib/export/parts-svg";

/**
 * 回傳這個零件所有要出樣板的加工面。
 *
 * 為什麼是「全部」而不是「面積最大那一面」：partMachiningFaces 的合約就是
 * 「每個入榫面各一張」——一隻桌腳常常兩個相鄰內側面各有一個榫孔接不同牙板。
 * 舊版只留面積最大的一面，全 catalog 實測有 38 個零件群組是多加工面，
 * 291 個榫孔被靜默丟掉、圖上不留任何痕跡（使用者會照著半套孔位鑿，鑿完才發現）。
 *
 * 排序：孔＋榫數量降冪 → 面積降冪。資訊最多的面排第一，件號拿到 a、
 * 索引也先列它。Array.sort 在 V8 是穩定排序，完全平手時維持
 * partMachiningFaces 的 front→back→left→right→top→bottom 順序，輸出可重現。
 *
 * 零件完全沒有榫卯時 partMachiningFaces 回空陣列，退回 partFlatOutline
 * （純外形），包成同樣的 MachiningFace 形狀，讓下游 sheet.ts 只處理一種型別。
 *
 * ⚠️ derived（反推母榫）會跟真母榫描述同一個接合，必須逐孔去重、真孔優先。
 * 反推的用途是補「範本沒建母榫」的接合（例如床頭櫃底板頂面那兩個側板孔），
 * 但它對每一個真母榫也會再算一次，於是同一個孔被畫兩遍。
 * 全 catalog 實測：孔數 312 → 514，多出的 202 個裡 130 對完全重合、
 * 5 對錯開 1.50~1.53mm（中式方角櫃 4 支立柱、餐椅後柱）。錯開的原因是反推取
 * 「旋轉後榫頭 8 角的 AABB」，對傾斜零件必然膨脹偏移。印在 1:1 樣板上就是
 * 兩個相距 1.5mm 的中心十字，下鑿的人不知道該信哪一個 —— 這正是這個功能
 * 最該防止的錯誤。
 *
 * 去重規則：真孔一律原樣保留（它是權威來源）；反推孔只有在「與所有真孔的中心
 * 距離都 > DUP_TOL_MM」時才留下。5mm 的容差夠寬到蓋住 1.5mm 的偏移，又不可能
 * 誤殺真正相異的孔——榫眼本身寬度就有 6mm 以上，同一面上兩個相距 5mm 的獨立
 * 接合在木工上不存在。
 *
 * 註：lib/export/parts-svg.ts 的 CNC 路徑 derivedFor() 是整個停用反推
 * （註解說對錐形／外撇腳幾何還不穩）。樣板這邊選擇保留 + 去重，因為那 16 個
 * 「只有反推才有」的孔是真接合，對照描有價值；反推對旋轉件的精度限制
 * 見 mortise-faces.ts 檔頭的 v1 說明。
 */
/** 判定兩個孔是否在描述同一個接合的中心距離容差（mm）。 */
const DUP_TOL_MM = 5;

/** 取一個孔的中心（圓孔用 cx/cy，方孔用四角平均）。取不到回 null。 */
function holeCentre(h: MachiningFace["holes"][number]): { x: number; y: number } | null {
  if (h.kind === "circle" && h.cx != null && h.cy != null) return { x: h.cx, y: h.cy };
  const pts = h.pts ?? [];
  if (!pts.length) return null;
  return {
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
  };
}

export function pickTemplateFaces(part: Part, derived: DerivedMortise[] = []): MachiningFace[] {
  // 模板明確宣告過入榫方向（Mortise.axis）的零件 → 完全不用反推。
  //
  // axis 只有「弧肩斜腳／非方腳」的腳會設，那是模板在說「這支腳的接合我自己
  // 標清楚了」。這種腳的反推特別不可靠：實測弧肩斜腳凳腳的 4 個反推孔，3 個跟
  // 真孔距離 0.0mm（純重複），第 4 個把孔判到**外側面**去（真孔 x=+9.5 在內側、
  // 反推 x=−6.5 在外側，差 16mm）。在腳的外側面多鑿一個不存在的孔，那支料就廢了。
  const templateDeclaresJoinery = part.mortises.some((m) => m.axis);
  if (templateDeclaresJoinery) derived = [];

  // 算兩次：只有真母榫的版本當權威，含反推的版本用來補漏。
  const realByKey = new Map(partMachiningFaces(part, [], "blank").map((f) => [f.faceKey, f]));
  const faces = partMachiningFaces(part, derived, "blank").map((f) => {
    const real = realByKey.get(f.faceKey);
    // 這個面完全沒有真孔 → 範本沒建這一面的接合，靠反推補（8/20 撿回來的 9 個
    // 真接合就是這種，例如床頭櫃底板頂面那兩個側板孔）。
    if (!real || real.holes.length === 0) return f;
    // 這個面有真孔 = 範本已經模型化了這一面 → 反推整面不要。
    //
    // 原本是「逐孔比中心距離、超過 DUP_TOL_MM(5mm) 才留」，只擋得住「幾乎重合」
    // 的那種。實測全 catalog 還有 26 個零件群組、67 個孔是同一個接合被畫兩次而
    // 距離遠大於 5mm（開放書櫃左側板 6 個真母榫畫出 12 個孔、斗櫃左側板 5 → 10）
    // ——1:1 樣板上就是兩個相距很遠的孔，下鑿的人不知道該信哪一個，而多鑿一個
    // 不存在的孔會直接毀掉那支料。真孔是權威，範本有建就整面聽它的。
    return { ...f, holes: real.holes };
  });
  if (faces.length > 0) {
    const marks = (f: MachiningFace) => f.holes.length + (f.tenons?.length ?? 0);
    return [...faces].sort((a, b) => (marks(b) - marks(a)) || (b.w * b.h - a.w * a.h));
  }

  const flat = partFlatOutline(part);
  return [
    {
      faceKey: "flat",
      faceLabelZh: "攤平面",
      outline: flat.pts,
      holes: [],
      tenons: [],
      w: flat.w,
      h: flat.h,
    },
  ];
}
