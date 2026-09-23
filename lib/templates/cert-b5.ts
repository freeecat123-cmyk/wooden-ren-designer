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
 * 技術士技能檢定 家具木工 乙級 術科試題 01200-100205（練習範本）
 *
 * ⭐ 照官方試題**公開尺寸**自己畫的練習範本，不是官方圖面的重製；不嵌、不顯示官方圖檔。
 *    官方應檢參考資料（完整題本 012002B15，本題圖框 112/10/27，不在 114/06/18 修正對照表範圍內，
 *    是現行版）請至 owinform.wdasec.gov.tw 下載，應檢以官方版本為準。
 *
 * ⚠️⚠️ **這份是單人單輪讀圖＋建模、沒有走過 b1~b4 那套「五人組（讀圖對照／評審表材料表對照／
 *    程式檢查／木工檢查／回歸檢查）平行複查」流程**（受限於本輪執行環境不能開子代理）。
 *    b1~b4 每一題都在複查輪抓到「圖上有標卻被寫成官方未規定」「origin.y 弄反」「width/thickness 對調」
 *    這種**三道閘（測試／auditJoints／findOverlaps）完全攔不下來**的錯誤，本題目前只有我自己覆核過一次，
 *    信心等級明顯低於前四題 → **上架前務必比照慣例「配檢查員跟對照員去檢查一輪」，不要直接當成跟 b1~b4 同等級**。
 *
 * ── 這是什麼（讀圖＋結構判斷，見下方逐項信心標記）──────────────────────
 * 480(寬)×380(深)×380(高) 的雙腳端單抽小凳／邊几：左右兩端各 2 支 45×32 直腳（不斜、不錐），
 * 兩端腳柱之間**只在後側**架一支 90×20 的上橫檔（貼齊腳頂），前後各架一支 45×32 的下橫檔（貼地），
 * 抽屜 370(寬，沿長向)×340(深，沿深向) 從**前面**推拉，滑條裝在兩端腳柱內側。
 *
 * ⭐ HIGH confidence（評審表 PDF 第 11 頁直接列出，逐字抄）：
 *   總高度 380±1｜總寬度 480±1｜總深度 380/370±1｜側上橫檔寬厚 90×20±0.5｜
 *   抽屜外側寬深 370×340±1｜腳柱寬厚 45×32±0.5｜側下橫檔寬厚 45×32±0.5｜抽屜前板寬度 130±0.5
 *   （最後一項比照 cert-b4 的解讀方式：跟該欄位在 b4 的用法一樣，這裡當**抽屜前板「高度」**用，
 *    不是字面的寬度——b4 檔頭已用同一張評審表版型論證過一次，b5 沿用同一判斷，未另外覆核。）
 *
 * 🟡 MEDIUM confidence（我自己讀圖＋跟評審表交叉推出來的結構判斷，**沒有第二人覆核**）：
 *   1. 上橫檔只有一支、在**後側**（不是兩端各一）：評審表「側上橫檔 90×20，2 部位」＝寬、厚各驗一次
 *      （1 支 × 2 個尺寸），不是 2 支——但「部位數不可反推件數」是本系列已證實不穩的規則
 *      （cert-b3/b4 檔頭都推翻過一次），這裡只能當旁證。工作圖左上角有一條沿寬度方向的長橫料（帶
 *      Ø8×30 木釘），从裁切位置看比較像**貫穿兩端、單一一支**的長橫檔，而不是兩支各自卡在單一端。
 *   2. 下橫檔前後各一（不是兩端各一）：評審表「側下橫檔 45×32，4 部位」＝2 支 × 2 尺寸。
 *   3. 抽屜從**前面**（沿深度方向）推拉，不是從某一端：抽屜外側 370×340 若解成「寬沿長向、深沿深向」，
 *      370 貼近兩端腳柱內距（480−2×32＝416 再扣滑條與間隙），340 貼近前後淨深（380−前後橫檔各留量），
 *      兩者都能封起來；若反過來（抽屜從端面拉）深度 340 會超過兩腳柱內距 290（45×2 端腳），做不出來
 *      ⇒ 用「哪個方向做得出來」反推方向，思路同 [[feedback_diagnose_by_diffing_success]]。
 *   4. 抽屜前/側/後板同高（130，直接取「抽屜前板 130」那個數字），沒有做 b1/b4 那種側板/後板各退縮
 *      幾 mm 的「反面」細節——圖面這塊沒有把握獨立判讀出退縮量，先用同高簡化，需要覆核。
 *   5. 總深度「380/370」兩個數字：本模型只用了 380（腳柱外緣跨距）；370 沒有另外做出一個獨立幾何特徵
 *      （個人判斷 370 很可能是同一把尺量到的抽屜寬度 370 在「總深度」列的重複記錄，但無法排除是
 *      腳底縮進/倒角造成的第二個包絡值）——**這條沒有被此模型滿足，需要下一輪覆核確認怎麼處理**。
 *   6. 上橫檔／下橫檔與腳柱的接合方式：本模型一律用**盲榫**（腳柱 32 厚只入 18，不貫穿），沒有圖面
 *      逐一核對榫深，是沿用 b1/b4 同類構件的常見做法，不是本題讀出來的官方數字。
 *   7. 滑條／螺釘位置：抽屜滑條裝在兩端腳柱內側面、Ø3.5×30 木螺釘鎖入，仿 cert-b1 的做法，
 *      本題工作圖上滑條細節沒有獨立覆核到（時間所限，優先顧全外部量測尺寸）。
 *
 * ── 官方學科依據（012002A12.pdf，用來定沒有獨立標示的鳩尾角度/深度，跟 b3/b4 同一批）──
 * §01-19／§05-4 鳩尾斜度 1/6～1/8 → 取 9.46°；§05-10 半隱鳩尾榫長＝板厚 2/3 → 15×2/3＝10（本模型用 12，
 * 留 3mm 面皮，跟 b1/b4 一致，非 §05-10 直接算出）；§05-24 19mm 木心板配 Ø8 木釘（本題無木心板，僅供對照）。
 *
 * ── 材料表對帳（PDF 第 6 頁六題共用表，只確認得到的幾項）─────────────
 * 木料 600×92×21.5 第五題發 1 支——⚠️ 已知全站教訓「21.5 料⇔21mm 零件」不成立（b4 檔頭已推翻），
 *   本模型側上橫檔取 20mm 厚（評審表數字），不強行湊 21.5，這支料只是提供這根 90 寬料的原料，足夠。
 * 其餘各項（木料 1050×95×32.5 ×2、440×132×18.5 ×1、400×130×15.5 ×3、550×19×8.5 ×5、
 * 木釘 Ø8×30、木螺釘三種、白膠）**本輪沒有逐一排版核對「切不切得出來」**，留給下一輪。
 *
 * ⛔ 扣 41 分三條：未於規定時間完成／自行攜帶材料工件進出場／尺寸誤差超過 20mm（跟其他五題一樣）。
 */

