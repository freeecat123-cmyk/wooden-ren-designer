import type { BillableMaterial, FurnitureDesign } from "@/lib/types";
import { calculateCutDimensions } from "@/lib/geometry/cut-dimensions";
import { deriveBuildSteps, totalEstimatedHours } from "@/lib/steps/derive";
import {
  MATERIAL_PRICE_PER_TSAI,
  MM3_PER_TSAI,
  SHEET_GOOD_LABEL,
  effectiveBillableMaterial,
} from "./catalog";
import { MATERIALS } from "@/lib/materials";
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
  /** 塗裝費 */
  finishingCost: number;
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

function materialLabel(m: BillableMaterial): string {
  if (m === "plywood" || m === "mdf") return SHEET_GOOD_LABEL[m];
  return MATERIALS[m]?.nameZh ?? m;
}

export function calculateQuote(
  design: FurnitureDesign,
  opts: LaborDefaults,
): QuoteBreakdown {
  // 1. 按計價材料分組加總材積
  const volumeByMaterial = new Map<BillableMaterial, number>();
  for (const part of design.parts) {
    const cut = calculateCutDimensions(part);
    const vol = cut.length * cut.width * cut.thickness;
    const mat = effectiveBillableMaterial(part);
    volumeByMaterial.set(mat, (volumeByMaterial.get(mat) ?? 0) + vol);
  }

  const materialLines: QuoteLineItem[] = [];
  let materialCost = 0;
  let totalVolumeMm3 = 0;
  let totalTsai = 0;

  // 排序：主材在前、板材在後
  const sortedEntries = [...volumeByMaterial.entries()].sort((a, b) => {
    const aSheet = a[0] === "plywood" || a[0] === "mdf" ? 1 : 0;
    const bSheet = b[0] === "plywood" || b[0] === "mdf" ? 1 : 0;
    return aSheet - bSheet;
  });

  for (const [mat, volMm3] of sortedEntries) {
    const withWaste = volMm3 * (1 + WASTE_RATE);
    const tsai = withWaste / MM3_PER_TSAI;

    // 才價優先順序：使用者輸入 > catalog 預設
    let unitPrice: number;
    if (mat === "plywood") {
      unitPrice = opts.plywoodPricePerTsai;
    } else if (mat === "mdf") {
      unitPrice = opts.mdfPricePerTsai;
    } else if (mat === design.primaryMaterial) {
      unitPrice = opts.primaryMaterialPricePerTsai;
    } else {
      // 極少情況：零件標了另一種實木（目前沒有 template 會這樣）
      unitPrice = MATERIAL_PRICE_PER_TSAI[mat] ?? 300;
    }

    const amount = tsai * unitPrice;
    const suffix =
      mat === design.primaryMaterial
        ? "（主材）"
        : mat === "plywood" || mat === "mdf"
        ? "（板材）"
        : "";
    materialLines.push({
      label: `材料｜${materialLabel(mat)}${suffix}`,
      detail: `${tsai.toFixed(2)} 才（含 ${Math.round(WASTE_RATE * 100)}% 切料損耗）× NT$${unitPrice}/才`,
      amount,
    });
    materialCost += amount;
    totalVolumeMm3 += withWaste;
    totalTsai += tsai;
  }

  // 2. 工時成本（build steps 加總）
  const steps = deriveBuildSteps(design);
  const laborHours = totalEstimatedHours(steps);
  const laborCost = laborHours * opts.hourlyRate;

  // 3. 設備折舊（按工時分攤）
  const equipmentCost = laborHours * opts.equipmentRate;

  // 4. 耗材 + 塗裝
  const consumables = opts.consumables;
  const finishingCost = opts.finishingCost;

  // 5. 小計
  const costSubtotal =
    materialCost + laborCost + equipmentCost + consumables + finishingCost;
  const margin = costSubtotal * opts.marginRate;
  const subtotalExclVat = costSubtotal + margin;
  const vat = subtotalExclVat * opts.vatRate;
  const total = subtotalExclVat + vat;

  const lines: QuoteLineItem[] = [
    ...materialLines,
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
      detail: "膠、砂紙、鑽頭磨耗等",
      amount: consumables,
    },
    {
      label: "塗裝費",
      detail: "護木油 / 蠟 / 漆料 + 上漆工時",
      amount: finishingCost,
    },
  ];

  return {
    totalTsai,
    totalVolumeMm3,
    materialCost,
    laborHours,
    laborCost,
    equipmentCost,
    consumables,
    finishingCost,
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
