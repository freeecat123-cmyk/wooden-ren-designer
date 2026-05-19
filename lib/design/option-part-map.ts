/**
 * 把 OptionSpec.key（或主表單三軸 length/width/height）對應到 3D 部件 ID pattern。
 * 用 regex 或 prefix 比對 part.id，hover 參數時 3D 對應件發光。
 *
 * partIdPatterns: regex array — match design.parts.find(p => regex.test(p.id))
 * 不需要 100% 覆蓋，只需 cover 高頻 key（length/width/height/leg/apron/seat/top/
 * back/shelf/drawer/door/stretcher）。
 */

export interface PartAnchorEntry {
  /** OptionSpec.key 或主表 key（length/width/height/material） */
  match: RegExp | string;
  /** 對應 part.id 的 regex 或 prefix */
  partIdPatterns: (RegExp | string)[];
}

export const OPTION_PART_MAP: PartAnchorEntry[] = [
  // 三軸主尺寸 — 詞素匹配（含中段 -leg- / -top- 之類 trestle 系列）
  { match: "length", partIdPatterns: [/(^|-)top($|-)/, /(^|-)seat($|-)/, /^panel-top/, /^bench-top/, /(^|-)apron-(front|back)/i, /(^|-)stretcher-(front|back)/i, /(^|-)rail($|-)/i] },
  { match: "width",  partIdPatterns: [/(^|-)top($|-)/, /(^|-)seat($|-)/, /^panel-top/, /(^|-)apron-(left|right|side)/i, /(^|-)stretcher-(left|right|side)/i] },
  { match: "height", partIdPatterns: [/(^|-)leg($|-)/, /(^|-)side-/, /(^|-)post($|-)/, /(^|-)stile($|-)/, /^back-post/, /(^|-)trestle/i] },
  // 腳系列（含 trestle-*-leg）
  { match: /^leg/i, partIdPatterns: [/(^|-)leg($|-)/, /^post-(?!back)/, /(^|-)stile($|-)/, /(^|-)trestle.*-leg/i] },
  // 牙板 / 圍裙
  { match: /apron/i, partIdPatterns: [/apron/i] },
  // 橫撐 — 含 ls-*（lower stretcher 縮寫，餐椅/餐桌/desk）+ desk-h-cross / standing-brace
  { match: /stretcher|brace/i, partIdPatterns: [/stretcher/i, /(^|-)brace($|-)/i, /^ls-/, /(^|-)h-(cross|side)/i, /(^|-)under-shelf/i] },
  // 抽屜（先於 seat / top，避免 drawerTop 之類 key 被吃掉）
  { match: /drawer/i, partIdPatterns: [/drawer/i] },
  // 門板
  { match: /door/i, partIdPatterns: [/door/i] },
  // 椅背 / 後板（含 back-panel / tb-back-panel / head-panel / back-top-rail / back-splat...）
  { match: /back/i, partIdPatterns: [/(^|-)back($|-)/i, /^panel-back/i, /^head-/i] },
  // 座板 / 桌面（含 cornice-top）
  { match: /^(seat|top)/i, partIdPatterns: [/(^|-)seat($|-)/, /(^|-)top($|-)/, /^panel-top/, /^bench-top/, /(^|-)cornice/i] },
  { match: /(topThick|topThickness|seatThick|seatThickness)/i, partIdPatterns: [/(^|-)seat($|-)/, /(^|-)top($|-)/, /^panel-top/] },
  // 層板 / 隔板
  { match: /shelf|divider|partition/i, partIdPatterns: [/shelf/i, /divider/i, /partition/i, /(^|-)vdivider/i] },
  // 側板（含 ${lr}-side-panel / tb-${lr}-side-panel / side-rail-*）
  { match: /side/i, partIdPatterns: [/(^|-)side($|-)/, /^panel-side/i, /-side-panel/i, /^side-rail/] },
  // 圍板 / 抽屜面板 / 任何 *-panel 命中
  { match: /panel|frieze|skirt/i, partIdPatterns: [/(^|-)panel($|-)/i, /^frieze/i, /^skirt/i, /-raised-panel/i, /-inlay/i] },
  // 把手 / 五金（不一定有對應 part，可能空回傳）
  { match: /handle|pull|knob|hardware/i, partIdPatterns: [/handle/i, /pull/i, /knob/i] },
  // 板材厚度（panel*Thickness）→ 幾乎所有面板
  { match: /panelThickness/i, partIdPatterns: [/(^|-)panel($|-)/i, /(^|-)side($|-)/, /(^|-)top($|-)/, /(^|-)back($|-)/, /^bottom/, /shelf/i, /divider/i, /-raised-panel/i] },
  // 框架 / 橫木 / 直柱（rail 通用）
  { match: /rail/i, partIdPatterns: [/(^|-)rail($|-)/i, /-rail-/i] },
];

export function resolvePartIds(
  optionKey: string,
  allPartIds: ReadonlyArray<string>,
): string[] {
  for (const entry of OPTION_PART_MAP) {
    const matches =
      typeof entry.match === "string"
        ? entry.match === optionKey
        : entry.match.test(optionKey);
    if (!matches) continue;
    const ids = allPartIds.filter((pid) =>
      entry.partIdPatterns.some((pat) =>
        typeof pat === "string" ? pid.startsWith(pat) : pat.test(pid),
      ),
    );
    if (ids.length > 0) return ids;
  }
  return [];
}
