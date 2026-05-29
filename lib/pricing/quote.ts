import type { BillableMaterial, FurnitureDesign, Part } from "@/lib/types";
import { calculateCutDimensions } from "@/lib/geometry/cut-dimensions";
import { deriveBuildSteps, totalEstimatedHours } from "@/lib/steps/derive";
import { taipeiYMD } from "@/lib/utils/date-tw";
import { formatMm } from "@/lib/units/format";
import { convertTwdToUsd } from "@/lib/units/fx";

const usd = (twd: number): string => `$${convertTwdToUsd(twd).toFixed(2)}`;

/**
 * 倒角 / 圓角加工工時。每條外露邊跑修邊機（V 角 / 圓刀）+ 手工砂磨。
 *
 * 比例（保守估）：
 *   chamfered (45°): 3 sec/mm = 3 min/m
 *   rounded:         4.8 sec/mm = 4.8 min/m（圓角砂磨更費時）
 *   每種規格 setup 3 min（換刀 + 試切）
 *
 * 跳過 visual=glass（玻璃）與 chamferMm <= 0 的 part。
 */
function chamferEdgeMm(part: Part): { perimeterMm: number; style: "chamfered" | "rounded" } | null {
  const s = part.shape;
  if (!s) return null;
  if (s.kind === "chamfered-top") {
    if (s.chamferMm <= 0) return null;
    // 4 條頂緣 = 周長 = 2 × (length + width)
    return {
      perimeterMm: 2 * (part.visible.length + part.visible.width),
      style: s.style === "rounded" ? "rounded" : "chamfered",
    };
  }
  if (s.kind === "chamfered-edges") {
    if (s.chamferMm <= 0) return null;
    // 4 條長邊 = 4 × max(length, width, thickness)
    const longest = Math.max(part.visible.length, part.visible.width, part.visible.thickness);
    return {
      perimeterMm: 4 * longest,
      style: s.style === "rounded" ? "rounded" : "chamfered",
    };
  }
  return null;
}

/** 座面挖型加工時。saddle 雙軸曲面（手工 scorp/雕刻機）= 1.5hr/座；
 *  scooped 兩條平行凹槽（router 跑模板）= 1.0hr/座。 */
export function computeSeatScoopLaborHours(design: FurnitureDesign): {
  hours: number;
  saddleSeats: number;
  scoopedSeats: number;
} {
  let saddleSeats = 0;
  let scoopedSeats = 0;
  for (const part of design.parts) {
    if (part.shape?.kind !== "seat-scoop") continue;
    if (part.shape.profile === "saddle") saddleSeats++;
    else if (part.shape.profile === "scooped") scoopedSeats++;
  }
  return {
    hours: saddleSeats * 1.5 + scoopedSeats * 1.0,
    saddleSeats,
    scoopedSeats,
  };
}

export function computeChamferLaborHours(design: FurnitureDesign): {
  hours: number;
  totalMmChamfered: number;
  totalMmRounded: number;
  uniqueConfigs: number;
} {
  let totalMmChamfered = 0;
  let totalMmRounded = 0;
  const configs = new Set<string>();
  for (const part of design.parts) {
    if (part.visual !== undefined) continue;
    const e = chamferEdgeMm(part);
    if (!e) continue;
    if (e.style === "rounded") totalMmRounded += e.perimeterMm;
    else totalMmChamfered += e.perimeterMm;
    // 同 R 值 + 同樣式 = 同次 setup（不同零件可共用一次裝刀）
    if (part.shape && (part.shape.kind === "chamfered-top" || part.shape.kind === "chamfered-edges")) {
      configs.add(`${e.style}-${part.shape.chamferMm}`);
    }
  }
  const cutHours = totalMmChamfered * 0.00005 + totalMmRounded * 0.00008;
  const setupHours = configs.size * 0.05;
  return {
    hours: cutHours + setupHours,
    totalMmChamfered,
    totalMmRounded,
    uniqueConfigs: configs.size,
  };
}
import {
  MATERIAL_PRICE_PER_BDFT,
  MM3_PER_BDFT,
  SHEET_AREA_MM2,
  SHEET_GOOD_LABEL,
  SHEET_GOOD_LABEL_EN,
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
  /** 自動估算的工時（hr）；laborHoursOverride 沒填時 = laborHours */
  autoLaborHours: number;
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
  /** 毛利金額（單件，木匠端） */
  margin: number;
  /** 木匠端單件未稅價（成本 + 毛利）。設計師加成前。 */
  makerUnitPriceExclVat: number;
  /** 設計師加成比例（0–1.5）。0 表示沒啟用設計師模式。 */
  designerMarkupRate: number;
  /** 設計師加成金額（單件）= makerUnitPriceExclVat × designerMarkupRate。 */
  designerMarkupAmount: number;
  /** 對外單件未稅價（已含設計師加成）。所有下游 subtotal/vat/total 皆以此為基準。 */
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
  /** 預估工作天數（實做 + bufferDays） */
  estimatedWorkdays: number;
  /** 實做工作天（工時 × 數量 ÷ 8hr，無緩衝） */
  buildWorkdays: number;
  /** 塗裝乾燥/出貨緩衝天數 */
  bufferDays: number;
  /** 行項目（用於表格顯示，單件） */
  lines: QuoteLineItem[];
}

