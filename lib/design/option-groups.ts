/**
 * 選項分群顯示用 metadata。桌面端 (app/[locale]/design/[type]/page.tsx) 跟手機端
 * AdvancedSheet (components/mobile/MobileShell.tsx) 都靠這份資料把 spec.group
 * 轉成可讀的中/英 section 標題 + 顯示順序。
 *
 * 維護注意：新增 OptionGroup（lib/types/index.ts）時兩個 map 都要補。
 * 譯詞統一表：docs/glossary-zh-en.md
 */

import type { OptionSpec } from "@/lib/types";

export interface GroupMeta {
  labelZh: string;
  labelEn: string;
  icon: string;
  bar: string;
}

export const GROUP_META: Record<string, GroupMeta> = {
  preset:     { labelZh: "配置預設",     labelEn: "Preset",            icon: "⭐",  bar: "bg-yellow-400"  },
  form:       { labelZh: "形制 / 比例",   labelEn: "Form / Proportion", icon: "🏛️", bar: "bg-stone-500"   },
  structure:  { labelZh: "櫃體結構 / 板材", labelEn: "Carcase / Panels",  icon: "🏗️", bar: "bg-stone-400"   },
  top:        { labelZh: "桌面 / 座板",   labelEn: "Top / Seat",        icon: "🪵",  bar: "bg-sky-400"     },
  panel:      { labelZh: "板心 / 背板",   labelEn: "Panel / Back",      icon: "▣",  bar: "bg-teal-500"    },
  rail:       { labelZh: "邊抹（框條）",  labelEn: "Rails",             icon: "═",  bar: "bg-amber-500"   },
  "zone-top": { labelZh: "上層",         labelEn: "Upper zone",        icon: "▲",  bar: "bg-sky-500"     },
  "zone-mid": { labelZh: "中層",         labelEn: "Mid zone",          icon: "■",  bar: "bg-sky-400"     },
  "zone-bot": { labelZh: "下層",         labelEn: "Lower zone",        icon: "▼",  bar: "bg-sky-300"     },
  "col-left": { labelZh: "左欄",         labelEn: "Left column",       icon: "◀",  bar: "bg-violet-500"  },
  "col-mid":  { labelZh: "中欄",         labelEn: "Middle column",     icon: "●",  bar: "bg-violet-400"  },
  "col-right":{ labelZh: "右欄",         labelEn: "Right column",      icon: "▶",  bar: "bg-violet-300"  },
  layers:     { labelZh: "分層配置",     labelEn: "Tier layout",       icon: "▤",  bar: "bg-indigo-400"  },
  door:       { labelZh: "門板",         labelEn: "Doors",             icon: "▯",  bar: "bg-fuchsia-400" },
  drawer:     { labelZh: "抽屜",         labelEn: "Drawers",           icon: "▦",  bar: "bg-violet-400"  },
  leg:        { labelZh: "底座 / 桌椅腳",  labelEn: "Base / Legs",       icon: "🦵", bar: "bg-rose-400"    },
  apron:      { labelZh: "牙條",         labelEn: "Apron",             icon: "━",  bar: "bg-amber-400"   },
  skirt:      { labelZh: "牙條 / 牙頭裝飾", labelEn: "Apron / Skirt",     icon: "〰", bar: "bg-orange-400" },
  joinery:    { labelZh: "角接合",       labelEn: "Corner joinery",    icon: "◢",  bar: "bg-amber-500"   },
  divider:    { labelZh: "內格分隔",     labelEn: "Dividers",          icon: "▤",  bar: "bg-indigo-400"  },
  handle:     { labelZh: "把手",         labelEn: "Pulls",             icon: "⊃",  bar: "bg-rose-400"    },
  lid:        { labelZh: "盒蓋",         labelEn: "Lid",               icon: "▢",  bar: "bg-cyan-400"    },
  lining:     { labelZh: "內襯 / 軟料",   labelEn: "Lining",            icon: "🧵", bar: "bg-fuchsia-400" },
  balustrade: { labelZh: "敞格圍欄",     labelEn: "Balustrade",        icon: "┃",  bar: "bg-pink-400"    },
  stretcher:  { labelZh: "橫撐 / 連腳料",  labelEn: "Stretchers",        icon: "║",  bar: "bg-emerald-400" },
  back:       { labelZh: "椅背",         labelEn: "Backrest",          icon: "◧",  bar: "bg-teal-400"    },
  misc:       { labelZh: "其他",         labelEn: "Other",             icon: "⚙",  bar: "bg-zinc-400"    },
};

export function groupLabel(meta: GroupMeta, locale: string): string {
  return locale === "en" ? meta.labelEn : meta.labelZh;
}

/** 顯示順序：從「整體骨架」往「五金細節」走 */
export const GROUP_ORDER = [
  "preset",
  "form",
  "structure",
  "joinery",
  "divider",
  "handle",
  "lid",
  "lining",
  "zone-top",
  "zone-mid",
  "zone-bot",
  "col-left",
  "col-mid",
  "col-right",
  "leg",
  "top",
  "panel",
  "rail",
  "skirt",
  "balustrade",
  "layers",
  "door",
  "drawer",
  "apron",
  "stretcher",
  "back",
  "misc",
];

/**
 * 把 OptionSpec 陣列依 spec.group 分群，回傳依 GROUP_ORDER 排序的群組陣列。
 * 同 group 內的 spec 維持原 schema 順序。沒有 group 或不在 GROUP_ORDER 內
 * 的 spec 全歸到 "misc"，這樣 UI 不會吃掉任何選項。
 */
export function groupSpecsByGroup(specs: OptionSpec[]): Array<{
  group: string;
  meta: GroupMeta;
  specs: OptionSpec[];
}> {
  const buckets = new Map<string, OptionSpec[]>();
  for (const s of specs) {
    const g = s.group && GROUP_META[s.group] ? s.group : "misc";
    if (!buckets.has(g)) buckets.set(g, []);
    buckets.get(g)!.push(s);
  }
  const ordered: Array<{ group: string; meta: GroupMeta; specs: OptionSpec[] }> = [];
  for (const g of GROUP_ORDER) {
    const items = buckets.get(g);
    if (!items || items.length === 0) continue;
    ordered.push({ group: g, meta: GROUP_META[g], specs: items });
  }
  return ordered;
}