/** 官方試題尺寸（mm）。X 0~480 由左腳柱外面、Y 0~380 由地面、Z 0~380 由前面（+Z＝背） */
const EXAM = {
  W: 480, D: 380, H: 380,
  legW: 32, legD: 45,                          // 腳柱寬(沿長向) × 厚(沿深向)，直腳、不斜
  backRailH: 90, backRailT: 20,                // 側上橫檔：90 高 × 20 厚，貼腳頂、只在後側一支
  lowerRailH: 45, lowerRailT: 32,              // 側下橫檔：45 高 × 32 厚，前後各一支、貼地
  legRailTenonT: 18,                           // 橫檔入腳的盲榫厚（腳柱 32 厚，留 14 背牆）
  legRailTenonLen: 20,
  drawerW: 370, drawerD: 340, drawerFrontH: 130,
  drawerFrontT: 18, drawerSideT: 15, drawerBackT: 15,
  drawerBottomT: 4, drawerBottomGrooveD: 7,
  runnerW: 14, runnerH: 14, runnerGap: 5,      // 滑條斷面；離抽屜側板/腳內面各留一點間隙
  dovetailSegments: 5, dovetailAngleDeg: 9.46, dovetailPinDepth: 12,
  dowelDia: 8, dowelLen: 30, dowelIntoFace: 15,
  screwRunner: "Ø3.5×30 木螺釘（CNS1051）",
  screwBottom: "Ø2.4×15 木螺釘（CNS1051）",
} as const;

