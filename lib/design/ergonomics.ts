/**
 * 人體工學合理性檢查
 *
 * 給設計頁的尺寸 form 提示「太高/太低/太深會不舒服」，不阻擋設計。
 * 標準依據：ISO 5970、HFES、NKBA、台灣常見體型。
 *
 * 詳細規則參考 docs/drafting-math.md §O。
 */

import type { FurnitureCategory } from "@/lib/types";

export type ErgoLevel = "OK" | "WARN" | "ERROR";

export interface ErgoWarning {
  field: string;       // 'height' | 'seatHeight' | 'width' ...
  level: ErgoLevel;
  message: string;     // 短句，給 hobbyist 看
  suggest: string;     // 建議範圍
}

interface Range {
  ok: [number, number];
  warnPad: number;     // OK 區間外 ±warnPad 是 WARN
  errPad?: number;     // 再 ±errPad 之外是 ERROR（預設 = warnPad × 2）
}

function check(value: number, r: Range, field: string, label: string): ErgoWarning | null {
  const [lo, hi] = r.ok;
  const errPad = r.errPad ?? r.warnPad * 2;
  if (value >= lo && value <= hi) return null;
  const suggest = `建議 ${lo}–${hi} mm`;
  if (value >= lo - r.warnPad && value <= hi + r.warnPad) {
    return { field, level: "WARN", message: `${label}邊緣值（${value} mm）`, suggest };
  }
  if (value >= lo - errPad && value <= hi + errPad) {
    return { field, level: "ERROR", message: `${label}超出建議範圍（${value} mm）`, suggest };
  }
  return { field, level: "ERROR", message: `${label}嚴重不合理（${value} mm）`, suggest };
}

// ---- 各家具類別的範圍表 ----

const CHAIR = {
  seatHeight: { ok: [430, 460] as [number, number], warnPad: 20, errPad: 40 },
};

const TABLE_DINING = {
  height: { ok: [720, 760] as [number, number], warnPad: 20, errPad: 40 },
  width:  { ok: [750, 1100] as [number, number], warnPad: 50, errPad: 100 }, // 桌深
};

const TABLE_DESK = {
  height: { ok: [730, 760] as [number, number], warnPad: 20, errPad: 40 },
  width:  { ok: [600, 800] as [number, number], warnPad: 50, errPad: 100 },
};

const TABLE_TEA = {
  // 茶几 / 低桌
  height: { ok: [380, 460] as [number, number], warnPad: 30, errPad: 60 },
};

const TABLE_SIDE = {
  height: { ok: [550, 650] as [number, number], warnPad: 30, errPad: 60 },
};

const STOOL = {
  // 凳子座高（無椅背）
  height: { ok: [430, 480] as [number, number], warnPad: 30, errPad: 60 },
};

const BENCH = {
  // 長椅
  height: { ok: [400, 460] as [number, number], warnPad: 30, errPad: 60 },
};

const WARDROBE = {
  height: { ok: [2100, 2400] as [number, number], warnPad: 100, errPad: 200 },
};

// ---- 主入口：依 category 跑對應檢查 ----

export interface ErgoInput {
  category: FurnitureCategory | string;
  overall: { length: number; width: number; height: number };
  options?: Record<string, unknown>;
}

