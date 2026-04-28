import type { MaterialId } from "@/lib/types";

/**
 * 立體屬性（per drafting-math.md §AC）
 *
 * 各維度為 1-5 分（5 = 最強/最佳），給雷達圖 + 屬性 chips 用。
 * 雷達圖六軸：硬度 / 加工性 / 耐候 / 香氣 / 環保 / 價格（價格 5 = 最便宜）
 */
export interface MaterialAttributes {
  /** 硬度（1-5）— 對應 Janka，5 = 極硬如紫檀 */
  hardness5: 1 | 2 | 3 | 4 | 5;
  /** 加工性（1-5）— 5 = 易切削/釘/黏，紫檀類為 1 */
  workability: 1 | 2 | 3 | 4 | 5;
  /** 耐候性（1-5）— 5 = 戶外耐用如柚木，雲杉為 1 */
  durability: 1 | 2 | 3 | 4 | 5;
  /** 香氣（1-5）— 5 = 強香如檜木，板材為 1 */
  aroma: 1 | 2 | 3 | 4 | 5;
  /** 環保（1-5）— 5 = 本地可再生 + 無 CITES，紫檀類為 1 */
  ecoScore: 1 | 2 | 3 | 4 | 5;
  /** 價格（1-5）— 5 = 最便宜，紫檀為 1 */
  affordability: 1 | 2 | 3 | 4 | 5;
  /** 戶外用 */
  outdoor: boolean;
  /** CITES 等級（受限木種才填） */
  cites: "I" | "II" | "III" | null;
  /** 黏合難度（給警示用，true = 油性難黏需擦丙酮） */
  oilyHardToGlue: boolean;
  /** 文化定位 tags（給派系推薦用） */
  styles: ("ming" | "qing" | "neo-cn" | "jp" | "nordic" | "american-craft" | "colonial" | "industrial")[];
}

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
  /** 立體屬性（per §AC9） */
  attrs?: MaterialAttributes;
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
    attrs: {
      hardness5: 2, workability: 5, durability: 5, aroma: 5, ecoScore: 4, affordability: 2,
      outdoor: true, cites: null, oilyHardToGlue: false,
      styles: ["jp", "neo-cn"],
    },
  },
  teak: {
    id: "teak",
    nameZh: "柚木",
    nameEn: "Teak",
    density: 660,
    hardness: 4740,
    color: "#a07a4f",
    notes: "油性大，戶外耐用",
    attrs: {
      hardness5: 4, workability: 3, durability: 5, aroma: 2, ecoScore: 2, affordability: 1,
      outdoor: true, cites: null, oilyHardToGlue: true,
      styles: ["colonial"],
    },
  },
  "white-oak": {
    id: "white-oak",
    nameZh: "白橡木",
    nameEn: "White Oak",
    density: 770,
    hardness: 6000,
    color: "#c4a571",
    notes: "硬度高，需用硬木鋸與利鑿",
    attrs: {
      hardness5: 5, workability: 3, durability: 4, aroma: 1, ecoScore: 4, affordability: 3,
      outdoor: true, cites: null, oilyHardToGlue: false,
      styles: ["nordic", "american-craft", "industrial"],
    },
  },
  walnut: {
    id: "walnut",
    nameZh: "胡桃木",
    nameEn: "Black Walnut",
    density: 640,
    hardness: 4490,
    color: "#5c4133",
    notes: "色澤深、紋理美，常用於高階家具",
    attrs: {
      hardness5: 4, workability: 4, durability: 3, aroma: 1, ecoScore: 3, affordability: 2,
      outdoor: false, cites: null, oilyHardToGlue: false,
      styles: ["american-craft", "neo-cn"],
    },
  },
  "douglas-fir": {
    id: "douglas-fir",
    nameZh: "花旗松",
    nameEn: "Douglas Fir",
    density: 530,
    hardness: 2900,
    color: "#e0b48a",
    notes: "便宜易取得，初學者常用",
    attrs: {
      hardness5: 2, workability: 5, durability: 2, aroma: 2, ecoScore: 4, affordability: 5,
      outdoor: false, cites: null, oilyHardToGlue: false,
      styles: ["industrial", "nordic"],
    },
  },
  maple: {
    id: "maple",
    nameZh: "楓木",
    nameEn: "Hard Maple",
    density: 705,
    hardness: 6450,
    color: "#efe0bc",
    notes: "紋理細緻淡雅，硬度高，常用於餐桌面與櫃體",
    attrs: {
      hardness5: 5, workability: 3, durability: 2, aroma: 1, ecoScore: 4, affordability: 3,
      outdoor: false, cites: null, oilyHardToGlue: false,
      styles: ["nordic", "american-craft"],
    },
  },
  ash: {
    id: "ash",
    nameZh: "梣木",
    nameEn: "White Ash",
    density: 675,
    hardness: 5900,
    color: "#d6c197",
    notes: "彈性佳、紋理明顯，常用於椅子與工具柄",
    attrs: {
      hardness5: 4, workability: 4, durability: 2, aroma: 1, ecoScore: 4, affordability: 4,
      outdoor: false, cites: null, oilyHardToGlue: false,
      styles: ["nordic", "american-craft"],
    },
  },
  beech: {
    id: "beech",
    nameZh: "山毛櫸",
    nameEn: "European Beech",
    density: 720,
    hardness: 6460,
    color: "#d8b98e",
    notes: "結構密實，適合榫卯家具與玩具",
    attrs: {
      hardness5: 5, workability: 3, durability: 2, aroma: 1, ecoScore: 4, affordability: 3,
      outdoor: false, cites: null, oilyHardToGlue: false,
      styles: ["nordic", "jp"],
    },
  },
  pine: {
    id: "pine",
    nameZh: "松木",
    nameEn: "Pine",
    density: 420,
    hardness: 1570,
    color: "#e8cfa5",
    notes: "價格便宜、節眼多，DIY 入門常用",
    attrs: {
      hardness5: 1, workability: 5, durability: 1, aroma: 2, ecoScore: 5, affordability: 5,
      outdoor: false, cites: null, oilyHardToGlue: false,
      styles: ["industrial", "nordic"],
    },
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
    attrs: {
      hardness5: 2, workability: 5, durability: 1, aroma: 1, ecoScore: 3, affordability: 5,
      outdoor: false, cites: null, oilyHardToGlue: false,
      styles: ["industrial"],
    },
  },
  "plywood-primary": {
    id: "plywood-primary",
    nameZh: "夾板（裝潢用）",
    nameEn: "Plywood",
    density: 600,
    hardness: 1500,
    color: "#d2b896",
    notes: "多層薄木板交錯膠合；穩定不變形，可貼皮做出實木質感",
    attrs: {
      hardness5: 2, workability: 5, durability: 2, aroma: 1, ecoScore: 3, affordability: 5,
      outdoor: false, cites: null, oilyHardToGlue: false,
      styles: ["industrial", "nordic"],
    },
  },
  "mdf-primary": {
    id: "mdf-primary",
    nameZh: "中纖板（MDF）",
    nameEn: "MDF",
    density: 750,
    hardness: 1300,
    color: "#c4a47c",
    notes: "木纖維高溫壓製；密度均勻適合烤漆 / CNC 雕刻，但怕水",
    attrs: {
      hardness5: 2, workability: 5, durability: 1, aroma: 1, ecoScore: 2, affordability: 5,
      outdoor: false, cites: null, oilyHardToGlue: false,
      styles: ["industrial"],
    },
  },
};
