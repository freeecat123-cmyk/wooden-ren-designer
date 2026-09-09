import type {
  FurnitureDesign,
  FurnitureTemplate,
  Mortise,
  OptionSpec,
  Part,
  Tenon,
} from "@/lib/types";
import { getOption, opt } from "@/lib/types";

/**
 * 技術士技能檢定 家具木工 乙級 術科試題 01200-100202（練習範本）
 *
 * ⭐ 照官方試題**公開尺寸**自己畫的練習範本，不是官方圖面的重製；不嵌、不顯示官方圖檔。
 *    官方應檢參考資料（完整題本 012002B15，本題圖框 112/10/27）請至 owinform.wdasec.gov.tw 下載，應檢以官方版本為準。
 *
 * ── 圖面判讀（2026-09-09，工作圖 PDF 第 16 頁；評審表第 8 頁；材料表第 6 頁）──
 * ⚠️ PDF 內嵌的是 1140×820 掃描圖，400dpi 只是放大 3.588 倍、真實解析度僅 1.45 px/mm
 *    → **一律以標註文字為準**，像素只用來認哪條線對哪個數字。細部剖面兩軸等向 5.2175 px/mm（沒有橫向拉伸）。
 *
 * 這是一個 482×400×420 的四腳單抽小櫃（床頭櫃）：
 * - 腳柱 32(寬)×45(深)×420，腳底 3×45° 倒角；**腳頂比天板高 10、比側板高 5**，形成淺盤邊。
 * - 左右側板是**木心板實心板** 18 厚 × 155 高 × 310 長：內面與腳內面齊、外面比腳外面縮 14；
 *   上緣包 8mm 實木封邊（155＝147 板身＋8 封邊）。每端 3 支 Ø8×30 木釘入腳（**入實木腳 12／入木心板 18**，B-B 上段「12｜18」），
 *   高度由板頂起 38｜39.5｜39.5｜38（＝155 自我驗證）→ 離地 377／337.5／298。
 * - 天板木心板 418×368×18，頂面離地 410（腳頂下 10）；前後緣各包 8 封邊（C-C「8｜64｜128｜128｜64｜8」＝400 對稱）。
 *   天板↔側板 3 支水平木釘（沿寬度方向），z＝72／200／328（就是那條鏈的節點）。
 * - 背板木心板 418×132×18，在 z 367~385、離地 260~392；頂緣 3 支垂直木釘入天板（x＝70／241／412，B-B「38｜171」）；
 *   兩端各 2 支木釘入腳（C-C「27｜78｜27」＝132）。
 * - 腳架：前後各一支 **45×24** 下橫檔（上緣離地 120，深度置中於腳＝10.5｜24｜10.5，榫 6｜12｜6）；
 *   中間兩支 **30×18** 前後向橫檔（離腳內面 110，上緣比 45 檔低 7.5，榫 10｜10｜10）。**左右沒有下橫檔**
 *   → 評審表「下橫檔寬、厚度 45×24，30×18」4 部位＝這 4 支；「榫接密合 32」＝4 支 × 2 端 × 4 面肩。
 * - 抽屜外 408×320，前板 130 高 18 厚（頂離天板底 2、正面比腳前面縮 15），與側板**半隱鳩尾**（榫孔深 12、面皮 6）；
 *   側板 320×110×15、後板 378×90×15、4mm 合板底板入槽（槽深 7、外肉 8）；
 *   側板外面 15 高 × 8 深滑條槽，木滑條 12 寬 × 14 高（入槽 7、留 1 間隙），Ø3×25 螺釘鎖在側板內面。
 *
 * ⚠️ **官方未規定、本範本自訂**：30×18 檔的榫厚（取 10）與榫長（取 12）、滑條的 z 起訖、滑條螺釘顆數。
 * ⚠️ **依官方學科參考資料（012002A12.pdf）定的**：
 *    鳩尾斜度 §01-19「一般為 1:6」＋§05-4「1/6～1/8」→ 9.46°（原本寫 10° 已超出官方範圍）；
 *    半隱鳩尾榫深 §05-10「板厚的 2/3」→ 18×2/3 ＝ 12 ✅；Ø8 木釘配 18 木心板 §05-24 ✅；
 *    鳩尾齒數由評審表「鳩尾榫密合 18 部位」÷ 2 個角 ＝ 每角 9 個元素（同一規則在第一題是 28÷4 角＝7）。
 * ⚠️ 未做成造型：腳底 3×45° 倒角、木螺釘本體。
 * ✅ 2026-09-09 四位檢查員複核後定案（原本兩處待確認都已結案）：
 *    ① A-A 上段最上面**是 5 不是 8.5** —— 放大後那是上下兩格「5」（腳頂→側板頂）與「8」（實木封邊厚），
 *       旋轉文字被誤讀成一個 8.5；155 鏈與「側板下緣 260＝抽屜前板下緣＝背板下緣」互相驗證。
 *    ② 後角（抽屜側板↔後板）**是純螺釘、不做鳩尾** —— B-B 上段 ø3.5×30 引線直指該處，
 *       C-C 又給了「20｜50｜20」＝每邊 2 支的位置；評審表「鳩尾榫密合 18」÷ 9 ＝ 2 個角，也只有前面兩角。
 *
 * ⚠️ **已知未解**：評審表「榫接密合 32 部位」。若照「榫頭數 × 4 面肩」（此規則在第一題驗證成立：2 榫 ×4＝8），
 *    本題 45×24 檔是貫穿榫、滿 45 高只有 2 個肩（4×2＝8）＋中間檔 4 個肩（4×4＝16）＝24 ≠ 32。
 *    但應檢須知第七條明訂「各部尺寸應以圖上所標示數字為準」，圖面三處證據都指向貫穿榫，故以圖為準。
 */