// 一個工作天實際產出工時≈6hr（扣除溝通、整理工作台、刀具更換、休息等隱形時間）
const HOURS_PER_WORKDAY = 6;

/**
 * 切料損耗：依家具類別調整
 * - accessory（筆筒/相框/小書擋等）：25%——小件零碎多、刨整邊角浪費高
 * - 一般家具：10%——常見值
 */
const WASTE_RATES: Record<"accessory" | "default", number> = {
  accessory: 0.25,
  default: 0.1,
};

function wasteRateFor(category: string): number {
  const accessoryCategories = new Set([
    "pencil-holder",
    "bookend",
    "photo-frame",
    "tray",
    "dovetail-box",
    "wine-rack",
    "coat-rack",
  ]);
  return accessoryCategories.has(category)
    ? WASTE_RATES.accessory
    : WASTE_RATES.default;
}

function materialLabel(m: BillableMaterial, locale: string = "zh-TW"): string {
  if (m === "plywood" || m === "mdf") {
    return locale === "en" ? SHEET_GOOD_LABEL_EN[m] : SHEET_GOOD_LABEL[m];
  }
  const spec = MATERIALS[m];
  if (!spec) return m;
  return locale === "en" ? spec.nameEn : spec.nameZh;
}

const QUOTE_COPY = {
  zhTW: {
    materialPrefix: "材料｜",
    primarySuffix: "（主材）",
    panelDetailTpl: (bdft: string, waste: number, unitPrice: number) =>
      `${bdft} 板才（含 ${waste}% 切料損耗）× NT$${unitPrice}/板才`,
    sheetMaterial: (label: string, thickness: string) =>
      `材料｜${label}（板材，${thickness}）`,
    sheetDetail: (sheets: number, thickness: string, sheetDims: string, areaM2: string, waste: number, unitPrice: number) =>
      `${sheets} 張 ${thickness} × ${sheetDims}（實用 ${areaM2} m² + ${waste}% 切料損耗 → ceil 成整張）× NT$${unitPrice}/板才`,
    labor: "加工工資",
    laborDetailOverride: (hours: string, autoHours: string, rate: number) =>
      `${hours} 小時（手動覆寫;自動估 ${autoHours}h）× NT$${rate}/hr`,
    laborDetailChamfer: (base: string, ch: string, chDetail: string, rate: number) =>
      `主工時 ${base}h + 倒角 ${ch}h(${chDetail})× NT$${rate}/hr`,
    laborDetailBasic: (hours: string, rate: number) => `${hours} 小時 × NT$${rate}/hr`,
    equipment: "設備折舊",
    equipmentDetail: (hours: string, rate: number) => `${hours} 小時 × NT$${rate}/hr`,
    consumables: "耗材",
    consumablesDetail: "膠、砂紙、鑽頭磨耗等",
    finishing: "塗裝費",
    finishingDetail: "護木油 / 蠟 / 漆料 + 上漆工時",
    hardware: "五金",
    hardwareDetail: "鉸鏈 / 滑軌 / 把手 / 腳輪等",
    shipping: "運費",
    shippingDetail: "跨區運輸 / 物流 / 搬運",
    installation: "安裝費",
    installationDetail: "現場組裝 / 上牆 / 水平調整",
    chamferRound: (m: string) => `45° 倒角 ${m}m`,
    chamferRounded: (m: string) => `圓角 ${m}m`,
    chamferConfigs: (n: number) => `${n} 種規格 setup`,
    chamferJoin: "、",
  },
  en: {
    materialPrefix: "Material · ",
    primarySuffix: " (primary)",
    panelDetailTpl: (bdft: string, waste: number, unitPrice: number) =>
      `${bdft} bd-ft (incl. ${waste}% cut waste) × ${usd(unitPrice)}/bd-ft`,
    sheetMaterial: (label: string, thickness: string) =>
      `Material · ${label} (sheet, ${thickness})`,
    sheetDetail: (sheets: number, thickness: string, sheetDims: string, areaM2: string, waste: number, unitPrice: number) =>
      `${sheets} sheets ${thickness} × ${sheetDims} (used ${areaM2} m² + ${waste}% waste → ceil to full sheets) × ${usd(unitPrice)}/bd-ft`,
    labor: "Labor",
    laborDetailOverride: (hours: string, autoHours: string, rate: number) =>
      `${hours} hr (manual override; auto-est ${autoHours}h) × ${usd(rate)}/hr`,
    laborDetailChamfer: (base: string, ch: string, chDetail: string, rate: number) =>
      `Build ${base}h + edge profiling ${ch}h (${chDetail}) × ${usd(rate)}/hr`,
    laborDetailBasic: (hours: string, rate: number) => `${hours} hr × ${usd(rate)}/hr`,
    equipment: "Equipment depreciation",
    equipmentDetail: (hours: string, rate: number) => `${hours} hr × ${usd(rate)}/hr`,
    consumables: "Consumables",
    consumablesDetail: "Glue, sandpaper, bit wear, etc.",
    finishing: "Finishing",
    finishingDetail: "Wood oil / wax / paint + finishing labor",
    hardware: "Hardware",
    hardwareDetail: "Hinges / slides / pulls / casters",
    shipping: "Shipping",
    shippingDetail: "Long-haul / logistics / moving",
    installation: "Installation",
    installationDetail: "On-site assembly / wall-mount / leveling",
    chamferRound: (m: string) => `45° chamfer ${m}m`,
    chamferRounded: (m: string) => `Rounded ${m}m`,
    chamferConfigs: (n: number) => `${n} setup configs`,
    chamferJoin: ", ",
  },
} as const;