export function checkErgonomics(input: ErgoInput): ErgoWarning[] {
  const warnings: ErgoWarning[] = [];
  const { category, overall, options = {} } = input;
  const seatHeight = typeof options.seatHeight === "number" ? options.seatHeight : null;

  switch (category) {
    case "dining-chair": {
      // 椅子：座高優先用 options.seatHeight（更準確），否則退到整體高度推估
      const sh = seatHeight ?? overall.height;
      const w = check(sh, CHAIR.seatHeight, "seatHeight", "坐高");
      if (w) warnings.push(w);
      // 側向穩定性：用 overall.length 當左右腳距 b（椅子寬）
      const stab = checkSideStability(sh, overall.length);
      if (stab) warnings.push(stab);
      break;
    }
    case "round-stool":
    case "square-stool": {
      const sh = seatHeight ?? overall.height;
      const w = check(sh, STOOL.height, "height", "凳高");
      if (w) warnings.push(w);
      // 凳子側向穩定性更關鍵（無椅背重心更高？人體一樣）
      const stab = checkSideStability(sh, Math.min(overall.length, overall.width));
      if (stab) warnings.push(stab);
      break;
    }
    case "bench": {
      const sh = seatHeight ?? overall.height;
      const w = check(sh, BENCH.height, "height", "長椅座高");
      if (w) warnings.push(w);
      // 長椅短邊是側向腳距
      const stab = checkSideStability(sh, overall.width);
      if (stab) warnings.push(stab);
      break;
    }
    case "dining-table": {
      const wh = check(overall.height, TABLE_DINING.height, "height", "餐桌高");
      const ww = check(overall.width, TABLE_DINING.width, "width", "餐桌深");
      if (wh) warnings.push(wh);
      if (ww) warnings.push(ww);
      break;
    }
    case "tea-table":
    case "low-table":
    case "round-tea-table": {
      const wh = check(overall.height, TABLE_TEA.height, "height", "茶几高");
      if (wh) warnings.push(wh);
      break;
    }
    case "side-table":
    case "nightstand": {
      const wh = check(overall.height, TABLE_SIDE.height, "height", "邊桌高");
      if (wh) warnings.push(wh);
      break;
    }
    case "wardrobe": {
      const wh = check(overall.height, WARDROBE.height, "height", "衣櫃總高");
      if (wh) warnings.push(wh);
      break;
    }
    // 其他類別暫不檢查（書櫃/鞋櫃等高度依空間需求差異大）
  }

  return warnings;
}

// ---- 輔助：椅桌差檢查（如果同時知道椅子座高與餐桌高度）----

export function checkChairTableGap(seatHeight: number, tableHeight: number): ErgoWarning | null {
  const diff = tableHeight - seatHeight;
  return check(
    diff,
    { ok: [270, 310] as [number, number], warnPad: 20, errPad: 40 },
    "diff",
    `桌椅差距`,
  );
}

/**
 * 椅子側向穩定性檢查（drafting-math.md §V）
 *
 * 公式：θ_side = atan((b/2) / h_total)
 *  - b = 左右腳距（取 overall.length，方凳/餐椅 ≈ 椅子寬）
 *  - h_total ≈ 座面高 + 180mm（人體坐姿重心，per §V1）
 *
 * 閾值（家用）：
 *  - θ_side ≥ 20° → OK
 *  - 12° ≤ θ_side < 20° → WARN（接近極限，靠材料剛性撐著）
 *  - θ_side < 12° → ERROR（高腳椅腳距太窄，會倒）
 *
 * 用例：吧椅 750mm 高 + 腳距 350mm → θ ≈ 10.4° → ERROR
 */
export function checkSideStability(seatHeight: number, legSpanB: number): ErgoWarning | null {
  if (legSpanB <= 0) return null;
  const hTotal = seatHeight + 180;
  const thetaRad = Math.atan(legSpanB / 2 / hTotal);
  const thetaDeg = (thetaRad * 180) / Math.PI;

  if (thetaDeg >= 20) return null;
  if (thetaDeg >= 12) {
    return {
      field: "stability",
      level: "WARN",
      message: `側向穩定性偏弱（θ ≈ ${thetaDeg.toFixed(1)}°，腳距 ${legSpanB} / 座高 ${seatHeight}）`,
      suggest: `加大左右腳距 ≥ ${Math.ceil(2 * hTotal * Math.tan((20 * Math.PI) / 180))} mm，或降低座面`,
    };
  }
  return {
    field: "stability",
    level: "ERROR",
    message: `側向會倒！θ ≈ ${thetaDeg.toFixed(1)}°（< 12° 危險）`,
    suggest: `腳距至少 ${Math.ceil(2 * hTotal * Math.tan((12 * Math.PI) / 180))} mm，或腳底外撇 splay 補償`,
  };
}
