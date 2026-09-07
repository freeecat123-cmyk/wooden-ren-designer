import type { OptionSpec } from "@/lib/types";
import { GROUP_META, type GroupMeta } from "./option-groups";

export const WORKBENCH_GROUP_KEYS = {
  structure: ["benchStyle", "materialStyle", "heightMode", "userHeightCm", "sawTableHeightMm", "roomLengthCm", "roomWidthCm", "constructionVersion"],
  top: ["plyTopLayers", "topThickness", "topBuild", "topSplit", "gapWidth", "wellWidth", "wellDepth", "endOverhang", "frontOverhang", "topBattens", "battenWidth", "battenThickness", "battenLayers", "breadboardEnds"],
  base: ["legLayers", "lsLayers", "plyLegBuild", "legSize", "legDepth", "legTopJoint", "withApron", "apronWidth", "apronThickness", "withLowerStretchers", "lowerStretcherArrangement", "lowerStretcherWidth", "lowerStretcherThickness", "lowerStretcherHeight", "legPenetratingTenon", "knockdown"],
  vises: ["frontVise", "frontViseSize", "viseInset", "viseSide", "endVise", "deadman", "doubleSided"],
  storage: ["withUnderShelf", "drawerCount", "drawerCols"],
  machining: ["legHoles", "dogHoles", "dogHoleDia", "dogHolePitch", "dogHoleFrontOffset", "holdfastHoles"],
} as const;

type WorkbenchGroup = keyof typeof WORKBENCH_GROUP_KEYS;
const META: Record<WorkbenchGroup, GroupMeta> = {
  structure: { ...GROUP_META.structure, labelZh: "尺寸 / 結構", labelEn: "Dimensions / Structure" },
  top: { ...GROUP_META.top, labelZh: "桌面", labelEn: "Top" },
  base: { ...GROUP_META.leg, labelZh: "底座", labelEn: "Base" },
  vises: { ...GROUP_META.workholding, labelZh: "鉗具 / 工件固定", labelEn: "Vises / Workholding" },
  storage: { ...GROUP_META.drawer, labelZh: "收納", labelEn: "Storage" },
  machining: { ...GROUP_META.misc, labelZh: "孔位 / 加工", labelEn: "Holes / Machining" },
};
const GROUPS = Object.keys(WORKBENCH_GROUP_KEYS) as WorkbenchGroup[];
const GROUP_BY_KEY = new Map<string, WorkbenchGroup>(GROUPS.flatMap((group) => WORKBENCH_GROUP_KEYS[group].map((key) => [key, group] as const)));

/** Presentation only: preserve schema identity, order, defaults and dependencies. */
export function groupWorkbenchSpecs(specs: OptionSpec[]) {
  const buckets = new Map<WorkbenchGroup, OptionSpec[]>();
  for (const spec of specs) {
    const group = GROUP_BY_KEY.get(spec.key) ?? "structure";
    const bucket = buckets.get(group) ?? [];
    bucket.push(spec);
    buckets.set(group, bucket);
  }
  return GROUPS.flatMap((group) => {
    const items = buckets.get(group);
    return items?.length ? [{ group, meta: META[group], specs: items }] : [];
  });
}