export function calculateQuote(
  design: FurnitureDesign,
  opts: LaborDefaults,
  locale: string = "zh-TW",
  unit: "mm" | "inch" = "mm",
): QuoteBreakdown {
  const C = locale === "en" ? QUOTE_COPY.en : QUOTE_COPY.zhTW;
  // 1. 按計價材料分組加總材積
  // 使用者若把夾板/中纖板單價清空（null），該類零件併回主材一起計
  // 視覺裝飾（玻璃）不計入木料成本
  //
  // 板材（plywood/mdf）特別處理：實際市場整張賣（2440×1220 標準張），
  // 半張也付全張錢。在這裡我們依「(板材, 厚度)」分組加總「面積」，
  // 之後 ceil(面積 / 整張面積) 算實際要買幾張、billedBdft 用實際厚度計。
  const volumeByMaterial = new Map<BillableMaterial, number>();
  // key: `${mat}-${thicknessMm}`；只放 plywood/mdf 用
  const sheetAreaByGroup = new Map<string, {
    mat: "plywood" | "mdf";
    thickness: number;
    totalAreaMm2: number;
  }>();
  for (const part of design.parts) {
    if (part.visual !== undefined) continue;
    const cut = calculateCutDimensions(part);
    const vol = cut.length * cut.width * cut.thickness;
    let mat = effectiveBillableMaterial(part);
    if (mat === "plywood" && opts.plywoodPricePerBdft == null) {
      mat = design.primaryMaterial;
    } else if (mat === "mdf" && opts.mdfPricePerBdft == null) {
      mat = design.primaryMaterial;
    }
    if (mat === "plywood" || mat === "mdf") {
      const key = `${mat}-${cut.thickness}`;
      const cur = sheetAreaByGroup.get(key) ?? { mat, thickness: cut.thickness, totalAreaMm2: 0 };
      cur.totalAreaMm2 += cut.length * cut.width;
      sheetAreaByGroup.set(key, cur);
    } else {
      volumeByMaterial.set(mat, (volumeByMaterial.get(mat) ?? 0) + vol);
    }
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

  // 1a. 實木：按 bdft 線性計價（鋸下來剩料還能用）
  for (const [mat, volMm3] of sortedEntries) {
    const wasteRate = wasteRateFor(design.category);
    const withWaste = volMm3 * (1 + wasteRate);
    const bdft = withWaste / MM3_PER_BDFT;

    let unitPrice: number;
    if (mat === design.primaryMaterial) {
      unitPrice = opts.primaryMaterialPricePerBdft;
    } else if (mat !== "plywood" && mat !== "mdf") {
      // 板材已在 1b 用整張計價路徑分流，這裡只剩實木 MaterialId
      unitPrice = MATERIAL_PRICE_PER_BDFT[mat] ?? 2000;
    } else {
      // 邏輯上不應該到這（板材在 sheetAreaByGroup 處理），保險回 0
      unitPrice = 0;
    }

    const amount = bdft * unitPrice;
    const suffix = mat === design.primaryMaterial ? C.primarySuffix : "";
    materialLines.push({
      label: `${C.materialPrefix}${materialLabel(mat, locale)}${suffix}`,
      detail: C.panelDetailTpl(bdft.toFixed(2), Math.round(wasteRate * 100), unitPrice),
      amount,
    });
    materialCost += amount;
    totalVolumeMm3 += withWaste;
    totalBdft += bdft;
  }

  // 1b. 板材：按整張計價（市場整張賣，半張也付全張錢）
  for (const { mat, thickness, totalAreaMm2 } of sheetAreaByGroup.values()) {
    const wasteRate = wasteRateFor(design.category);
    // 板材切料損耗 → 換算成「需要的面積」，再 ceil 成整張
    const areaWithWaste = totalAreaMm2 * (1 + wasteRate);
    const sheetsNeeded = Math.ceil(areaWithWaste / SHEET_AREA_MM2);
    const billedVolumeMm3 = sheetsNeeded * SHEET_AREA_MM2 * thickness;
    const bdft = billedVolumeMm3 / MM3_PER_BDFT;

    const unitPrice = mat === "plywood"
      ? (opts.plywoodPricePerBdft ?? 0)
      : (opts.mdfPricePerBdft ?? 0);
    const amount = bdft * unitPrice;

    const thicknessStr = formatMm(thickness, unit);
    const sheetDimsStr = `${formatMm(2440, unit)}×${formatMm(1220, unit)}`;
    materialLines.push({
      label: C.sheetMaterial(materialLabel(mat, locale), thicknessStr),
      detail: C.sheetDetail(
        sheetsNeeded,
        thicknessStr,
        sheetDimsStr,
        (totalAreaMm2 / 1e6).toFixed(2),
        Math.round(wasteRate * 100),
        unitPrice,
      ),
      amount,
    });
    materialCost += amount;
    totalVolumeMm3 += billedVolumeMm3;
    totalBdft += bdft;
  }

  // 2. 工時成本（build steps 加總 + 倒角加工）
  // 若使用者設了 laborHoursOverride > 0，整個總工時直接覆寫（用於難度高/特殊客製/熟練度差異）
  const steps = deriveBuildSteps(design);
  const baseLaborHours = totalEstimatedHours(steps);
  const chamferLabor = computeChamferLaborHours(design);
  const seatScoopLabor = computeSeatScoopLaborHours(design);
  const autoLaborHours = baseLaborHours + chamferLabor.hours + seatScoopLabor.hours;
  const hoursOverride = opts.laborHoursOverride ?? 0;
  const hasHoursOverride = hoursOverride > 0;
  const laborHours = hasHoursOverride ? hoursOverride : autoLaborHours;
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
  // 若有手動覆寫 → 最終價直接是 override，margin 反推（可能負值=賠本）
  // 否則按 marginRate 加成
  const override = opts.overrideUnitPrice ?? 0;
  const hasOverride = override > 0;
  const makerUnitPriceExclVat = hasOverride ? override : costSubtotal * (1 + opts.marginRate);
  const margin = makerUnitPriceExclVat - costSubtotal;

  // 設計師加成：在「木匠成本＋毛利」之上再乘一層，給裝潢設計師對自己客戶報價用。
  // 0 = 一般木工接案模式（行為跟過去一致）；> 0 = 對外單價 = 木匠價 × (1 + markup)。
  const designerMarkupRate = Math.max(0, Math.min(1.5, opts.designerMarkupRate ?? 0));
  const designerMarkupAmount = makerUnitPriceExclVat * designerMarkupRate;
  const unitPriceExclVat = makerUnitPriceExclVat + designerMarkupAmount;

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

  // 8. 預估工作天數（實做工時 × 數量 ÷ 6hr/天 + 塗裝乾燥/出貨緩衝）
  const bufferDays = Math.max(0, Math.round(opts.bufferDays ?? 0));
  const buildWorkdays = Math.ceil((laborHours * quantity) / HOURS_PER_WORKDAY);
  const estimatedWorkdays = buildWorkdays + bufferDays;

  // 倒角工時拆出來顯示，讓客戶看得出 R 值大小對價格的影響
  const chamferDetail =
    chamferLabor.hours > 0
      ? [
          chamferLabor.totalMmChamfered > 0
            ? C.chamferRound((chamferLabor.totalMmChamfered / 1000).toFixed(1))
            : "",
          chamferLabor.totalMmRounded > 0
            ? C.chamferRounded((chamferLabor.totalMmRounded / 1000).toFixed(1))
            : "",
          chamferLabor.uniqueConfigs > 0
            ? C.chamferConfigs(chamferLabor.uniqueConfigs)
            : "",
        ]
          .filter(Boolean)
          .join(C.chamferJoin)
      : "";

  const lines: QuoteLineItem[] = [
    ...materialLines,
    {
      label: C.labor,
      detail: hasHoursOverride
        ? C.laborDetailOverride(laborHours.toFixed(1), autoLaborHours.toFixed(1), opts.hourlyRate)
        : chamferLabor.hours > 0
          ? C.laborDetailChamfer(
              baseLaborHours.toFixed(1),
              chamferLabor.hours.toFixed(1),
              chamferDetail,
              opts.hourlyRate,
            )
          : C.laborDetailBasic(laborHours.toFixed(1), opts.hourlyRate),
      amount: laborCost,
    },
    {
      label: C.equipment,
      detail: C.equipmentDetail(laborHours.toFixed(1), opts.equipmentRate),
      amount: equipmentCost,
    },
    {
      label: C.consumables,
      detail: C.consumablesDetail,
      amount: consumables,
    },
    {
      label: C.finishing,
      detail: C.finishingDetail,
      amount: finishingCost,
    },
    ...(hardwareCost > 0
      ? [
          {
            label: C.hardware,
            detail: C.hardwareDetail,
            amount: hardwareCost,
          },
        ]
      : []),
    ...(shippingCost > 0
      ? [
          {
            label: C.shipping,
            detail: C.shippingDetail,
            amount: shippingCost,
          },
        ]
      : []),
    ...(installationCost > 0
      ? [
          {
            label: C.installation,
            detail: C.installationDetail,
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
    autoLaborHours,
    laborCost,
    equipmentCost,
    consumables,
    finishingCost,
    shippingCost,
    installationCost,
    hardwareCost,
    costSubtotal,
    margin,
    makerUnitPriceExclVat,
    designerMarkupRate,
    designerMarkupAmount,
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
    buildWorkdays,
    bufferDays,
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

/** djb2-ish 字串雜湊，base36 取 3 碼。穩定（同 input → 同 output），不需亂數。 */
function shortHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
  }
  return Math.abs(h).toString(36).slice(0, 3).toUpperCase().padStart(3, "X");
}

/**
 * 產生報價單編號 Q-YYYYMMDD-<設計id前 4 碼>[-<context 雜湊 3 碼>]
 *
 * context 通常是「客戶名+規格+材料」字串，讓同一天同設計但不同客戶不撞號。
 * 同客戶同規格同天 → 同編號（穩定，重複報價不重複編號）。
 * 不傳 context（舊行為）→ 沒有後綴。
 *
 * 注意：用台北時區算日期。Vercel server 在 UTC，若用 toISOString()，
 * 台北早上 0-8 點會跑成「昨天」、下午 4 點後跑成「今天/明天」邊界錯亂——
 * 這就是過去「LINE 分享案號跟畫面顯示對不上」的 bug 來源。
 */
export function generateQuoteNumber(
  designId: string,
  context: string = "",
  date = new Date(),
): string {
  const ymd = taipeiYMD(date);
  const hash = designId.slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, "X");
  const suffix = context.trim() ? `-${shortHash(context.trim())}` : "";
  return `Q-${ymd}-${hash}${suffix}`;
}