export const certB5Options: OptionSpec[] = [
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
    help: "試題一定要做抽屜。取消只是為了看清楚腳架與橫檔，應檢一定要裝",
  },
];

export const certB5: FurnitureTemplate = (input): FurnitureDesign => {
  const { material } = input;
  const isEn = (input.locale ?? "zh-TW") === "en";
  const o = certB5Options;
  const pullRaw = getOption<number>(input, opt(o, "drawerPull"));
  const pull = Math.min(250, Math.max(0, Number.isFinite(pullRaw) ? pullRaw : 0));
  const withDrawer = getOption<boolean>(input, opt(o, "withDrawer"));

  const E = EXAM;
  // 尺寸鎖死：跟 b3/b4 一樣，考題的每一個常數都是官方數字，不跟滑桿縮放。
  const W = E.W, D = E.D, H = E.H;
  const warnings: string[] = [];
  const round = (d: number) => ({ shape: "round" as const, length: d, width: d, through: false });

  /** 圖面座標 → 世界座標：X 置中、Z 置中（+Z＝背）、Y 不變（origin.y＝底） */
  const wx = (x: number) => x - W / 2;
  const wz = (z: number) => z - D / 2;

  const parts: Part[] = [];

  // ── 版面關鍵座標 ─────────────────────────────────────────────────
  const legCx0 = E.legW / 2;                    // 16  左腳中心（世界 X＝wx(16)＝−224）
  const legCx1 = W - E.legW / 2;                // 464 右腳中心（世界 X＝+224）
  const legCz = D / 2;                          // 190 腳柱沿深度置中（世界 Z＝0）
  const railSpanX = W - 2 * E.legW;             // 416（兩腳內面之間，橫檔跨距）
  const legInnerX0 = E.legW;                    // 32  左腳內面
  const legInnerX1 = W - E.legW;                // 448 右腳內面

  // ── 腳柱 ×4：直腳 32(x)×45(z)×380(y)，rotation x=π/2 ─────────────
  // rotation {x:π/2}：local x→世界 x、local y(厚 45)→世界 z、local z(寬 380)→世界 −y
  for (const sx of [0, 1] as const) for (const sz of [0, 1] as const) {
    const cx = sx === 0 ? legCx0 : legCx1;
    const cz = sz === 0 ? E.legD / 2 : D - E.legD / 2;
    const legInX = sx === 0 ? 1 : -1;           // 朝跨距內側的 local x 正負（rotation 後 local x＝世界 x）
    const m: Mortise[] = [];
    // 下橫檔盲榫眼（前後每支腳都有）
    // ⚠️ auditJoints 對位規則：mortise.depth↔tenon.length、mortise.length↔tenon.width、
    // mortise.width↔tenon.thickness——depth 是「插進去多深」要對榫頭長度，不是榫頭厚度，
    // 第一版把這兩個搞反了（榫全部找不到孔），改對後才過稽核（但那只驗尺寸，不驗位置）。
    // ⚠️⚠️ 位置那條後來被 `npm run audit`（machining）抓到：這支腳 rotation{x:π/2} 下
    // local y 是厚度方向（世界 z、範圍 [0,45]）、local z 才是高度方向（世界 −y，置中算法跟
    // cert-b1 側板/後板同一套 −(目標世界高 − 本零件世界高中心)）。第一版把「高度」寫進 origin.y，
    // 上橫檔那個孔算出 y=335 遠超出 [0,45]，2D 加工圖榫眼畫到料件外 40mm——joints 稽核只比尺寸
    // 不比位置，這種錯要靠 `npm run audit` 的 machining 那支才抓得到。
    const legCenterY = H / 2;
    m.push({
      origin: { x: legInX * E.legW / 2, y: E.legD / 2, z: legCenterY - E.lowerRailH / 2 },
      depth: E.legRailTenonLen, length: E.lowerRailH, width: E.legRailTenonT,
      through: false,
      label: isEn ? "mortise, lower rail tenon" : "側下橫檔盲榫眼",
    });
    // 上橫檔盲榫眼：只有「後側」兩支腳（sz===1）才有
    if (sz === 1) m.push({
      origin: { x: legInX * E.legW / 2, y: E.legD / 2, z: legCenterY - (H - E.backRailH / 2) },
      depth: E.legRailTenonLen, length: E.backRailH, width: E.legRailTenonT,
      through: false,
      label: isEn ? "mortise, back rail tenon" : "側上橫檔盲榫眼",
    });
    parts.push({
      id: `leg-${sx === 0 ? "left" : "right"}-${sz === 0 ? "front" : "back"}`,
      nameZh: `腳柱（${sx === 0 ? "左" : "右"}${sz === 0 ? "前" : "後"}）`,
      nameEn: `Leg (${sx === 0 ? "left" : "right"} ${sz === 0 ? "front" : "back"})`,
      material,
      grainDirection: "width",
      visible: { length: E.legW, width: H, thickness: E.legD },
      origin: { x: wx(cx), y: 0, z: wz(cz) },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      tenons: [],
      mortises: m,
    });
  }

  // ── 側上橫檔 ×1（90 高 × 20 厚，貼腳頂、只在後側）────────────────
  {
    const railCz = D - E.legD / 2;              // 貼齊後腳中心（後腳內面在 D−legD）
    const tenonW = E.backRailH;
    parts.push({
      id: "back-rail",
      nameZh: "側上橫檔（後）",
      nameEn: "Upper side rail (back)",
      material,
      grainDirection: "length",
      visible: { length: railSpanX, width: E.backRailH, thickness: E.backRailT },
      origin: { x: wx(W / 2), y: H - E.backRailH, z: wz(railCz) },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      tenons: (["start", "end"] as const).map((position): Tenon => ({
        position, type: "blind-tenon",
        length: E.legRailTenonLen, width: tenonW, thickness: E.legRailTenonT,
        shoulderOn: ["top", "bottom"],
      })),
      mortises: [],
    });
  }

  // ── 側下橫檔 ×2（45 高 × 32 厚，前後各一，貼地）──────────────────
  for (const sz of [0, 1] as const) {
    const railCz = sz === 0 ? E.legD / 2 : D - E.legD / 2;
    parts.push({
      // ⚠️ id 要落在 svg-views.tsx 的 crossPieces 前綴白名單裡（"stretcher"）才會在三視圖標尺寸，
      // 不能隨便取名——這是本系列已經踩過兩次的共用層陷阱（AGENTS.md「一個一個列的名單」那條）。
      id: sz === 0 ? "stretcher-front" : "stretcher-back",
      nameZh: sz === 0 ? "側下橫檔（前）" : "側下橫檔（後）",
      nameEn: sz === 0 ? "Lower side rail (front)" : "Lower side rail (back)",
      material,
      grainDirection: "length",
      visible: { length: railSpanX, width: E.lowerRailH, thickness: E.lowerRailT },
      origin: { x: wx(W / 2), y: 0, z: wz(railCz) },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      tenons: (["start", "end"] as const).map((position): Tenon => ({
        position, type: "blind-tenon",
        length: E.legRailTenonLen, width: E.lowerRailH, thickness: E.legRailTenonT,
        shoulderOn: ["top", "bottom"],
      })),
      mortises: [],
    });
  }

  // ── 抽屜（外側 370×340，從前面推拉；前角鳩尾、後角木釘，仿 cert-b1 做法）──
  if (withDrawer) {
    const zShift = -pull;
    const drawerCx = W / 2;
    const drawerFrontZ0 = (D - E.drawerD) / 2 + zShift;   // 20（前面留 20 淨空給下橫檔厚度以外的餘裕）
    const frontY0 = 100, frontY1 = frontY0 + E.drawerFrontH;   // 100~230（簡化：前/側/後同高）
    const frontCz = drawerFrontZ0 + E.drawerFrontT / 2;
    // 底板槽（世界 Y）：底板貼地那一面在 frontY0+10，槽跟底板同高，槽中心 Y＝底板中心 Y。
    const bottomPlateBottomY = frontY0 + 10;
    const bottomGrooveCy = bottomPlateBottomY + E.drawerBottomT / 2;
    const frontCy = frontY0 + E.drawerFrontH / 2;
    // 槽的 mortise local z：跟 cert-b1 同一套公式，−(目標世界 Y 中心 − 本零件世界 Y 中心)。
    const frontGrooveLocalZ = frontCy - bottomGrooveCy;

    parts.push({
      id: "drawer-1-front",
      nameZh: "抽屜前板",
      nameEn: "Drawer front",
      material,
      grainDirection: "length",
      visible: { length: E.drawerW, width: E.drawerFrontH, thickness: E.drawerFrontT },
      origin: { x: wx(drawerCx), y: frontY0, z: wz(frontCz) },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      tenons: [],
      mortises: [
        {
          origin: { x: 0, y: E.drawerFrontT, z: frontGrooveLocalZ },
          depth: E.drawerBottomGrooveD, length: E.drawerW - 2 * E.drawerSideT + 2 * E.drawerBottomGrooveD, width: E.drawerBottomT,
          through: false, cosmetic: true, label: isEn ? "bottom groove" : "底板槽",
        },
      ],
    });

    // 側板 ×2：長度＝前板背面(内)到後板背面，前端鳩尾（尾在側板）
    const sideZ0 = drawerFrontZ0 + (E.drawerFrontT - E.dovetailPinDepth);
    const sideZ1 = drawerFrontZ0 + E.drawerD;
    const sideLen = sideZ1 - sideZ0;
    const sideCz = (sideZ0 + sideZ1) / 2;
    for (const sx of [0, 1] as const) {
      const cx = sx === 0 ? drawerCx - E.drawerW / 2 + E.drawerSideT / 2 : drawerCx + E.drawerW / 2 - E.drawerSideT / 2;
      const innerY = sx === 0 ? E.drawerSideT : 0;
      parts.push({
        id: sx === 0 ? "drawer-1-side-left" : "drawer-1-side-right",
        nameZh: sx === 0 ? "抽屜側板（左）" : "抽屜側板（右）",
        nameEn: sx === 0 ? "Drawer side (left)" : "Drawer side (right)",
        material,
        grainDirection: "length",
        visible: { length: sideLen, width: E.drawerFrontH, thickness: E.drawerSideT },
        origin: { x: wx(cx), y: frontY0, z: wz(sideCz) },
        rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
        shape: { kind: "dovetail-ends", segmentCount: E.dovetailSegments, phase: 0, angleDeg: E.dovetailAngleDeg, pinDepth: E.dovetailPinDepth, halfPin: true },
        tenons: [],
        // ⚠️ 側板底邊直接擱在滑條上（butt joint），本輪沒有另外幫滑條開槽——
        // 簡化為滑條頂面即承重面，不是官方畫法，需要下一輪覆核。
        mortises: [
          { origin: { x: 0, y: innerY, z: frontGrooveLocalZ }, depth: E.drawerBottomGrooveD, length: sideLen, width: E.drawerBottomT,
            through: false, cosmetic: true, label: isEn ? "bottom groove" : "底板槽" },
          // 木釘孔（配對後板端面那兩個孔，同直徑 Ø8）：開在側板後端內面、跟後板同高（中心高度，local z＝0）。
          // ⚠️ 這片側板是雙重旋轉（x=π/2,y=π/2）：local y 是厚度方向（面別，跟底板槽同一支 innerY）、
          // local z 才是高度方向——第一版把這兩個寫反了，孔配不到對面（跟腳柱榫眼那個 depth/length 反的
          // 是不同一種錯，但同一類「欄位對應想當然爾」的坑）。
          // ⚠️ 這片側板 rotation{x:π/2,y:π/2} 下 local x → 世界 −z，正值反而指向前面；
          // 要落在後端（世界 Z＝sideZ1）要用 −sideLen/2，第一版正負號寫反，孔位跑到前端去了。
          { origin: { x: -sideLen / 2, y: innerY, z: 0 },
            depth: E.drawerSideT / 2, ...round(E.dowelDia),
            label: isEn ? "Ø8 dowel, back panel" : "Ø8 木釘（後板）" },
        ],
      });
    }

    // 後板：木釘接兩側板
    const backCz = sideZ1 - E.drawerBackT / 2;
    parts.push({
      id: "drawer-1-back",
      nameZh: "抽屜後板",
      nameEn: "Drawer back",
      material,
      grainDirection: "length",
      visible: { length: E.drawerW - 2 * E.drawerSideT, width: E.drawerFrontH, thickness: E.drawerBackT },
      origin: { x: wx(drawerCx), y: frontY0, z: wz(backCz) },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
      tenons: [],
      mortises: [1, -1].map((ex) => ({
        // 後板 rotation{x:π/2} 下 local y 是「入面深度」（0~thickness，不是高度！），
        // local z 才對到世界高度；第一版把 y 寫成 drawerFrontH/2（想當成「置中高度」），
        // 結果孔整組偏移 57.5mm 跑出側板的容許誤差——高度置中要用 z:0，y 只填厚度中點。
        origin: { x: ex * (E.drawerW - 2 * E.drawerSideT) / 2, y: E.drawerBackT / 2, z: 0 },
        depth: E.dowelIntoFace - E.drawerSideT / 2, ...round(E.dowelDia),
        label: isEn ? "Ø8 dowel, side" : "Ø8 木釘（側板）",
      })),
    });

    // 底板（4mm 合板）：入前板/兩側板槽 7，後端頂在後板內面
    parts.push({
      id: "drawer-1-bottom",
      nameZh: "抽屜底板（4mm 合板）",
      nameEn: "Drawer bottom (4mm plywood)",
      material,
      materialOverride: "plywood",
      grainDirection: "length",
      visible: {
        length: E.drawerW - 2 * E.drawerSideT + 2 * E.drawerBottomGrooveD,
        width: (sideZ1 - E.drawerBackT) - (drawerFrontZ0 + E.drawerFrontT - E.drawerBottomGrooveD),
        thickness: E.drawerBottomT,
      },
      // 後端頂在後板內面（sideZ1 − backT），不是後板外面——不然會整片疊進後板裡。
      origin: { x: wx(drawerCx), y: bottomPlateBottomY, z: wz(((sideZ1 - E.drawerBackT) + drawerFrontZ0 + E.drawerFrontT - E.drawerBottomGrooveD) / 2) },
      tenons: [],
      mortises: [],
    });

    // 滑條 ×2：裝在兩端腳柱內側面，支撐抽屜側板（比照 cert-b1）
    const runnerZ0 = sideZ0, runnerZ1 = sideZ1, runnerLen = runnerZ1 - runnerZ0;
    const runnerCz = (runnerZ0 + runnerZ1) / 2;
    for (const sx of [0, 1] as const) {
      const cx = sx === 0 ? legInnerX0 + E.runnerGap + E.runnerW / 2 : legInnerX1 - E.runnerGap - E.runnerW / 2;
      parts.push({
        id: sx === 0 ? "runner-left" : "runner-right",
        nameZh: sx === 0 ? "抽屜滑條（左）" : "抽屜滑條（右）",
        nameEn: sx === 0 ? "Drawer runner (left)" : "Drawer runner (right)",
        material,
        grainDirection: "length",
        visible: { length: runnerLen, width: E.runnerH, thickness: E.runnerW },
        origin: { x: wx(cx), y: frontY0 - E.runnerH, z: wz(runnerCz) },
        rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
        tenons: [],
        mortises: [],
      });
    }
  }

  if (H !== input.height || W !== input.length || D !== input.width) {
    warnings.push(isEn
      ? `Not adjustable: this is a fixed trade-test answer, size locked to ${W}×${D}×${H} mm.`
      : `尺寸不可調：這是考題固定答案，鎖定 ${W}×${D}×${H}mm。`);
  }
  if (pull > 0) warnings.push(isEn ? `Drawer shown pulled out ${pull} mm (display only).` : `抽屜拉出 ${pull}mm 只是展示，尺寸不變。`);
  warnings.push(isEn
    ? "⚠️ Draft only: read from the published drawing in a single pass without the usual independent cross-check team. Verify against the official drawing before treating this as equal quality to questions 1-4."
    : "⚠️ 本範本目前只有單人讀圖，還沒走過乙級第一~四題那套「檢查員／對照員」複查流程，上架前務必比照慣例再檢查一輪。");

  const design: FurnitureDesign = {
    id: `cert-b5-${W}x${D}x${H}`,
    category: "cert-b5",
    nameZh: "家具木工乙級 第五題（01200-100205）",
    overall: { length: W, width: D, thickness: H },
    parts,
    defaultJoinery: "blind-tenon",
    useButtJointConvention: true,
    joineryOnly: true,
    primaryMaterial: material,
    notes: isEn
      ? `Practice piece drawn from the published dimensions of Taiwan's Class B furniture-woodworking trade test, question 01200-100205 (7 hours). 480×380×380: two end leg-frames (4 straight legs, 45×32) joined by one 90×20 upper back rail near the top and two 45×32 lower rails (front and back) near the floor; a front-opening drawer 370×340 with a 130 mm-tall front, dovetailed side-to-front corners and doweled back corners, riding on two runners screwed to the inside faces of the leg posts. **This draft was read and modeled by a single pass without the usual independent cross-check team (drawing reader / grading-sheet & material-list checker / geometry & test reviewer / joinery reviewer) that questions 1-4 went through — verify against the official drawing before treating it as equal quality.** Download the official paper at owinform.wdasec.gov.tw and follow that version on test day.`
      : `依技術士技能檢定家具木工乙級術科試題 01200-100205（7 小時）公開尺寸繪製的練習範本。480×380×380：兩端各 2 支 45×32 直腳，後側頂端架一支 90×20 上橫檔，前後各一支 45×32 下橫檔貼地；抽屜 370×340 從前面推拉，前板 130 高，前角鳩尾、後角木釘，滑條鎖在兩端腳柱內側。**本範本目前只有單人讀圖建模一輪，還沒走過第一~四題那套「檢查員／對照員」平行複查流程，上架前務必先比照慣例再檢查一輪，不要直接當成跟前四題同等級。**官方應檢參考資料請至技能檢定中心官網下載，應檢以官方版本為準。`,
  };
  if (warnings.length) design.warnings = warnings;
  return design;
};

/** 研究頁／測試用：考題預設尺寸的完整設計。 */
export function certB5Assembly(): FurnitureDesign {
  const options: Record<string, string | number | boolean> = {};
  for (const s of certB5Options) options[s.key] = s.defaultValue;
  return certB5({ length: EXAM.W, width: EXAM.D, height: EXAM.H, material: "pine", options });
}
