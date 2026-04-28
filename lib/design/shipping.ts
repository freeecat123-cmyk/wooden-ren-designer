/**
 * 打包出貨估算（per drafting-math.md §Z）
 *
 * 從家具設計推：實重 + 三邊和 + 推薦貨運業者 + 估價
 * 純函數，不接 UI。
 */

import { MATERIALS } from "@/lib/materials";
import type { FurnitureDesign } from "@/lib/types";

export interface ShippingEstimate {
  /** 實重（kg），含 12% 包裝重 */
  weightKg: number;
  /** 模型體積（m³）*/
  volumeM3: number;
  /** 三邊和（cm，台灣慣用）*/
  threeBangSumCm: number;
  /** 最長邊（cm）*/
  longestEdgeCm: number;
  /** 是否需 KD（拆裝）出貨 */
  needsKD: boolean;
  /** 推薦業者清單（依適用度排序） */
  carriers: CarrierOption[];
}

export interface CarrierOption {
  id: "blackcat" | "hct" | "kerry" | "self";
  name: string;
  feasible: boolean;
  /** 預估費用 NT$（不適用時 null）*/
  feeNtd: number | null;
  /** 給使用者的說明 */
  note: string;
}

/** 計算家具實重（kg）= 各部件 體積×密度 加總 + 12% 包裝重 */
export function estimateWeight(design: FurnitureDesign): number {
  let totalKg = 0;
  for (const p of design.parts) {
    const volM3 =
      (p.visible.length * p.visible.width * p.visible.thickness) / 1_000_000_000;
    const density = MATERIALS[p.material]?.density ?? 600;
    totalKg += volM3 * density;
  }
  // +12% 包裝重（紙箱+保麗龍+泡棉）
  return Math.round(totalKg * 1.12 * 10) / 10;
}

export function estimateShipping(design: FurnitureDesign): ShippingEstimate {
  const { length, width, thickness } = design.overall;
  const dimsCm = [length, width, thickness].map((mm) => mm / 10).sort((a, b) => b - a);
  const longestEdgeCm = dimsCm[0];
  const threeBangSumCm = Math.round(dimsCm[0] + dimsCm[1] + dimsCm[2]);
  const volumeM3 = (length * width * thickness) / 1_000_000_000;
  const weightKg = estimateWeight(design);
  const needsKD = longestEdgeCm > 150 || threeBangSumCm > 220;

  const carriers: CarrierOption[] = [
    blackcat(threeBangSumCm, longestEdgeCm, weightKg),
    hct(threeBangSumCm, longestEdgeCm, weightKg),
    kerry(weightKg, needsKD),
    selfDeliver(weightKg, longestEdgeCm),
  ];

  // 適用排前面，再按費用低排
  carriers.sort((a, b) => {
    if (a.feasible !== b.feasible) return a.feasible ? -1 : 1;
    return (a.feeNtd ?? 99999) - (b.feeNtd ?? 99999);
  });

  return { weightKg, volumeM3, threeBangSumCm, longestEdgeCm, needsKD, carriers };
}

// ---- 各業者規則 ----

function blackcat(threeBang: number, longest: number, weight: number): CarrierOption {
  const feasible = threeBang <= 150 && longest <= 100 && weight <= 20;
  if (!feasible) {
    return {
      id: "blackcat",
      name: "黑貓宅急便",
      feasible: false,
      feeNtd: null,
      note: `超出限制（≤ 150cm 三邊和 / ≤ 100cm 單邊 / ≤ 20kg）`,
    };
  }
  // 黑貓費率（粗估）：60cm $130、90cm $200、120cm $300、150cm $400
  let fee = 130;
  if (threeBang > 60) fee = 200;
  if (threeBang > 90) fee = 300;
  if (threeBang > 120) fee = 400;
  return {
    id: "blackcat",
    name: "黑貓宅急便",
    feasible: true,
    feeNtd: fee,
    note: `三邊和 ${threeBang}cm、${weight}kg`,
  };
}

function hct(threeBang: number, longest: number, weight: number): CarrierOption {
  const feasible = threeBang <= 220 && longest <= 150 && weight <= 30;
  if (!feasible) {
    return {
      id: "hct",
      name: "新竹物流",
      feasible: false,
      feeNtd: null,
      note: `超出限制（≤ 220cm 三邊和 / ≤ 150cm 單邊 / ≤ 30kg）`,
    };
  }
  let fee = 200;
  if (threeBang > 100) fee = 350;
  if (threeBang > 150) fee = 500;
  if (threeBang > 200) fee = 700;
  return {
    id: "hct",
    name: "新竹物流",
    feasible: true,
    feeNtd: fee,
    note: `三邊和 ${threeBang}cm、${weight}kg`,
  };
}

function kerry(weight: number, needsKD: boolean): CarrierOption {
  // 嘉里大榮棧板運輸：適合超大件
  const fee = weight > 100 ? 2500 : weight > 50 ? 1800 : 1200;
  return {
    id: "kerry",
    name: "嘉里大榮（棧板）",
    feasible: true,
    feeNtd: fee,
    note: needsKD ? "適合大型 / 拆裝家具，建議走棧板" : "若整裝出貨可用",
  };
}

function selfDeliver(weight: number, longest: number): CarrierOption {
  const feasible = weight > 50 || longest > 200;
  return {
    id: "self",
    name: "自送 / 自營貨運",
    feasible,
    feeNtd: feasible ? null : null,
    note: feasible
      ? "重量大 / 超尺寸建議自送或找專業家具搬運（含上樓）"
      : "一般尺寸不建議（成本高）",
  };
}
