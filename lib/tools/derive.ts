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
    { id: "mallet", priority: "required", reason: "敲擊鑿刀" },
  ],
  "blind-tenon": [
    { id: "chisel-set-3-6-12", priority: "required", reason: "鑿半榫榫眼" },
    { id: "japanese-saw", priority: "required", reason: "切榫頰與肩線" },
    { id: "mallet", priority: "required", reason: "敲擊鑿刀" },
  ],
  "shouldered-tenon": [
    { id: "chisel-set-3-6-12", priority: "required", reason: "整修肩榫" },
    { id: "japanese-saw", priority: "required", reason: "切肩線" },
    { id: "mallet", priority: "required", reason: "敲擊鑿刀" },
  ],
  "stub-joint": [
    { id: "chisel-set-3-6-12", priority: "required", reason: "鑿出寬深榫眼讓整支牙條卡入" },
    { id: "mallet", priority: "required", reason: "敲擊鑿刀" },
    { id: "router-table", priority: "recommended", reason: "用銑床快速挖槽，比手鑿快數倍" },
  ],
  "half-lap": [
    { id: "japanese-saw", priority: "required", reason: "切搭接深度" },
    { id: "chisel-set-3-6-12", priority: "required", reason: "整平搭接面" },
  ],
  dovetail: [
    { id: "dovetail-saw", priority: "required", reason: "切鳩尾的細齒鋸" },
    { id: "dovetail-marker", priority: "required", reason: "1:6 / 1:8 角度劃線" },
    { id: "chisel-set-3-6-12", priority: "required", reason: "清除鳩尾廢料" },
  ],
  "finger-joint": [
    { id: "chisel-set-3-6-12", priority: "required", reason: "整修指接" },
    { id: "router-table", priority: "recommended", reason: "用銑床批量切指" },
  ],
  "tongue-and-groove": [
    { id: "groove-plane", priority: "recommended", reason: "手工開槽" },
    { id: "groove-blade", priority: "recommended", reason: "搭配修邊機 + 開槽直刀，效率最佳" },
  ],
  dowel: [
    { id: "dowel-jig", priority: "required", reason: "確保木釘對齊" },
    { id: "drill", priority: "required", reason: "鑽木釘孔" },
    { id: "drill-bits", priority: "required", reason: "搭配電鑽使用" },
  ],
  "mitered-spline": [
    { id: "japanese-saw", priority: "required", reason: "精準 45° 切角" },
    { id: "groove-blade", priority: "recommended", reason: "切片榫溝（修邊機 + 開槽直刀）" },
  ],
  "pocket-hole": [
    { id: "pocket-hole-jig", priority: "required", reason: "鑽 15° 斜孔" },
    { id: "drill", priority: "required", reason: "鑽孔" },
    { id: "drill-bits", priority: "required", reason: "斜孔專用階梯鑽頭" },
  ],
  screw: [
    { id: "drill", priority: "required", reason: "鑽先導孔與鎖螺絲" },
    { id: "drill-bits", priority: "required", reason: "搭配電鑽" },
  ],
};

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

  const hardness = MATERIALS[design.primaryMaterial].hardness;
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

  return Array.from(map.values()).sort((a, b) => {
    const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (pr !== 0) return pr;
    return a.tool.category.localeCompare(b.tool.category);
  });
}
