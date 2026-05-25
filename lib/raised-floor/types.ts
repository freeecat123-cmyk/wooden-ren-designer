/**
 * 和室架高平台估價工具 — 型別定義
 *
 * 單位:cm(與 /floor /ceiling 一致)。
 * 平台形狀=正交多邊形(rect 或 L),可挖 0–2 個挨柱凹陷。
 * 4 大材料:面材(plank)、骨架(joist)、夾板(plywood)、踢腳(skirting)。
 */

import type { Point, RoomPolygon } from "@/lib/floor/types";

export type { Point, RoomPolygon };

export type PlatformShape = "rect" | "l-shape";

/** 挨柱位置:從矩形/L 邊界往內凹挖一塊矩形 */
export type PillarCorner = "tl" | "tr" | "bl" | "br";

export interface Pillar {
  corner: PillarCorner;
  /** 沿 X 方向凹陷寬度(cm) */
  widthCm: number;
  /** 沿 Y 方向凹陷深度(cm) */
  depthCm: number;
}

/** 角材規格(實木角材) */
export interface JoistPreset {
  id: string;
  nameZh: string;
  /** 斷面寬(mm) */
  widthMm: number;
  /** 斷面厚(mm) */
  thicknessMm: number;
}

/** 夾板規格(底層襯板) */
export interface PlywoodPreset {
  id: string;
  nameZh: string;
  /** 板厚(mm) */
  thicknessMm: number;
  /** 單片長(cm)=台尺 4 尺 ≈ 122cm */
  sheetLengthCm: number;
  /** 單片寬(cm)=台尺 8 尺 ≈ 244cm */
  sheetWidthCm: number;
}

export interface RaisedFloorInput {
  /** 平台形狀:矩形 / L */
  shape: PlatformShape;
  /** 總寬(沿 X,cm)*/
  widthCm: number;
  /** 總深(沿 Y,cm)*/
  depthCm: number;
  /** L 形右下凹角的凹陷尺寸(沿 X)cm — 僅 shape=l-shape 時使用 */
  lCutXCm: number;
  /** L 形右下凹角的凹陷尺寸(沿 Y)cm — 僅 shape=l-shape 時使用 */
  lCutYCm: number;
  /** 挨柱列表(0–2 根) */
  pillars: Pillar[];
  /** 架高高度(cm) */
  heightCm: number;
  /** 面材:複用 PlankPreset 的 length/width/gap */
  plankLengthCm: number;
  plankWidthCm: number;
  /** 牆邊伸縮縫(mm)— 跟 /floor 同單位慣例 */
  plankGapMm: number;
  /** 骨架 */
  joist: JoistPreset;
  /** 骨架間距(cm,中心-中心) */
  joistSpacingCm: number;
  /** 夾板 */
  plywood: PlywoodPreset;
  /** 夾板損耗率(0–0.5) */
  plywoodWaste: number;
  /** 估價(NT$) */
  plankPricePerPing: number;
  joistPricePerM: number;
  plywoodPricePerSheet: number;
  skirtingPricePerM: number;
}

export type RaisedFloorBomCategory =
  | "plank"
  | "joist"
  | "plywood"
  | "skirting";

export interface RaisedFloorBomItem {
  category: RaisedFloorBomCategory;
  nameZh: string;
  spec: string;
  /** 數量(片/條) */
  count?: number;
  /** 總長度(m)— joist / skirting */
  totalLengthM?: number;
  note?: string;
  /** 此項小計(NT$);未報價=undefined */
  subtotal?: number;
}

export interface RaisedFloorBom {
  input: RaisedFloorInput;
  /** 平台多邊形(扣除挨柱後) */
  platform: RoomPolygon;
  items: RaisedFloorBomItem[];
  auto: {
    /** 平台面積(m²) */
    platformAreaM2: number;
    /** 坪數 */
    pingShu: number;
    /** 周長(m)— 含挨柱內凹邊 */
    perimeterM: number;
  };
  cost: {
    plank: number;
    joist: number;
    plywood: number;
    skirting: number;
    total: number;
    /** 任一品項未報價 → true */
    hasUnpriced: boolean;
  };
  trace: {
    /** 面材整片數(複用 floor layout 推出來)*/
    plankFullCount: number;
    /** 面材裁切件數 */
    plankCutCount: number;
    /** 面材總片數(整片 + 裁切片新料)*/
    plankTotalCount: number;
    /** 面材損耗率(%) */
    plankWastePercent: number;
    /** 骨架總公尺數(短向骨架 + 一圈邊框) */
    joistTotalM: number;
    /** 短向骨架條數 */
    joistRowCount: number;
    /** 夾板片數(含損耗) */
    plywoodSheetCount: number;
    /** 平台周長(m) */
    perimeterM: number;
  };
}

/** 預設輸入:矩形 300×400 / 高 30cm / 超耐磨標準 / 30×36 角材 30cm 間距 / 15mm 夾板 */
export const DEFAULT_RAISED_FLOOR_INPUT: RaisedFloorInput = {
  shape: "rect",
  widthCm: 300,
  depthCm: 400,
  lCutXCm: 120,
  lCutYCm: 160,
  pillars: [],
  heightCm: 30,
  plankLengthCm: 121,
  plankWidthCm: 19.5,
  plankGapMm: 8,
  joist: {
    id: "j1",
    nameZh: "1寸×1.2",
    widthMm: 30,
    thicknessMm: 36,
  },
  joistSpacingCm: 30,
  plywood: {
    id: "ply15",
    nameZh: "樺木夾板 15mm",
    thicknessMm: 15,
    sheetLengthCm: 122,
    sheetWidthCm: 244,
  },
  plywoodWaste: 0.2,
  plankPricePerPing: 0,
  joistPricePerM: 0,
  plywoodPricePerSheet: 0,
  skirtingPricePerM: 0,
};
