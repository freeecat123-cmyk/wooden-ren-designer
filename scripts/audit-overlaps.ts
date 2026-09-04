/**
 * Audit zero-tolerance part overlaps for every furniture template.
 *
 * 跑每個 FURNITURE_CATALOG 條目對組裝版（無榫，預設模式）做 Y-segmented
 * silhouette overlap 偵測（drafting-math §A11 D.2，2026-05-01 改架構）：
 *
 *   Stage 1 — AABB 體積相交（fast reject）
 *   Stage 2 — Y-slice silhouette 接觸（在 Y 交集區間採樣 24 層，每層用
 *             front/side silhouette 取 X/Z 區間 = AABB-at-Y；任一層 X∩Z >
 *             tolerance 才算真 overlap）
 *
 * Y-slice 把 OBB 的「常數截面」死角解掉——tapered 腳在低 Y 自動縮、splayed
 * 腳自動位移，AABB-at-Y 跟著實際幾何走。
 *
 * Parametrize：對 `legShape` 這類 select 選項，每個 choice 各跑一次。
 *
 * Run: npx tsx scripts/audit-overlaps.ts [--joinery]
 *      --joinery 旗標：用榫接版（保留 tenons/mortises）跑 audit
 */

/**
 * Template-level 設計殘差 allowlist——保留以擋將來新模板的非預期 false
 * positive。2026-05-01 D.2 完整收尾後此清單為空（120/120 全綠）：
 *
 *   - bracket: 改成端面對腳（不嵌入），audit 通過
 *   - strong-taper (dining-chair): 套 apron-trapezoid + 修正 apronInnerSpan
 *     公式（length − legSize − apronLegSize 而非 length − 2*apronLegSize）
 *   - splayed-tapered family / round-taper-up（圓家具）：圓家具 builder 加
 *     legBottomScale 路徑 + apron-trapezoid，silhouette code tapered
 *     X/Z 雙軸線性內插（取代 step-function isBottom）
 *   - pedestal: foot origin 改成從柱外面延伸（不嵌入柱）
 */
const SHAPE_AWARE_VARIANTS = new Set<string>([]);
/**
 * `${category}:${variant}` allowlist——shape-aware silhouette 看不到的 X-Z
 * 缺口造成的 audit false positive：
 *   - tea-table × box / tapered: shelf 用 notched-corners 切角避腳柱，
 *     overlap 偵測 silhouette（front/side）看不到 X-Z 缺角，誤判 leg×shelf。
 *     實際 3D 棚板四角已切除，物理上不重疊。
 */
