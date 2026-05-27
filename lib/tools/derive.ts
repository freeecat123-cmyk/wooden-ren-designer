import type { FurnitureDesign, JoineryType } from "@/lib/types";
import { MATERIALS } from "@/lib/materials";
import { TOOL_CATALOG, type Tool, type ToolPriority } from "./catalog";

export interface RequiredTool {
  tool: Tool;
  priority: ToolPriority;
  reason: string;
}

interface ReasonPair {
  zh: string;
  en: string;
}

interface AlwaysSpec {
  id: string;
  reason: ReasonPair;
}

interface JoinerySpec {
  id: string;
  priority: ToolPriority;
  reason: ReasonPair;
}

const PRIORITY_RANK: Record<ToolPriority, number> = {
  required: 0,
  recommended: 1,
  optional: 2,
};

const pickReason = (r: ReasonPair, locale: string) =>
  locale === "en" ? r.en : r.zh;

const ALWAYS_REQUIRED: AlwaysSpec[] = [
  { id: "tape-measure-5m", reason: { zh: "全程量測下料與組裝", en: "Measuring from cut list to assembly" } },
  { id: "try-square", reason: { zh: "確認直角與肩線", en: "Check square edges and shoulder lines" } },
  { id: "marking-gauge", reason: { zh: "劃榫頭/榫眼基準線", en: "Mark tenon and mortise reference lines" } },
  { id: "f-clamp-x4", reason: { zh: "膠合時固定零件", en: "Clamp parts during glue-up" } },
  { id: "pva-glue", reason: { zh: "榫接膠合", en: "Glue mortise-and-tenon joints" } },
  { id: "sandpaper-set", reason: { zh: "組裝後表面處理", en: "Surface prep after assembly" } },
  { id: "wood-oil", reason: { zh: "完成後保護表面", en: "Protect the finished surface" } },
];

