import type { MaterialId } from "@/lib/types";

export interface MaterialSpec {
  id: MaterialId;
  nameZh: string;
  nameEn: string;
  /** kg/m^3 */
  density: number;
  /** Janka hardness, N */
  hardness: number;
  /** Hex color for 3D rendering */
  color: string;
  /** Recommended joinery considerations */
  notes?: string;
}

export const MATERIALS: Record<MaterialId, MaterialSpec> = {
  "taiwan-cypress": {
    id: "taiwan-cypress",
    nameZh: "台灣檜木",
    nameEn: "Taiwan Cypress",
    density: 480,
    hardness: 1900,
    color: "#d8b878",
    notes: "香氣濃，質地軟好加工，適合榫卯練習",
  },
  teak: {
    id: "teak",
    nameZh: "柚木",
    nameEn: "Teak",
    density: 660,
    hardness: 4740,
    color: "#a07a4f",
    notes: "油性大，戶外耐用",
  },
  "white-oak": {
    id: "white-oak",
    nameZh: "白橡木",
    nameEn: "White Oak",
    density: 770,
    hardness: 6000,
    color: "#c4a571",
    notes: "硬度高，需用硬木鋸與利鑿",
  },
  walnut: {
    id: "walnut",
    nameZh: "胡桃木",
    nameEn: "Black Walnut",
    density: 640,
    hardness: 4490,
    color: "#5c4133",
    notes: "色澤深、紋理美，常用於高階家具",
  },
  "douglas-fir": {
    id: "douglas-fir",
    nameZh: "花旗松",
    nameEn: "Douglas Fir",
    density: 530,
    hardness: 2900,
    color: "#e0b48a",
    notes: "便宜易取得，初學者常用",
  },
  maple: {
    id: "maple",
    nameZh: "楓木",
    nameEn: "Hard Maple",
    density: 705,
    hardness: 6450,
    color: "#efe0bc",
    notes: "紋理細緻淡雅，硬度高，常用於餐桌面與櫃體",
  },
  ash: {
    id: "ash",
    nameZh: "梣木",
    nameEn: "White Ash",
    density: 675,
    hardness: 5900,
    color: "#d6c197",
    notes: "彈性佳、紋理明顯，常用於椅子與工具柄",
  },
  beech: {
    id: "beech",
    nameZh: "山毛櫸",
    nameEn: "European Beech",
    density: 720,
    hardness: 6460,
    color: "#d8b98e",
    notes: "結構密實，適合榫卯家具與玩具",
  },
  pine: {
    id: "pine",
    nameZh: "松木",
    nameEn: "Pine",
    density: 420,
    hardness: 1570,
    color: "#e8cfa5",
    notes: "價格便宜、節眼多，DIY 入門常用",
  },
  // —— 板材類（裝潢用）—— hardness 設低，不觸發硬木工具/粗砂紙建議
  "blockboard-primary": {
    id: "blockboard-primary",
    nameZh: "木芯板",
    nameEn: "Blockboard",
    density: 450,
    hardness: 1200,
    color: "#d8be97",
    notes: "中央松木條 + 上下夾板貼皮；輕、便宜、不會翹曲，裝潢櫃常用",
  },
  "plywood-primary": {
    id: "plywood-primary",
    nameZh: "夾板（裝潢用）",
    nameEn: "Plywood",
    density: 600,
    hardness: 1500,
    color: "#d2b896",
    notes: "多層薄木板交錯膠合；穩定不變形，可貼皮做出實木質感",
  },
  "mdf-primary": {
    id: "mdf-primary",
    nameZh: "中纖板（MDF）",
    nameEn: "MDF",
    density: 750,
    hardness: 1300,
    color: "#c4a47c",
    notes: "木纖維高溫壓製；密度均勻適合烤漆 / CNC 雕刻，但怕水",
  },
};