const SHAPE_AWARE_CASES = new Set<string>([
  // 方凳弧肩斜腳（curved-taper）：曾在此 allowlist（腳 bbox 全寬、內面實際收窄→誤報）。
  // 2026-08-03 補上 projectPartSilhouette / projectPartPolygon 的 curved-taper 分支後，
  // audit 的 Y-segmented silhouette 路徑已能看到「隨高度收窄的實際內面」，AABB-at-Y 正確 →
  // 0 overlap，不再需要 allowlist（移除）。
  "tea-table:box",
  "tea-table:tapered",
  // 弧肩斜腳（curved-taper）同 box/tapered：下棚 slat 端角 × 腳，silhouette
  // 看不到 slat notched-corner → 誤報。腳實際內面已收窄、離 slat 更遠，非真重疊。
  "tea-table:curved-taper",
  /**
   * 兩向弧肩:4 對「下橫撐 × 下橫撐」在腳的內角互切 1.6 × 50 × 1.6mm。
   *
   * 這**不是**腳的 bug（腳 × 橫撐 已經 0 重疊、0 縫,見 audit-leg-joints）。
   * 成因:四根下橫撐同高度圍成一圈,兩個方向都補償到腳的弧面之後,在腳的內角
   * 搶同一塊「被挖掉」的空間 ——
   *     y=120 時腳的斷面被弧挖成 34.4×34.4(名目 50×50),
   *     而橫撐 22mm 厚、對齊腳的名目中心線 → 內側緣超出腳 1.6mm。
   *     楔形,到 y≈163 收斂為 0。
   *
   * 沒有修,因為兩條解法都會動到既有外觀(木頭仁明確要求不准動舊的):
   *   a) 縮短 X 向橫撐 → 單向弧肩也會跟著變(它早就伸到 215.6mm)
   *   b) 把橫撐移離腳中心線 7.8mm → 單向 / 直腳 / 錐形腳全部跟著位移
   * 真家具在這個角落是格肩榫互讓,本來就不是兩塊實體對撞。
   */
  "tea-table:curved-taper+ctTwoWay",
  /**
   * 方凳兩向弧肩:4 對「下橫撐 × 下橫撐」在腳的內角互切 1.1 × 40 × 9.1mm。
   * 跟上面茶几完全同一類 —— 兩個方向的橫撐都補償到腳的弧面之後,
   * 在腳被挖掉的內角搶同一塊空間。
   *
   * 方凳更明顯是因為腳只有 35mm、弧最深挖 16mm → 該高度腳斷面只剩 19×19,
   * 而橫撐本身就 18mm 厚,幾乎塞滿。
   *
   * 腳 × 橫撐 是 0 重疊、0 縫、0 榫頭外露(這三件才是使用者看得到的)。
   * 不修的理由同茶几:兩條解法都會動到既有外觀。
   */
  "stool:curved-taper+ctTwoWay",
  // 加了「橫撐處也做弧肩」之後同一批既有誤報換了變體名稱,理由同上兩條。
  "tea-table:curved-taper+ctLowerCove",
  "tea-table:curved-taper+ctTwoWay+ctLowerCove",
  "stool:curved-taper+ctLowerCove",
  "stool:curved-taper+ctTwoWay+ctLowerCove",
  // 獨柱餐桌：lathe-turned 中段比 mesh box 細，4 隻爪要壓進 mesh box 邊內
  // 才能視覺接合柱底 lathe 輪廓——audit 用 box 算 overlap 看不到柱「實際變細」。
  "round-table:pedestal",
  // 中式方角櫃：邊抹板心結構，rail 端頭榫接進立柱（傳統明式做法），
  // audit 看到 rail × rail 在立柱位置交界其實是榫頭區，不是真實重疊。
  "chinese-cabinet:auto",
  "chinese-cabinet:box",
  "chinese-cabinet:inward-hoof",
  "chinese-cabinet:outward-hoof",
  // 書桌圓錐斜腳：apron 端面延伸到圓腳中心藏接縫，apron × leg 結構性 overlap
  "desk:splayed-round-tapered",
  // 鳩尾盒：壁體間鳩尾齒互嵌、頂蓋邊條入槽——所有 overlap 都是 joint 結構性
  // 重疊（CSG subtract 重疊規範、見 feedback_csg_overlap_over_analytical_fit）
  "dovetail-box:default",
  // 相框：back-panel 入立柱凹溝、frame × panel 結構性 overlap
  "photo-frame:default",
  // 書擋：三角加固 brace 用 right-triangle shape 倚靠 back panel 立面、
  // 物理上是「靠著」不是「穿進」，audit 用 brace bbox 偵測誤判結構 overlap
  "bookend:default",
  // 木工工具牆：法式斜切條牆條 × 工具座掛條 45° 斜面完全重合貼合（互鎖），
  // AABB 相交但實體只在斜面相切、不互穿——shape-aware silhouette 判 0 重疊
  "wall-mounted-tool-storage:default",
  // 立式衣帽架：lathe-turned 中柱、3 隻腳內端榫接進圓柱（腳內端落在柱半徑
  // R30 處 = 190−160）。2026-06-13 修正圓料 silhouette 採樣（圓截面改放長軸
  // 正交平面）後，柱俯視輪廓由「誤畫的方形」變成正確的「圓形」，腳榫butt 進
  // 圓柱的結構性重疊才被偵到——同 round-table:pedestal 性質（柱實際是圓的）。
  "coat-rack:default",
  // 紅酒架：方格佈局縱向分隔板 × 水平層板用十字搭接（half-lap），兩件都滿深、垂直
  // 交叉、重疊處各挖一半深度互鎖（明式格屜做法）。audit 用實體 OBB 看到 shelf × divider
  // 在交叉處 15×15×280 結構性重疊（缺口是 mortise CSG subtract、OBB 不計）= joint，非穿模。
  // 菱形佈局無縱向分隔板不在此列。legShape 各 variant 格屜結構相同故全列。
  "wine-rack:box",
  "wine-rack:tapered",
  "wine-rack:round",
  "wine-rack:round-tapered",
  "wine-rack:bracket",
  "wine-rack:plinth",
  "wine-rack:panel-side",
  // 工作桌下層板：notched-corners 缺角讓腳，silhouette 看不到缺角 → 腳 × 層板誤報（同 tea-table）。
  // 這幾個變體裡只有這 4 對；其他新零件（尾鉗 / 靠板 / 抽屜櫃）都在別的變體裡另外驗到 0。
  "workbench:default+deadman+lowerStretcherArrangement=box-frame+withUnderShelf",
  // 長板靠板：滑板底 V 槽騎在脊條尖上、頂直槽咬住上軌，各咬進 12（槽是 cosmetic mortise，OBB 不計）
  // = 結構性重疊（同紅酒架半搭接），不是穿模。09-04 視覺審查：原本只是「貼著」會倒出來。
  "workbench:default+topSplit=center-well+deadman",
  "workbench:default+deadman+lowerStretcherArrangement=box-frame",
  "workbench:default+viseSide=right+endVise=wagon+deadman+lowerStretcherArrangement=box-frame",
  "workbench:default+frontVise=leg+deadman+lowerStretcherArrangement=pair-x",
  "workbench:default+topSplit=gap+frontVise=leg+withUnderShelf+knockdown=bolt",
  // 長方腳 + 長板靠板：靠板滑板咬住脊條／上軌（同上面那組 deadman 變體）
  "workbench:default+legDepth=75+deadman",
  // 長方腳 + 下層板：notched-corners 缺角讓腳，silhouette 看不到缺角 → 誤報（同上面那組 withUnderShelf）
  "workbench:default+legDepth=75+withApron+withUnderShelf",
  // 夾板疊層（§AU23）：橫撐／裙板的端頭伸進「疊層時預留的搭接槽」裡（半搭接，同紅酒架
  // box 那組）。槽是 cosmetic mortise，OBB 不扣 → 腳 × 橫撐 / 腳 × 裙板 在槽裡結構性重疊，
  // 重疊厚度恰等於槽深（腳 72 兩向 → 18；腳 54 兩向 → (54−36)/2 = 9），不是穿模。
  "workbench:default+materialStyle=plywood",
  "workbench:default+materialStyle=plywood+plyTopLayers=2+legLayers=3",
  "workbench:default+materialStyle=plywood+plyTopLayers=4+legLayers=5",
  "workbench:default+materialStyle=plywood+withApron+lowerStretcherArrangement=h-frame+knockdown=bolt",
  "workbench:default+materialStyle=plywood+frontVise=leg+legLayers=3+withUnderShelf",
  "workbench:default+materialStyle=plywood+benchStyle=apron",
  "workbench:default+materialStyle=plywood+topSplit=center-well+drawerCount=2",
]);
import { FURNITURE_CATALOG } from "../lib/templates";
import type { FurnitureCatalogEntry } from "../lib/templates";
import { toBeginnerMode } from "../lib/templates/beginner-mode";
import { findOverlaps } from "../lib/geometry/overlap";
import type {
  FurnitureDesign,
  MaterialId,
  OptionSpec,
} from "../lib/types";

