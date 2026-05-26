/**
 * 選項分群顯示用 metadata。桌面端 (app/design/[type]/page.tsx) 跟手機端
 * AdvancedSheet (components/mobile/MobileShell.tsx) 都靠這份資料把 spec.group
 * 轉成可讀的中文 section 標題 + 顯示順序。
 *
 * 維護注意：新增 OptionGroup（lib/types/index.ts）時兩個 map 都要補。
 */

import type { OptionSpec } from "@/lib/types";

export const GROUP_META: Record<
  string,
  { label: string; icon: string; bar: string }
> = {
  preset:     { label: "配置預設",     icon: "⭐", bar: "bg-yellow-400"  },
  form:       { label: "形制 / 比例",   icon: "🏛️", bar: "bg-stone-500"   },
  structure:  { label: "櫃體結構 / 板材", icon: "🏗️", bar: "bg-stone-400"   },
  top:        { label: "桌面 / 座板",   icon: "🪵", bar: "bg-sky-400"     },
  panel:      { label: "板心 / 背板",   icon: "▣", bar: "bg-teal-500"    },
  rail:       { label: "邊抹（框條）",  icon: "═", bar: "bg-amber-500"   },
  "zone-top": { label: "上層",         icon: "▲", bar: "bg-sky-500"     },
  "zone-mid": { label: "中層",         icon: "■", bar: "bg-sky-400"     },
  "zone-bot": { label: "下層",         icon: "▼", bar: "bg-sky-300"     },
  "col-left": { label: "左欄",         icon: "◀", bar: "bg-violet-500"  },
  "col-mid":  { label: "中欄",         icon: "●", bar: "bg-violet-400"  },
  "col-right":{ label: "右欄",         icon: "▶", bar: "bg-violet-300"  },
  layers:     { label: "分層配置",     icon: "▤", bar: "bg-indigo-400"  },
  door:       { label: "門板",         icon: "▯", bar: "bg-fuchsia-400" },
  drawer:     { label: "抽屜",         icon: "▦", bar: "bg-violet-400"  },
  leg:        { label: "底座 / 桌椅腳",  icon: "🦵", bar: "bg-rose-400"    },
  apron:      { label: "牙條",         icon: "━", bar: "bg-amber-400"   },
  skirt:      { label: "牙條 / 牙頭裝飾", icon: "〰", bar: "bg-orange-400" },
  joinery:    { label: "角接合",       icon: "◢", bar: "bg-amber-500"   },
  divider:    { label: "內格分隔",     icon: "▤", bar: "bg-indigo-400"  },
  handle:     { label: "把手",         icon: "⊃", bar: "bg-rose-400"    },
  lid:        { label: "盒蓋",         icon: "▢", bar: "bg-cyan-400"    },
  lining:     { label: "內襯 / 軟料",   icon: "🧵", bar: "bg-fuchsia-400" },
  balustrade: { label: "敞格圍欄",     icon: "┃", bar: "bg-pink-400"    },
  stretcher:  { label: "橫撐 / 連腳料",  icon: "║", bar: "bg-emerald-400" },
  back:       { label: "椅背",         icon: "◧", bar: "bg-teal-400"    },
  misc:       { label: "其他",         icon: "⚙", bar: "bg-zinc-400"    },
};

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
  meta: { label: string; icon: string; bar: string };
  specs: OptionSpec[];
}> {
  const buckets = new Map<string, OptionSpec[]>();
  for (const s of specs) {
    const g = s.group && GROUP_META[s.group] ? s.group : "misc";
    if (!buckets.has(g)) buckets.set(g, []);
    buckets.get(g)!.push(s);
  }
  const ordered: Array<{
    group: string;
    meta: { label: string; icon: string; bar: string };
    specs: OptionSpec[];
  }> = [];
  for (const g of GROUP_ORDER) {
    const items = buckets.get(g);
    if (!items || items.length === 0) continue;
    ordered.push({ group: g, meta: GROUP_META[g], specs: items });
  }
  return ordered;
}
