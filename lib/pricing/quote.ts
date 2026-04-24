import type { BillableMaterial, FurnitureDesign } from "@/lib/types";
import { calculateCutDimensions } from "@/lib/geometry/cut-dimensions";
import { deriveBuildSteps, totalEstimatedHours } from "@/lib/steps/derive";
import {
  MATERIAL_PRICE_PER_BDFT,
  MM3_PER_BDFT,
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
  /** 材料用量（所有材料合計板才數，含切料損耗）*/
  totalBdft: number;
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
  /** 運費 */
  shippingCost: number;
  /** 安裝費 */
  installationCost: number;
  /** 其他五金 */
  hardwareCost: number;
  /** 成本小計（未加毛利、未含稅、單件） */
  costSubtotal: number;
  /** 毛利金額（單件） */
  margin: number;
  /** 單件報價（未稅、未打折） */
  unitPriceExclVat: number;
  /** 數量 */
  quantity: number;
  /** 依數量加總的報價（未稅、未打折） */
  subtotalBeforeDiscount: number;
  /** 折扣金額（正值代表減去多少） */
  discountAmount: number;
  /** 打折後的未稅報價 */
  subtotalExclVat: number;
  /** 營業稅 */
  vat: number;
  /** 含稅總計 */
  total: number;
  /** 訂金（下訂時收） */
  depositAmount: number;
  /** 尾款（交貨時收） */
  balanceAmount: number;
  /** 預估工作天數（工時 ÷ 8hr + bufferDays） */
  estimatedWorkdays: number;
  /** 行項目（用於表格顯示，單件） */
  lines: QuoteLineItem[];
}