const useJoinery = process.argv.includes("--joinery");

interface Row {
  category: string;
  nameZh: string;
  variant: string;
  partsCount: number;
  overlapCount: number;
  flag: string;
  expected: boolean;
  examples: string[];
}

/**
 * 沒有 legShape 的模板也要掃它的「會長出新零件」的選項（工作桌 2026-09-04 v2：尾鉗 / 長板靠板 /
 * 抽屜櫃 / 雙面桌 / 封邊板 / 小鉗附件 / 裙板桌前緣凸出）。語法同 legShape 的 "+flag"，
 * 另外支援 "+key=value"（select / number）。
 */
const EXTRA_VARIANTS: Record<string, string[]> = {
  workbench: [
    "default+endVise=wagon",
    "default+topSplit=center-well",
    "default+topBattens",
    "default+topBattens+endVise=wagon+frontViseSize=9in",
    "default+topSplit=center-well+deadman",
    "default+lowerStretcherArrangement=h-frame",
    "default+deadman+lowerStretcherArrangement=box-frame",
    "default+deadman+lowerStretcherArrangement=box-frame+withUnderShelf",
    "default+drawerCount=2",
    "default+drawerCount=3+lowerStretcherArrangement=box-frame",
    "default+benchStyle=apron",
    "default+benchStyle=apron+drawerCount=2",
    "default+benchStyle=well",
    "default+benchStyle=mft",
    "default+benchStyle=classroom",
    "default+breadboardEnds",
    "default+topSplit=gap+frontVise=leg+withUnderShelf+knockdown=bolt",
    "default+viseSide=right+endVise=wagon+deadman+lowerStretcherArrangement=box-frame",
    "default+frontVise=leg+deadman+lowerStretcherArrangement=pair-x",
    // 夾板疊層（§AU23）：料伸進腳的搭接槽 → 結構性重疊列 SHAPE_AWARE_CASES；每種層數 / 流派各掃一次
    "default+materialStyle=plywood",
    "default+materialStyle=plywood+plyTopLayers=2+legLayers=3",
    "default+materialStyle=plywood+plyTopLayers=4+legLayers=5",
    "default+materialStyle=plywood+withApron+lowerStretcherArrangement=h-frame+knockdown=bolt",
    "default+materialStyle=plywood+frontVise=leg+legLayers=3+withUnderShelf",
    "default+materialStyle=plywood+benchStyle=apron",
    "default+materialStyle=plywood+topSplit=center-well+drawerCount=2",
    // 穿帶改成騎在腳頂（腳頂榫貫穿穿帶）、抽屜橫向分格：09-04 新做的兩條都要掃
    "default+topBattens",
    "default+topBattens+frontVise=leg",
    "default+topBattens+breadboardEnds",
    "default+topBattens+endOverhang=10",
    "default+topBattens+endVise=wagon",
    "default+drawerCount=2+drawerCols=2",
    "default+drawerCount=3+drawerCols=3",
    // 長方腳（腳厚 ≠ 腳寬）
    "default+legDepth=75",
    "default+legDepth=75+withApron+withUnderShelf",
    "default+legDepth=60+frontVise=leg+topBattens",
    "default+legDepth=75+deadman",
  ],
};