const JOINERY_TOOLS: Record<JoineryType, JoinerySpec[]> = {
  "through-tenon": [
    { id: "chisel-set-3-6-12", priority: "required", reason: { zh: "鑿通榫榫眼與整修榫頭", en: "Chop the through mortise and pare tenons" } },
    { id: "japanese-saw", priority: "required", reason: { zh: "切榫頰與肩線", en: "Cut tenon cheeks and shoulders" } },
    { id: "all-purpose-saw", priority: "recommended", reason: { zh: "泛用型導付鋸,一把可替代切榫頰與肩線", en: "All-purpose backsaw — covers both cheeks and shoulders" } },
    { id: "flush-cut-saw", priority: "recommended", reason: { zh: "組裝後切平突出的通榫榫頭,不傷木面", en: "Trim through-tenon proud ends flush without scratching the surface" } },
    { id: "mallet", priority: "required", reason: { zh: "敲擊鑿刀", en: "Strike the chisel" } },
    { id: "chisel-canvas-roll", priority: "recommended", reason: { zh: "鑿刀組收納捲包,保護刀刃", en: "Chisel roll — protects edges in storage" } },
  ],
  "blind-tenon": [
    { id: "chisel-set-3-6-12", priority: "required", reason: { zh: "鑿半榫榫眼", en: "Chop the blind mortise" } },
    { id: "japanese-saw", priority: "required", reason: { zh: "切榫頰與肩線", en: "Cut tenon cheeks and shoulders" } },
    { id: "all-purpose-saw", priority: "recommended", reason: { zh: "泛用型導付鋸,一把可替代切榫頰與肩線", en: "All-purpose backsaw — covers both cheeks and shoulders" } },
    { id: "mallet", priority: "required", reason: { zh: "敲擊鑿刀", en: "Strike the chisel" } },
    { id: "chisel-canvas-roll", priority: "recommended", reason: { zh: "鑿刀組收納捲包,保護刀刃", en: "Chisel roll — protects edges in storage" } },
  ],
  "shouldered-tenon": [
    { id: "chisel-set-3-6-12", priority: "required", reason: { zh: "整修肩榫", en: "Pare the shouldered tenon" } },
    { id: "japanese-saw", priority: "required", reason: { zh: "切肩線", en: "Cut the shoulder line" } },
    { id: "all-purpose-saw", priority: "recommended", reason: { zh: "泛用型導付鋸,一把可替代切肩線", en: "All-purpose backsaw — fine for shoulder cuts" } },
    { id: "mallet", priority: "required", reason: { zh: "敲擊鑿刀", en: "Strike the chisel" } },
    { id: "chisel-canvas-roll", priority: "recommended", reason: { zh: "鑿刀組收納捲包,保護刀刃", en: "Chisel roll — protects edges in storage" } },
  ],
  "stub-joint": [
    { id: "chisel-set-3-6-12", priority: "required", reason: { zh: "鑿出寬深榫眼讓整支牙條卡入", en: "Chop a wide-deep mortise to seat the apron" } },
    { id: "mallet", priority: "required", reason: { zh: "敲擊鑿刀", en: "Strike the chisel" } },
    { id: "router-table", priority: "recommended", reason: { zh: "用銑床快速挖槽,比手鑿快數倍", en: "Router-table for fast mortising — many times faster than hand chopping" } },
    { id: "chisel-canvas-roll", priority: "recommended", reason: { zh: "鑿刀組收納捲包,保護刀刃", en: "Chisel roll — protects edges in storage" } },
  ],
  "half-lap": [
    { id: "japanese-saw", priority: "required", reason: { zh: "切搭接深度", en: "Cut to the lap depth" } },
    { id: "all-purpose-saw", priority: "recommended", reason: { zh: "泛用型導付鋸,一把可替代切搭接", en: "All-purpose backsaw — handles lap joints" } },
    { id: "chisel-set-3-6-12", priority: "required", reason: { zh: "整平搭接面", en: "Pare the lap surface flat" } },
    { id: "chisel-canvas-roll", priority: "recommended", reason: { zh: "鑿刀組收納捲包,保護刀刃", en: "Chisel roll — protects edges in storage" } },
  ],
  dovetail: [
    { id: "dovetail-saw", priority: "required", reason: { zh: "切鳩尾的細齒鋸", en: "Fine-tooth saw for dovetail cuts" } },
    { id: "all-purpose-saw", priority: "recommended", reason: { zh: "泛用型導付鋸,極細齒亦可切鳩尾", en: "All-purpose backsaw — extra-fine teeth also cut dovetails" } },
    { id: "dovetail-marker", priority: "required", reason: { zh: "1:6 / 1:8 角度劃線", en: "Lay out 1:6 / 1:8 dovetail angles" } },
    { id: "chisel-set-3-6-12", priority: "required", reason: { zh: "清除鳩尾廢料", en: "Chop out dovetail waste" } },
    { id: "chisel-canvas-roll", priority: "recommended", reason: { zh: "鑿刀組收納捲包,保護刀刃", en: "Chisel roll — protects edges in storage" } },
    { id: "dovetail-jig", priority: "recommended", reason: { zh: "搭配修邊機批量做全透燕尾榫,省手工時間", en: "Router jig for batch through-dovetails — saves hand work" } },
  ],
  "finger-joint": [
    { id: "chisel-set-3-6-12", priority: "required", reason: { zh: "整修指接", en: "Pare the finger joint" } },
    { id: "all-purpose-saw", priority: "recommended", reason: { zh: "泛用型導付鋸,手工切指接", en: "All-purpose backsaw — hand-cut finger joints" } },
    { id: "router-table", priority: "recommended", reason: { zh: "用銑床批量切指", en: "Router-table for batched finger cuts" } },
    { id: "chisel-canvas-roll", priority: "recommended", reason: { zh: "鑿刀組收納捲包,保護刀刃", en: "Chisel roll — protects edges in storage" } },
  ],
  "tongue-and-groove": [
    { id: "groove-plane", priority: "recommended", reason: { zh: "手工開槽", en: "Hand-cut grooves" } },
    { id: "groove-blade", priority: "recommended", reason: { zh: "搭配修邊機 + 開槽直刀,效率最佳", en: "Router + straight grooving bit — most efficient" } },
  ],
  dowel: [
    { id: "dowel-jig", priority: "required", reason: { zh: "確保木釘對齊", en: "Keep dowels aligned" } },
    { id: "drill", priority: "required", reason: { zh: "鑽木釘孔", en: "Drill dowel holes" } },
    { id: "drill-bits", priority: "required", reason: { zh: "搭配電鑽使用", en: "Bits for the drill" } },
    { id: "flush-cut-saw", priority: "recommended", reason: { zh: "組裝後切平突出的木釘,不傷木面", en: "Trim proud dowels flush without scratching the surface" } },
  ],
  "mitered-spline": [
    { id: "japanese-saw", priority: "required", reason: { zh: "精準 45° 切角", en: "Precise 45° miter cut" } },
    { id: "all-purpose-saw", priority: "recommended", reason: { zh: "泛用型導付鋸,一把可替代切 45° 角", en: "All-purpose backsaw — also makes 45° miters" } },
    { id: "groove-blade", priority: "recommended", reason: { zh: "切片榫溝(修邊機 + 開槽直刀)", en: "Cut spline slots (router + grooving bit)" } },
    { id: "magnetic-saw-guide", priority: "recommended", reason: { zh: "磁吸 45° 導引塊,手鋸切角不歪斜", en: "Magnetic 45° guide — keeps the hand saw straight" } },
  ],
  mitered: [
    { id: "japanese-saw", priority: "required", reason: { zh: "精準 45° 切角", en: "Precise 45° miter cut" } },
    { id: "all-purpose-saw", priority: "recommended", reason: { zh: "泛用型導付鋸,一把可替代切 45° 角", en: "All-purpose backsaw — also makes 45° miters" } },
    { id: "miter-box", priority: "recommended", reason: { zh: "斜切箱輔助角度,比目測精準", en: "Miter box keeps the cut true" } },
    { id: "magnetic-saw-guide", priority: "recommended", reason: { zh: "磁吸 45° 導引塊,手鋸切角不歪斜", en: "Magnetic 45° guide — keeps the hand saw straight" } },
  ],
  "pocket-hole": [
    { id: "pocket-hole-jig", priority: "required", reason: { zh: "鑽 15° 斜孔", en: "Drill 15° pocket holes" } },
    { id: "drill", priority: "required", reason: { zh: "鑽孔", en: "Drill the holes" } },
    { id: "drill-bits", priority: "required", reason: { zh: "斜孔專用階梯鑽頭", en: "Pocket-hole step-drill bits" } },
    { id: "tenz-screw-set", priority: "recommended", reason: { zh: "TENZ 星型螺絲省力不咬合,斜孔鎖固專用", en: "TENZ star-drive screws — low cam-out, great for pocket holes" } },
    { id: "countersink-bit", priority: "recommended", reason: { zh: "螺絲頭埋進木面不外露,正面更光潔", en: "Countersink the head flush — cleaner show face" } },
  ],
  screw: [
    { id: "drill", priority: "required", reason: { zh: "鑽先導孔與鎖螺絲", en: "Pilot-drill and drive screws" } },
    { id: "drill-bits", priority: "required", reason: { zh: "搭配電鑽", en: "Bits for the drill" } },
    { id: "tenz-screw-set", priority: "recommended", reason: { zh: "TENZ 星型螺絲省力不咬合", en: "TENZ star-drive screws — low cam-out" } },
    { id: "countersink-bit", priority: "recommended", reason: { zh: "螺絲頭埋進木面不外露", en: "Countersink the head flush" } },
    { id: "hand-drill-brace", priority: "optional", reason: { zh: "手搖鑽手動鎖固,無電源也能裝", en: "Hand brace — drive screws without power" } },
  ],
};