/** 官方試題尺寸（mm）。座標：X 0~482 由左、Y 0~420 由地面、Z 0~400 由**正面**；程式內再平移到世界座標 */
const EXAM = {
  W: 482, D: 400, H: 420,
  legW: 32, legD: 45, legChamfer: 3,
  topT: 18, topFromLegTop: 10, topEdge: 8,   // 天板頂面比腳頂低 10（考題 410）；前後封邊各 8 深
  topDowelZ: [72, 200, 328],                 // 天板↔側板水平木釘（C-C 鏈節點）
  sidePanelFromLegTop: 5,                    // 側板頂比腳頂低 5（考題 415）
  sidePanelH: 155,                           // 含 8 封邊
  sideEdge: 8,
  sidePanelT: 18,
  sidePanelInset: 14,                        // 外面比腳外面縮 14（B-B 鏈 14｜18｜5｜15）
  sideDowelFromTop: [38, 77.5, 117],         // 由板頂起 38｜39.5｜39.5 → 離地 377／337.5／298
  backPanelH: 132, backPanelT: 18,
  backPanelFromRear: 15,                     // 背板背面離背 15（考題 385；板 367~385）——從**背面**量，深度變大時要跟著往後
  backDowelFromTopBottom: [27, 105],         // 背板兩端入腳木釘離天板底 27｜再 78（C-C「27｜78｜27」＝132；27+78=105）
  dowelDia: 8, dowelLen: 30,
  dowelIntoLeg: 12, dowelIntoPanel: 18,      // Ø8×30 入實木腳 12／入木心板 18（B-B 上段「12｜18」，12+18=30）
  dowelIntoBoard: 15,                        // 板↔板（天板↔側板／天板↔背板）圖上沒標入料深，取對半
  railFbH: 45, railFbT: 24, railFbTopY: 120, railFbZ0: 10.5,   // 前後下橫檔
  railFbTenonT: 12, railFbTenonH: 45, railTenonLen: 32,        // 榫 6｜12｜6（C-C）；**貫穿榫**：滿 45 高 × 穿透腳柱 32
  railMidH: 30, railMidT: 18, railMidFromLegInner: 110, railMidDropFromFb: 7.5,
  railMidTenonH: 10, railMidTenonT: 10, railMidTenonLen: 12,   // 榫 10｜10｜10；厚與長圖上沒標
  drawerGap: 5,                              // 抽屜側面與腳的間隙（B-B 鏈的 5）
  drawerD: 320,
  drawerFrontH: 130, drawerFrontT: 18, drawerFrontZ: 15, drawerTopGap: 2,
  drawerSideH: 110, drawerSideT: 15, drawerSideBelowFront: 8,     // 側板頂比前板頂低 8（382 vs 390）
  drawerBackH: 90, drawerBackT: 15, drawerBackBelowSide: 5,       // 後板頂比側板頂低 5（A-A「5」；C-C 5+90+15＝110）→ 377
  slotBelowSideTop: 55,                                            // 滑條槽頂比抽屜側板頂低 55（55｜15｜40＝110）→ 327
  grooveD: 7, bottomT: 4,                    // 底板槽深 7（外肉 8）
  slotH: 15, slotD: 8,                       // 滑條槽 15 高 8 深（考題 312.5~327.5）
  runnerW: 12, runnerH: 14,                  // 滑條 12 寬 × 14 高（入槽 7）
  dovetailSegments: 9, dovetailAngleDeg: 9.46, dovetailPinDepth: 12,   // 見檔頭「鳩尾」段：9 段／1:6／板厚 2/3
  runnerScrew: "Ø3×25 木螺釘（CNS1051）",
  bottomScrew: "Ø2.4×15 木螺釘（CNS1051）×3",
  backScrew: "Ø3.5×30 木螺釘（CNS1051）",
} as const;

export const certB2Options: OptionSpec[] = [
  {
    group: "structure",
    type: "number",
    key: "drawerPull",
    label: "抽屜拉出量（示意）",
    defaultValue: 0,
    min: 0,
    max: 250,
    step: 10,
    unit: "mm",
    help: "只影響 3D 展示（把抽屜拉出來看滑條怎麼入槽），不改任何尺寸。應檢時抽屜當然是關著的",
  },
  {
    group: "structure",
    type: "checkbox",
    key: "withDrawer",
    label: "裝抽屜",
    defaultValue: true,
    help: "試題一定要做抽屜。取消只是為了看清楚櫃體與滑條，應檢一定要裝",
  },
];