/** 抓 template 的 legShape select 選項所有 choice value（包含 default） */
function legShapeChoices(entry: FurnitureCatalogEntry): string[] {
  const spec: OptionSpec | undefined = (entry.optionSchema ?? []).find(
    (o: OptionSpec) => o.key === "legShape",
  );
  if (!spec || spec.type !== "select") return ["default", ...(EXTRA_VARIANTS[entry.category] ?? [])];
  const choices = spec.choices ?? [];
  const base = choices.map((c: { value: string | number | boolean }) => String(c.value));
  // 弧肩斜腳額外掃一次「兩向弧肩」(勾選框原本完全沒被掃到)
  const hasTwoWay = (entry.optionSchema ?? []).some((o: OptionSpec) => o.key === "ctTwoWay");
  /** ⭐ 新的 boolean 選項一定要加進變異清單,否則等於沒防護（§A11.8 的教訓,已犯過一次）*/
  const hasLowerCove = (entry.optionSchema ?? []).some((o: OptionSpec) => o.key === "ctLowerCove");
  return hasTwoWay && base.includes("curved-taper")
    ? [...base, "curved-taper+ctTwoWay", ...(hasLowerCove ? ["curved-taper+ctLowerCove", "curved-taper+ctTwoWay+ctLowerCove"] : [])]
    : base;
}

