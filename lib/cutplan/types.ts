import type { BillableMaterial, MaterialId } from "@/lib/types";

/** 一件需要從原料鋸下來的零件（已是切料尺寸，包含榫頭） */
export interface CutPiece {
  /** 零件 id（同設計裡的 part.id） */
  partId: string;
  partNameZh: string;
  /** 簡易編號 A / B / C...（由 PieceSpec 的順序推導；多件同規格共用同一編號） */
  code?: string;
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

/** 一張原料板 (2D)：不分實木/板材，一律用這個結構 */
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
      /** 切料順序（1-based，同一 bin 內由低到高） */
      order?: number;
    }>;
    /** 已使用寬度（含 kerf） */
    usedWidth: number;
  }>;
  /** 已使用高度（含 shelf 之間 kerf） */
  usedHeight: number;
}

/**
 * 統一排料 group：實木 + 板材共用。每個 bin 代表一塊實體原料。
 */
export interface StockGroup {
  kind: "solid" | "plywood" | "mdf";
  /** solid 才有 */
  material?: MaterialId;
  thickness: number;
  pieces: CutPiece[];
  bins: SheetBin[];
  utilization: number;
  unplaced: CutPiece[];
}

/**
 * 常見厚度預設（mm）。實木用英制轉 mm，板材用國際慣用值。
 * PiecesEditor / StockEditor 的厚度欄會用這些作下拉選項，
 * 使用者仍可選「其他」自由輸入。
 */
export const SOLID_WOOD_THICKNESSES: number[] = [
  25, // 1"
  32, // 1 1/4"
  38, // 1 1/2"
  51, // 2"
  76, // 3"
  102, // 4"
];

export const SHEET_THICKNESSES: number[] = [1.2, 3, 6, 9, 12, 15, 18, 21];

/**
 * 統一庫存項目：實木 + 板材共用一張表。
 * kind="solid" 用 material；kind="plywood"/"mdf" 不用 material。
 */
export interface StockItem {
  kind: "solid" | "plywood" | "mdf";
  /** 僅 kind==="solid" 有意義；板材類別不關心木種 */
  material?: MaterialId;
  thickness: number;
  length: number;
  width: number;
  /** 庫存支數；null = 不限 */
  count: number | null;
}

/**
 * @deprecated 用 StockItem 代替。保留 export 是因為舊的 URL / 儲存資料可能還在用。
 */
export type LumberStock = StockItem;

export interface NestConfig {
  /** 統一庫存（實木 + 板材）。空陣列 = 沒列任何板，零件全部 unplaced。 */
  inventory: StockItem[];
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
  /**
   * 排料策略：
   * - "ffd" First-Fit Decreasing：第一個塞得下的 shelf 就放（預設，快且穩定）
   * - "bfd" Best-Fit Decreasing：挑剩餘空間最少但塞得下的 shelf（通常利用率更高）
   */
  strategy?: "ffd" | "bfd";
}

export interface NestPlan {
  groups: StockGroup[];
  config: NestConfig;
}

