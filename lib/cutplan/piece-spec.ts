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

/**
 * 拼板分割 — 把一筆 spec 拆成多條較窄的等寬條。
 * 共用：PiecesEditor 表格、CutPlanSection 排不下警告區。
 *
 * 兩種模式：
 *   - 平均：輸入整數 N → 每條寬 = ceil(原寬/N) + 10mm 膠合刨平損耗，數量 × N
 *   - 自訂：輸入逗號分隔（如 "220,200,220"）→ 拆 N 個獨立 spec，不加損耗
 *
 * 用 window.prompt 收輸入；user 取消 / 輸入無效會 alert + 不做事。
 * 直接 mutate 並 onChange — 呼叫端不必處理 ID 變化。
 */
export function splitSpecPrompt(
  specs: PieceSpec[],
  id: string,
  onChange: (next: PieceSpec[]) => void,
): void {
  const GLUE_ALLOWANCE_MM = 10;
  const stripSplitSuffix = (name: string) =>
    name.replace(/(拼\s*\d+\s*條)\s*$/, "").replace(/(拼板\s*\d+mm)\s*$/, "").trim();

  const src = specs.find((s) => s.id === id);
  if (!src) return;
  const input = window.prompt(
    [
      `拼板分割——「${src.name}」寬 ${src.width}mm`,
      "",
      "輸入條數（平均，自動 +10mm 損耗）：如 3",
      "或各條寬度（逗號分隔，不加損耗）：如 220,200,220",
    ].join("\n"),
    "3",
  );
  if (input === null) return;
  const trimmed = input.trim();
  const baseName = stripSplitSuffix(src.name);

  if (/[,，]/.test(trimmed)) {
    const widths = trimmed
      .split(/[,,]/)
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (widths.length < 2) {
      alert("自訂模式至少要 2 條有效寬度");
      return;
    }
    const newSpecs: PieceSpec[] = widths.map((w, i) => ({
      ...src,
      id: `${src.id}-s${i}`,
      name: `${baseName}（拼板 ${w}mm）`,
      width: w,
      quantity: src.quantity,
    }));
    onChange(specs.flatMap((s) => (s.id === id ? newSpecs : [s])));
    return;
  }

  const n = Math.max(2, Math.min(20, parseInt(trimmed, 10) || 0));
  if (n < 2) {
    alert("條數要 ≥ 2");
    return;
  }
  const newWidth = Math.ceil(src.width / n) + GLUE_ALLOWANCE_MM;
  const updated: PieceSpec = {
    ...src,
    name: `${baseName}（拼${n}條）`,
    width: newWidth,
    quantity: src.quantity * n,
  };
  onChange(specs.map((s) => (s.id === id ? updated : s)));
}

/**
 * partId 反查 spec id：expandSpecs 產生的 partId 是 `${specId}-${i}`（quantity > 1）
 * 或就是 specId（quantity === 1）。要分割時要拿回原 spec id。
 */
export function specIdFromPartId(partId: string): string {
  // 拿掉尾巴的 -123 數字，但保留 -s0 / -s1 之類的 split 後 spec id
  return partId.replace(/-\d+$/, "");
}

export { materialZh };