function buildDesign(
  entry: FurnitureCatalogEntry,
  legShapeOverride?: string,
): FurnitureDesign | null {
  if (!entry.template) return null;
  const opts = (entry.optionSchema ?? []).reduce<
    Record<string, string | number | boolean>
  >((acc: Record<string, string | number | boolean>, spec: OptionSpec) => {
    acc[spec.key] = spec.defaultValue;
    return acc;
  }, {});
  if (legShapeOverride && legShapeOverride !== "default") {
    /**
     * ⚠️ variant 字串可以帶 "+ctTwoWay" 後綴,代表「這個腳型 + 兩向弧肩」。
     *
     * ⛔ 原本只掃 legShape 的 choices,**勾選框完全沒被掃到** ——
     *    兩向弧肩上線後,四支腳的 Z 內面全做在同一側(dirZ 從外斜量誤推),
     *    兩支腳的弧朝外、跟牙條穿模,而這支稽核照樣綠燈。
     *    (2026-08-24 木頭仁截圖回報「透視穿了」才發現。)
     */
    const [shape, ...flags] = legShapeOverride.split("+");
    if (shape !== "default") opts.legShape = shape;
    for (const f of flags) {
      if (!f) continue;
      const eq = f.indexOf("=");
      if (eq < 0) { opts[f] = true; continue; }
      const k = f.slice(0, eq), v = f.slice(eq + 1);
      opts[k] = /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v;
    }
  }
  return entry.template({
    length: entry.defaults.length,
    width: entry.defaults.width,
    height: entry.defaults.height,
    material: "maple" as MaterialId,
    options: opts,
  });
}

const rows: Row[] = [];

for (const entry of FURNITURE_CATALOG) {
  if (!entry.template) continue;
  const variants = legShapeChoices(entry);
  for (const variant of variants) {
    const raw = buildDesign(entry, variant);
    if (!raw) continue;
    const design = useJoinery ? raw : toBeginnerMode(raw);
    const allOverlaps = findOverlaps(design.parts);
    // butt-joint convention 允許椅背後仰時背柱底端 dip 進座板/後腳 AABB（物理必然，
    // overshoot 補縫 → bottom-back corner 必然下沉，視覺被遮蓋；2026-05-05）。
    const buttJointFiltered = design.useButtJointConvention
      ? allOverlaps.filter((o) => {
          const ids = [o.a, o.b].sort();
          if (ids[1] !== "seat" && !ids[1].startsWith("leg-")) return true;
          if (ids[0].startsWith("back-")) return false;
          return true;
        })
      : allOverlaps;
    // 門框+鑲板的合法 joinery overlap：鑲板舌頭嵌入框料凹槽 grooveDepth=8mm
    // 是物理正確結構（frame & panel construction），audit 不該擋。
    // 百葉門的百葉條（-louver-N）兩端同樣整片卡進豎梃凹槽，視同鑲板入框。
    const overlaps = buttJointFiltered.filter((o) => {
      const ids = [o.a, o.b].sort();
      const isPanel = (id: string) => /-door-\d+-(panel|louver-\d+)(-|$)/.test(id);
      const isFrame = (id: string) => /-door-\d+-(rail-(top|bottom)|stile-(left|right))(-|$)/.test(id);
      return !((isPanel(ids[0]) && isFrame(ids[1])) || (isPanel(ids[1]) && isFrame(ids[0])));
    });
    const examples = overlaps
      .slice(0, 3)
      .map(
        (o) =>
          `${o.a} × ${o.b} (${o.intersectionMm.x}×${o.intersectionMm.y}×${o.intersectionMm.z})`,
      );
    rows.push({
      category: entry.category,
      nameZh: entry.nameZh,
      variant,
      partsCount: design.parts.length,
      overlapCount: overlaps.length,
      flag: design.useButtJointConvention ? "✓" : "  ",
      expected:
        SHAPE_AWARE_VARIANTS.has(variant) ||
        SHAPE_AWARE_CASES.has(`${entry.category}:${variant}`),
      examples,
    });
  }
}

