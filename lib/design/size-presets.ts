import type { FurnitureCategory } from "@/lib/types";

export interface SizePreset {
  label: string;
  /** EN translation (optional — falls back to label) */
  labelEn?: string;
  /** 長 (mm) */
  length: number;
  /** 寬/深 (mm) */
  width: number;
  /** 高 (mm) */
  height: number;
  /** 一行人話描述，給客戶聽得懂 */
  hint?: string;
  /** EN translation of hint */
  hintEn?: string;
}

export const SIZE_PRESETS: Partial<Record<FurnitureCategory, SizePreset[]>> = {
  "dining-table": [
    { label: "4 人標準", labelEn: "4-seat standard", length: 1500, width: 800, height: 740, hint: "4 人桌標準", hintEn: "Standard 4-person table" },
    { label: "6 人", labelEn: "6-seat", length: 1800, width: 900, height: 740, hint: "6 人桌標準", hintEn: "Standard 6-person table" },
    { label: "8 人", labelEn: "8-seat", length: 2100, width: 1000, height: 740, hint: "大家庭", hintEn: "Large family" },
  ],
  desk: [
    { label: "學生／單螢幕", labelEn: "Student / single monitor", length: 1200, width: 600, height: 740 },
    { label: "標準辦公", labelEn: "Standard office", length: 1400, width: 700, height: 740 },
    { label: "雙螢幕", labelEn: "Dual monitor", length: 1600, width: 800, height: 740 },
    { label: "雙人共用", labelEn: "Shared by two", length: 1800, width: 800, height: 740 },
  ],
  "tea-table": [
    { label: "小（套房）", labelEn: "Small (studio)", length: 800, width: 500, height: 400 },
    { label: "中（一般客廳）", labelEn: "Medium (living room)", length: 1000, width: 600, height: 400 },
    { label: "大（大客廳）", labelEn: "Large (great room)", length: 1200, width: 700, height: 400 },
  ],
  "low-table": [
    { label: "和室／小", labelEn: "Tatami / small", length: 1000, width: 600, height: 350 },
    { label: "和室／大", labelEn: "Tatami / large", length: 1400, width: 800, height: 350 },
  ],
  "side-table": [
    { label: "床邊", labelEn: "Bedside", length: 450, width: 400, height: 600 },
    { label: "沙發旁", labelEn: "Sofa side", length: 500, width: 400, height: 550 },
  ],
  bench: [
    { label: "玄關穿鞋", labelEn: "Entryway shoe bench", length: 1000, width: 350, height: 450 },
    { label: "餐桌長凳", labelEn: "Dining bench", length: 1200, width: 350, height: 450 },
    { label: "雙人公園", labelEn: "Two-seat park bench", length: 1500, width: 400, height: 450 },
  ],
  "dining-chair": [
    { label: "標準餐椅", labelEn: "Standard dining chair", length: 450, width: 450, height: 850 },
  ],
  "bar-stool": [
    { label: "中島吧檯", labelEn: "Kitchen island counter", length: 380, width: 380, height: 650 },
    { label: "高吧椅", labelEn: "Tall bar stool", length: 380, width: 380, height: 750 },
  ],
  "open-bookshelf": [
    { label: "矮櫃 4 層", labelEn: "Low cabinet 4 tier", length: 800, width: 300, height: 1200 },
    { label: "標準 5 層", labelEn: "Standard 5 tier", length: 800, width: 300, height: 1500 },
    { label: "頂天 6 層", labelEn: "Ceiling-high 6 tier", length: 800, width: 300, height: 1800 },
  ],
  wardrobe: [
    { label: "單人 80cm", labelEn: "Single 80 cm", length: 800, width: 600, height: 2000 },
    { label: "雙人 120cm", labelEn: "Double 120 cm", length: 1200, width: 600, height: 2000 },
    { label: "夫妻 160cm", labelEn: "Couple 160 cm", length: 1600, width: 600, height: 2000 },
  ],
  "media-console": [
    { label: "55 吋電視", labelEn: '55" TV', length: 1500, width: 400, height: 500 },
    { label: "65 吋電視", labelEn: '65" TV', length: 1800, width: 400, height: 500 },
    { label: "75 吋電視", labelEn: '75" TV', length: 2100, width: 450, height: 500 },
  ],
  "shoe-cabinet": [
    { label: "玄關小櫃", labelEn: "Entryway small cabinet", length: 800, width: 350, height: 1000 },
    { label: "標準鞋櫃", labelEn: "Standard shoe cabinet", length: 1000, width: 350, height: 1200 },
  ],
  "chest-of-drawers": [
    { label: "床邊抽屜", labelEn: "Bedside chest", length: 600, width: 450, height: 700 },
    { label: "5 抽斗櫃", labelEn: "5-drawer chest", length: 900, width: 450, height: 1100 },
  ],
  nightstand: [
    { label: "標準（抽屜+門）", labelEn: "Standard (drawer + door)", length: 500, width: 400, height: 650 },
    { label: "小坪數（窄）", labelEn: "Compact (narrow)", length: 400, width: 350, height: 600 },
    { label: "高腳極簡（japandi）", labelEn: "Japandi tall-leg", length: 450, width: 400, height: 620 },
  ],
  "round-table": [
    { label: "4 人圓餐桌", labelEn: "4-seat round dining", length: 1100, width: 1100, height: 740 },
    { label: "6 人圓餐桌", labelEn: "6-seat round dining", length: 1400, width: 1400, height: 740 },
  ],
  "round-tea-table": [
    { label: "小圓茶几", labelEn: "Small round tea table", length: 700, width: 700, height: 400 },
    { label: "中圓茶几", labelEn: "Medium round tea table", length: 900, width: 900, height: 400 },
  ],
};

export function getSizePresets(category: FurnitureCategory): SizePreset[] {
  return SIZE_PRESETS[category] ?? [];
}

/** Locale-aware accessor — picks labelEn / hintEn when locale is "en". */
export function getSizePresetsLocalized(
  category: FurnitureCategory,
  locale: string,
): SizePreset[] {
  const presets = SIZE_PRESETS[category] ?? [];
  if (locale !== "en") return presets;
  return presets.map((p) => ({
    ...p,
    label: p.labelEn ?? p.label,
    hint: p.hintEn ?? p.hint,
  }));
}