const POWER_TOOL_IDS = [
  "router-table",
  "drill",
  "drill-bits",
  "dowel-jig",
  "pocket-hole-jig",
  "groove-blade",
];

const SHARPENABLE_IDS = ["chisel-set-3-6-12", "chisel-hardwood", "groove-plane"];

const EXTRA_REASONS = {
  hardwoodChisel: { zh: "白橡等硬木需高硬度鑿刀,普通鑿刀易崩刃", en: "Hardwoods like white oak need hardened chisels — standard ones chip" },
  hardwoodCoarseSand: { zh: "硬木刨後需 60 番去除刨痕", en: "Hardwood after planing needs 60-grit to remove plane marks" },
  longClamp: { zh: "長型家具膠合需大尺寸夾具", en: "Long furniture glue-ups need large clamps" },
  concealedHinge: { zh: "櫃門可選用隱藏鉸鏈", en: "Cabinet doors may use concealed hinges" },
  markingKnife: { zh: "SK5 雙刃劃線刀,比鉛筆精準十倍,榫接對位專用", en: "SK5 double-edged marking knife — ten times more precise than a pencil for joinery layout" },
  maskingTape: { zh: "弱黏紙膠帶,膠合防溢膠、塗裝遮邊、面板保護萬用", en: "Low-tack masking tape — squeeze-out, paint edges, panel protection" },
  benchVise: { zh: "快速虎鉗,鑿榫／鋸切時鎖緊零件比 F 夾穩", en: "Quick-release vise — steadier than F-clamps when chopping or sawing" },
  glueTray: { zh: "矽膠托盤＋滾筒刷,膠水乾掉一撕即淨,比紙杯衛生", en: "Silicone tray + roller — peel cured glue off cleanly, beats paper cups" },
  glueBox: { zh: "矽膠膠水盒,膠水可儲存重複用,比拋棄式環保", en: "Silicone glue box — store and reuse glue, less waste than disposables" },
  sharpening: { zh: "鑿刀／鉋刀定角開刃,搭配磨刀石使用", en: "Fixed-angle sharpening jig for chisels / plane blades — pairs with a waterstone" },
  lubricant: { zh: "帶鋸／台鋸／平刨台面防鏽＋離型,推料順暢", en: "Rust prevention + release for bandsaw / table saw / jointer tables — feeds smoother" },
  routerEngraving: { zh: "修邊機加底座做圓弧／龜甲紋雕刻裝飾", en: "Router base for arc / honeycomb decorative carving" },
};

