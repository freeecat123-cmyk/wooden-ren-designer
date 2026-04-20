import type { FurnitureDesign, JoineryType } from "@/lib/types";
import { calculateCutDimensions } from "@/lib/geometry/cut-dimensions";
import { extractJoineryUsages } from "@/lib/joinery/extract";
import { JOINERY_LABEL } from "@/lib/joinery/details";
import { MATERIALS } from "@/lib/materials";

export type StepPhase =
  | "prepare"
  | "mark"
  | "cut-stock"
  | "cut-joinery"
  | "fit"
  | "glue"
  | "sand"
  | "finish";

export const PHASE_LABEL: Record<StepPhase, string> = {
  prepare: "備料",
  mark: "劃線",
  "cut-stock": "切料",
  "cut-joinery": "鋸鑿榫卯",
  fit: "試組",
  glue: "膠合",
  sand: "砂磨",
  finish: "塗裝",
};

export interface BuildStep {
  id: string;
  phase: StepPhase;
  title: string;
  description: string;
  /** TOOL_CATALOG ids referenced by this step */
  toolIds: string[];
  /** design.parts ids this step touches */
  partIds?: string[];
  estimatedMinutes?: number;
  warnings?: string[];
}

/** Tools needed for cutting a given joinery type. */
const JOINERY_CUT_TOOLS: Record<JoineryType, string[]> = {
  "through-tenon": ["japanese-saw", "chisel-set-3-6-12", "mallet"],
  "blind-tenon": ["japanese-saw", "chisel-set-3-6-12", "mallet"],
  "shouldered-tenon": ["japanese-saw", "chisel-set-3-6-12", "mallet"],
  "half-lap": ["japanese-saw", "chisel-set-3-6-12"],
  dovetail: ["dovetail-saw", "dovetail-marker", "chisel-fine"],
  "finger-joint": ["chisel-set-3-6-12", "router-table"],
  "tongue-and-groove": ["trim-router", "groove-plane"],
  dowel: ["dowel-jig", "drill", "drill-bits"],
  "mitered-spline": ["miter-saw", "groove-blade"],
  "pocket-hole": ["pocket-hole-jig", "drill", "drill-bits"],
  screw: ["drill", "drill-bits"],
};

