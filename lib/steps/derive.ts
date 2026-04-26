import type { FurnitureCategory, FurnitureDesign, JoineryType } from "@/lib/types";
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
  /** 細部要點清單，bullet 形式呈現比段落好讀 */
  bullets?: string[];
}

const JOINERY_CUT_TOOLS: Record<JoineryType, string[]> = {
  "through-tenon": ["japanese-saw", "chisel-set-3-6-12", "mallet"],
  "blind-tenon": ["japanese-saw", "chisel-set-3-6-12", "mallet"],
  "shouldered-tenon": ["japanese-saw", "chisel-set-3-6-12", "mallet"],
  "stub-joint": ["chisel-set-3-6-12", "mallet", "router-table"],
  "half-lap": ["japanese-saw", "chisel-set-3-6-12"],
  dovetail: ["dovetail-saw", "dovetail-marker", "chisel-set-3-6-12"],
  "finger-joint": ["chisel-set-3-6-12", "router-table"],
  "tongue-and-groove": ["groove-plane", "groove-blade"],
  dowel: ["dowel-jig", "drill", "drill-bits"],
  "mitered-spline": ["japanese-saw", "groove-blade"],
  "pocket-hole": ["pocket-hole-jig", "drill", "drill-bits"],
  screw: ["drill", "drill-bits"],
};

/** 家具大類別歸類，給工序加分支用 */
function categoryFamily(c: FurnitureCategory): "table" | "seating" | "cabinet" | "accessory" | "other" {
  if (
    c === "tea-table" || c === "side-table" || c === "low-table" ||
    c === "dining-table" || c === "desk" || c === "round-tea-table" ||
    c === "round-table"
  ) return "table";
  if (
    c === "stool" || c === "bench" || c === "dining-chair" ||
    c === "bar-stool" || c === "round-stool"
  ) return "seating";
  if (
    c === "open-bookshelf" || c === "chest-of-drawers" || c === "shoe-cabinet" ||
    c === "display-cabinet" || c === "wardrobe" || c === "media-console" ||
    c === "nightstand"
  ) return "cabinet";
  if (
    c === "pencil-holder" || c === "bookend" || c === "photo-frame" ||
    c === "tray" || c === "dovetail-box" || c === "wine-rack" || c === "coat-rack"
  ) return "accessory";
  return "other";
}

