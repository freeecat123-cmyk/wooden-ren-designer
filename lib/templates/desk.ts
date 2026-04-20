import type { FurnitureTemplate, OptionSpec, Part } from "@/lib/types";
import { getOption } from "@/lib/types";
import { simpleTable } from "./_builders/simple-table";

export const deskOptions: OptionSpec[] = [
  { type: "select", key: "legShape", label: "桌腳樣式", defaultValue: "box", choices: [
    { value: "box", label: "直腳（方料）" },
    { value: "tapered", label: "錐形腳" },
  ] },
  { type: "number", key: "legSize", label: "桌腳粗 (mm)", defaultValue: 55, min: 20, max: 120, step: 2 },
  { type: "number", key: "topThickness", label: "桌面厚 (mm)", defaultValue: 28, min: 12, max: 60, step: 2 },
  { type: "number", key: "apronWidth", label: "牙板高 (mm)", defaultValue: 90, min: 30, max: 200, step: 5 },
  { type: "number", key: "apronThickness", label: "牙板厚 (mm)", defaultValue: 25, min: 10, max: 50, step: 2 },
  { type: "number", key: "topOverhang", label: "桌面外伸 (mm)", defaultValue: 30, min: 0, max: 300, step: 5 },
  { type: "checkbox", key: "withCenterStretcher", label: "中央橫撐", defaultValue: true },
  { type: "checkbox", key: "withLowerStretchers", label: "下橫撐", defaultValue: false },
  { type: "number", key: "drawerCount", label: "懸吊抽屜數", defaultValue: 0, min: 0, max: 3, step: 1, help: "桌面下掛一組抽屜櫃（0 = 無）" },
  { type: "select", key: "drawerSide", label: "抽屜位置", defaultValue: "right", choices: [
    { value: "left", label: "左側" },
    { value: "right", label: "右側" },
    { value: "center", label: "中央（窄型）" },
  ] },
  { type: "number", key: "legInset", label: "桌腳內縮 (mm)", defaultValue: 0, min: 0, max: 400, step: 5 },
];

export const desk: FurnitureTemplate = (input) => {
  const legShape = getOption<string>(input, deskOptions[0]);
  const legSize = getOption<number>(input, deskOptions[1]);
  const topThickness = getOption<number>(input, deskOptions[2]);
  const apronWidth = getOption<number>(input, deskOptions[3]);
  const apronThickness = getOption<number>(input, deskOptions[4]);
  const topOverhang = getOption<number>(input, deskOptions[5]);
  const withCenterStretcher = getOption<boolean>(input, deskOptions[6]);
  const withLowerStretchers = getOption<boolean>(input, deskOptions[7]);
  const drawerCount = getOption<number>(input, deskOptions[8]);
  const drawerSide = getOption<string>(input, deskOptions[9]);
  const legInset = getOption<number>(input, deskOptions[10]);

  const design = simpleTable({
    category: "desk",
    nameZh: "書桌",
    length: input.length,
    width: input.width,
    height: input.height,
    material: input.material,
    legSize,
    topThickness,
    apronWidth,
    apronThickness,
    topOverhang,
    withCenterStretcher: withCenterStretcher && drawerCount === 0,
    withLowerStretchers,
    legInset,
    legShape: legShape === "tapered" ? "tapered" : "box",
    notes: `書桌：桌腳 ${legSize}mm${legShape === "tapered" ? "（錐形）" : ""}、牙板 ${apronWidth}×${apronThickness}mm${drawerCount > 0 ? `、${drawerSide === "center" ? "中央" : drawerSide === "left" ? "左側" : "右側"}懸吊 ${drawerCount} 抽屜` : ""}。`,
  });

  if (drawerCount > 0) {
    const legHeight = input.height - topThickness;
    const caseW = drawerSide === "center"
      ? Math.min(400, input.length * 0.4)
      : Math.min(450, (input.length - 2 * legSize) * 0.4);
    const caseH = Math.min(legHeight * 0.55, drawerCount * 120 + 40);
    const caseD = input.width - 40;
    const caseY = legHeight - caseH;
    const sideT = 15;
    const caseX = drawerSide === "center"
      ? 0
      : drawerSide === "left"
      ? -(input.length / 2 - legSize - caseW / 2 - 20)
      : (input.length / 2 - legSize - caseW / 2 - 20);

    const drawers: Part[] = [];
    const slotH = caseH / drawerCount;
    const frontT = 15;
    for (let i = 0; i < drawerCount; i++) {
      drawers.push({
        id: `desk-drawer-${i + 1}-front`,
        nameZh: `懸吊抽屜${i + 1} 面板`,
        material: input.material,
        grainDirection: "length",
        visible: { length: caseW - 4, width: slotH - 6, thickness: frontT },
        origin: { x: caseX, y: caseY + i * slotH + 3, z: -input.width / 2 + frontT / 2 },
        rotation: { x: Math.PI / 2, y: 0, z: 0 },
        tenons: [],
        mortises: [],
      });
    }

    // 懸吊抽屜箱左右側板
    const sides: Part[] = [-1, 1].map((s) => ({
      id: `desk-drawer-side-${s < 0 ? "left" : "right"}`,
      nameZh: `懸吊抽屜${s < 0 ? "左" : "右"}側板`,
      material: input.material,
      grainDirection: "length",
      visible: { length: caseD, width: caseH, thickness: sideT },
      origin: { x: caseX + s * (caseW / 2 - sideT / 2), y: caseY, z: 0 },
      rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
      tenons: [],
      mortises: [],
    }));

    // 頂板（與桌面黏合）
    design.parts.push({
      id: "desk-drawer-top",
      nameZh: "懸吊抽屜頂板",
      material: input.material,
      grainDirection: "length",
      visible: { length: caseW, width: caseD, thickness: sideT },
      origin: { x: caseX, y: caseY + caseH - sideT, z: 0 },
      tenons: [],
      mortises: [],
    });
    design.parts.push(...sides, ...drawers);
  }

  return design;
};
