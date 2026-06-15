// 純函式：用 part id 前綴判斷分類。無 React / DOM 依賴，server / client 皆可。
// svg-views.tsx 因為含 client-only SVG 元件被標 "use client"，因此把這支
// 純邏輯抽出來獨立檔，讓 server component（print page、part-drawing/grouping
// 等）可以安全呼叫。

export type PartCategory =
  | "case"
  | "divider"
  | "drawer"
  | "door"
  | "apron"
  | "seat"
  | "leg"
  | "misc";

export function categorizePart(id: string): PartCategory {
  if (/^z?\d*-?drawer-?\d*-(face|front|back|side|bottom)/.test(id))
    return "drawer";
  if (/drawer-col-partition/.test(id)) return "divider";
  if (/-door-.*-(rail|stile|panel|glass)/.test(id)) return "door";
  // 木盒：盒蓋主板（lid）+ 嵌入式凸唇（lid-plug）是純方板，但跟 top/bottom 一樣
  // 是核心結構件、木工要看下料尺寸 → 歸 case 才會出零件圖（rabbeted 純方蓋原本漏掉）。
  // lid-hinge-N 是五金（visual=metal）維持 misc、不出圖。
  if (id === "top" || id === "bottom" || id === "back" || id === "lid" || id === "lid-plug") return "case";
  if (/^side-(left|right)$/.test(id)) return "case";
  // 工具牆：法式斜切條（牆條/掛條）+ 三帶側立板歸結構（case）
  if (/-cleat-\d+$/.test(id) || /^tool-\w+-cleat$/.test(id)) return "case";
  if (/-side-(left|right)$/.test(id)) return "case";
  if (
    /^shelf-/.test(id) ||
    /-shelf-/.test(id) ||
    /-divider-/.test(id) ||
    /-boundary/.test(id) ||
    /^col-partition/.test(id) ||
    /col-partition-/.test(id)
  )
    return "divider";
  if (
    /^apron/.test(id) ||
    /^stretcher/.test(id) ||
    /^ls-/.test(id) ||
    id === "center-stretcher" ||
    id === "back-rail" ||
    id === "back-top-rail"
  )
    return "apron";
  if (id === "seat" || /^seat-/.test(id)) return "seat";
  if (/^back-slat/.test(id) || /^back-splat/.test(id) || /^splat/.test(id))
    return "seat";
  if (/^slat/.test(id) || /^rung/.test(id)) return "seat";
  if (
    /^leg-/.test(id) ||
    /^bracket-/.test(id) ||
    /^plinth/.test(id) ||
    /^side-extension/.test(id)
  )
    return "leg";
  return "misc";
}
