/**
 * 地板施工模擬器(超耐磨/海島型平鋪)— 型別定義
 *
 * 全模組單位:cm(與 /ceiling 一致,避免 mm/cm 轉換錯誤)。
 * 例外:伸縮縫以 mm 輸入(業界慣用),內部立即 /10 轉 cm。
 *
 * 座標系:原點左上,x 右,y 下,房間頂點順時針。
 */

export interface Point {
  x: number;
  y: number;
}

/** 房間 = 正交多邊形(所有邊水平或垂直),頂點順時針 */
export interface RoomPolygon {
  vertices: Point[];
}

/** 鋪設方向:沿 bbox 長軸 / 短軸 */
export type FloorDirection = "long-axis" | "short-axis";

/** 鋪設樣式:直鋪錯縫 / 人字拼 */
export type FloorPattern = "straight" | "herringbone";

/** 錯縫策略 */
export type StaggerMode = "half" | "third" | "random";

/** 起鋪角。center = 中央置中:首/末排對牆等寬,不偏向任一角 */
export type StartCorner =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "center";

/** 損耗計法 */
export type WasteMode = "computed" | "empirical";

/** 收邊類型 */
export type SkirtingType = "skirting" | "trim" | "none";

export interface FloorInput {
  room: RoomPolygon;
  /** 鋪設樣式:直鋪 / 人字拼 */
  pattern: FloorPattern;
  /** 地板片長(cm) */
  plankLengthCm: number;
  /** 地板片寬(cm) */
  plankWidthCm: number;
  direction: FloorDirection;
  stagger: StaggerMode;
  startCorner: StartCorner;
  /** 牆邊伸縮縫(mm) */
  expansionGapMm: number;
  wasteMode: WasteMode;
  /** 裁切餘料是否再利用 */
  reuseOffcuts: boolean;
  skirtingType: SkirtingType;
  /** 門洞數量(踢腳板/收邊條長度扣除用) */
  doorCount: number;
  /** 每個門洞寬度(cm) */
  doorWidthCm: number;
  /** 地板每坪報價(NT$);0 = 未設定不計價 */
  plankPricePerPing: number;
  /** 踢腳板/收邊條每米報價(NT$) */
  skirtingPricePerM: number;
  /** 防潮墊每坪報價(NT$) */
  underlayPricePerPing: number;
}

/** 一片排好的地板片 */
export interface PlacedPlank {
  /** 該片左上角(cm,房間座標) */
  x: number;
  y: number;
  /** 名目尺寸(cm)— 沿 run 軸為 length,沿 row 軸為 width */
  lengthCm: number;
  widthCm: number;
  /** full = 整片可用;cut = 需裁切;在版面外的片不會出現在清單 */
  kind: "full" | "cut";
  /** 第幾排(0 起) */
  row: number;
  /** 與房間可鋪區域的交集面積(cm²)*/
  usedAreaCm2: number;
  /** cut 片裁切後的有效長度(cm)= usedAreaCm2 / widthCm;full 片 = lengthCm */
  effectiveLengthCm: number;
  /** 繪製用多邊形:裁切後落在房間內的可見形狀(人字拼用,3–7 頂點);直鋪片不帶 */
  shape?: Point[];
}

export interface FloorLayout {
  planks: PlacedPlank[];
  rows: number;
  /** 鋪設可用區域(房間向內縮伸縮縫後) */
  layableRegion: RoomPolygon;
}

/** 一行材料 */
export interface FloorBomItem {
  category: "plank" | "skirting" | "underlay";
  nameZh: string;
  spec: string;
  /** 數量(片/條/—)*/
  count?: number;
  /** 總長(m)— skirting 用 */
  totalLengthM?: number;
  /** 總面積(m²)— underlay 用 */
  totalAreaM2?: number;
  note?: string;
  /** 此項小計金額(NT$);價格未設定時為 undefined */
  subtotal?: number;
}

export interface FloorBom {
  input: FloorInput;
  layout: FloorLayout;
  items: FloorBomItem[];
  auto: {
    roomAreaM2: number;
    pingShu: number;
    perimeterM: number;
  };
  cost: {
    plank: number;
    skirting: number;
    underlay: number;
    total: number;
    /** 任一品項價格未設定(=0)→ true,UI 提示估價不完整 */
    hasUnpriced: boolean;
  };
  trace: {
    fullPlankCount: number;
    /** 需裁切片數(餘料優化前的原始裁切片數) */
    cutPieceCount: number;
    /** 裁切片實際消耗的全新地板片數(餘料優化後) */
    cutPlankCount: number;
    totalPlankCount: number;
    wastePercent: number;
    plankRows: number;
    /** 餘料再利用紀錄 */
    offcutReuseLog: string[];
  };
}

export const DEFAULT_FLOOR_INPUT: FloorInput = {
  room: {
    // 預設 420×300 cm 矩形
    vertices: [
      { x: 0, y: 0 },
      { x: 420, y: 0 },
      { x: 420, y: 300 },
      { x: 0, y: 300 },
    ],
  },
  pattern: "straight",
  plankLengthCm: 120,
  plankWidthCm: 19,
  direction: "long-axis",
  stagger: "half",
  startCorner: "top-left",
  expansionGapMm: 10,
  wasteMode: "computed",
  reuseOffcuts: true,
  skirtingType: "skirting",
  doorCount: 1,
  doorWidthCm: 90,
  plankPricePerPing: 0,
  skirtingPricePerM: 0,
  underlayPricePerPing: 0,
};