export function deriveBuildSteps(design: FurnitureDesign): BuildStep[] {
  const steps: BuildStep[] = [];
  const material = MATERIALS[design.primaryMaterial];
  const joineryUsages = extractJoineryUsages(design);
  const hasJoinery = joineryUsages.length > 0;
  const isHardwood = material.hardness >= 5000;
  const isLong = design.overall.length > 1200;
  const family = categoryFamily(design.category);

  const hasDrawer = design.parts.some((p) => /(?:^|-)drawer/.test(p.id) && /front|side|back|bottom/.test(p.id));
  const hasDoor = design.parts.some((p) => /door|panel/.test(p.id));
  const hasBack = design.parts.some((p) => p.id === "back-panel" || /^back-/.test(p.id));
  const hasShelves = design.parts.some((p) => /shelf|shelves/.test(p.id));
  const hasUpperApron = design.parts.some((p) => /apron|stretcher/.test(p.id));
  const isRoundTop = design.parts.some((p) => p.shape?.kind === "round" && /top|seat/.test(p.id));
  const wideTop = isRoundTop && design.overall.length >= 600;

  // ---------------------------------------------------------------------------
  // 1. 備料 — 拆成「選料」「平刨」「厚刨」「整理基準面」4 步
  // ---------------------------------------------------------------------------
  steps.push({
    id: "step-01-select-stock",
    phase: "prepare",
    title: "選料與檢查",
    description:
      `${material.nameZh}（密度約 ${material.density} kg/m³）。挑料時優先選紋路順、無大節疤、`
      + `應力釋放完成（板邊不翹）。預留 5–10% 切料損耗——大件家具不要省這個 buffer。`,
    toolIds: ["tape-measure-5m"],
    estimatedMinutes: 30,
    bullets: [
      "含水率必須 12% 以下（北部冬天理想 8–10%）；含水率高的料組裝後乾縮會把榫頭撐裂",
      "顏色 / 紋路相近的料留給看得到的面（桌面、座板、門板）",
      "節疤大於 10mm 的避開承重結構部位",
      isHardwood
        ? "硬木（白橡 / 山毛櫸）刀具務必磨利再加工，崩刃會傷料也傷人"
        : "軟木（松 / 杉）刨削容易撕紋，刨刀角度抬高一點、走慢一點",
    ],
    warnings: isHardwood
      ? ["硬木鋸切時注意鋸路發燙——鋸到一半停一下讓鋸片散熱，避免鋸齒退火"]
      : undefined,
  });

  steps.push({
    id: "step-02-jointer-planer",
    phase: "prepare",
    title: "平刨 + 厚刨整平",
    description:
      `用平刨整出「一個基準面 + 一個 90° 邊」（兩個面互成直角），再用厚刨把對面刨成`
      + `跟基準面平行的尺寸。沒有平刨厚刨的話，買整平好的木料（規料）回來就直接跳到下一步。`,
    toolIds: ["jointer-planer", "thicknesser", "try-square"],
    estimatedMinutes: 60,
    bullets: [
      "平刨先過大面（基準面），手感變平 + 直角尺貼著兩面無縫就過關",
      "厚刨每次過刨深度 ≤ 1.5mm（硬木 ≤ 1mm），多刀比一次猛刨不會把料撐裂",
      "刨完留 0.5mm 砂磨餘量；別刨到剛好，砂磨還會再去 0.3–0.5mm",
    ],
  });

  // ---------------------------------------------------------------------------
  // 2. 切料 — 按長到短切、按長到短編號
  // ---------------------------------------------------------------------------
  const totalParts = design.parts.length;
  steps.push({
    id: "step-03-cut-stock",
    phase: "cut-stock",
    title: `按材料單切料 ${totalParts} 件`,
    description:
      `把整平好的長料按「材料單」切成各個零件。`
      + (hasJoinery ? `**注意**：含榫零件的切料長度已包含榫頭凸出量，請勿再額外加長。` : "")
      + `切完馬上用鉛筆 / 編號膠帶在每件側邊標記零件 id（例如 leg-l-f / apron-front），`
      + `避免後面試組時搞混分不清誰是誰。`,
    toolIds: ["tape-measure-5m", "try-square", "japanese-saw"],
    partIds: design.parts.map((p) => p.id),
    estimatedMinutes: 18 * totalParts,
    bullets: [
      "**從最長的零件先切**——長料切短沒問題，但短料絕對接不回長",
      "鋸切前畫直角線（用直角尺 + 鉛筆／劃線刀），鋸線留在「廢料側」",
      "切完每件用直角尺檢查兩端是否方正——歪了現在還能用刨刀修，組裝後就回不去",
      hasJoinery
        ? "材料單上「可見尺寸」與「切料尺寸」是兩個值，含榫零件兩者會差榫頭長度——切料用「切料尺寸」"
        : "組裝版（butt joint）切料尺寸 = 可見尺寸，直接用",
    ],
    warnings: ["切料前再核對一次材料單尺寸，鋸下去就回不來"],
  });

  // ---------------------------------------------------------------------------
  // 寬桌面 / 圓桌面：拼板專屬步驟
  // ---------------------------------------------------------------------------
  if (wideTop) {
    steps.push({
      id: "step-03b-glue-up-top",
      phase: "glue",
      title: `拼板 — ${design.overall.length}mm 桌面`,
      description:
        `直徑 ${design.overall.length}mm 的桌面通常需要 3–5 片實木（每片寬 150–200mm）拼起來。`
        + `拼板要點：紋路方向交錯（一上一下）抗翹曲；接合面用花榫片或長榫條補強；`
        + `拼板膠 + 平行夾具夾 8 小時以上再鬆夾。`,
      toolIds: ["pva-glue", "f-clamp-x4", "long-clamp-x2", "biscuit-joiner", "try-square"],
      estimatedMinutes: 90,
      bullets: [
        "拼板前所有接合面用平刨整成完美 90°；接合面有縫上膠夾完還是有縫",
        "排好順序看紋路——年輪「↑↓↑↓」交錯排可抗翹曲",
        "上膠後從中間往兩端依序夾，避免拼板拱起來",
        "8 小時固化 → 鬆夾 → 用厚刨或砂帶機把拼板兩面整平 → 才能切圓",
      ],
      warnings: ["拼板務必用實木拼板膠（PVA 黃膠），絕不能用 AB 膠或 502——會脆裂"],
    });

    steps.push({
      id: "step-03c-cut-circle",
      phase: "cut-stock",
      title: `切圓桌面（${design.overall.length}mm 直徑）`,
      description:
        `拼板乾燥後在桌面中心釘一個 dish 軸點，用線鋸 / 修邊機 + 圓規夾具切出圓形。`
        + `初切先留 5mm 餘量，細修用修邊機 + 軸承導引刀刨平圓邊。`,
      toolIds: ["jigsaw", "router-table", "tape-measure-5m"],
      estimatedMinutes: 60,
      bullets: [
        "用線鋸先粗切離畫線 5mm；不要直接想一刀切到準",
        "修邊機 + 圓規夾具 + 直邊刀沿軸點旋轉收邊，一刀深 ≤ 3mm 多次",
        "圓邊要再用 R5–R10 倒角刀做手感（不然桌邊割人）",
      ],
    });
  }

  // ---------------------------------------------------------------------------
  // 3. 劃線 — 榫卯標記 + 基準面標記
  // ---------------------------------------------------------------------------
  if (joineryUsages.length > 0) {
    steps.push({
      id: "step-04-mark",
      phase: "mark",
      title: "榫卯劃線（榫頭 + 榫眼）",
      description:
        `依「榫卯細節圖」把每個零件的榫頭 / 榫眼位置劃出來。`
        + `劃完先全部對著三視圖檢查一遍，沒問題才開始鋸鑿。`,
      toolIds: [
        "marking-gauge",
        "try-square",
        ...(joineryUsages.some((u) => u.type === "dovetail")
          ? ["dovetail-marker"]
          : []),
      ],
      estimatedMinutes: 12 * joineryUsages.length,
      bullets: [
        "**先標基準面**：每件零件選一個面當「基準」，全部劃線都從基準面測量，這樣 0.5mm 誤差不會累積",
        "劃線一律用劃線規 / 小刀刻線——鉛筆有 0.3mm 寬度，鋸下去就差 0.3mm",
        "肩線 / 鋸線用刀劃出 V 槽，鋸齒會自然落進槽內不偏",
        "同類型榫卯（例如 4 條牙條的 8 個榫頭）一次標完，避免來回換工具與量具",
      ],
      warnings: ["劃線錯了現在還能擦掉重來；切下去就只能補木屑塞縫"],
    });
  }

  // ---------------------------------------------------------------------------
  // 4. 鋸鑿榫卯 — 依類型分批
  // ---------------------------------------------------------------------------
  for (let i = 0; i < joineryUsages.length; i++) {
    const u = joineryUsages[i];
    steps.push({
      id: `step-05-${i + 1}-${u.type}`,
      phase: "cut-joinery",
      title: `製作 ${JOINERY_LABEL[u.type]}（${u.count} 處）`,
      description:
        `榫頭 ${u.tenon.length} × ${u.tenon.width} × ${u.tenon.thickness}mm，`
        + `對應母件厚約 ${u.estimatedMotherThickness}mm。**先做榫頭再做榫眼**，最後試插。`,
      toolIds: [
        ...JOINERY_CUT_TOOLS[u.type],
        ...(isHardwood &&
        (u.type === "through-tenon" ||
          u.type === "blind-tenon" ||
          u.type === "shouldered-tenon")
          ? ["chisel-hardwood"]
          : []),
      ],
      estimatedMinutes: 22 * u.count,
      bullets:
        u.type === "through-tenon"
          ? [
              "通榫穿透母件——榫眼從正反兩面對劃，正面鑿到中間翻過來鑿到中間，避免單邊鑿到底邊崩裂",
              "榫頭尾端可以斜一點點（0.2mm）方便引導入榫；插進去再用木鎚敲緊",
              "通榫穿出母件的 1–2mm 凸出可保留作為視覺特色（或削平砂平）",
            ]
          : u.type === "blind-tenon"
            ? [
                "盲榫深度 ≤ 母件厚的 2/3；鑿太深會穿出去",
                "鑿榫眼前在鑿子上做深度標記（膠帶纏一圈），避免一鑿太深",
                "榫頭比榫眼短 1mm 留膠縫——不然榫頭頂到底膠合不密",
              ]
            : u.type === "shouldered-tenon"
              ? [
                  "帶肩榫的肩寬固定 6mm（兩側）——肩太窄結構弱、太寬料費還難看",
                  "鋸肩線要比榫頭線深 0.5mm，膠合時肩才能緊貼母件正面",
                  "榫厚 = min(apron 厚 - 12, 腳粗 / 3)——太厚母件會撐裂",
                ]
              : u.type === "dovetail"
                ? [
                  "傳統做法「先做尾後做榫」（先尾後榫法），尾用尾為母件劃榫線，配合度最高",
                  "尾鋸時鋸線留在廢料側 0.3mm，鑿削修到正好",
                  "鳩尾夾角硬木約 1:8、軟木約 1:6（角度過小拉力不夠、過大易斷）",
                  ]
                : u.type === "tongue-and-groove"
                  ? [
                      "舌厚 = 母件厚的 1/3；舌太厚槽會撐裂",
                      "槽要比舌深 1mm 留膠縫",
                      "舌的兩肩各留 1mm 防裂",
                    ]
                  : [
                      "鋸線留在廢料側，鑿削多次淺鑿（單刀 ≤ 1mm 深）比一次重鑿不會崩",
                      "做完一個馬上試插，符合再做下一個——前面修錯後面才不會踩同樣雷",
                    ],
    });
  }

  // ---------------------------------------------------------------------------
  // 5. 試組 — 全件無膠 dry fit
  // ---------------------------------------------------------------------------
  steps.push({
    id: "step-06-dry-fit",
    phase: "fit",
    title: "乾組試裝（不上膠）",
    description: hasJoinery
      ? `不上膠先把所有榫卯試插一次。**緊的地方修榫頭、不要修榫眼**——榫眼是母件結構，`
        + `修壞了整件報廢。理想配合度：手指輕推能進、稍微敲一下到底、拔出來要花點力氣。`
      : `不上膠先把所有零件依順序試擺一次。`,
    toolIds: hasJoinery
      ? ["mallet", "chisel-set-3-6-12", "try-square", "tape-measure-5m"]
      : ["try-square", "tape-measure-5m"],
    estimatedMinutes: 25,
    bullets: [
      "試組順序跟膠合順序要一樣——先做小組件（腳架、抽屜箱），再合成大件",
      "用直角尺在組好的小組件四個角檢查 90°；歪了現在還能調",
      "對角線量一下：兩條對角線等長就方正、不等就歪了",
      hasJoinery
        ? "榫頭太緊**輕削**，每次 0.2mm，一邊削一邊試插；猛削會變鬆"
        : "板對板組裝先試後鎖；先夾緊+對齊再下螺絲，不要鎖完再校正位置",
    ],
    warnings: hasJoinery
      ? ["榫頭太緊硬敲——膠合時膠水讓木材膨脹，會把母件撐裂"]
      : ["乾組試裝就要找出對位問題；上膠後膠水固化的 10 分鐘內你只能盲調"],
  });

  // ---------------------------------------------------------------------------
  // 6. 子組件膠合 — 依家具類別決定先組什麼
  // ---------------------------------------------------------------------------
  if (family === "table" || family === "seating") {
    if (hasUpperApron) {
      steps.push({
        id: "step-07a-glue-frame",
        phase: "glue",
        title: "膠合腳架（先做兩個側框）",
        description:
          `桌 / 椅腳組裝原則：**永遠不要一次組 4 隻腳**。先做「左側框」（左前腳 + 左後腳 + 左牙板）`
          + `跟「右側框」，等兩個側框膠乾後（24 小時）再用前後牙板把它們連起來。`
          + `分階段組可以避免你 10 分鐘內要對齊 4 個榫卯來不及。`,
        toolIds: ["pva-glue", "f-clamp-x4", "try-square"],
        estimatedMinutes: 30,
        bullets: [
          "兩個側框各自夾緊到完全方正（直角尺 + 對角線檢查）",
          "夾合面墊「夾木」（一片 5mm 厚的廢料），避免夾頭壓痕到家具表面",
          "等 24 小時——24 小時後再合大件，PVA 完全固化",
        ],
        warnings: ["膠水開始凝固後（10 分鐘）再調整位置，膠縫就會破壞，再固化強度只剩一半"],
      });
    }
  }

  if (family === "cabinet" && hasDrawer) {
    steps.push({
      id: "step-07b-glue-drawer-box",
      phase: "glue",
      title: "組抽屜箱（前 + 後 + 兩側 + 底）",
      description:
        `每個抽屜獨立組裝。順序：先做「前 + 兩側」（鳩尾或半搭接），確認方正再裝後板，`
        + `最後底板從後方滑入凹槽（不上膠，讓底板能熱漲冷縮）。`,
      toolIds: ["pva-glue", "f-clamp-x4", "try-square", "rubber-mallet"],
      estimatedMinutes: 40,
      bullets: [
        "抽屜箱要做到完全方正——歪了滑入櫃體會卡住",
        "底板留 1mm 膠縫不上膠，底板可以隨季節熱漲冷縮不撐裂側板",
        "抽屜面板（drawer-front）等抽屜箱乾透後再用螺絲從箱體前面鎖上去（可調整位置）",
      ],
    });
  }

  if (family === "cabinet" && hasDoor) {
    steps.push({
      id: "step-07c-glue-door",
      phase: "glue",
      title: "組門板（鑲板或夾板貼皮）",
      description:
        `木鑲板門：上下橫木 + 兩側立柱組成方框，中間鑲板**不上膠**鬆鬆插入凹槽，`
        + `留 2mm 膨脹間隙。夾板貼皮平板門：直接切板裁邊，4 邊鎖封邊膠帶。`,
      toolIds: ["pva-glue", "f-clamp-x4", "try-square"],
      estimatedMinutes: 30,
      bullets: [
        "鑲板絕對不能膠合到框體——木材熱漲冷縮會把框撐裂",
        "鑲板四邊塗蠟或漆好後再裝框，避免冬天縮起來露出沒漆的木邊",
        "門組合後測對角線方正，歪了夾正再等 24 小時固化",
      ],
    });
  }

  // ---------------------------------------------------------------------------
  // 7. 最終膠合 — 大件組合
  // ---------------------------------------------------------------------------
  steps.push({
    id: "step-08-glue-final",
    phase: "glue",
    title: "最終膠合（合大件）",
    description: hasJoinery
      ? `把已組好的子組件（腳架 / 抽屜箱 / 門 等）跟主結構（桌面 / 櫃體側板 / 背板）膠合起來。`
        + `太棒膠二號（PVA）薄塗在榫頭與榫眼內壁——薄塗 1mm 即可，太厚溢膠難清。`
      : `太棒膠二號（PVA）薄塗於板對板接合面，依試組順序組裝，依序鎖斜孔螺絲 / 打木釘 + 夾緊。`,
    toolIds: [
      "pva-glue",
      "f-clamp-x4",
      ...(isLong ? ["long-clamp-x2"] : []),
      "try-square",
      "rubber-mallet",
    ],
    estimatedMinutes: 50,
    bullets: [
      "**膠合前所有夾具預備好**——PVA 開放時間只有 8–10 分鐘，你沒時間找夾具",
      "夾緊後立刻用濕布擦溢膠，乾掉後吃不上塗料留下白印",
      "夾合後馬上量對角線——歪了立刻鬆夾調整再夾，膠水還沒固化前還能救",
      "靜置 24 小時完全固化才能鬆夾砂磨；6 小時可動但強度只到一半",
    ],
    warnings: [
      "膠合 + 夾緊的整個流程一次完成（10 分鐘內），中途不要分心",
      "夾頭跟家具之間墊夾木，否則金屬夾頭會壓出永久痕跡",
    ],
  });

  // ---------------------------------------------------------------------------
  // 8. 背板 / 層板（櫃類專屬）
  // ---------------------------------------------------------------------------
  if (family === "cabinet" && hasBack) {
    steps.push({
      id: "step-09-back-panel",
      phase: "glue",
      title: "裝背板",
      description:
        `背板從後方插入櫃體背面凹槽（夾板可上膠，實木拼板背板**不上膠**讓它熱漲冷縮）。`
        + `用 18mm 釘從外側打進凹槽四邊固定。`,
      toolIds: ["nail-gun", "rubber-mallet"],
      estimatedMinutes: 20,
    });
  }

  if (family === "cabinet" && hasShelves) {
    steps.push({
      id: "step-10-shelves",
      phase: "fit",
      title: "裝層板",
      description:
        `固定層板用木膠 + 螺絲鎖到側板的層板槽；可調層板用層板托釘（5mm 鋁釘）插入側板的孔位。`,
      toolIds: ["drill", "drill-bits", "shelf-pin"],
      estimatedMinutes: 25,
    });
  }

  // ---------------------------------------------------------------------------
  // 9. 砂磨 — 4 階段細化
  // ---------------------------------------------------------------------------
  steps.push({
    id: "step-11-sand-coarse",
    phase: "sand",
    title: "砂磨第 1 道（120 番去刨痕）",
    description: `用 120 番砂紙把所有面的刨痕、鋸切痕、膠痕磨掉。**順木紋方向**砂磨，逆紋會留下橫向刮痕怎麼磨都磨不掉。`,
    toolIds: ["sandpaper-set", "orbital-sander"],
    estimatedMinutes: 50,
    bullets: [
      "硬木（白橡 / 山毛櫸）刨痕深可從 100 番起；軟木（松 / 杉）120 番足夠",
      "用震盪式砂磨機（orbital sander）效率高，但邊角處改用手砂避免磨圓",
      "邊角輕輕倒角（1mm 圓角），銳利邊角會在使用時刮人也容易掉漆",
    ],
  });

  steps.push({
    id: "step-12-sand-medium",
    phase: "sand",
    title: "砂磨第 2 道（180 番細化）",
    description: `換 180 番。把上一道 120 番留下的劃痕完全磨掉再進下一道——上一道痕跡沒磨掉的話，後面油漆上去全部都看得到。`,
    toolIds: ["sandpaper-set", "orbital-sander"],
    estimatedMinutes: 40,
  });

  steps.push({
    id: "step-13-sand-fine",
    phase: "sand",
    title: "砂磨第 3 道（240 番）",
    description: `用 240 番做最後細修，準備上漆 / 上油的表面狀態。砂完用乾淨棉布或氣槍吹掉所有粉塵，不能殘留——不然第一層漆會吃灰塵變粗糙。`,
    toolIds: ["sandpaper-set", "tack-cloth"],
    estimatedMinutes: 30,
  });

  // ---------------------------------------------------------------------------
  // 10. 塗裝 — 護木油 3 層
  // ---------------------------------------------------------------------------
  steps.push({
    id: "step-14-finish-coat-1",
    phase: "finish",
    title: "上護木油第 1 層",
    description:
      `用棉布薄塗護木油（建議 OSMO 木蠟油 / 立邦木油 / 大師牌護木油）。靜置 15 分鐘讓木材吸收，`
      + `再用乾淨棉布擦掉所有多餘的油（一定要擦掉，不擦會殘留變黏膩）。等 12–24 小時乾燥。`,
    toolIds: ["wood-oil", "lint-free-cloth"],
    estimatedMinutes: 35,
    warnings: [
      "**沾油棉布會自燃！** 用完攤開晾乾或浸水後丟棄，不要揉成一團——氧化反應放熱會起火",
    ],
  });

  steps.push({
    id: "step-15-burnish",
    phase: "finish",
    title: "0000 鋼絲絨輕磨",
    description: `第一層完全乾透後（24 小時）用 0000 號鋼絲絨輕磨整個表面，把吸油凸起的木纖維磨平。磨完用乾棉布擦乾淨。這步是讓表面「絲滑」的關鍵。`,
    toolIds: ["steel-wool-0000", "lint-free-cloth"],
    estimatedMinutes: 20,
  });

  steps.push({
    id: "step-16-finish-coat-2",
    phase: "finish",
    title: "上護木油第 2 層",
    description: `重複第 1 層的程序：薄塗 → 靜置 15 分鐘 → 擦淨多餘油 → 等 24 小時乾燥。第 2 層後表面會明顯滑順、有暖光澤。日常使用 2 層足夠；高使用面（桌面、椅面）建議 3 層。`,
    toolIds: ["wood-oil", "lint-free-cloth"],
    estimatedMinutes: 35,
  });

  if (family === "table" || family === "seating") {
    steps.push({
      id: "step-17-finish-coat-3",
      phase: "finish",
      title: "上護木油第 3 層（桌椅承重面建議）",
      description:
        `桌面 / 椅面 / 工作面建議再加第 3 層做防護。每天會接觸到的表面（餐桌 / 書桌）`
        + `油膜薄會很快磨損，3 層才能撐 2–3 年再保養。`,
      toolIds: ["wood-oil", "lint-free-cloth"],
      estimatedMinutes: 30,
    });
  }

  // ---------------------------------------------------------------------------
  // 11. 五金 / 配件
  // ---------------------------------------------------------------------------
  if (hasDoor) {
    steps.push({
      id: "step-18-hinges",
      phase: "fit",
      title: "裝鉸鏈與門把",
      description:
        `西德鉸鏈（杯型隱藏鉸鏈）：先在門板背面用 35mm forstner 鑽頭鑽鉸鏈杯孔，`
        + `深度 12mm。把鉸鏈固定在門上，再對位螺絲到櫃體側板。門關起來後微調 3 個螺絲（前後 / 左右 / 上下）讓門縫等距。`,
      toolIds: ["drill", "forstner-bit-35", "screwdriver", "level"],
      estimatedMinutes: 30 * (design.parts.filter((p) => /door/.test(p.id)).length || 1),
      bullets: [
        "西德鉸鏈標準位置：門上下端各往內 100mm 裝一個鉸鏈；門高 > 1m 中間再加 1 個",
        "門縫標準 3mm 平均；歪了用鉸鏈三向調整螺絲微調",
      ],
    });
  }

  if (hasDrawer) {
    steps.push({
      id: "step-19-drawer-slide",
      phase: "fit",
      title: "裝抽屜滑軌（如使用）",
      description:
        `三節滑軌：先把滑軌的「外軌」鎖到櫃體側板，「內軌」鎖到抽屜箱側板。`
        + `兩軌的高度位置必須完全水平、左右對齊，不然抽屜推進去會卡。傳統作法不用滑軌而用木滑條也可以。`,
      toolIds: ["drill", "drill-bits", "level", "tape-measure-5m"],
      estimatedMinutes: 40,
      bullets: [
        "滑軌前緣要跟櫃體前緣切齊（裝抽屜面板才能蓋過滑軌）",
        "雙側滑軌高度誤差 ≤ 1mm；3mm 以上抽屜會卡",
      ],
    });
  }

  // ---------------------------------------------------------------------------
  // 12. 完工驗收
  // ---------------------------------------------------------------------------
  steps.push({
    id: "step-99-final-check",
    phase: "finish",
    title: "完工檢查與驗收",
    description: `所有膠 / 油完全乾透後（總計 72 小時）做最終檢查。`,
    toolIds: ["try-square", "tape-measure-5m", "level"],
    estimatedMinutes: 20,
    bullets: [
      "**方正度**：4 個立面用直角尺檢查 90°；對角線量等長",
      "**水平**：水平儀放桌面 / 座板測無偏向",
      "**穩定度**：搖晃整件家具，腳是否平貼地面（單腳離地的話用刨刀修最長腳）",
      hasDoor ? "門縫均等 3mm，開關順暢" : "",
      hasDrawer ? "抽屜推拉順暢，無卡頓、無傾斜" : "",
      "塗裝表面摸起來絲滑無顆粒、無漏塗區域",
    ].filter(Boolean),
  });

  return steps;
}

export function totalEstimatedHours(steps: BuildStep[]): number {
  const min = steps.reduce((s, st) => s + (st.estimatedMinutes ?? 0), 0);
  return Math.round((min / 60) * 10) / 10;
}
