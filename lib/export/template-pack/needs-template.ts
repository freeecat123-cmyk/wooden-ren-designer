// 判斷一個加工面到底需不需要 1:1 樣板。
import type { MachiningFace } from "@/lib/export/mortise-faces";

/**
 * 判定「矩形」時允許的浮點毛邊（mm）。
 *
 * 幾何運算（旋轉、投影、CSG）會在座標尾巴留下 0.00x 級的殘差，用嚴格相等判斷
 * 會讓一整批本來該被過濾掉的純矩形又冒出來。0.05mm 遠小於任何真實的木工特徵
 * （最窄的切角、斜邊都是 mm 級），不可能把「真的歪掉的邊」誤判成矩形。
 */
const RECT_TOL_MM = 0.05;

/** 輪廓是不是四個角都落在外接矩形角上的正矩形。 */
function isPlainRectOutline(outline: MachiningFace["outline"]): boolean {
  // 只認剛好 4 點。5 點的「重複收尾點」或多點近似矩形一律當成需要樣板——
  // 這個判定是用來「少印紙」的，寧可多印一張，也不要因為判寬了而漏掉輪廓資訊。
  if (outline.length !== 4) return false;

  const xs = outline.map((p) => p.x);
  const ys = outline.map((p) => p.y);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);

  // 每個點都要貼在某個外接矩形的角上，而且四個角剛好各被佔一次
  // （不看點的順序：順時針、逆時針、從哪個角起算都該判成矩形）。
  const cornerUsed = [false, false, false, false];
  for (const p of outline) {
    const onLeft = Math.abs(p.x - x0) <= RECT_TOL_MM;
    const onRight = Math.abs(p.x - x1) <= RECT_TOL_MM;
    const onTop = Math.abs(p.y - y0) <= RECT_TOL_MM;
    const onBottom = Math.abs(p.y - y1) <= RECT_TOL_MM;
    if (!(onLeft || onRight) || !(onTop || onBottom)) return false;
    const idx = (onLeft ? 0 : 1) + (onTop ? 0 : 2);
    if (cornerUsed[idx]) return false; // 兩個點擠在同一角 = 退化圖形，不是矩形
    cornerUsed[idx] = true;
  }
  return cornerUsed.every(Boolean);
}

/**
 * 這個加工面需不需要出 1:1 實尺樣板。
 *
 * 不需要的只有一種：**零孔、零榫、輪廓是純矩形**。一片沒有任何榫孔的長方形，
 * 1:1 樣板等於零資訊——量兩個數字畫線就切了，卻要吃掉好幾張 A4（衣櫃前後底座板
 * 1180×80 佔掉 5 張、玻璃展示櫃連玻璃片都在出木工樣板）。全 catalog 實測 559 張
 * A4 裡有 179 張（32%）是這種。
 *
 * 反過來說，只要有孔、有榫、或輪廓不是矩形（曲線、切角、梯形），就一定要出——
 * 那些正是「照著描」唯一划算的情況。
 *
 * ⚠️ 被判成不需要的零件**不可以從索引消失**。它只是不出樣板，索引仍要列出來並
 * 標明尺寸與「直接量畫」，否則使用者會以為漏件（2026-08-19 索引分頁那次踩過
 * 「無聲丟件」，是同一類錯誤）。
 */
export function faceNeedsTemplate(face: MachiningFace): boolean {
  const marks = face.holes.length + (face.tenons?.length ?? 0);
  if (marks > 0) return true;
  return !isPlainRectOutline(face.outline);
}
