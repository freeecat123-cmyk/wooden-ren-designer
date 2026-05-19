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
  // 三軸主尺寸
  { match: "length", partIdPatterns: [/^top/, /^seat/, /^panel-top/, /^bench-top/, /^apron-front/i, /^apron-back/i, /^stretcher-front/i, /^stretcher-back/i] },
  { match: "width",  partIdPatterns: [/^top/, /^seat/, /^panel-top/, /^apron-left/i, /^apron-right/i, /^stretcher-left/i, /^stretcher-right/i] },
  { match: "height", partIdPatterns: [/^leg-/, /^side-/, /^post-/, /^stile-/, /^back-post/] },
  // 腳系列
  { match: /^leg/i, partIdPatterns: [/^leg-/, /^post-(?!back)/, /^stile-/] },
  // 牙板 / 圍裙
  { match: /apron/i, partIdPatterns: [/apron/i] },
  // 橫撐
  { match: /stretcher|brace/i, partIdPatterns: [/stretcher/i, /^brace/i] },
  // 抽屜（先於 seat / top，避免 drawerTop 之類 key 被吃掉）
  { match: /drawer/i, partIdPatterns: [/drawer/i] },
  // 門板
  { match: /door/i, partIdPatterns: [/door/i] },
  // 椅背 / 後板
  { match: /back/i, partIdPatterns: [/^back/i, /^panel-back/i] },
  // 座板 / 桌面
  { match: /^(seat|top)/i, partIdPatterns: [/^seat/, /^top/, /^panel-top/, /^bench-top/] },
  { match: /(topThick|topThickness|seatThick|seatThickness)/i, partIdPatterns: [/^seat/, /^top/, /^panel-top/] },
  // 層板 / 隔板
  { match: /shelf|divider|partition/i, partIdPatterns: [/shelf/i, /divider/i, /partition/i] },
  // 側板
  { match: /side/i, partIdPatterns: [/^side-/, /^panel-side/i] },
  // 把手 / 五金（不一定有對應 part，可能空回傳）
  { match: /handle|pull|knob|hardware/i, partIdPatterns: [/handle/i, /pull/i, /knob/i] },
  // 板材厚度（panel*Thickness）→ 幾乎所有面板
  { match: /panelThickness/i, partIdPatterns: [/^panel-/, /^side-/, /^top/, /^back/, /^bottom/, /shelf/i, /divider/i] },
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
