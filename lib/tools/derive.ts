import type { FurnitureDesign, JoineryType } from "@/lib/types";
import { MATERIALS } from "@/lib/materials";
import { TOOL_CATALOG, type Tool, type ToolPriority } from "./catalog";

export interface RequiredTool {
  tool: Tool;
  priority: ToolPriority;
  reason: string;
}

const PRIORITY_RANK: Record<ToolPriority, number> = {
  required: 0,
  recommended: 1,
  optional: 2,
};

const ALWAYS_REQUIRED: Array<{ id: string; reason: string }> = [
  { id: "tape-measure-5m", reason: "全程量測下料與組裝" },
  { id: "try-square", reason: "確認直角與肩線" },
  { id: "marking-gauge", reason: "劃榫頭/榫眼基準線" },
  { id: "f-clamp-x4", reason: "膠合時固定零件" },
  { id: "pva-glue", reason: "榫接膠合" },
  { id: "sandpaper-set", reason: "組裝後表面處理" },
  { id: "wood-oil", reason: "完成後保護表面" },
];

const JOINERY_TOOLS: Record<
  JoineryType,
  Array<{ id: string; priority: ToolPriority; reason: string }>
> = {
  "through-tenon": [
    { id: "chisel-set-3-6-12", priority: "required", reason: "鑿通榫榫眼與整修榫頭" },
    { id: "japanese-saw", priority: "required", reason: "切榫頰與肩線" },
    { id: "all-purpose-saw", priority: "recommended", reason: "泛用型導付鋸，一把可替代切榫頰與肩線" },
    { id: "flush-cut-saw", priority: "recommended", reason: "組裝後切平突出的通榫榫頭，不傷木面" },
    { id: "mallet", priority: "required", reason: "敲擊鑿刀" },
    { id: "chisel-canvas-roll", priority: "recommended", reason: "鑿刀組收納捲包，保護刀刃" },
  ],
  "blind-tenon": [
    { id: "chisel-set-3-6-12", priority: "required", reason: "鑿半榫榫眼" },
    { id: "japanese-saw", priority: "required", reason: "切榫頰與肩線" },
    { id: "all-purpose-saw", priority: "recommended", reason: "泛用型導付鋸，一把可替代切榫頰與肩線" },
    { id: "mallet", priority: "required", reason: "敲擊鑿刀" },
    { id: "chisel-canvas-roll", priority: "recommended", reason: "鑿刀組收納捲包，保護刀刃" },
  ],
  "shouldered-tenon": [
    { id: "chisel-set-3-6-12", priority: "required", reason: "整修肩榫" },
    { id: "japanese-saw", priority: "required", reason: "切肩線" },
    { id: "all-purpose-saw", priority: "recommended", reason: "泛用型導付鋸，一把可替代切肩線" },
    { id: "mallet", priority: "required", reason: "敲擊鑿刀" },
    { id: "chisel-canvas-roll", priority: "recommended", reason: "鑿刀組收納捲包，保護刀刃" },
  ],
  "stub-joint": [
    { id: "chisel-set-3-6-12", priority: "required", reason: "鑿出寬深榫眼讓整支牙條卡入" },
    { id: "mallet", priority: "required", reason: "敲擊鑿刀" },
    { id: "router-table", priority: "recommended", reason: "用銑床快速挖槽，比手鑿快數倍" },
    { id: "chisel-canvas-roll", priority: "recommended", reason: "鑿刀組收納捲包，保護刀刃" },
  ],
  "half-lap": [
    { id: "japanese-saw", priority: "required", reason: "切搭接深度" },
    { id: "all-purpose-saw", priority: "recommended", reason: "泛用型導付鋸，一把可替代切搭接" },
    { id: "chisel-set-3-6-12", priority: "required", reason: "整平搭接面" },
    { id: "chisel-canvas-roll", priority: "recommended", reason: "鑿刀組收納捲包，保護刀刃" },
  ],
  dovetail: [
    { id: "dovetail-saw", priority: "required", reason: "切鳩尾的細齒鋸" },
    { id: "all-purpose-saw", priority: "recommended", reason: "泛用型導付鋸，極細齒亦可切鳩尾" },
    { id: "dovetail-marker", priority: "required", reason: "1:6 / 1:8 角度劃線" },
    { id: "chisel-set-3-6-12", priority: "required", reason: "清除鳩尾廢料" },
    { id: "chisel-canvas-roll", priority: "recommended", reason: "鑿刀組收納捲包，保護刀刃" },
    { id: "dovetail-jig", priority: "recommended", reason: "搭配修邊機批量做全透燕尾榫，省手工時間" },
  ],
  "finger-joint": [
    { id: "chisel-set-3-6-12", priority: "required", reason: "整修指接" },
    { id: "all-purpose-saw", priority: "recommended", reason: "泛用型導付鋸，手工切指接" },
    { id: "router-table", priority: "recommended", reason: "用銑床批量切指" },
    { id: "chisel-canvas-roll", priority: "recommended", reason: "鑿刀組收納捲包，保護刀刃" },
  ],
  "tongue-and-groove": [
    { id: "groove-plane", priority: "recommended", reason: "手工開槽" },
    { id: "groove-blade", priority: "recommended", reason: "搭配修邊機 + 開槽直刀，效率最佳" },
  ],
  dowel: [
    { id: "dowel-jig", priority: "required", reason: "確保木釘對齊" },
    { id: "drill", priority: "required", reason: "鑽木釘孔" },
    { id: "drill-bits", priority: "required", reason: "搭配電鑽使用" },
    { id: "flush-cut-saw", priority: "recommended", reason: "組裝後切平突出的木釘，不傷木面" },
  ],
  "mitered-spline": [
    { id: "japanese-saw", priority: "required", reason: "精準 45° 切角" },
    { id: "all-purpose-saw", priority: "recommended", reason: "泛用型導付鋸，一把可替代切 45° 角" },
    { id: "groove-blade", priority: "recommended", reason: "切片榫溝（修邊機 + 開槽直刀）" },
    { id: "magnetic-saw-guide", priority: "recommended", reason: "磁吸 45° 導引塊，手鋸切角不歪斜" },
  ],
  mitered: [
    { id: "japanese-saw", priority: "required", reason: "精準 45° 切角" },
    { id: "all-purpose-saw", priority: "recommended", reason: "泛用型導付鋸，一把可替代切 45° 角" },
    { id: "miter-box", priority: "recommended", reason: "斜切箱輔助角度，比目測精準" },
    { id: "magnetic-saw-guide", priority: "recommended", reason: "磁吸 45° 導引塊，手鋸切角不歪斜" },
  ],
  "pocket-hole": [
    { id: "pocket-hole-jig", priority: "required", reason: "鑽 15° 斜孔" },
    { id: "drill", priority: "required", reason: "鑽孔" },
    { id: "drill-bits", priority: "required", reason: "斜孔專用階梯鑽頭" },
    { id: "tenz-screw-set", priority: "recommended", reason: "TENZ 星型螺絲省力不咬合，斜孔鎖固專用" },
    { id: "countersink-bit", priority: "recommended", reason: "螺絲頭埋進木面不外露，正面更光潔" },
  ],
  screw: [
    { id: "drill", priority: "required", reason: "鑽先導孔與鎖螺絲" },
    { id: "drill-bits", priority: "required", reason: "搭配電鑽" },
    { id: "tenz-screw-set", priority: "recommended", reason: "TENZ 星型螺絲省力不咬合" },
    { id: "countersink-bit", priority: "recommended", reason: "螺絲頭埋進木面不外露" },
    { id: "hand-drill-brace", priority: "optional", reason: "手搖鑽手動鎖固，無電源也能裝" },
  ],
};