rows.sort((a, b) => b.overlapCount - a.overlapCount);

const totalOverlaps = rows.reduce((sum, r) => sum + r.overlapCount, 0);

console.log(
  `\n# Overlap Audit (${useJoinery ? "joinery" : "assembly/beginner"} mode)\n`,
);
console.log(`Total cases (template × legShape variant): ${rows.length}`);
console.log(
  `Cases with overlaps: ${rows.filter((r) => r.overlapCount > 0).length}`,
);
console.log(`Cases clean: ${rows.filter((r) => r.overlapCount === 0).length}`);
console.log("");
console.log(
  "| status | butt-joint? | category | variant | name | parts | overlaps | examples (≤3) |",
);
console.log("|---|---|---|---|---|---|---|---|");
for (const r of rows) {
  const exCol = r.examples.length > 0 ? r.examples.join("<br>") : "—";
  const status =
    r.overlapCount === 0 ? "✅" : r.expected ? "⚠️ design-residue" : "❌ NEW";
  console.log(
    `| ${status} | ${r.flag} | \`${r.category}\` | \`${r.variant}\` | ${r.nameZh} | ${r.partsCount} | **${r.overlapCount}** | ${exCol} |`,
  );
}
console.log("");

const failed = rows.filter((r) => r.overlapCount > 0);
const newFailures = failed.filter((r) => !r.expected);
const expectedStillFailing = failed.filter((r) => r.expected);
const expectedNowPassing = rows.filter(
  (r) => r.expected && r.overlapCount === 0,
);

if (expectedStillFailing.length > 0) {
  console.log(
    `⚠️  ${expectedStillFailing.length} case(s) with template design residue (drafting-math.md §A11 D.2 後殘留——bracket 結構性嵌入、splayed-tapered 補償邊界、pedestal 設計重疊)：`,
  );
  for (const r of expectedStillFailing) {
    console.log(
      `   - ${r.nameZh} (\`${r.category}\` × \`${r.variant}\`) · ${r.overlapCount} pairs`,
    );
  }
  console.log("");
}

if (expectedNowPassing.length > 0) {
  console.log(
    `🎉 ${expectedNowPassing.length} design-residue variant case(s) now pass clean — consider tightening allowlist:`,
  );
  for (const r of expectedNowPassing) {
    console.log(`   - ${r.category} × ${r.variant}`);
  }
  console.log("");
}

if (newFailures.length > 0) {
  console.error(
    `❌ Audit failed: ${newFailures.reduce((s, r) => s + r.overlapCount, 0)} NEW overlap pair(s) across ${newFailures.length} case(s):`,
  );
  for (const r of newFailures) {
    console.error(
      `   - ${r.nameZh} (\`${r.category}\` × \`${r.variant}\`) · ${r.overlapCount} pairs · ${r.examples.slice(0, 1).join("")}`,
    );
  }
  console.error(
    `   Fix or set useButtJointConvention=true on the design (see docs/drafting-math.md §A10).`,
  );
  process.exit(1);
}
console.log(
  `✅ All non-allowlisted cases clean (${rows.length - expectedStillFailing.length}/${rows.length}).`,
);
