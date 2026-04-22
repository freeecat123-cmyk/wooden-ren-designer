import type { FurnitureDesign } from "@/lib/types";
import { calculateCutDimensions } from "@/lib/geometry/cut-dimensions";
import { deriveBuildSteps, totalEstimatedHours } from "@/lib/steps/derive";
import {
  MATERIAL_PRICE_PER_TSAI,
  MM3_PER_TSAI,
} from "./catalog";
import type { LaborDefaults } from "./labor";

export interface QuoteLineItem {
  label: string;
  detail?: string;
  amount: number;
}

export interface QuoteBreakdown {
  /** 材料用量（總材積）*/
  totalTsai: number;
  totalVolumeMm3: number;
  /** 材料成本（含 10% 切料損耗）*/
  materialCost: number;
  /** 預估工時（hr） */
  laborHours: number;
  /** 工資 */
  laborCost: number;
  /** 設備折舊 */
  equipmentCost: number;
  /** 耗材 */
  consumables: number;
  /** 成本小計（未加毛利、未含稅） */
  costSubtotal: number;
  /** 毛利金額 */
  margin: number;
  /** 報價（未稅） */
  subtotalExclVat: number;
  /** 營業稅 */
  vat: number;
  /** 含稅總計 */
  total: number;
  /** 行項目（用於表格顯示） */
  lines: QuoteLineItem[];
}

const WASTE_RATE = 0.1; // 10% 切料損耗

export function calculateQuote(
  design: FurnitureDesign,
  opts: LaborDefaults,
): QuoteBreakdown {
  // 1. 材料成本：總材積（含切料損耗）× 才價
  let totalVolumeMm3 = 0;
  for (const part of design.parts) {
    const cut = calculateCutDimensions(part);
    totalVolumeMm3 += cut.length * cut.width * cut.thickness;
  }
  const totalWithWasteMm3 = totalVolumeMm3 * (1 + WASTE_RATE);
  const totalTsai = totalWithWasteMm3 / MM3_PER_TSAI;
  const unitPrice = MATERIAL_PRICE_PER_TSAI[design.primaryMaterial] ?? 300;
  const materialCost = totalTsai * unitPrice;

  // 2. 工時成本（build steps 加總）
  const steps = deriveBuildSteps(design);
  const laborHours = totalEstimatedHours(steps);
  const laborCost = laborHours * opts.hourlyRate;

  // 3. 設備折舊（按工時分攤）
  const equipmentCost = laborHours * opts.equipmentRate;

  // 4. 耗材
  const consumables = opts.consumables;

  // 5. 小計
  const costSubtotal = materialCost + laborCost + equipmentCost + consumables;
  const margin = costSubtotal * opts.marginRate;
  const subtotalExclVat = costSubtotal + margin;
  const vat = subtotalExclVat * opts.vatRate;
  const total = subtotalExclVat + vat;

  const lines: QuoteLineItem[] = [
    {
      label: "材料成本",
      detail: `${totalTsai.toFixed(2)} 才（含 ${Math.round(WASTE_RATE * 100)}% 切料損耗）× NT$${unitPrice}/才`,
      amount: materialCost,
    },
    {
      label: "加工工資",
      detail: `${laborHours.toFixed(1)} 小時 × NT$${opts.hourlyRate}/hr`,
      amount: laborCost,
    },
    {
      label: "設備折舊",
      detail: `${laborHours.toFixed(1)} 小時 × NT$${opts.equipmentRate}/hr`,
      amount: equipmentCost,
    },
    {
      label: "耗材",
      detail: "膠、砂紙、護木油、鑽頭磨耗等",
      amount: consumables,
    },
  ];

  return {
    totalTsai,
    totalVolumeMm3: totalWithWasteMm3,
    materialCost,
    laborHours,
    laborCost,
    equipmentCost,
    consumables,
    costSubtotal,
    margin,
    subtotalExclVat,
    vat,
    total,
    lines,
  };
}

/** 產生報價單編號 Q-YYYYMMDD-<設計id前 4 碼> */
export function generateQuoteNumber(designId: string, date = new Date()): string {
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, "");
  const hash = designId.slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, "X");
  return `Q-${ymd}-${hash}`;
}
