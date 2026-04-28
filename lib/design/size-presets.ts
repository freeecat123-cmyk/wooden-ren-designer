import type { FurnitureCategory } from "@/lib/types";

export interface SizePreset {
  label: string;
  /** 長 (mm) */
  length: number;
  /** 寬/深 (mm) */
  width: number;
  /** 高 (mm) */
  height: number;
  /** 一行人話描述，給客戶聽得懂 */
  hint?: string;
}

/**
 * 業界常用尺寸 preset。木工接到客戶尺寸詢問可一鍵帶入。
 * 沒列在這裡的 category 設計頁不會顯示 preset 列，不影響原本流程。
 */
export const SIZE_PRESETS: Partial<Record<FurnitureCategory, SizePreset[]>> = {
  "dining-table": [
    { label: "4 人標準", length: 1500, width: 800, height: 740, hint: "4 人桌標準" },
    { label: "6 人", length: 1800, width: 900, height: 740, hint: "6 人桌標準" },
    { label: "8 人", length: 2100, width: 1000, height: 740, hint: "大家庭" },
  ],
  desk: [
    { label: "學生／單螢幕", length: 1200, width: 600, height: 740 },
    { label: "標準辦公", length: 1400, width: 700, height: 740 },
    { label: "雙螢幕", length: 1600, width: 800, height: 740 },
    { label: "雙人共用", length: 1800, width: 800, height: 740 },
  ],
  "tea-table": [
    { label: "小（套房）", length: 800, width: 500, height: 400 },
    { label: "中（一般客廳）", length: 1000, width: 600, height: 400 },
    { label: "大（大客廳）", length: 1200, width: 700, height: 400 },
  ],
  "low-table": [
    { label: "和室／小", length: 1000, width: 600, height: 350 },
    { label: "和室／大", length: 1400, width: 800, height: 350 },
  ],
  "side-table": [
    { label: "床邊", length: 450, width: 400, height: 600 },
    { label: "沙發旁", length: 500, width: 500, height: 550 },
  ],
  bench: [
    { label: "玄關穿鞋", length: 1000, width: 350, height: 450 },
    { label: "餐桌長凳", length: 1200, width: 350, height: 450 },
    { label: "雙人公園", length: 1500, width: 400, height: 450 },
  ],
  "dining-chair": [
    { label: "標準餐椅", length: 450, width: 450, height: 850 },
  ],
  "bar-stool": [
    { label: "中島吧檯", length: 380, width: 380, height: 650 },
    { label: "高吧椅", length: 380, width: 380, height: 750 },
  ],
  "open-bookshelf": [
    { label: "矮櫃 4 層", length: 800, width: 300, height: 1200 },
    { label: "標準 5 層", length: 800, width: 300, height: 1500 },
    { label: "頂天 6 層", length: 800, width: 300, height: 1800 },
  ],
  wardrobe: [
    { label: "單人 80cm", length: 800, width: 600, height: 2000 },
    { label: "雙人 120cm", length: 1200, width: 600, height: 2000 },
    { label: "夫妻 160cm", length: 1600, width: 600, height: 2000 },
  ],
  "media-console": [
    { label: "55 吋電視", length: 1500, width: 400, height: 500 },
    { label: "65 吋電視", length: 1800, width: 400, height: 500 },
    { label: "75 吋電視", length: 2100, width: 450, height: 500 },
  ],
  "shoe-cabinet": [
    { label: "玄關小櫃", length: 800, width: 350, height: 1000 },
    { label: "標準鞋櫃", length: 1000, width: 350, height: 1200 },
  ],
  "chest-of-drawers": [
    { label: "床邊抽屜", length: 600, width: 450, height: 700 },
    { label: "5 抽斗櫃", length: 900, width: 450, height: 1100 },
  ],
  nightstand: [
    { label: "雙抽床頭櫃", length: 500, width: 400, height: 600 },
  ],
  "round-table": [
    { label: "4 人圓餐桌", length: 1100, width: 1100, height: 740 },
    { label: "6 人圓餐桌", length: 1400, width: 1400, height: 740 },
  ],
  "round-tea-table": [
    { label: "小圓茶几", length: 700, width: 700, height: 400 },
    { label: "中圓茶几", length: 900, width: 900, height: 400 },
  ],
};

export function getSizePresets(category: FurnitureCategory): SizePreset[] {
  return SIZE_PRESETS[category] ?? [];
}
