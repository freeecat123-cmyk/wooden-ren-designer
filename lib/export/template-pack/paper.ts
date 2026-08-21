// 1:1 樣板用紙張表。尺寸為 mm，一律「長邊 × 短邊」。
import type { MachiningFace } from "@/lib/export/mortise-faces";
import { isPlainRectOutline } from "./needs-template";

export interface PaperSpec {
  id: string;
  label: string;
  /** 長邊 mm */
  w: number;
  /** 短邊 mm */
  h: number;
}

export const PAPERS: readonly PaperSpec[] = [
  { id: "A4", label: "A4", w: 297, h: 210 },
  { id: "A3", label: "A3", w: 420, h: 297 },
  { id: "B3", label: "B3", w: 500, h: 353 },
  { id: "A2", label: "A2", w: 594, h: 420 },
  { id: "A1", label: "A1", w: 841, h: 594 },
  { id: "A0", label: "A0", w: 1189, h: 841 },
] as const;

/** 每邊留白 mm。 */
export const SHEET_MARGIN_MM = 5;

/** 完整紙張階梯（A4 → A0）。輪廓不是矩形時可以一路用到 A0。 */
export const FULL_LADDER: readonly PaperSpec[] = PAPERS;

/** 矩形板的紙張上限。 */
const RECT_CAP = "A2";

/**
 * 依「輪廓形狀」回傳可用的紙張階梯。
 *
 * 2026-08-21 取代原本綁 PartCategory 的面板類封頂 A2。舊規則兩頭都錯：
 *   - 誤殺：有 dado／切角的側板（鞋櫃 906×350、斗櫃 816×450）被分類判成面板 →
 *     封頂 A2 → 整個拿不到樣板，全 catalog 有 23 個面中招
 *   - 浪費：一片 900×350 只有 2 個孔的矩形頂板，卻可能吃掉一整張 A0
 *
 * ⚠️ 圓茶几 700mm 圓桌面這類曲線件**還救不到**：partMachiningFaces 目前回的是
 * 外接矩形，圓桌面拿到的輪廓是一個正方形，所以它在這裡仍然被判成矩形、封頂
 * A2、印不出來。這其實是保護——真的放它出去只會印出一張正方形樣板。等真實
 * 輪廓算得出來之後，它自然會走進「非矩形 → 開到 A0」這條分支，這個函式不用再改。
 *
 * 新規則只問一件事：**這個輪廓用尺畫得出來嗎**。
 *   - 畫不出來的（圓形、曲線、切角）→ 開到 A0，1:1 描邊是唯一划算的做法
 *   - 矩形板（不管幾個孔）→ 封頂 A2。矩形的孔位用零件圖量兩個數字就標出來了，
 *     1:1 沒有比較快，不值得輸出中心那張大紙
 *
 * 註：零孔零榫的純矩形根本不會走到這裡——needs-template.ts 已經先把它整個
 * 濾掉不出樣板了。所以這裡的「矩形」一定是帶孔或帶榫的板。
 */
export function ladderForOutline(outline: MachiningFace["outline"]): PaperSpec[] {
  const cap = isPlainRectOutline(outline) ? RECT_CAP : "A0";
  const out: PaperSpec[] = [];
  for (const p of PAPERS) {
    out.push(p);
    if (p.id === cap) break;
  }
  return out;
}
