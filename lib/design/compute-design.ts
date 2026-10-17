import type { FurnitureCatalogEntry } from "@/lib/templates";
import { parseDesignSearchParams, type ParsedDesignParams, type SpRecord } from "./parse-search-params";
import { applyEdgeProtection } from "@/lib/joinery/edge-protection";
import { toBeginnerMode } from "@/lib/templates/beginner-mode";
import { planAssembly, type AssemblyPlan } from "@/lib/assembly/plan";
import type { FurnitureDesign, MaterialId } from "@/lib/types";

/**
 * 「網址參數 → 模板輸入」的唯一一套規則，設計頁 server 跟瀏覽器端即時預覽共用。
 *
 * 為什麼抽出來（2026-10-17）：改參數原本要等 server 整頁重算（實測 1～2 秒），
 * 現在瀏覽器先用同一套規則算 3D、server 結果到了再換掉。兩邊各寫一份的話，
 * 付費鎖 / 尺寸上限 / 書桌夾制只要一邊漏改，預覽就會先畫出 server 不給的東西。
 */

/** 範例預覽鎖：只留材料 / 視圖類參數，尺寸與結構選項全部回到模板預設。 */
export const PREVIEW_KEEP_PARAMS = new Set([
  "material", "joineryMode", "scene", "ui", "xray", "wf", "lidLift", "explode", "audit", "hide",
]);

export interface DesignAccess {
  /** 付費範本未解鎖：鎖在範例尺寸，只能換料 */
  previewLocked: boolean;
  /** 方案允許自由尺寸（或管理員）——要網址也帶 designerMode 才解除上限 */
  canBypassLimits: boolean;
  /** 載入的是儲存時的凍結模型：不夾上限、不做書桌夾制 */
  frozen?: boolean;
}

export interface ResolvedDesignInputs {
  parsed: ParsedDesignParams;
  material: MaterialId;
  options: Record<string, string | number | boolean>;
  joineryMode: boolean;
  limits: { length: number; width: number; height: number } | null;
  isRoundCategory: boolean;
  length: number;
  width: number;
  height: number;
}

export function resolveDesignInputs(
  type: string,
  entry: FurnitureCatalogEntry,
  sp: SpRecord,
  access: DesignAccess,
): ResolvedDesignInputs {
  // 即使前端鎖有漏洞，server 這層強制重設才是真正的防線。
  const parseSp = access.previewLocked
    ? Object.fromEntries(Object.entries(sp).filter(([k]) => PREVIEW_KEEP_PARAMS.has(k)))
    : sp;
  const parsed = parseDesignSearchParams(parseSp, entry);
  const { material, options } = parsed;
  // 只有榫接版的模板（技能檢定練習件）：不管網址帶什麼都走榫接版，
  // 組裝版會把貫穿榫拔掉、凸出的 20mm 跟著消失（見 FurnitureCatalogEntry.joineryOnly）
  const joineryMode = entry.joineryOnly ? true : parsed.joineryMode;
  // Server-side hard clamp:雙保險 — 不靠 canUseDesignerMode aggregate flag,
  // 直接看 plan 權限 + admin。即使 UI 哪天把 toggle 露給 free user(或 designerMode
  // 旗標被汙染),只要 plan 不允許就強制夾。admin 仍可繞 limit 方便測試。
  const limits = access.frozen || (access.canBypassLimits && parsed.designerMode)
    ? null
    : entry.limits ?? null;
  // 圓形家具（圓凳/圓茶几/圓餐桌）只有「直徑」一個尺寸——template 端 input.length
  // 當直徑、忽略 input.width。UI 也只給直徑一個 input，width 強制 = length 避免
  // 殘留分享連結帶不同數值造成 server / template 看到不一致。
  const isRoundCategory =
    type === "round-stool" || type === "round-table" || type === "round-tea-table";
  const length = limits ? Math.min(parsed.length, limits.length) : parsed.length;
  const widthRaw = limits ? Math.min(parsed.width, limits.width) : parsed.width;
  const width = isRoundCategory ? length : widthRaw;
  const height = limits ? Math.min(parsed.height, limits.height) : parsed.height;

  // 書桌特例：H 框離地高 server-side clamp 到櫃底以下，讓 form 顯示實際採用值
  if (type === "desk" && !access.frozen) {
    const drawerCount = Number(options.drawerCount ?? 0);
    const reqStretcherY = Number(options.pedestalStretcherHeight ?? 0);
    if (drawerCount > 0 && reqStretcherY > 0) {
      const topThickness = Number(options.topThickness ?? 28);
      const withApron = options.withApron !== false;
      const apronWidth = Number(options.apronWidth ?? 90);
      const pedestalTopGap = Number(options.pedestalTopGap ?? 5);
      const legHeight = height - topThickness;
      const topGap = withApron ? apronWidth + 5 : pedestalTopGap;
      const caseTopY = legHeight - topGap;
      const maxCaseH = caseTopY - 80;
      const caseH = Math.min(maxCaseH, drawerCount * 130 + 30);
      const caseY = caseTopY - caseH;
      const STRETCHER_H = 40;
      const maxStretcherY = caseY - STRETCHER_H;
      if (reqStretcherY > maxStretcherY) {
        options.pedestalStretcherHeight = maxStretcherY;
      }
    }
  }

  return { parsed, material, options, joineryMode, limits, isRoundCategory, length, width, height };
}

export function buildDesign(
  entry: FurnitureCatalogEntry,
  inputs: ResolvedDesignInputs,
  locale: string,
): { rawDesign: FurnitureDesign; design: FurnitureDesign } {
  const { length, width, height, material, options, joineryMode } = inputs;
  const rawDesign = entry.template!({ length, width, height, material, options, locale });
  const design = joineryMode ? applyEdgeProtection(rawDesign) : toBeginnerMode(rawDesign);
  return { rawDesign, design };
}

/** 組裝動畫排程（§H8）：用還帶榫頭榫眼的 rawDesign 算，組裝版多鎖螺絲。 */
export function buildAssemblyPlan(rawDesign: FurnitureDesign, joineryMode: boolean): AssemblyPlan {
  return planAssembly(rawDesign, { screws: !joineryMode });
}