export const certB2: FurnitureTemplate = (input): FurnitureDesign => {
  const { material } = input;
  const isEn = (input.locale ?? "zh-TW") === "en";
  const o = certB2Options;
  const pull = getOption<number>(input, opt(o, "drawerPull"));
  const withDrawer = getOption<boolean>(input, opt(o, "withDrawer"));

  const E = EXAM;
  // 長寬下限直接夾在考題尺寸：抽屜與木釘列都是考題常數、不跟著跨距縮，縮小就會整組穿模（乙級第一題的教訓）。
  // 高度是唯一真的可以調的：天板／側板／背板／抽屜整組吊在「腳頂往下」的固定關係上，變高就是腳變長。
  // 下限 300 是算出來的：側板底＝H−160，要高過下橫檔頂 120 → H > 280。
  const W = Math.max(E.W, input.length);
  const D = Math.max(E.D, input.width);
  const H = Math.max(300, input.height);

  /** 圖面座標 → 世界座標：X 置中、Y 不變（origin.y＝底）、+Z＝背 */
  const wx = (x: number) => x - W / 2;
  const wz = (z: number) => z - D / 2;
  const parts: Part[] = [];
  const warnings: string[] = [];
  const round = (d: number) => ({ shape: "round" as const, length: d, width: d, through: false });

  const legInnerX = E.legW;                       // 左腳內面 x=32
  const legRightInnerX = W - E.legW;              // 右腳內面
  const legBackFrontZ = E.legD;                   // 前腳背面 z=45
  const legBackInnerZ = D - E.legD;               // 後腳前面
  const spanX = legRightInnerX - legInnerX;       // 418
  const spanZ = legBackInnerZ - legBackFrontZ;    // 310
  const topY = H - E.topFromLegTop;                      // 410
  const topBottomY = topY - E.topT;                      // 392
  const sidePanelTopY = H - E.sidePanelFromLegTop;       // 415
  const panelBottomY = sidePanelTopY - E.sidePanelH;     // 260 ＝ 抽屜前板底＝背板底（三者同高，圖上互相驗證）
  const backDowelY = E.backDowelFromTopBottom.map((d) => topBottomY - d);   // 365 / 287.5
  const backPanelZ = D - E.backPanelFromRear - E.backPanelT;               // 367（背板前面）

  // ── 腳柱 ×4（32×45×H；rotation x=π/2：local y(厚 45)→世界 z、local z(寬 H)→世界 −y）──
  // 榫眼／木釘孔的 local 換算：ly = (worldZ − legCenterZ) + legD/2、lz = −(worldY − legCenterY)
  const legCy = H / 2;
  for (const sx of [0, 1] as const) for (const sz of [0, 1] as const) {
    const legX0 = sx === 0 ? 0 : W - E.legW;                  // 腳的 x 起點
    const legZ0 = sz === 0 ? 0 : D - E.legD;
    const legCx = legX0 + E.legW / 2, legCz = legZ0 + E.legD / 2;
    const innerSignX = sx === 0 ? 1 : -1;                     // 內面朝 +x（左腳）或 −x（右腳）
    const innerSignZ = sz === 0 ? 1 : -1;
    const m: Mortise[] = [];
    const localY = (worldZ: number) => worldZ - legCz + E.legD / 2;
    const localZ = (worldY: number) => -(worldY - legCy);
    // 側板端木釘 ×3（沿 z 進腳的內側 z 面）
    for (const d of E.sideDowelFromTop) m.push({
      origin: { x: innerSignX * (E.legW / 2 - E.sidePanelT / 2), y: sz === 0 ? E.legD : 0, z: localZ(sidePanelTopY - d) },
      depth: E.dowelIntoLeg, ...round(E.dowelDia), label: isEn ? "Ø8 dowel, side panel" : "Ø8 木釘（側板）",
    });
    // 背板端木釘 ×2（只有後腳；沿 x 進腳的內側 x 面）
    if (sz === 1) for (const y of backDowelY) m.push({
      origin: { x: innerSignX * E.legW / 2, y: localY(backPanelZ + E.backPanelT / 2), z: localZ(y) },
      depth: E.dowelIntoLeg, ...round(E.dowelDia), label: isEn ? "Ø8 dowel, back panel" : "Ø8 木釘（背板）",
    });
    // 前／後下橫檔榫眼（沿 x 貫穿整支腳，12 厚 × 45 高）
    m.push({
      origin: { x: innerSignX * E.legW / 2, y: localY(legZ0 + E.railFbZ0 + E.railFbT / 2), z: localZ(E.railFbTopY - E.railFbH / 2) },
      depth: E.railTenonLen, length: E.railFbTenonH, width: E.railFbTenonT, through: true,
      label: isEn ? "through mortise, bottom rail" : "下橫檔貫穿榫眼（12×45）",
    });
    void innerSignZ;
    parts.push({
      id: `leg-${sx === 0 ? "left" : "right"}-${sz === 0 ? "front" : "back"}`,
      nameZh: `腳柱（${sx === 0 ? "左" : "右"}${sz === 0 ? "前" : "後"}）`,
      nameEn: `Leg (${sx === 0 ? "left" : "right"} ${sz === 0 ? "front" : "back"})`,
      material,
      grainDirection: "width",
      visible: { length: E.legW, width: H, thickness: E.legD },
      origin: { x: wx(legCx), y: 0, z: wz(legCz) },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      tenons: [],
      mortises: m,
    });
  }

  // ── 左右側板（木心板 18×147×310）＋ 上緣 8 封邊 ─────────────────────────
  const panelCoreTopY = sidePanelTopY - E.sideEdge;         // 407
  const panelCoreH = E.sidePanelH - E.sideEdge;               // 147
  const panelCy = panelBottomY + panelCoreH / 2;
  for (const sx of [0, 1] as const) {
    const outerX = sx === 0 ? E.sidePanelInset : W - E.sidePanelInset - E.sidePanelT;
    const panelCx = outerX + E.sidePanelT / 2;
    // rotation {x:π/2, y:π/2}：local x→世界 −z、local y(厚)→世界 x、local z(寬)→世界 −y
    const innerY = sx === 0 ? E.sidePanelT : 0;               // 內面（朝櫃內）在 local y 的哪一側
    const m: Mortise[] = [];
    // 兩端木釘孔（沿 z，開在端面）
    for (const d of E.sideDowelFromTop) for (const ez of [-1, 1]) m.push({
      origin: { x: ez * spanZ / 2, y: E.sidePanelT / 2, z: -((sidePanelTopY - d) - panelCy) },
      depth: E.dowelIntoPanel, ...round(E.dowelDia), label: isEn ? "Ø8 dowel, leg" : "Ø8 木釘（入腳）",
    });
    // 天板木釘孔 ×3（沿 x，開在內面）
    for (const z of E.topDowelZ) m.push({
      origin: { x: -(z - D / 2), y: innerY, z: -((topBottomY + E.topT / 2) - panelCy) },
      depth: E.dowelIntoBoard, ...round(E.dowelDia), label: isEn ? "Ø8 dowel, top" : "Ø8 木釘（天板）",
    });
    parts.push({
      id: sx === 0 ? "side-panel-left" : "side-panel-right",
      nameZh: sx === 0 ? "側板（左）" : "側板（右）",
      nameEn: sx === 0 ? "Side panel (left)" : "Side panel (right)",
      material: "blockboard-primary",
      grainDirection: "length",
      visible: { length: spanZ, width: panelCoreH, thickness: E.sidePanelT },
      origin: { x: wx(panelCx), y: panelBottomY, z: 0 },
      rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
      tenons: [],
      mortises: m,
    });
    parts.push({
      id: sx === 0 ? "side-edge-left" : "side-edge-right",
      nameZh: sx === 0 ? "側板上緣封邊（左）" : "側板上緣封邊（右）",
      nameEn: sx === 0 ? "Side panel edging (left)" : "Side panel edging (right)",
      material,
      grainDirection: "length",
      visible: { length: spanZ, width: E.sidePanelT, thickness: E.sideEdge },
      origin: { x: wx(panelCx), y: panelCoreTopY, z: 0 },
      rotation: { x: 0, y: Math.PI / 2, z: 0 },
      tenons: [],
      mortises: [],
    });
  }

  // ── 背板（木心板 418×132×18）──────────────────────────────────────────
  {
    const backCy = panelBottomY + E.backPanelH / 2;
    const m: Mortise[] = [];
    for (const y of backDowelY) for (const ex of [-1, 1]) m.push({
      origin: { x: ex * spanX / 2, y: E.backPanelT / 2, z: -(y - backCy) },
      depth: E.dowelIntoPanel, ...round(E.dowelDia), label: isEn ? "Ø8 dowel, leg" : "Ø8 木釘（入腳）",
    });
    for (const x of [70, 241, 412]) m.push({
      origin: { x: wx(x), y: E.backPanelT / 2, z: -(E.backPanelH / 2) },
      depth: E.dowelIntoBoard, ...round(E.dowelDia), label: isEn ? "Ø8 dowel, top" : "Ø8 木釘（天板）",
    });
    parts.push({
      id: "back-panel",
      nameZh: "背板",
      nameEn: "Back panel",
      material: "blockboard-primary",
      grainDirection: "length",
      visible: { length: spanX, width: E.backPanelH, thickness: E.backPanelT },
      origin: { x: 0, y: panelBottomY, z: wz(backPanelZ + E.backPanelT / 2) },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      tenons: [],
      mortises: m,
    });
  }

  // ── 天板（木心板 418×368×18）＋前後 8 封邊 ────────────────────────────
  {
    const coreZ0 = E.topEdge * 2, coreZ1 = D - E.topEdge * 2;   // 16 ~ 384
    const coreD = coreZ1 - coreZ0;                              // 368
    const m: Mortise[] = [];
    // 天板↔側板水平木釘（沿 x，開在天板左右端面）
    for (const z of E.topDowelZ) for (const ex of [-1, 1]) m.push({
      origin: { x: ex * spanX / 2, y: E.topT / 2, z: wz(z) - wz((coreZ0 + coreZ1) / 2) },
      depth: E.dowelIntoBoard, ...round(E.dowelDia), label: isEn ? "Ø8 dowel, side panel" : "Ø8 木釘（側板）",
    });
    // 天板↔背板垂直木釘（沿 y，開在天板底面）
    for (const x of [70, 241, 412]) m.push({
      origin: { x: wx(x), y: 0, z: wz(backPanelZ + E.backPanelT / 2) - wz((coreZ0 + coreZ1) / 2) },
      depth: E.dowelIntoBoard, ...round(E.dowelDia), label: isEn ? "Ø8 dowel, back panel" : "Ø8 木釘（背板）",
    });
    parts.push({
      id: "top-core",
      nameZh: "天板（木心板）",
      nameEn: "Top core (blockboard)",
      material: "blockboard-primary",
      grainDirection: "length",
      visible: { length: spanX, width: coreD, thickness: E.topT },
      origin: { x: 0, y: topBottomY, z: wz((coreZ0 + coreZ1) / 2) },
      tenons: [],
      mortises: m,
    });
    for (const sz of [0, 1] as const) {
      const z0 = sz === 0 ? E.topEdge : D - E.topEdge * 2;
      parts.push({
        id: sz === 0 ? "top-edge-front" : "top-edge-back",
        nameZh: sz === 0 ? "天板封邊（前）" : "天板封邊（後）",
        nameEn: sz === 0 ? "Top edging (front)" : "Top edging (back)",
        material,
        grainDirection: "length",
        visible: { length: spanX, width: E.topEdge, thickness: E.topT },
        origin: { x: 0, y: topBottomY, z: wz(z0 + E.topEdge / 2) },
        tenons: [],
        mortises: [],
      });
    }
  }

  // ── 下橫檔：前後 45×24 ×2、中間 30×18 ×2（全部榫接）──────────────────
  const railFbCy = E.railFbTopY - E.railFbH / 2;
  const railTenon = (
    position: "start" | "end", width: number, thickness: number,
    kind: "through" | "blind" = "blind",
  ): Tenon => ({
    position,
    type: kind === "through" ? "through-tenon" : "blind-tenon",
    length: E.railTenonLen, width, thickness,
    // 貫穿榫是滿 45 高（width 軸 = 檔高），只有厚度方向（top/bottom）有肩
    shoulderOn: kind === "through" ? ["top", "bottom"] : ["top", "bottom", "left", "right"],
  });
  for (const sz of [0, 1] as const) {
    const z0 = sz === 0 ? E.railFbZ0 : D - E.legD + E.railFbZ0;
    const railCz = z0 + E.railFbT / 2;
    parts.push({
      id: sz === 0 ? "rail-front" : "rail-back",
      nameZh: sz === 0 ? "前下橫檔" : "後下橫檔",
      nameEn: sz === 0 ? "Front bottom rail" : "Back bottom rail",
      material,
      grainDirection: "length",
      visible: { length: spanX, width: E.railFbH, thickness: E.railFbT },
      origin: { x: 0, y: E.railFbTopY - E.railFbH, z: wz(railCz) },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      tenons: [railTenon("start", E.railFbTenonH, E.railFbTenonT, "through"), railTenon("end", E.railFbTenonH, E.railFbTenonT, "through")],
      // 中間兩支 30×18 橫檔的榫眼（開在朝櫃內那一面）
      mortises: [-1, 1].map((ex) => ({
        origin: {
          x: ex * (spanX / 2 - (E.railMidFromLegInner + E.railMidT / 2)),
          y: sz === 0 ? E.railFbT : 0,
          z: -((E.railFbTopY - E.railMidDropFromFb - E.railMidH / 2) - railFbCy),
        },
        depth: E.railMidTenonLen, length: E.railMidTenonT, width: E.railMidTenonH, through: false,
        label: isEn ? "mortise, mid rail tenon" : "中間橫檔榫眼（10×10）",
      })),
    });
  }
  const railMidTopY = E.railFbTopY - E.railMidDropFromFb;
  // 中間橫檔夾在前後兩支 45×24 之間：前檔背面 z=34.5、後檔正面 z=365.5 → 身長 331，兩端各再伸 12 入榫眼。
  // 🩸第一版用「腳深＋10.5＋24」當起點（79.5），把身長算成 241。
  const railMidZ0 = E.railFbZ0 + E.railFbT;
  const railMidZ1 = D - E.legD + E.railFbZ0;
  const railMidBody = railMidZ1 - railMidZ0;
  for (const ex of [-1, 1] as const) {
    parts.push({
      id: ex < 0 ? "rail-mid-left" : "rail-mid-right",
      nameZh: ex < 0 ? "中間下橫檔（左）" : "中間下橫檔（右）",
      nameEn: ex < 0 ? "Mid bottom rail (left)" : "Mid bottom rail (right)",
      material,
      grainDirection: "length",
      visible: { length: railMidBody, width: E.railMidH, thickness: E.railMidT },
      origin: {
        x: ex * (spanX / 2 - (E.railMidFromLegInner + E.railMidT / 2)),
        y: railMidTopY - E.railMidH,
        z: wz((railMidZ0 + railMidZ1) / 2),
      },
      rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
      tenons: [railTenon("start", E.railMidTenonH, E.railMidTenonT), railTenon("end", E.railMidTenonH, E.railMidTenonT)]
        .map((t) => ({ ...t, length: E.railMidTenonLen })),
      mortises: [],
    });
  }

  // ── 木釘 ×25（Ø8×30 現成品，做成零件；不入裁切／零件圖）────────────────
  /**
   * `c` ＝**接合面**上的圓心；`intoPanel` 給板側的入料深（預設 15＝對半）。
   * 入腳 12／入板 18 時圓心不在接合面上，要往板側偏 (intoPanel − dowelLen/2)＝3。
   * `panelDir` ＝板在哪一側（沿 axis 的 +1／−1）。
   */
  const dowel = (
    id: string, nameZh: string, nameEn: string, axis: "x" | "y" | "z",
    c: { x: number; y: number; z: number },
    intoPanel: number = E.dowelLen / 2, panelDir: 1 | -1 = 1,
  ): Part => {
    const shift = (intoPanel - E.dowelLen / 2) * panelDir;
    c = { x: axis === "x" ? c.x + shift : c.x, y: axis === "y" ? c.y + shift : c.y, z: axis === "z" ? c.z + shift : c.z };
    return {
    id, nameZh, nameEn, material,
    // 圓棒的順紋一定沿軸向。沿 x → length 欄、沿 z → width 欄，都表達得出來；
    // 沿 y 時長度落在 thickness 欄，而 GrainDirection 只有 length/width 兩種，無法表達 → 留 length。
    grainDirection: axis === "z" ? "width" : "length",
    visible: axis === "x"
      ? { length: E.dowelLen, width: E.dowelDia, thickness: E.dowelDia }
      : axis === "z"
        ? { length: E.dowelDia, width: E.dowelLen, thickness: E.dowelDia }
        : { length: E.dowelDia, width: E.dowelDia, thickness: E.dowelLen },
    origin: { x: c.x, y: c.y - (axis === "y" ? E.dowelLen / 2 : E.dowelDia / 2), z: c.z },
    shape: { kind: "round", axis },
    visual: "dowel",
    tenons: [],
    mortises: [],
    };
  };
  // 側板↔腳 12 支（沿 z，中心在腳內面）
  for (const sx of [0, 1] as const) for (const sz of [0, 1] as const) for (const d of E.sideDowelFromTop) {
    const px = sx === 0 ? E.sidePanelInset + E.sidePanelT / 2 : W - E.sidePanelInset - E.sidePanelT / 2;
    parts.push(dowel(`dowel-side-${sx}${sz}-${d}`, "木釘 Ø8×30（側板）", "Dowel Ø8×30 (side panel)", "z",
      { x: wx(px), y: sidePanelTopY - d, z: wz(sz === 0 ? legBackFrontZ : legBackInnerZ) },
      E.dowelIntoPanel, sz === 0 ? 1 : -1));
  }
  // 背板↔腳 4 支（沿 x，中心在腳內面）
  for (const ex of [0, 1] as const) for (const y of backDowelY) {
    parts.push(dowel(`dowel-back-${ex}-${y}`, "木釘 Ø8×30（背板）", "Dowel Ø8×30 (back panel)", "x",
      { x: wx(ex === 0 ? legInnerX : legRightInnerX), y, z: wz(backPanelZ + E.backPanelT / 2) },
      E.dowelIntoPanel, ex === 0 ? 1 : -1));
  }
  // 天板↔側板 6 支（沿 x，中心在側板內面＝天板端面）
  for (const ex of [0, 1] as const) for (const z of E.topDowelZ) {
    parts.push(dowel(`dowel-top-side-${ex}-${z}`, "木釘 Ø8×30（天板）", "Dowel Ø8×30 (top)", "x",
      { x: wx(ex === 0 ? legInnerX : legRightInnerX), y: topBottomY + E.topT / 2, z: wz(z) }));
  }
  // 天板↔背板 3 支（沿 y，中心在天板底面）
  for (const x of [70, 241, 412]) {
    parts.push(dowel(`dowel-top-back-${x}`, "木釘 Ø8×30（背板）", "Dowel Ø8×30 (back panel)", "y",
      { x: wx(x), y: topBottomY, z: wz(backPanelZ + E.backPanelT / 2) }));
  }

  // ── 抽屜 ─────────────────────────────────────────────────────────────
  if (withDrawer) {
    const zShift = -pull;
    const drawerX0 = legInnerX + E.drawerGap;                    // 37
    const drawerW = spanX - 2 * E.drawerGap;                      // 408
    const frontZ0 = E.drawerFrontZ + zShift;                      // 15
    const frontTopY = topBottomY - E.drawerTopGap;                // 390
    const frontBottomY = frontTopY - E.drawerFrontH;              // 260
    const sideTopY = frontTopY - E.drawerSideBelowFront;          // 382
    const sideBottomY = sideTopY - E.drawerSideH;                 // 272
    const backZ1 = E.drawerFrontZ + E.drawerD + zShift;           // 335（後板背面）
    const backCz = backZ1 - E.drawerBackT / 2;
    const backTopY = sideTopY - E.drawerBackBelowSide;            // 377.5
    const backBottomY = backTopY - E.drawerBackH;                 // 287.5
    const bottomTopY = backBottomY;                               // 底板頂與後板底齊（底板從後板底下穿過）
    const bottomY = bottomTopY - E.bottomT;
    const sideCx0 = drawerX0 + E.drawerSideT / 2;
    const sideZ0 = frontZ0 + (E.drawerFrontT - E.dovetailPinDepth) + zShift * 0;   // 半隱鳩尾面皮 6
    const sideLen = backZ1 - sideZ0;
    const sideCz = (sideZ0 + backZ1) / 2;
    const sideCy = sideBottomY + E.drawerSideH / 2;
    const slotTopY = sideTopY - E.slotBelowSideTop;               // 327.5
    const slotCy = slotTopY - E.slotH / 2;
    const bottomGrooveCy = bottomY + E.bottomT / 2;

    parts.push({
      id: "drawer-1-front",
      nameZh: "抽屜前板",
      nameEn: "Drawer front",
      material,
      grainDirection: "length",
      visible: { length: drawerW, width: E.drawerFrontH, thickness: E.drawerFrontT },
      origin: { x: 0, y: frontBottomY, z: wz(frontZ0 + E.drawerFrontT / 2) },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      tenons: [],
      mortises: [{
        origin: { x: 0, y: E.drawerFrontT, z: -(bottomGrooveCy - (frontBottomY + E.drawerFrontH / 2)) },
        depth: E.grooveD, length: drawerW - 2 * E.drawerSideT + 2 * E.grooveD, width: E.bottomT,
        through: false, cosmetic: true, label: isEn ? "bottom groove 4 wide × 7 deep" : "底板槽（4 寬 × 7 深）",
      }],
    });
    for (const ex of [0, 1] as const) {
      const cx = ex === 0 ? sideCx0 : W - sideCx0;
      const outerY = ex === 0 ? 0 : E.drawerSideT, innerY = ex === 0 ? E.drawerSideT : 0;
      parts.push({
        id: ex === 0 ? "drawer-1-side-left" : "drawer-1-side-right",
        nameZh: ex === 0 ? "抽屜側板（左）" : "抽屜側板（右）",
        nameEn: ex === 0 ? "Drawer side (left)" : "Drawer side (right)",
        material,
        grainDirection: "length",
        visible: { length: sideLen, width: E.drawerSideH, thickness: E.drawerSideT },
        origin: { x: wx(cx), y: sideBottomY, z: wz(sideCz) },
        rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
        // ends:"plus" ＝只有**前端**做鳩尾。local +x → 世界 −z ＝正面。
        // 後端（接抽屜後板）官方是 ø3.5×30 木螺釘（工作圖 B-B 引線＋C-C「20｜50｜20」每邊 2 支）。
        shape: { kind: "dovetail-ends", segmentCount: E.dovetailSegments, phase: 0, angleDeg: E.dovetailAngleDeg, pinDepth: E.dovetailPinDepth, halfPin: true, ends: "plus" },
        tenons: [],
        mortises: [
          { origin: { x: 0, y: outerY, z: -(slotCy - sideCy) }, depth: E.slotD, length: sideLen, width: E.slotH,
            through: false, cosmetic: true, label: isEn ? "runner slot 15 high × 8 deep" : "滑條槽（15 高 × 8 深）" },
          { origin: { x: 0, y: innerY, z: -(bottomGrooveCy - sideCy) }, depth: E.grooveD, length: sideLen, width: E.bottomT,
            through: false, cosmetic: true, label: isEn ? "bottom groove 4 wide × 7 deep" : "底板槽（4 寬 × 7 深）" },
        ],
      });
    }
    const backLen = drawerW - 2 * E.drawerSideT;                  // 378
    parts.push({
      id: "drawer-1-back",
      nameZh: "抽屜後板",
      nameEn: "Drawer back",
      material,
      grainDirection: "length",
      visible: { length: backLen, width: E.drawerBackH, thickness: E.drawerBackT },
      origin: { x: 0, y: backBottomY, z: wz(backCz) },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      tenons: [],
      mortises: [],
    });
    parts.push({
      id: "drawer-1-bottom",
      nameZh: "抽屜底板（4mm 合板）",
      nameEn: "Drawer bottom (4mm plywood)",
      material,
      materialOverride: "plywood",
      grainDirection: "length",
      visible: { length: backLen + 2 * E.grooveD, width: backZ1 - (frontZ0 + E.drawerFrontT - E.grooveD), thickness: E.bottomT },
      origin: { x: 0, y: bottomY, z: wz((backZ1 + frontZ0 + E.drawerFrontT - E.grooveD) / 2) },
      tenons: [],
      mortises: [],
    });
  }

  // ── 滑條 ×2（12 寬 × 14 高 × 310，鎖在側板內面、入抽屜側板槽 7）────────
  for (const ex of [0, 1] as const) {
    const cx = ex === 0 ? legInnerX + E.runnerW / 2 : W - legInnerX - E.runnerW / 2;
    parts.push({
      id: ex === 0 ? "runner-left" : "runner-right",
      nameZh: ex === 0 ? "抽屜滑條（左）" : "抽屜滑條（右）",
      nameEn: ex === 0 ? "Drawer runner (left)" : "Drawer runner (right)",
      material,
      grainDirection: "length",
      visible: { length: spanZ, width: E.runnerH, thickness: E.runnerW },
      origin: { x: wx(cx), y: (topBottomY - E.drawerTopGap - E.drawerSideBelowFront - E.slotBelowSideTop) - E.runnerH, z: 0 },
      rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
      tenons: [],
      mortises: [],
    });
  }

  if (W !== input.length || D !== input.width || H !== input.height) {
    warnings.push(isEn
      ? `Too small to build: clamped to ${W}×${D}×${H} mm.`
      : `尺寸太小做不出來：已夾到 ${W}×${D}×${H}mm（長寬下限就是考題尺寸 ${E.W}×${E.D}）。`);
  }
  if (W !== E.W || D !== E.D || H !== E.H) {
    warnings.push(isEn
      ? `Not the exam size: the official piece is ${E.W}×${E.D}×${E.H} mm (you have ${W}×${D}×${H}).`
      : `不是考題尺寸：官方試題是 ${E.W}×${E.D}×${E.H}mm（目前 ${W}×${D}×${H}）。練習可以，應檢要照官方尺寸。`);
  }
  if (pull > 0) warnings.push(isEn ? `Drawer shown pulled out ${pull} mm (display only).` : `抽屜拉出 ${pull}mm 只是展示，尺寸不變。`);

  const design: FurnitureDesign = {
    id: `cert-b2-${W}x${D}x${H}`,
    category: "cert-b2",
    nameZh: "家具木工乙級 第二題（01200-100202）",
    overall: { length: W, width: D, thickness: H },
    parts,
    defaultJoinery: "blind-tenon",
    useButtJointConvention: true,
    joineryOnly: true,
    primaryMaterial: material,
    notes: isEn
      ? `Practice piece drawn from the published dimensions of Taiwan's Class B furniture-woodworking trade test, question 01200-100202 (7 hours). A 482×400×420 mm four-legged nightstand with one drawer: legs 32×45 standing 10 mm proud of the top and 5 mm proud of the side panels; blockboard side panels 18×155×310 dowelled to the legs with three Ø8×30 dowels per end (12 into the solid-wood leg, 18 into the blockboard) and edged with 8 mm solid wood on top; blockboard top 418×368×18 with 8 mm solid edging front and back, dowelled sideways into the side panels at z = 72/200/328; blockboard back panel 418×132×18; a base frame of two 45×24 front/back rails (top 120 off the floor, 12 mm through tenons, 45 high, right through the 32 mm leg) and two 30×18 front-to-back rails (110 in from the leg faces, 10 mm tenons) — no rails on the left and right; a side-hung drawer 408×320 with a half-blind dovetailed front (12 mm sockets, 6 mm lap), 15 mm sides (cut length 314) in 15×8 runner slots, wooden runners 12×14, a 90 mm back and a 4 mm plywood bottom in 7 mm grooves. **Drawn from published dimensions — download the official paper and follow that version on test day.**`
      : `依技術士技能檢定家具木工乙級術科試題 01200-100202（7 小時）公開尺寸繪製的練習範本。482×400×420 的四腳單抽小櫃：腳柱 32×45，腳頂比天板高 10、比側板高 5；木心板側板 18×155×310（含上緣 8 實木封邊），每端 3 支 Ø8×30 木釘入腳（**入實木腳 12／入木心板 18**、由板頂 38｜39.5｜39.5）；木心板天板 418×368×18、前後各包 8 封邊，以 3 支水平木釘（z＝72／200／328）接側板；木心板背板 418×132×18，頂緣 3 支垂直木釘入天板、兩端各 2 支入腳；腳架是**前後兩支 45×24**（上緣離地 120、**貫穿榫**：滿 45 高 × 12 厚 × 穿透腳柱 32，厚度方向 6｜12｜6）＋**中間兩支 30×18**（離腳內面 110、比 45 檔低 7.5、榫 10｜10｜10）**，左右不設橫檔**；側掛抽屜 408×320：前板 130 高 18 厚（頂離天板底 2、正面比腳前面縮 15）與側板半隱鳩尾（榫孔深 12、留 6 面皮），側板切料長 **314**×110×15（＝抽屜外深 320 − 前板 18 + 入前板 12）外面開 15 高 × 8 深滑條槽，木滑條 12×14 以 ${E.runnerScrew} 鎖在側板內面（入槽 7、留 1 間隙），後板 378×90×15（頂比側板頂低 5）以 ${E.backScrew} 從側板鎖入、**後角不做鳩尾**（工作圖 B-B 只畫螺釘），4mm 合板底板入 7 深槽、以 ${E.bottomScrew} 鎖住後板底緣。官方材料表為 1~6 題共用一張。**本圖依公開尺寸自行繪製，不含官方圖檔；應檢請以技能檢定中心公布的官方版本為準。**
**官方有規定、本範本未做成造型**（只寫在說明裡）：腳底 3×45° 倒角（工作圖 C-C 有標，評審表「圓弧與倒角」有配分）、木螺釘本體（三種規格共 12 部位，評審表「五金裝配」有配分）。
**官方未規定、由本範本自訂**：30×18 檔的榫厚（取 10）與榫長（取 12）、鳩尾齒數（取 9 段）、滑條的前後起訖（取滿側板長）、抽屜側板切料長（隨鳩尾榫深浮動）。
**工時**：官方測驗時間 **7 小時**（應檢須知第十條；時間配當表上午 3.5 ＋ 下午 3.5）。工序表的估時是照一般木工節奏算的，會比 7 小時多——檢定現場的料已依材料表註 2「四面鉋光、要求直角」備妥、尺寸也接近成品，實際加工會快很多，而且**應檢不做塗裝**（須知第六條只准砂光）。
**依官方學科參考資料定的**：鳩尾斜度 1:6（§01-19、§05-4「1/6～1/8」）＝9.46°；半隱鳩尾榫深 12＝板厚 18 的 2/3（§05-10）；Ø8 木釘配 18 木心板（§05-24）。`,
  };
  if (warnings.length) design.warnings = warnings;
  return design;
};

/** 考題預設尺寸的完整設計（測試／探針用）。 */
export function certB2Assembly(): FurnitureDesign {
  const options: Record<string, string | number | boolean> = {};
  for (const s of certB2Options) options[s.key] = s.defaultValue;
  return certB2({ length: EXAM.W, width: EXAM.D, height: EXAM.H, material: "pine", options });
}