const HOURS_PER_WORKDAY = 8;

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
  // 使用者若把夾板/中纖板單價清空（null），該類零件併回主材一起計
  // 視覺裝飾（玻璃）不計入木料成本
  const volumeByMaterial = new Map<BillableMaterial, number>();
  for (const part of design.parts) {
    if (part.visual === "glass") continue;
    const cut = calculateCutDimensions(part);
    const vol = cut.length * cut.width * cut.thickness;
    let mat = effectiveBillableMaterial(part);
    if (mat === "plywood" && opts.plywoodPricePerBdft == null) {
      mat = design.primaryMaterial;
    } else if (mat === "mdf" && opts.mdfPricePerBdft == null) {
      mat = design.primaryMaterial;
    }
    volumeByMaterial.set(mat, (volumeByMaterial.get(mat) ?? 0) + vol);
  }

  const materialLines: QuoteLineItem[] = [];
  let materialCost = 0;
  let totalVolumeMm3 = 0;
  let totalBdft = 0;

  // 排序：主材在前、板材在後
  const sortedEntries = [...volumeByMaterial.entries()].sort((a, b) => {
    const aSheet = a[0] === "plywood" || a[0] === "mdf" ? 1 : 0;
    const bSheet = b[0] === "plywood" || b[0] === "mdf" ? 1 : 0;
    return aSheet - bSheet;
  });

  for (const [mat, volMm3] of sortedEntries) {
    const withWaste = volMm3 * (1 + WASTE_RATE);
    const bdft = withWaste / MM3_PER_BDFT;

    // 單價優先順序：使用者輸入 > catalog 預設
    // （null 的情況在前面 volumeByMaterial 建立階段已併回主材，這裡不會再看到）
    let unitPrice: number;
    if (mat === "plywood") {
      unitPrice = opts.plywoodPricePerBdft ?? 0;
    } else if (mat === "mdf") {
      unitPrice = opts.mdfPricePerBdft ?? 0;
    } else if (mat === design.primaryMaterial) {
      unitPrice = opts.primaryMaterialPricePerBdft;
    } else {
      // 極少情況：零件標了另一種實木（目前沒有 template 會這樣）
      unitPrice = MATERIAL_PRICE_PER_BDFT[mat] ?? 2000;
    }

    const amount = bdft * unitPrice;
    const suffix =
      mat === design.primaryMaterial
        ? "（主材）"
        : mat === "plywood" || mat === "mdf"
        ? "（板材）"
        : "";
    materialLines.push({
      label: `材料｜${materialLabel(mat)}${suffix}`,
      detail: `${bdft.toFixed(2)} 板才（含 ${Math.round(WASTE_RATE * 100)}% 切料損耗）× NT$${unitPrice}/板才`,
      amount,
    });
    materialCost += amount;
    totalVolumeMm3 += withWaste;
    totalBdft += bdft;
  }

  // 2. 工時成本（build steps 加總）
  const steps = deriveBuildSteps(design);
  const laborHours = totalEstimatedHours(steps);
  const laborCost = laborHours * opts.hourlyRate;

  // 3. 設備折舊（按工時分攤）
  const equipmentCost = laborHours * opts.equipmentRate;

  // 4. 耗材 / 塗裝 / 運費 / 安裝 / 五金
  const consumables = opts.consumables;
  const finishingCost = opts.finishingCost;
  const shippingCost = opts.shippingCost;
  const installationCost = opts.installationCost;
  const hardwareCost = opts.hardwareCost;

  // 5. 單件小計
  const costSubtotal =
    materialCost +
    laborCost +
    equipmentCost +
    consumables +
    finishingCost +
    shippingCost +
    installationCost +
    hardwareCost;
  const margin = costSubtotal * opts.marginRate;
  const unitPriceExclVat = costSubtotal + margin;

  // 6. 數量 × 折扣 → 稅
  const quantity = Math.max(1, Math.round(opts.quantity ?? 1));
  const subtotalBeforeDiscount = unitPriceExclVat * quantity;
  const discountRate = Math.max(0, Math.min(1, opts.discountRate ?? 0));
  const discountAmount = subtotalBeforeDiscount * discountRate;
  const subtotalExclVat = subtotalBeforeDiscount - discountAmount;
  const vat = subtotalExclVat * opts.vatRate;
  const total = subtotalExclVat + vat;

  // 7. 訂金/尾款拆分（依含稅總計）
  const depositRate = Math.max(0, Math.min(1, opts.depositRate ?? 0.5));
  const depositAmount = Math.round(total * depositRate);
  const balanceAmount = Math.max(0, Math.round(total) - depositAmount);

  // 8. 預估工作天數（實做工時 × 數量 ÷ 8hr/天 + 塗裝乾燥/出貨緩衝）
  const bufferDays = Math.max(0, Math.round(opts.bufferDays ?? 0));
  const estimatedWorkdays =
    Math.ceil((laborHours * quantity) / HOURS_PER_WORKDAY) + bufferDays;

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
    ...(hardwareCost > 0
      ? [
          {
            label: "五金",
            detail: "鉸鏈 / 滑軌 / 把手 / 腳輪等",
            amount: hardwareCost,
          },
        ]
      : []),
    ...(shippingCost > 0
      ? [
          {
            label: "運費",
            detail: "跨區運輸 / 物流 / 搬運",
            amount: shippingCost,
          },
        ]
      : []),
    ...(installationCost > 0
      ? [
          {
            label: "安裝費",
            detail: "現場組裝 / 上牆 / 水平調整",
            amount: installationCost,
          },
        ]
      : []),
  ];

  return {
    totalBdft,
    totalVolumeMm3,
    materialCost,
    laborHours,
    laborCost,
    equipmentCost,
    consumables,
    finishingCost,
    shippingCost,
    installationCost,
    hardwareCost,
    costSubtotal,
    margin,
    unitPriceExclVat,
    quantity,
    subtotalBeforeDiscount,
    discountAmount,
    subtotalExclVat,
    vat,
    total,
    depositAmount,
    balanceAmount,
    estimatedWorkdays,
    lines,
  };
}

/** 從起始日起跳 workdays 個工作天（週六日不算），回傳預計交貨日 */
export function addWorkdays(start: Date, workdays: number): Date {
  const d = new Date(start);
  let added = 0;
  while (added < workdays) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d;
}

/** 產生報價單編號 Q-YYYYMMDD-<設計id前 4 碼> */
export function generateQuoteNumber(designId: string, date = new Date()): string {
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, "");
  const hash = designId.slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, "X");
  return `Q-${ymd}-${hash}`;
}