export function deriveRequiredTools(
  design: FurnitureDesign,
  locale: string = "zh-TW",
): RequiredTool[] {
  const map = new Map<string, RequiredTool>();

  const add = (id: string, priority: ToolPriority, reason: ReasonPair) => {
    const tool = TOOL_CATALOG[id];
    if (!tool) return;
    const existing = map.get(id);
    if (!existing) {
      map.set(id, { tool, priority, reason: pickReason(reason, locale) });
      return;
    }
    if (PRIORITY_RANK[priority] < PRIORITY_RANK[existing.priority]) {
      map.set(id, { tool, priority, reason: pickReason(reason, locale) });
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
    add("chisel-hardwood", "required", EXTRA_REASONS.hardwoodChisel);
    add("sandpaper-coarse-60", "required", EXTRA_REASONS.hardwoodCoarseSand);
  }

  const longSpan =
    design.overall.length > 1200 ||
    design.category === "dining-table" ||
    design.category === "desk" ||
    design.category === "bench";
  if (longSpan) {
    add("long-clamp-x2", "required", EXTRA_REASONS.longClamp);
  }

  if (
    design.category === "chest-of-drawers" ||
    design.category === "shoe-cabinet" ||
    design.category === "display-cabinet" ||
    design.category === "media-console" ||
    design.category === "nightstand" ||
    design.category === "wardrobe"
  ) {
    add("concealed-hinge", "optional", EXTRA_REASONS.concealedHinge);
  }

  add("marking-knife", "recommended", EXTRA_REASONS.markingKnife);
  add("masking-tape-low-tack", "recommended", EXTRA_REASONS.maskingTape);
  add("quick-bench-vise", "recommended", EXTRA_REASONS.benchVise);
  add("glue-tray-set", "recommended", EXTRA_REASONS.glueTray);
  add("silicone-glue-box", "recommended", EXTRA_REASONS.glueBox);

  if (SHARPENABLE_IDS.some((id) => map.has(id))) {
    add("sharpening-jig", "recommended", EXTRA_REASONS.sharpening);
  }
  if (POWER_TOOL_IDS.some((id) => map.has(id))) {
    add("silicone-lubricant", "recommended", EXTRA_REASONS.lubricant);
  }
  if (
    design.category === "chinese-cabinet" ||
    design.category === "display-cabinet"
  ) {
    add("router-engraving-base", "optional", EXTRA_REASONS.routerEngraving);
  }

  return Array.from(map.values()).sort((a, b) => {
    const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (pr !== 0) return pr;
    return a.tool.category.localeCompare(b.tool.category);
  });
}
