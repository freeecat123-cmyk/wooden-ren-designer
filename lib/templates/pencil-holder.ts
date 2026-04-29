import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { buildBox } from "./_builders/box-builder";

export const pencilHolderOptions: OptionSpec[] = [
  { group: "structure", type: "number", key: "wallThickness", label: "壁厚 (mm)", defaultValue: 8, min: 5, max: 15, step: 1, unit: "mm" },
  { group: "structure", type: "number", key: "bottomThickness", label: "底厚 (mm)", defaultValue: 8, min: 5, max: 15, step: 1, unit: "mm" },
  { group: "structure", type: "select", key: "cornerJoinery", label: "角接合方式", defaultValue: "stub-joint", choices: [
    { value: "stub-joint", label: "搭接（rabbet，最簡單）" },
    { value: "finger-joint", label: "指接（finger joint，外露指狀）" },
    { value: "miter", label: "斜角拼（45°，最隱形但要對齊）" },
  ] },
  { group: "structure", type: "number", key: "dividers", label: "縱向隔板數", defaultValue: 0, min: 0, max: 5, step: 1, help: "0 = 整空；1-5 沿長邊方向加直立隔板（垂直 length 軸）" },
  { group: "structure", type: "number", key: "crossDividers", label: "橫向隔板數", defaultValue: 0, min: 0, max: 5, step: 1, help: "0 = 沒有；1-5 沿短邊方向加隔板（跟縱向組合可形成 grid 網格）" },
];

/**
 * 筆筒 — 5 片板組成的方盒（4 壁 + 底）
 * input: 外尺寸（長×寬×高）
 */
export const pencilHolder: FurnitureTemplate = (input): FurnitureDesign => {
  const { length: outerL, width: outerW, height: outerH, material } = input;
  const o = pencilHolderOptions;
  const wallT = getOption<number>(input, opt(o, "wallThickness"));
  const botT = getOption<number>(input, opt(o, "bottomThickness"));
  const cornerJoinery = getOption<string>(input, opt(o, "cornerJoinery")) as
    | "stub-joint"
    | "finger-joint"
    | "miter";
  const dividers = getOption<number>(input, opt(o, "dividers"));
  const crossDividers = getOption<number>(input, opt(o, "crossDividers"));

  const built = buildBox({
    outerL,
    outerW,
    outerH,
    wallT,
    botT,
    material,
    cornerJoinery: cornerJoinery === "miter" ? "stub-joint" : cornerJoinery,
    bottomFit: "grooved",
  });

  // 斜接 (miter) 的下料規則：4 片壁都用「全外尺寸」下料、兩端 45° 斜切，
  // 不像 stub-joint 那樣 2 長 (outerL) + 2 短 (innerW)。
  // 我們繼續用 stub-joint 幾何畫 3D（避免角落破面），但 cut list 必須反映 miter
  // 的實際下料：覆寫 visible.length + 清掉 stub 的 tenon allowance。
  if (cornerJoinery === "miter") {
    for (const part of built.parts) {
      if (part.id === "wall-front" || part.id === "wall-back") {
        part.visible = { ...part.visible, length: outerL };
        part.tenons = [];
      } else if (part.id === "wall-left" || part.id === "wall-right") {
        part.visible = { ...part.visible, length: outerW };
        part.tenons = [];
      }
    }
  }

  // 加內部直立隔板（縱向：沿 length 軸切，跟長邊垂直）
  const dividerParts: typeof built.parts = [];
  const dividerThick = wallT - 2;
  if (dividers > 0) {
    const dividerSpacing = built.innerL / (dividers + 1);
    for (let i = 1; i <= dividers; i++) {
      dividerParts.push({
        id: `divider-${i}`,
        nameZh: `縱向隔板 ${i}`,
        material,
        grainDirection: "length",
        visible: { length: built.innerW, width: outerH - botT, thickness: dividerThick },
        origin: {
          x: -built.innerL / 2 + i * dividerSpacing,
          y: botT,
          z: 0,
        },
        rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
        tenons: [],
        mortises: [],
      });
    }
  }
  // 橫向隔板（沿 width 軸切，跟短邊垂直）
  if (crossDividers > 0) {
    const dividerSpacing = built.innerW / (crossDividers + 1);
    for (let i = 1; i <= crossDividers; i++) {
      dividerParts.push({
        id: `cross-divider-${i}`,
        nameZh: `橫向隔板 ${i}`,
        material,
        grainDirection: "length",
        visible: { length: built.innerL, width: outerH - botT, thickness: dividerThick },
        origin: {
          x: 0,
          y: botT,
          z: -built.innerW / 2 + i * dividerSpacing,
        },
        rotation: { x: Math.PI / 2, y: 0, z: 0 },
        tenons: [],
        mortises: [],
      });
    }
  }

  const design: FurnitureDesign = {
    id: `pencil-holder-${outerL}x${outerW}x${outerH}`,
    category: "pencil-holder",
    nameZh: "筆筒",
    overall: { length: outerL, width: outerW, thickness: outerH },
    parts: [...built.parts, ...dividerParts],
    defaultJoinery: cornerJoinery === "miter" ? "stub-joint" : cornerJoinery,
    primaryMaterial: material,
    notes: `筆筒 ${outerL}×${outerW}×${outerH}mm，${5 + dividers + crossDividers} 片實木組成。底板用槽接嵌入 4 壁內側下緣，4 角採${cornerJoinery === "finger-joint" ? "**指接**（外露指狀視覺，新手練習指接的最佳對象）" : cornerJoinery === "miter" ? "**斜角拼**（45° 對接，最隱形但需 45° 鋸台或斜切片切，膠合 + 細釘加固）" : "**搭接**（rabbet，最簡單，膠合即可）"}。內部 ${built.innerL}×${built.innerW}mm 約可放 ${Math.max(0, Math.floor((built.innerL * built.innerW) / 100))} 支筆。${dividers > 0 ? ` 內部縱向 ${dividers} 片隔板。` : ""}${crossDividers > 0 ? ` 橫向 ${crossDividers} 片隔板。` : ""}${dividers > 0 && crossDividers > 0 ? ` grid 網格分 ${(dividers + 1) * (crossDividers + 1)} 區。` : ""}`,
  };

  if (built.warnings.length) design.warnings = [...built.warnings];
  // 結構檢查 + max bounds
  const warnings: string[] = [];
  if (outerL > 200 || outerW > 200 || outerH > 250) {
    warnings.push(`筆筒 ${outerL}×${outerW}×${outerH}mm 超過合理範圍（max 200×200×250mm）。再大就比較像鳩尾盒——考慮改用鳩尾盒模板`);
    design.suggestions = [{
      text: `${outerL}×${outerW}×${outerH}mm 已超過筆筒範圍——鳩尾盒模板支援更大的盒體 + 鳩尾接合選項。`,
      suggestedCategory: "dovetail-box",
      presetParams: { length: String(outerL), width: String(outerW), height: String(outerH), material },
    }];
  }
  if (warnings.length) design.warnings = [...(design.warnings ?? []), ...warnings];
  return design;
};