/** 任一存在於 map 中就代表用到電動／鑽孔／銑刀類工具 */
const POWER_TOOL_IDS = [
  "router-table",
  "drill",
  "drill-bits",
  "dowel-jig",
  "pocket-hole-jig",
  "groove-blade",
];

/** 任一存在於 map 中就代表動到刃口工具，會需要磨刀 */
const SHARPENABLE_IDS = ["chisel-set-3-6-12", "chisel-hardwood", "groove-plane"];

export function deriveRequiredTools(design: FurnitureDesign): RequiredTool[] {
  const map = new Map<string, RequiredTool>();

  const add = (id: string, priority: ToolPriority, reason: string) => {
    const tool = TOOL_CATALOG[id];
    if (!tool) return;
    const existing = map.get(id);
    if (!existing) {
      map.set(id, { tool, priority, reason });
      return;
    }
    if (PRIORITY_RANK[priority] < PRIORITY_RANK[existing.priority]) {
      map.set(id, { tool, priority, reason });
    }
  };

  for (const item of ALWAYS_REQUIRED) {
    add(item.id, "required", item.reason);
  }

  const seenJoinery = new Set<JoineryType>();
  for (const part of design.parts) {
    for (const tenon of part.tenons) {
      seenJoinery.add(tenon.type);
    }
  }
  for (const joinery of seenJoinery) {
    for (const t of JOINERY_TOOLS[joinery]) {
      add(t.id, t.priority, t.reason);
    }
  }

  const hardness = MATERIALS[design.primaryMaterial]?.hardness ?? 0;
  if (hardness >= 5000) {
    add("chisel-hardwood", "required", "白橡等硬木需高硬度鑿刀，普通鑿刀易崩刃");
    add("sandpaper-coarse-60", "required", "硬木刨後需 60 番去除刨痕");
  }

  const longSpan =
    design.overall.length > 1200 ||
    design.category === "dining-table" ||
    design.category === "desk" ||
    design.category === "bench";
  if (longSpan) {
    add("long-clamp-x2", "required", "長型家具膠合需大尺寸夾具");
  }

  if (
    design.category === "chest-of-drawers" ||
    design.category === "shoe-cabinet" ||
    design.category === "display-cabinet" ||
    design.category === "media-console" ||
    design.category === "nightstand" ||
    design.category === "wardrobe"
  ) {
    add("concealed-hinge", "optional", "櫃門可選用隱藏鉸鏈");
  }

  // ----- 衍生推薦（依目前已選工具反推） -----
  // 全家具通用建議——marking / glue / clamp / 保護面板類，無條件帶
  add("marking-knife", "recommended", "SK5 雙刃劃線刀，比鉛筆精準十倍，榫接對位專用");
  add("masking-tape-low-tack", "recommended", "弱黏紙膠帶，膠合防溢膠、塗裝遮邊、面板保護萬用");
  add("quick-bench-vise", "recommended", "快速虎鉗，鑿榫／鋸切時鎖緊零件比 F 夾穩");
  // pva-glue 一定在 ALWAYS_REQUIRED → 任何家具都會帶到，所以 glue-tray-set
  // 也跟著建議
  add("glue-tray-set", "recommended", "矽膠托盤＋滾筒刷，膠水乾掉一撕即淨，比紙杯衛生");
  add("silicone-glue-box", "recommended", "矽膠膠水盒，膠水可儲存重複用，比拋棄式環保");
  // 用到刃口工具 → 推薦磨刀器（鑿刀／鉋刀都需要定期定角開刃）
  if (SHARPENABLE_IDS.some((id) => map.has(id))) {
    add("sharpening-jig", "recommended", "鑿刀／鉋刀定角開刃，搭配磨刀石使用");
  }
  // 用到電動／鑽孔／銑刀類 → 推薦機台潤滑噴霧
  if (POWER_TOOL_IDS.some((id) => map.has(id))) {
    add("silicone-lubricant", "recommended", "帶鋸／台鋸／平刨台面防鏽＋離型，推料順暢");
  }
  // 裝飾性櫃類家具 → 推薦修邊機雕刻底座（圓弧／龜甲紋裝飾）
  if (
    design.category === "chinese-cabinet" ||
    design.category === "display-cabinet"
  ) {
    add("router-engraving-base", "optional", "修邊機加底座做圓弧／龜甲紋雕刻裝飾");
  }

  return Array.from(map.values()).sort((a, b) => {
    const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (pr !== 0) return pr;
    return a.tool.category.localeCompare(b.tool.category);
  });
}