export function deriveBuildSteps(design: FurnitureDesign): BuildStep[] {
  const steps: BuildStep[] = [];
  const material = MATERIALS[design.primaryMaterial];
  const joineryUsages = extractJoineryUsages(design);
  const isHardwood = material.hardness >= 5000;
  const isLong = design.overall.length > 1200;

  // 1. 備料（檢查木料、含水率、選紋）
  steps.push({
    id: "step-01-prepare",
    phase: "prepare",
    title: "選料與準備",
    description:
      `選用 ${material.nameZh} 板材，檢查含水率（建議 12% 以下）、是否有節疤、` +
      `應力釋放是否完成。依材料單預留 5–10% 切料損耗。`,
    toolIds: ["tape-measure-5m"],
    estimatedMinutes: 30,
    warnings: isHardwood
      ? ["白橡等硬木質地堅硬，刀具務必磨利再進行加工，避免崩刃。"]
      : undefined,
  });

  // 2. 切料（每個零件依含榫頭尺寸下料）
  const totalParts = design.parts.length;
  steps.push({
    id: "step-02-cut-stock",
    phase: "cut-stock",
    title: `切料 ${totalParts} 件`,
    description:
      `依材料單的「切料尺寸」鋸出 ${totalParts} 件。注意：含榫零件的切料長度` +
      `已包含榫頭凸出量，請勿再額外加長。鋸切後逐件編號對應材料單。`,
    toolIds: [
      "tape-measure-5m",
      "pencil",
      "try-square",
      "japanese-saw",
      ...(isHardwood ? ["tungsten-blade"] : []),
    ],
    partIds: design.parts.map((p) => p.id),
    estimatedMinutes: 20 * totalParts,
    warnings: ["切料前一定再核對一次材料單尺寸，鋸下去就回不去。"],
  });

  // 3. 劃線
  if (joineryUsages.length > 0) {
    steps.push({
      id: "step-03-mark",
      phase: "mark",
      title: "榫卯劃線",
      description:
        `依榫卯細節圖在每個零件上劃出榫頭與榫眼位置：` +
        joineryUsages
          .map((u) => `${JOINERY_LABEL[u.type]} × ${u.count} 處`)
          .join("、") +
        `。所有同類型榫卯一次劃完，避免來回切換工具。`,
      toolIds: [
        "marking-gauge",
        "try-square",
        "pencil",
        ...(joineryUsages.some((u) => u.type === "dovetail")
          ? ["dovetail-marker"]
          : []),
      ],
      estimatedMinutes: 15 * joineryUsages.length,
      warnings: [
        "劃線一律用劃線規/小刀，不要只靠鉛筆——鉛筆有寬度，會差 0.3mm。",
      ],
    });
  }

  // 4. 鋸鑿榫卯（依不同榫卯類型分步）
  for (let i = 0; i < joineryUsages.length; i++) {
    const u = joineryUsages[i];
    steps.push({
      id: `step-04-${i + 1}-${u.type}`,
      phase: "cut-joinery",
      title: `製作 ${JOINERY_LABEL[u.type]}（${u.count} 處）`,
      description:
        `榫頭尺寸 ${u.tenon.length} × ${u.tenon.width} × ${u.tenon.thickness} mm，` +
        `對應母件厚度約 ${u.estimatedMotherThickness} mm。` +
        `先做榫頭再做榫眼，最後試插。鋸切時鋸線留在廢料側，鑿削時分多次淺鑿。`,
      toolIds: [
        ...JOINERY_CUT_TOOLS[u.type],
        ...(isHardwood &&
        (u.type === "through-tenon" ||
          u.type === "blind-tenon" ||
          u.type === "shouldered-tenon")
          ? ["chisel-hardwood"]
          : []),
      ],
      estimatedMinutes: 25 * u.count,
      warnings:
        u.type === "through-tenon"
          ? ["通榫穿透母件，正反兩面都要對齊鑿，避免崩裂。"]
          : undefined,
    });
  }

  // 5. 試組
  steps.push({
    id: "step-05-fit",
    phase: "fit",
    title: "乾組試裝",
    description:
      `不上膠先把所有榫卯試插一次，確認：（1）榫頭能順利進入榫眼但不過鬆；` +
      `（2）整體方正、無扭歪；（3）肩線密合無縫隙。緊的地方用鑿刀微調榫頭` +
      `（不要修榫眼）。`,
    toolIds: ["mallet", "chisel-set-3-6-12", "try-square"],
    estimatedMinutes: 20,
    warnings: [
      "若榫頭太緊硬敲，膠合時膨脹會把母件撐裂——寧鬆勿緊，留 0.1mm 膠縫。",
    ],
  });

  // 6. 膠合
  steps.push({
    id: "step-06-glue",
    phase: "glue",
    title: "上膠夾合",
    description:
      `PVA 木工膠塗在榫頭與榫眼內壁（薄薄一層即可），` +
      `按試組順序組裝，依序夾緊。靜置 24 小時完全固化。` +
      `組裝順序建議：先做小組件（如腳架）→ 再合大件。`,
    toolIds: [
      "pva-glue",
      "f-clamp-x4",
      ...(isLong ? ["long-clamp-x2"] : []),
      "try-square",
    ],
    estimatedMinutes: 45,
    warnings: [
      "膠合時間有限（PVA 開放時間約 10 分鐘），先把所有夾具預備好再開膠。",
      "夾合後立刻用濕布擦掉溢膠，乾掉後會吃不上塗料。",
    ],
  });

  // 7. 砂磨
  steps.push({
    id: "step-07-sand",
    phase: "sand",
    title: "砂磨表面",
    description:
      `按砂紙番數遞進：${isHardwood ? "60 → " : ""}120 → 240 → 400。` +
      `每換一次砂紙都要把上一道的痕跡完全磨掉再進下一道。` +
      `砂磨方向順木紋，避免逆紋產生橫向刮痕。`,
    toolIds: [
      "sandpaper-set",
      ...(isHardwood ? ["sandpaper-coarse-60"] : []),
    ],
    estimatedMinutes: 60,
  });

  // 8. 上油
  steps.push({
    id: "step-08-finish",
    phase: "finish",
    title: "上護木油",
    description:
      `用棉布薄塗護木油，靜置 15 分鐘讓木材吸收，再用乾淨棉布擦掉多餘的油。` +
      `等 24 小時乾燥後用 0000 號鋼絲絨輕磨，再塗第二層。建議 2–3 層。`,
    toolIds: ["wood-oil"],
    estimatedMinutes: 30,
    warnings: [
      "沾油的棉布會自燃！使用後攤開晾乾或浸水後丟棄，不要揉成一團。",
    ],
  });

  return steps;
}

export function totalEstimatedHours(steps: BuildStep[]): number {
  const min = steps.reduce((s, st) => s + (st.estimatedMinutes ?? 0), 0);
  return Math.round((min / 60) * 10) / 10;
}
