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
};
