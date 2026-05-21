import type {
  FurnitureDesign,
  FurnitureTemplate,
  OptionSpec,
  Part,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";
import { buildBox } from "./_builders/box-builder";
import { polygonStaves } from "./_builders/polygon-stave-builder";

/** 使用情境 preset — exported 以便 lib/templates/index.ts applyPresets 用 */
export interface PencilHolderPresetConfig {
  bodyShape?: "rect" | "hex" | "oct";
  wallThickness?: number;
  bottomThickness?: number;
  bottomAttach?: "seated" | "inset-panel" | "flush-glued";
  cornerJoinery?: string;
  dividers?: number;
  crossDividers?: number;
  dividerInset?: number;
  polygonDividerStyle?: "none" | "single" | "cross";
}
export const PENCIL_HOLDER_PRESETS: Record<string, PencilHolderPresetConfig> = {
  // 1. 簡約方筒：入門款，純筒整空，搭接最快上手
  classic: {
    bodyShape: "rect", wallThickness: 8, bottomThickness: 8,
    bottomAttach: "seated", cornerJoinery: "stub-joint",
    dividers: 0, crossDividers: 0, dividerInset: 0,
  },
  // 2. 文具 grid 站：6 格分剪刀/筆/刀片，指接 + dado 嵌入隔板（pro 視覺）
  "stationery-grid": {
    bodyShape: "rect", wallThickness: 10, bottomThickness: 10,
    bottomAttach: "seated", cornerJoinery: "finger-joint",
    dividers: 2, crossDividers: 1, dividerInset: 3,
  },
  // 3. 化妝刷筒：深方筒 + 1 縱向隔板分前後區
  "makeup-brush": {
    bodyShape: "rect", wallThickness: 10, bottomThickness: 10,
    bottomAttach: "seated", cornerJoinery: "stub-joint",
    dividers: 1, crossDividers: 0, dividerInset: 0,
  },
  // 4. 木工工具盒：9 格分裝尺/筆/夾子，厚壁鑲板入溝防變形
  "woodworker-caddy": {
    bodyShape: "rect", wallThickness: 12, bottomThickness: 12,
    bottomAttach: "inset-panel", cornerJoinery: "finger-joint",
    dividers: 2, crossDividers: 2, dividerInset: 3,
  },
  // 5. 六角茶葉筒：hex + 鑲板入溝、整空整面、季節伸縮免裂
  "hex-tea-canister": {
    bodyShape: "hex", wallThickness: 10, bottomThickness: 10,
    bottomAttach: "inset-panel", cornerJoinery: "stub-joint",
    polygonDividerStyle: "none", dividerInset: 0,
  },
  // 6. 八角十字筒：oct + 十字穿心、整塊膠合底齊邊
  "oct-crossed": {
    bodyShape: "oct", wallThickness: 10, bottomThickness: 10,
    bottomAttach: "flush-glued", cornerJoinery: "stub-joint",
    polygonDividerStyle: "cross", dividerInset: 3,
  },
};

export const pencilHolderOptions: OptionSpec[] = [
  { group: "structure", type: "select", key: "bodyShape", label: "筒身形狀", defaultValue: "rect", choices: [
    { value: "rect", label: "方筒（4 壁，最簡單）" },
    { value: "hex", label: "六角筒（6 段拼接）" },
    { value: "oct", label: "八角筒（8 段拼接）" },
  ], help: "六/八角款用 stave 拼接（取 length/width 較小邊為直徑）；方筒以外不支援 dividers" },
  { group: "preset", type: "select", key: "useCase", label: "使用情境預設", defaultValue: "custom", choices: [
    { value: "custom", label: "自訂（不套 preset）" },
    { value: "classic", label: "簡約方筒（搭接整空，入門款）" },
    { value: "stationery-grid", label: "文具 grid 站（方筒 + 指接 + 6 格 + dado）" },
    { value: "makeup-brush", label: "化妝刷筒（方筒 + 1 縱向隔板）" },
    { value: "woodworker-caddy", label: "木工工具盒（方筒 + 9 格 + 鑲板入溝）" },
    { value: "hex-tea-canister", label: "六角茶葉筒（hex + 鑲板入溝整空）" },
    { value: "oct-crossed", label: "八角十字筒（oct + 十字穿心 + 齊邊膠合）" },
  ], help: "強制套用該情境的形狀 / 接合 / 底板裝法 / 隔板組合；要自訂請先切到「自訂（不套 preset）」。" },
  { group: "structure", type: "number", key: "wallThickness", label: "壁厚 (mm)", defaultValue: 8, min: 5, max: 15, step: 1, unit: "mm" },
  { group: "structure", type: "number", key: "bottomThickness", label: "底厚 (mm)", defaultValue: 8, min: 5, max: 15, step: 1, unit: "mm" },
  { group: "structure", type: "select", key: "bottomAttach", label: "底板接法", defaultValue: "seated", choices: [
    { value: "seated", label: "底板坐地 + 壁圍上方（原本，膠合最簡單）" },
    { value: "inset-panel", label: "鑲板入溝（像抽屜底板，4 壁開槽嵌入）" },
    { value: "flush-glued", label: "整塊黏上去（底板與外框齊邊）" },
  ], help: "seated=底板比框內小一圈坐地、壁立其上；inset-panel=4 壁內側下緣開 5mm 槽、底板浮嵌（季節伸縮免裂）；flush-glued=底板整塊外緣齊邊、強力膠合。", wide: true },
  { group: "structure", type: "select", key: "cornerJoinery", label: "角接合方式", defaultValue: "stub-joint", choices: [
    { value: "stub-joint", label: "搭接（rabbet，最簡單）" },
    { value: "finger-joint", label: "指接（finger joint，外露指狀）" },
    { value: "miter", label: "斜角拼（45°，最隱形但要對齊）" },
  ], dependsOn: { key: "bodyShape", equals: "rect" }, help: "六/八角筒固定 miter-spline 端面斜接，不需要選擇。" },
  { group: "structure", type: "number", key: "dividers", label: "縱向隔板數", defaultValue: 0, min: 0, max: 5, step: 1, help: "0 = 整空；1-5 沿長邊方向加直立隔板（垂直 length 軸）", dependsOn: { key: "bodyShape", equals: "rect" } },
  { group: "structure", type: "number", key: "crossDividers", label: "橫向隔板數", defaultValue: 0, min: 0, max: 5, step: 1, help: "0 = 沒有；1-5 沿短邊方向加隔板（跟縱向組合可形成 grid 網格）", dependsOn: { key: "bodyShape", equals: "rect" } },
  { group: "structure", type: "number", key: "dividerThickness", label: "隔板厚度 (mm)", defaultValue: 6, min: 3, max: 15, step: 1, unit: "mm", help: "預設跟著「壁厚的一半」（壁 8mm→隔板 4mm、壁 12mm→6mm）。改數字才覆寫。" },
  { group: "structure", type: "number", key: "dividerHeight", label: "隔板高度 (mm)", defaultValue: 0, min: 0, max: 500, step: 1, unit: "mm", help: "0 = 自動填滿（從底板到頂）。手動指定可矮於壁高，讓筆桿露出來。" },
  { group: "structure", type: "number", key: "dividerInset", label: "隔板嵌入深度 (mm)", defaultValue: 0, min: 0, max: 15, step: 1, unit: "mm", help: "0 = 跟壁齊；設 3mm = 隔板兩端各延伸 3mm 進壁內側溝槽（dado joint，壁內側要銑對應槽）。方筒 / 六角 / 八角通用。" },
  { group: "structure", type: "select", key: "polygonDividerStyle", label: "多邊形隔板", defaultValue: "none", choices: [
    { value: "none", label: "無隔板" },
    { value: "single", label: "單片直徑（穿過中心）" },
    { value: "cross", label: "十字（2 片穿過中心交叉）", dependsOn: { key: "bodyShape", equals: "oct" } },
  ], dependsOn: { key: "bodyShape", notIn: ["rect"] }, help: "六/八角筒專用。單片穿過盒中心；八角還可以選十字（六角因 wall 間距 60° 不對齊垂直，不支援）。" },
  { group: "structure", type: "number", key: "fingerSegments", label: "指接段數", defaultValue: 0, min: 0, max: 30, step: 1, help: "僅 cornerJoinery=指接 時生效。0=自動（依壁高自動算奇數），1-30 = 手動指定段數。建議奇數（5/7/9/11/13），兩端都是齒視覺較對稱。", dependsOn: { all: [{ key: "bodyShape", equals: "rect" }, { key: "cornerJoinery", equals: "finger-joint" }] } },
];

/**
 * 筆筒 — 5 片板組成的方盒（4 壁 + 底）
 * input: 外尺寸（長×寬×高）
 */
export const pencilHolder: FurnitureTemplate = (input): FurnitureDesign => {
  const { length: outerL, width: outerW, height: outerH, material } = input;
  const o = pencilHolderOptions;
  // 鑲板入溝（inset-panel）底板統一抬高量。方筒 / 六角 / 八角共用同一個固定值，
  // 否則底板與隔板起點會在三條路徑各自漂移（曾被 revert 拆散成 botT / 5 / 2*botT）。
  const INSET_PANEL_LIFT = 6;
  const useCase = getOption<string>(input, opt(o, "useCase"));
  const preset = PENCIL_HOLDER_PRESETS[useCase];
  // 強制套用：選了 preset 後 preset 有定義的欄位一律蓋過使用者當前值
  const wallTRaw = getOption<number>(input, opt(o, "wallThickness"));
  const wallT = preset?.wallThickness !== undefined ? preset.wallThickness : wallTRaw;
  const botTRaw = getOption<number>(input, opt(o, "bottomThickness"));
  const botT = preset?.bottomThickness !== undefined ? preset.bottomThickness : botTRaw;
  const cornerJoineryRaw = getOption<string>(input, opt(o, "cornerJoinery"));
  const cornerJoinery = (preset?.cornerJoinery !== undefined ? preset.cornerJoinery : cornerJoineryRaw) as
    | "stub-joint"
    | "finger-joint"
    | "miter";
  const dividersRaw = getOption<number>(input, opt(o, "dividers"));
  const dividers = preset?.dividers !== undefined ? preset.dividers : dividersRaw;
  const crossDividersRaw = getOption<number>(input, opt(o, "crossDividers"));
  const crossDividers = preset?.crossDividers !== undefined ? preset.crossDividers : crossDividersRaw;
  const bodyShapeRaw = getOption<string>(input, opt(o, "bodyShape")) as "rect" | "hex" | "oct";
  const bodyShape = (preset?.bodyShape !== undefined ? preset.bodyShape : bodyShapeRaw) as "rect" | "hex" | "oct";
  const bottomAttachRaw = getOption<string>(input, opt(o, "bottomAttach")) as "seated" | "inset-panel" | "flush-glued";
  const bottomAttach = (preset?.bottomAttach !== undefined ? preset.bottomAttach : bottomAttachRaw) as "seated" | "inset-panel" | "flush-glued";
  const polygonDividerStyleRaw = getOption<string>(input, opt(o, "polygonDividerStyle"));
  const polygonDividerStyle = preset?.polygonDividerStyle !== undefined ? preset.polygonDividerStyle : polygonDividerStyleRaw;
  // 隔板厚度：option 預設 6 當 sentinel = 自動走 wallT/2
  const dividerHeightOpt = getOption<number>(input, opt(o, "dividerHeight"));
  const dividerInsetRaw = getOption<number>(input, opt(o, "dividerInset"));
  const dividerInsetPreset = preset?.dividerInset !== undefined ? preset.dividerInset : dividerInsetRaw;
  const dividerInsetOpt = Math.max(0, Math.min(wallT - 1, dividerInsetPreset));
  const dividerThicknessRaw = getOption<number>(input, opt(o, "dividerThickness"));
  const dividerThick = dividerThicknessRaw === 6
    ? Math.max(3, Math.round(wallT / 2))
    : dividerThicknessRaw;
  // 指接段數：0 = 自動（依壁高奇數），1-30 = 手動指定
  const fingerSegmentsOpt = getOption<number>(input, opt(o, "fingerSegments"));

  // 六/八角款：完全跳過 buildBox，自組多邊形 stave + 多邊形底板
  if (bodyShape === "hex" || bodyShape === "oct") {
    const sides = bodyShape === "hex" ? 6 : 8;
    const outerD = Math.min(outerL, outerW);
    const apothem = (outerD / 2) * Math.cos(Math.PI / sides);  // 外壁 apothem
    const outerWallVertexR = outerD / 2;

    // 底板裝法（跟 dovetail-box / tray 同一套）：
    //   seated      = 底板邊緣壓入壁內 wallT/2、N 壁壓在底板邊緣膠合
    //   inset-panel = 4 壁全高、底板邊緣卡進壁內側 5mm 溝、底板下緣距盒底 5mm
    //   flush-glued = 底板外緣與壁外緣齊邊、整面塗膠
    let stavesOuterH: number;
    let stavesBaseY: number;
    let bottomOriginY: number;
    let bottomVertexR: number;
    if (bottomAttach === "inset-panel") {
      const polyBotSkirt = INSET_PANEL_LIFT;
      stavesOuterH = outerH + botT;
      stavesBaseY = 0;
      bottomOriginY = polyBotSkirt;
      const grooveDepth = Math.max(1, Math.min(5, Math.floor(wallT / 2)));
      const bottomApothem = (apothem - wallT) + grooveDepth;
      bottomVertexR = bottomApothem / Math.cos(Math.PI / sides);
    } else if (bottomAttach === "flush-glued") {
      stavesOuterH = outerH;
      stavesBaseY = botT;
      bottomOriginY = 0;
      bottomVertexR = outerWallVertexR;
    } else { // seated
      stavesOuterH = outerH;
      stavesBaseY = botT;
      bottomOriginY = 0;
      const seatOverlap = wallT / 2;
      const bottomApothem = (apothem - wallT) + seatOverlap;
      bottomVertexR = bottomApothem / Math.cos(Math.PI / sides);
    }

    const staves = polygonStaves({ sides, outerD, outerH: stavesOuterH, wallT, botT, material, baseY: stavesBaseY });
    // 端面 mitre（角度 = π/N，相鄰兩壁外角 = 2π/N）；不切 stave 會像現在重疊兩塊
    const miterInset = wallT * Math.tan(Math.PI / sides);
    for (const stave of staves) {
      stave.shape = { kind: "mitered-ends", insetEach: miterInset, outerSide: "+y" };
    }
    const bottomBbox = 2 * bottomVertexR;
    const polyBottom: Part = {
      id: "bottom",
      nameZh: `${sides} 角底板`,
      material,
      grainDirection: "length",
      visible: { length: bottomBbox, width: bottomBbox, thickness: botT },
      origin: { x: 0, y: bottomOriginY, z: 0 },
      shape: { kind: "regular-polygon", sides, outerRadius: bottomVertexR },
      tenons: [],
      mortises: [],
    };

    // 穿心隔板（single / cross）；hex 不支援 cross（壁間距 60° 不對齊垂直）
    const polygonDividerParts: Part[] = [];
    const polyDividerStyleStr = (sides === 6 && polygonDividerStyle === "cross") ? "single" : polygonDividerStyle;
    if (polyDividerStyleStr === "single" || polyDividerStyleStr === "cross") {
      const innerFlatR = apothem - wallT;
      // dividerInset > 0 時兩端各延伸進壁內側 dado 槽 dividerInsetOpt mm；
      // = 0 時剛好頂到壁內側面、零縫
      const polyDividerInset = Math.min(dividerInsetOpt, wallT - 1);
      const polyDividerLen = 2 * innerFlatR + 2 * polyDividerInset;
      const polyBottomTopY = bottomAttach === "inset-panel" ? INSET_PANEL_LIFT + botT : botT;
      const polyDividerHAuto = Math.max(1, outerH - polyBottomTopY);
      const polyDividerH = dividerHeightOpt > 0
        ? Math.max(1, Math.min(dividerHeightOpt, polyDividerHAuto))
        : polyDividerHAuto;
      // divider-1：length 沿世界 -Z（對齊 staves 0 / sides/2 的 ±Z 壁）、width→-Y 垂直
      // Three.js Euler "ZYX" intrinsic XYZ：world = Rz·Ry·Rx·local
      // { x: π/2, y: π/2 }：part-X (length) → -Z 水平、part-Z (width) → -Y 垂直 bottom-anchored
      polygonDividerParts.push({
        id: "divider-1",
        nameZh: "穿心隔板 1（縱）",
        material,
        grainDirection: "length",
        visible: { length: polyDividerLen, width: polyDividerH, thickness: dividerThick },
        origin: { x: 0, y: polyBottomTopY, z: 0 },
        rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
        tenons: [],
        mortises: [],
      });
      if (polyDividerStyleStr === "cross") {
        // divider-2：length 沿世界 +X（對齊 staves sides/4 / 3·sides/4 的 ±X 壁）、width→-Y 垂直
        // { x: π/2 }：part-X (length) → +X 水平、part-Z (width) → -Y 垂直
        polygonDividerParts.push({
          id: "divider-2",
          nameZh: "穿心隔板 2（橫）",
          material,
          grainDirection: "length",
          visible: { length: polyDividerLen, width: polyDividerH, thickness: dividerThick },
          origin: { x: 0, y: polyBottomTopY, z: 0 },
          rotation: { x: Math.PI / 2, y: 0, z: 0 },
          tenons: [],
          mortises: [],
        });
      }
      // dividerInset > 0 時對應壁加 dado 槽（CSG cosmetic mortise）
      // origin.y = 0（壁內側面），depth 朝外延伸 inset mm — divider tip 嵌入這個槽
      if (polyDividerInset > 0) {
        const addStaveMortise = (staveIdx: number) => {
          const stave = staves[staveIdx];
          if (!stave) return;
          stave.mortises.push({
            origin: { x: 0, y: 0, z: 0 },
            depth: polyDividerInset + 0.3,
            length: polyDividerH + 0.5,
            width: dividerThick + 0.5,
            through: false,
            shape: "rect",
            cosmetic: true,
          });
        };
        addStaveMortise(0);
        addStaveMortise(sides / 2);
        if (polyDividerStyleStr === "cross") {
          addStaveMortise(sides / 4);
          addStaveMortise((3 * sides) / 4);
        }
      }
    }

    return {
      id: `pencil-holder-${bodyShape}-${outerD}x${outerH}`,
      category: "pencil-holder",
      nameZh: `${sides === 6 ? "六" : "八"}角筆筒`,
      overall: { length: outerD, width: outerD, thickness: outerH },
      parts: [polyBottom, ...staves, ...polygonDividerParts],
      defaultJoinery: "mitered-spline",
      useButtJointConvention: false,
      primaryMaterial: material,
      notes: `${sides} 角筆筒，外接圓 ⌀${outerD}mm × 高 ${outerH}mm，壁厚 ${wallT}mm。${sides} 段直立壁邊接 ${(360 / sides).toFixed(1)}° 斜切（${sides === 6 ? "60° 內角" : "45° 內角"}），相鄰邊用膠合 + biscuit / 暗榫加固。底板⌀${outerD - 2}mm 圓盤從底嵌入或膠合。`,
    };
  }

  const built = buildBox({
    outerL,
    outerW,
    outerH,
    wallT,
    botT,
    material,
    cornerJoinery: cornerJoinery === "miter" ? "stub-joint" : cornerJoinery,
    bottomFit: bottomAttach === "flush-glued" ? "floating" : "grooved",
  });

  // 底板接法後處理 — 蓋掉 buildBox 預設幾何
  const bottomPart = built.parts.find((p) => p.id === "bottom");
  if (bottomPart) {
    if (bottomAttach === "inset-panel") {
      // 鑲板入溝：4 壁全高、底板浮嵌於壁內側 5mm 槽中，底板下緣離盒底 INSET_PANEL_LIFT
      const grooveDepth = 5;
      const insetEach = Math.max(2, wallT - grooveDepth);
      bottomPart.visible = {
        length: outerL - 2 * insetEach,
        width: outerW - 2 * insetEach,
        thickness: botT,
      };
      bottomPart.origin = { x: 0, y: INSET_PANEL_LIFT, z: 0 };
      for (const part of built.parts) {
        if (part.id.startsWith("wall-")) {
          part.visible = { ...part.visible, width: outerH };
          part.origin = { ...part.origin, y: 0 };
        }
      }
    } else if (bottomAttach === "flush-glued") {
      // 整塊膠合：底板外緣與框體齊
      bottomPart.visible = { length: outerL, width: outerW, thickness: botT };
      bottomPart.origin = { x: 0, y: 0, z: 0 };
    }
    // seated 不動，保留 buildBox 既有結果
  }

  // 斜接 (miter) / 指接 (finger-joint) 下料：短壁 (左/右) 也延伸到外角全長
  // （搭接 stub-joint 才是短壁夾在長壁之間 length=innerW）。
  // 壁的 Y / 高度交由 bottomAttach 決定（seated=坐底板上，inset-panel/flush-glued=全高），不在這裡覆寫。
  if (cornerJoinery === "miter" || cornerJoinery === "finger-joint") {
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
  // miter 4 壁額外掛 mitered-ends shape，3D / 三視圖會把端面渲成 45° 斜切。
  if (cornerJoinery === "miter") {
    for (const part of built.parts) {
      let outerSide: "+y" | "-y" | null = null;
      if (part.id === "wall-back" || part.id === "wall-right") outerSide = "+y";
      else if (part.id === "wall-front" || part.id === "wall-left") outerSide = "-y";
      if (outerSide) {
        part.shape = { kind: "mitered-ends", insetEach: wallT, outerSide };
      }
    }
  }

  // finger-joint 4 壁掛 finger-joint-ends shape：comb 沿 wallH 方向交錯。
  if (cornerJoinery === "finger-joint") {
    let segmentCount: number;
    if (fingerSegmentsOpt > 0) {
      segmentCount = Math.max(2, Math.min(30, Math.floor(fingerSegmentsOpt)));
    } else {
      const totalH = outerH - botT;
      segmentCount = Math.max(3, Math.round(totalH / (1.5 * wallT)));
      if (segmentCount % 2 === 0) segmentCount += 1;
      segmentCount = Math.min(13, segmentCount);
    }
    for (const part of built.parts) {
      let phase: 0 | 1 | null = null;
      if (part.id === "wall-front" || part.id === "wall-back") phase = 0;
      else if (part.id === "wall-left" || part.id === "wall-right") phase = 1;
      if (phase !== null) {
        part.shape = {
          kind: "finger-joint-ends",
          segmentCount,
          phase,
          fingerDepth: wallT,
        };
      }
    }
  }

  // 隔板起點 Y：底板頂面位置 — inset-panel 底板抬高 INSET_PANEL_LIFT，其餘走 buildBox 既定
  const bottomTopY = bottomAttach === "inset-panel" ? INSET_PANEL_LIFT + botT : botT;
  // 隔板嵌入壁時，隔板頂面會跟壁頂面 coplanar → z-fight。縮 1mm 防共平面。
  const insetClearance = dividerInsetOpt > 0 ? 1 : 0;
  const dividerHAuto = Math.max(1, outerH - bottomTopY - insetClearance);
  const dividerH = dividerHeightOpt > 0
    ? Math.max(1, Math.min(dividerHeightOpt, dividerHAuto))
    : dividerHAuto;

  // 加內部直立隔板（縱向：沿 length 軸切，跟長邊垂直）
  const dividerParts: typeof built.parts = [];
  if (dividers > 0) {
    const dividerSpacing = built.innerL / (dividers + 1);
    for (let i = 1; i <= dividers; i++) {
      dividerParts.push({
        id: `divider-${i}`,
        nameZh: `縱向隔板 ${i}`,
        material,
        grainDirection: "length",
        visible: { length: built.innerW + 2 * dividerInsetOpt, width: dividerH, thickness: dividerThick },
        origin: {
          x: -built.innerL / 2 + i * dividerSpacing,
          y: bottomTopY,
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
        visible: { length: built.innerL + 2 * dividerInsetOpt, width: dividerH, thickness: dividerThick },
        origin: {
          x: 0,
          y: bottomTopY,
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
    useButtJointConvention: true,
    primaryMaterial: material,
    notes: `筆筒 ${outerL}×${outerW}×${outerH}mm，${5 + dividers + crossDividers} 片實木組成。底板${bottomAttach === "inset-panel" ? "**鑲板入溝**（4 壁內側下緣銑 5mm 槽、底板浮嵌，留伸縮空間免裂）" : bottomAttach === "flush-glued" ? "**整塊膠合**（底板外緣與框體齊邊，木工膠夾合即可）" : "**坐地疊裝**（底板坐地、4 壁立其上膠合）"}，4 角採${cornerJoinery === "finger-joint" ? "**指接**（外露指狀視覺，新手練習指接的最佳對象）" : cornerJoinery === "miter" ? "**斜角拼**（45° 對接，最隱形但需 45° 鋸台或斜切片切，膠合 + 細釘加固）" : "**搭接**（rabbet，最簡單，膠合即可）"}。內部 ${built.innerL}×${built.innerW}mm 約可放 ${Math.max(0, Math.floor((built.innerL * built.innerW) / 100))} 支筆。${dividers > 0 ? ` 內部縱向 ${dividers} 片隔板（${dividerThick}mm 厚）。` : ""}${crossDividers > 0 ? ` 橫向 ${crossDividers} 片隔板（${dividerThick}mm 厚）。` : ""}${dividers > 0 && crossDividers > 0 ? ` grid 網格分 ${(dividers + 1) * (crossDividers + 1)} 區。` : ""}`,
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

/** 把 preset 的欄位 shadow 進 options（呼叫端：parseDesignSearchParams）
 *  讓表單 UI 顯示的數字 = 渲染用的數字，不再有「拉了沒反應」。 */
export function applyPencilHolderPresets(
  options: Record<string, string | number | boolean>,
): Record<string, string | number | boolean> {
  const useCase = String(options.useCase ?? "");
  const preset = PENCIL_HOLDER_PRESETS[useCase];
  if (!preset) return options;
  const next: Record<string, string | number | boolean> = { ...options };
  if (preset.bodyShape !== undefined) next.bodyShape = preset.bodyShape;
  if (preset.wallThickness !== undefined) next.wallThickness = preset.wallThickness;
  if (preset.bottomThickness !== undefined) next.bottomThickness = preset.bottomThickness;
  if (preset.bottomAttach !== undefined) next.bottomAttach = preset.bottomAttach;
  if (preset.cornerJoinery !== undefined) next.cornerJoinery = preset.cornerJoinery;
  if (preset.dividers !== undefined) next.dividers = preset.dividers;
  if (preset.crossDividers !== undefined) next.crossDividers = preset.crossDividers;
  if (preset.dividerInset !== undefined) next.dividerInset = preset.dividerInset;
  if (preset.polygonDividerStyle !== undefined) next.polygonDividerStyle = preset.polygonDividerStyle;
  return next;
}
