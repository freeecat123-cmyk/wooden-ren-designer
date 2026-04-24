import type { BillableMaterial, MaterialId } from "@/lib/types";
import type { CutPiece, NestConfig } from "./types";
import { computePlanFromPieces } from "./index";
import { materialZh } from "./group";

/**
 * 編輯用「零件規格」——合併相同件數成一列，方便增刪改。
 * 轉換成 CutPiece 陣列（quantity 展開）才餵給 packLinear/packSheet。
 */
export interface PieceSpec {
  /** 穩定 id，給 React key 跟 color 用 */
  id: string;
  name: string;
  /** 長（最長邊） */
  length: number;
  /** 寬（中邊） */
  width: number;
  /** 厚（最短邊） */
  thickness: number;
  material: MaterialId;
  billable: BillableMaterial;
  quantity: number;
  allowRotate: boolean;
}

/**
 * 把設計匯入的 CutPiece 陣列合併成 PieceSpec：
 * 以 (name 去數字+billable+長寬厚) 為 key 群聚，每個 key 的 qty = 出現次數
 */
export function collapseIntoSpecs(pieces: CutPiece[]): PieceSpec[] {
  const map = new Map<string, PieceSpec>();
  for (const p of pieces) {
    // 跟 extract.ts 同規則：去掉所有數字、合併空白（「下層抽屜1 面板」→「下層抽屜 面板」）
    const nameBase = p.partNameZh
      .replace(/\d+/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const key = `${nameBase}|${p.billable}|${p.material}|${p.length}|${p.width}|${p.thickness}`;
    if (!map.has(key)) {
      map.set(key, {
        id: `spec-${map.size}`,
        name: nameBase,
        length: p.length,
        width: p.width,
        thickness: p.thickness,
        material: p.material,
        billable: p.billable,
        quantity: 1,
        allowRotate: p.allowRotate === true,
      });
    } else {
      map.get(key)!.quantity += 1;
    }
  }
  return Array.from(map.values());
}

/**
 * Excel-style 欄位編號：0→A, 25→Z, 26→AA, 27→AB, ...
 * 用於 PieceSpec 的簡易編號，方便裁切圖辨認。
 */
export function indexToCode(i: number): string {
  let n = i;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

/** 把 PieceSpec 展開成 CutPiece 陣列，供排料演算法使用
 *  多件同規格時 code 加序號（C1, C2, C3...），方便現場辨識同款零件的第 N 件 */
export function expandSpecs(specs: PieceSpec[]): CutPiece[] {
  const out: CutPiece[] = [];
  specs.forEach((s, idx) => {
    const baseCode = indexToCode(idx);
    for (let i = 0; i < s.quantity; i++) {
      const code = s.quantity === 1 ? baseCode : `${baseCode}${i + 1}`;
      out.push({
        partId: s.quantity === 1 ? s.id : `${s.id}-${i}`,
        partNameZh: s.quantity === 1 ? s.name : `${s.name} ${i + 1}`,
        code,
        length: s.length,
        width: s.width,
        thickness: s.thickness,
        material: s.material,
        billable: s.billable,
        allowRotate: s.allowRotate,
      });
    }
  });
  return out;
}

/** 把一堆 CutPiece 分進 lumber / sheet group map（供 computePlanFromPieces） */
export function regroupPieces(pieces: CutPiece[]): {
  lumberGroups: Map<string, CutPiece[]>;
  sheetGroups: Map<string, CutPiece[]>;
} {
  const lumber = new Map<string, CutPiece[]>();
  const sheet = new Map<string, CutPiece[]>();
  for (const p of pieces) {
    if (p.billable === "plywood" || p.billable === "mdf") {
      const k = `${p.billable}|${p.thickness}`;
      if (!sheet.has(k)) sheet.set(k, []);
      sheet.get(k)!.push(p);
    } else {
      const k = `${p.material}|${p.width}|${p.thickness}`;
      if (!lumber.has(k)) lumber.set(k, []);
      lumber.get(k)!.push(p);
    }
  }
  return { lumberGroups: lumber, sheetGroups: sheet };
}

export function planFromSpecs(specs: PieceSpec[], config: NestConfig) {
  const pieces = expandSpecs(specs);
  const { lumberGroups, sheetGroups } = regroupPieces(pieces);
  return computePlanFromPieces(lumberGroups, sheetGroups, config);
}

export { materialZh };
