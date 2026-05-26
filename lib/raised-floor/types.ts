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

/** 防潮墊規格(地板/平台底層防潮) */
export interface UnderlayPreset {
  id: string;
  nameZh: string;
  /** 單捲覆蓋面積(m²) */
  rollAreaM2: number;
  /** 厚度(mm)— 標示用 */
  thicknessMm: number;
  /** 單捲報價(NT$);0 = 未設定不計價 */
  pricePerRoll: number;
}

/** 踢腳板種類 */
export type SkirtingType = "none" | "wood" | "pvc";

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
  /** 面材鋪設方向:沿長軸(預設,跨多根主支)或沿短軸(轉 90°)*/
  plankDirection?: "long-axis" | "short-axis";
  /** 起鋪角:從哪個角起鋪面材;center = 中央置中對牆等寬 */
  plankStartCorner?:
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right"
    | "center";
  /** 主支角材(也用於頂框/底框)*/
  mainJoist: JoistPreset;
  /** 副支角材(可跟主支不同尺寸)*/
  subJoist: JoistPreset;
  /** 主支間距(cm,中心-中心,沿長軸方向量)*/
  joistSpacingCm: number;
  /** 副支間距(cm,中心-中心,沿短軸方向量;副支垂直主支跨 slot)*/
  subJoistSpacingCm: number;
  /** 夾板 */
  plywood: PlywoodPreset;
  /** 夾板損耗率(0–0.5) */
  plywoodWaste: number;
  /** 夾板拼縫間隙(mm)— 防潮膨脹用,實務 2–5mm */
  plywoodGapMm: number;
  /** 估價(NT$) */
  plankPricePerPing: number;
  joistPricePerM: number;
  plywoodPricePerSheet: number;
  skirtingPricePerM: number;
  /** 防潮墊規格;undefined = 不裝防潮墊 */
  underlay?: UnderlayPreset;
  /** 防潮墊損耗率(0–0.5),預設 0.1;搭接 + 切邊 */
  underlayWaste?: number;
  /** 踢腳板種類;預設 "none" 表示沿用舊版「踢腳/收邊 沿平台周長」單一行為 */
  skirtingType?: SkirtingType;
  /** 踢腳板高度(cm),預設 8;skirtingType ≠ "none" 才顯示 */
  skirtingHeightCm?: number;
  /** 門洞數量(踢腳板長度扣除用) */
  doorCount?: number;
  /** 每個門洞寬度(cm) */
  doorWidthCm?: number;
}

export type RaisedFloorBomCategory =
  | "plank"
  | "joist"
  | "sub-joist"
  | "plywood"
  | "skirting"
  | "underlay";

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
  /** 面材排版(重用 lib/floor 的 layout,給裁切表用) */
  layout: import("@/lib/floor/types").FloorLayout;
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
    /** 防潮墊小計;input.underlay = undefined 時為 0 */
    underlay: number;
    total: number;
    /** 任一品項未報價 → true */
    hasUnpriced: boolean;
  };
  trace: {
    /** 面材整片數(複用 floor layout 推出來)*/
    plankFullCount: number;
    /** 面材裁切件數 */
    plankCutCount: number;
    /** 裁切片實際消耗的新片數(餘料再利用後)*/
    plankCutNewCount: number;
    /** 餘料再利用紀錄(人類可讀) */
    offcutReuseLog: string[];
    /** 面材總片數(整片 + 裁切片新料)*/
    plankTotalCount: number;
    /** 面材損耗率(%) */
    plankWastePercent: number;
    /** 主支總公尺數(短向骨架 + 一圈邊框)— 不含副支 */
    joistTotalM: number;
    /** 短向主支條數(中間,不含邊框)*/
    joistRowCount: number;
    /** 中間主支沿長軸的中心位置陣列(cm,bbox 相對座標),供 SVG/3D 共用 */
    mainJoistCentersCm: number[];
    /** 副支總根數(所有 slot 加總) */
    subJoistCount: number;
    /** 副支總公尺數(只含副支) */
    subJoistTotalM: number;
    /** 副支典型單支長(cm)— UI 顯示用,取 middle slot 的長度 */
    subJoistLengthCm: number;
    /** 夾板片數(含損耗) */
    plywoodSheetCount: number;
    /** 平台周長(m) */
    perimeterM: number;
    /** 踢腳板長度(m)= 周長 − 門洞;skirtingType="none" 時 = 周長 */
    skirtingLengthM: number;
    /** 防潮墊卷數(含損耗);input.underlay = undefined 時 = 0 */
    underlayRollCount: number;
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
  plankDirection: "long-axis",
  plankStartCorner: "top-left",
  mainJoist: {
    id: "joist-2x1.2",
    nameZh: "2寸×1.2(60×36mm)",
    widthMm: 60,
    thicknessMm: 36,
  },
  subJoist: {
    id: "joist-1x1.2",
    nameZh: "1寸×1.2(30×36mm)",
    widthMm: 30,
    thicknessMm: 36,
  },
  joistSpacingCm: 30,
  subJoistSpacingCm: 40,
  plywood: {
    id: "ply18-4x8",
    nameZh: "普通夾板 18mm (4×8 尺)",
    thicknessMm: 18,
    sheetLengthCm: 122,
    sheetWidthCm: 244,
  },
  plywoodWaste: 0.2,
  plywoodGapMm: 3,
  plankPricePerPing: 0,
  joistPricePerM: 0,
  plywoodPricePerSheet: 0,
  skirtingPricePerM: 0,
  underlay: undefined,
  underlayWaste: 0.1,
  skirtingType: "none",
  skirtingHeightCm: 8,
  doorCount: 0,
  doorWidthCm: 90,
};
