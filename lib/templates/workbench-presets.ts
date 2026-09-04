/**
 * 工作桌流派 preset —— 「選了流派就把整組值寫進網址」用的對照表。
 *
 * 為什麼獨立成檔：`components/design/DesignFormShell.tsx`（client）在使用者切換 `benchStyle` 時
 * 要把這些 key 一次寫進表單／網址，模板本身（`workbench.ts`）則**不再**用「值等於預設就吃 preset」
 * 的方式覆寫——那種寫法會讓「表單顯示預設值、3D 用的是 preset 值」對不起來，而且 preset 帶入的
 * key 永遠選不回 spec 預設（2026-09-04 工程師抓蟲）。
 *
 * ⚠️ 這份表要跟 `workbenchOptions` 的 key 一致（audit-pack-keys 之外另有 workbench.test 驗）。
 */
export type PresetValue = string | number | boolean;

/** 各流派帶入的值；沒列的 key 一律回 spec 預設（見 WORKBENCH_PRESET_DEFAULTS） */
export const WORKBENCH_PRESETS: Record<string, Record<string, PresetValue>> = {
  /** 法式厚板桌：Roubo —— 全部走 spec 預設 */
  roubo: {},
  /** 裙板桌（英式 Nicholson / Sellers 平價）：薄桌面 + 高裙板 + 四邊下橫撐 + 下層板 + 螺栓可拆 + 前緣凸出 50 */
  apron: {
    topThickness: 65, topBuild: "stack", topLayers: 2,
    legSize: 75, legTopJoint: "blind",
    withApron: true, apronWidth: 290, apronThickness: 40,
    lowerStretcherArrangement: "box-frame", lowerStretcherWidth: 90, lowerStretcherThickness: 40,
    withUnderShelf: true, legPenetratingTenon: false,
    knockdown: "bolt", frontOverhang: 50,
  },
  /** 工具槽桌（北歐式）：中等厚度桌面 + 後側工具槽 + 9" 鉗 */
  well: {
    topThickness: 65, legSize: 80, legTopJoint: "blind",
    topSplit: "well", wellWidth: 150, wellDepth: 45,
    frontViseSize: "9in",
  },
  /** 教室雙面桌：厚板桌骨架，兩人面對面各一支前鉗、各一列狗孔（木頭仁教室 1800×900） */
  classroom: { doubleSided: true },
  /** 20mm 孔陣桌（現代 MFT）：夾板疊層 + 淺裙板 + 20mm 格陣（96 間距）、不裝鉗 */
  mft: {
    topThickness: 40, topBuild: "stack", topLayers: 2,
    legSize: 60, legTopJoint: "blind",
    withApron: true, apronWidth: 120, apronThickness: 25,
    lowerStretcherArrangement: "box-frame", lowerStretcherWidth: 60, lowerStretcherThickness: 25,
    withUnderShelf: true, legPenetratingTenon: false,
    frontVise: "none", dogHoles: "grid", holdfastHoles: false,
  },
};

/** 所有流派會動到的 key 的 spec 預設值（切回別的流派時沒帶到的 key 要回這裡） */
export const WORKBENCH_PRESET_DEFAULTS: Record<string, PresetValue> = {
  topThickness: 75, topBuild: "plank", topLayers: 2,
  legSize: 100, legTopJoint: "through",
  withApron: false, apronWidth: 250, apronThickness: 40,
  lowerStretcherArrangement: "box-frame", lowerStretcherWidth: 100, lowerStretcherThickness: 50,
  withUnderShelf: false, legPenetratingTenon: true,
  knockdown: "none", frontOverhang: 0,
  topSplit: "none", wellWidth: 150, wellDepth: 45,
  frontViseSize: "7in", frontVise: "quick", dogHoles: "row", holdfastHoles: true,
  doubleSided: false,
};

/** 切到某流派時要寫進表單／網址的完整值（preset 沒帶的 key 回預設） */
export function workbenchPresetValues(style: string): Record<string, PresetValue> {
  return { ...WORKBENCH_PRESET_DEFAULTS, ...(WORKBENCH_PRESETS[style] ?? {}) };
}
