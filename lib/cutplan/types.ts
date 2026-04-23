import type { BillableMaterial, MaterialId } from "@/lib/types";

/** 一件需要從原料鋸下來的零件（已是切料尺寸，包含榫頭） */
export interface CutPiece {
  /** 零件 id（同設計裡的 part.id） */
  partId: string;
  partNameZh: string;
  /** 切料後的長（沿纖維方向） */
  length: number;
  /** 切料後的寬 */
  width: number;
  /** 切料後的厚 */
  thickness: number;
  /** 主材（3D 用色） */
  material: MaterialId;
  /** 計價 / 排料用材：實木用 material、板材用 plywood / mdf */
  billable: BillableMaterial;
  /**
   * 允許 2D 排料時將零件旋轉 90°。
   * 預設 false（保守，考量纖維方向）；板材類通常可以設 true。
   */
  allowRotate?: boolean;
}

/** 實木線性排料的一根原料 */
export interface LinearBin {
  /** 本根原料的長度（可能比最大 stockLength 小，若排完剩下太多） */
  stockLength: number;
  /** 這組零件的橫截面（寬 × 厚）——同一 group 內統一 */
  width: number;
  thickness: number;
  /** 放入的零件 + 起始位置（從 0 開始，含 kerf 累加） */
  pieces: Array<{ piece: CutPiece; startMm: number }>;
  /** 已使用長度（含每刀之間的 kerf） */
  usedLength: number;
}

/** 板材 2D 排料的一張原料 */
export interface SheetBin {
  stockLength: number;
  stockWidth: number;
  shelves: Array<{
    /** 此 shelf 在板上的 y 起點（從左下角 0,0 起算） */
    y: number;
    /** shelf 高度（= 該 shelf 最高零件的高） */
    height: number;
    /** 零件：座標以 (x, y) 為左下角 */
    pieces: Array<{
      piece: CutPiece;
      x: number;
      y: number;
      w: number;
      h: number;
      /** 是否已旋轉 90°（w/h 跟 piece.length/width 對調） */
      rotated: boolean;
    }>;
    /** 已使用寬度（含 kerf） */
    usedWidth: number;
  }>;
  /** 已使用高度（含 shelf 之間 kerf） */
  usedHeight: number;
}

/** 實木 group：同材質 × 同寬 × 同厚 */
export interface LinearGroup {
  material: MaterialId;
  width: number;
  thickness: number;
  pieces: CutPiece[];
  bins: LinearBin[];
  /** 總利用率（用掉長度 / 原料總長） */
  utilization: number;
}

/** 板材 group：同板材 × 同厚度 */
export interface SheetGroup {
  billable: "plywood" | "mdf";
  /** 板上的「主材名稱」（給使用者辨識——實際三夾/MDF 不區分纖維方向） */
  representativeMaterialZh: string;
  thickness: number;
  pieces: CutPiece[];
  bins: SheetBin[];
  /** 總利用率（零件面積 / 原料總面積） */
  utilization: number;
}

export interface NestConfig {
  /** 可用的實木原料長度（mm），演算法會 FFD 優先用大支 */
  lumberLengths: number[];
  /** 板材尺寸（mm），只支援一種規格 */
  sheetSize: { length: number; width: number };
  /** 鋸路（mm） */
  kerf: number;
  /**
   * 最小可用餘料（mm）。低於此長度的剩料當作「不可用」，不計入利用率分母。
   * 例：設 50mm，一支原料尾端剩 30mm 就不算浪費（反正也用不到）。
   */
  minWasteMm: number;
  /**
   * 是否允許板材零件 90° 旋轉（全域）。單件層級可被 CutPiece.allowRotate 覆寫。
   */
  allowSheetRotate: boolean;
}

export interface NestPlan {
  linearGroups: LinearGroup[];
  sheetGroups: SheetGroup[];
  config: NestConfig;
}
