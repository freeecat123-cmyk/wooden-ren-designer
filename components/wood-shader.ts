import type { WebGLProgramParametersWithUniforms } from "three";

/**
 * 木紋 grain shader injection。每個零件依 grainDirection × 跨紋寬度選對應版本：
 *
 *  - grainDirection "length" → grain 沿 local X、cross = local Z
 *  - grainDirection "width"  → grain 沿 local Z、cross = local X
 *  - cross-grain 尺寸 ≥ 80mm → wide：寬板用 plain-sawn 山形紋（cathedral 拱）
 *  - cross-grain 尺寸 < 80mm → narrow：細條用 quartersawn 直紋
 *
 * 為什麼 local position 而不是 world：grain 跟著零件本身走，不是跟著世界座標。
 * vWoodLocalPos 乘 100 把 three-units (1 unit = 100mm) 換成 mm，下面所有頻率
 * 與距離常數都按 mm 寫。
 *
 * 條紋方向慣例（一致）：
 *   noise 值的「變化方向」決定暗帶的「分隔方向」，暗帶本身沿「不變的軸」延伸。
 *   要順紋長線 → 沿 gx 不變、沿 wz 變化 → gx 用低頻、wz 用高頻。
 *   （原 shader 寫反了被 cathedral 拱蓋過，改成直紋後浮出來，已修正）
 *
 * 用法：見 components/PerspectiveView.tsx 的 Part component，依 cross-grain
 * 尺寸選 narrow / wide。
 */

const HELPERS = `
varying vec3 vWoodLocalPos;
varying vec3 vWoodLocalNormal;
float wd_hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float wd_noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = wd_hash(i);
  float b = wd_hash(i + vec2(1.0, 0.0));
  float c = wd_hash(i + vec2(0.0, 1.0));
  float d = wd_hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float wd_fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    v += amp * wd_noise(p);
    p *= 2.0;
    amp *= 0.5;
  }
  return v;
}
`;

type GrainMode = "narrow" | "wide";

/**
 * 拼板 / 疊層：零件在料單上是 pieces 片，沿零件 local 的 `axis` 切、總跨距 spanMm。
 * ⭐ axis 是「零件自己的軸」（x=長、y=厚、z=寬），呼叫端要跟料單同一套判斷：
 *    拼板 → 跨紋方向那一軸；疊層 → **最小的那一維**（腳的 visible.thickness 是腳高，
 *    照它切會把腳沿高度切成好幾段——2026-09-04 木頭仁回報「桌腳這些零件也要看得出分層」）。
 */
export type BoardSplit = { pieces: number; spanMm: number; axis: "x" | "y" | "z" };

/**
 * grainAxis = 沿木紋方向的 local 座標（如 lp.x）
 * crossAxis = 主要 cross-grain 方向（顯眼的那一邊）
 * thinAxis  = 次要 cross-grain 方向（厚度方向）
 * mode      = "narrow"（直紋）或 "wide"（山形紋 + 直紋條）
 */
function makeGrainFragment(
  grainAxis: string,
  crossAxis: string,
  thinAxis: string,
  mode: GrainMode,
  board?: BoardSplit,
): string {
  // 拼板 / 疊層：同一個零件在料單上是 N 片（panelPieces）。3D 以前畫成一整塊，
  // 看不出是拼的（木頭仁 2026-09-04：「桌面做法 可以顯示出層數 拼木的木紋嗎」）。
  // 做法：不動幾何，在著色器裡按「第幾片」把木紋起點錯開，交界畫一條膠合線。
  //   split = "cross"（寬板平拼 / 窄條側立拼）沿跨紋方向切，"thin"（疊層）沿厚度切。
  const boardHeader = board
    ? `
float bAxis = lp.${board.axis};
float bT = clamp((bAxis + ${board.spanMm.toFixed(2)} * 0.5) / ${(board.spanMm / board.pieces).toFixed(4)}, 0.0, ${board.pieces.toFixed(1)} - 0.0001);
float bIdx = floor(bT);
float bHash = wd_hash(vec2(bIdx * 1.7 + 0.3, 3.7));
// 每片各自的木紋起點與樹心偏移 → 相鄰兩片紋路不會連成一片
gx += bHash * 900.0;
wz += (bHash - 0.5) * 90.0;
// 膠合線：離交界 1.6mm 內壓暗（真實膠縫更細，但 3D 預覽 0.7mm 不到一個像素＝等於沒畫）
float bEdgeMm = min(fract(bT), 1.0 - fract(bT)) * ${(board.spanMm / board.pieces).toFixed(4)};
float bGlue = 1.0 - smoothstep(0.0, 2.2, bEdgeMm);
// 每片再帶一點色差（真實拼板／疊層每片本來就深淺不同）。線太細時（薄板疊層一層才 18mm、
// 側立拼一條 60mm）光靠膠合線在縮圖上看不出來，色差在任何縮放都讀得到。
// 亂數色差 + 奇偶交替：純亂數會有相鄰兩片剛好同深淺而糊在一起（側立拼 10 條時很明顯），
// 交替那一項保證隔壁一定不同色。
float bTone = (bHash - 0.5) * 0.10 + (mod(bIdx, 2.0) - 0.5) * 0.10;
`
    : "\nfloat bGlue = 0.0;\nfloat bTone = 0.0;\n";
  const header = `#include <map_fragment>
vec3 lp = vWoodLocalPos;
float gx = ${grainAxis};
float wz = ${crossAxis};
float wy = ${thinAxis};
${boardHeader}`;
  if (mode === "wide") {
    return `${header}
// 廣面 vs 薄邊偵測：cathedral 拱分布在 (gx, wz) 平面（板的廣面）。
// 薄邊（normal 沿 wz 或 gx）只看到 ring 截斷的橫條，要關掉。
// vWoodLocalNormal 是 geometry-local normal；|normal.y| ~1 表示沿 thin 軸 Y
// = 廣面（板的正反面），|normal.y| ~0 = 薄邊（板的側緣、端面）。
float faceY = abs(vWoodLocalNormal.y);
float cathedralFade = smoothstep(0.5, 0.85, faceY);
// 山形紋（plain-sawn）：寬板從樹幹切下時看到的 cathedral 拱。
// 樹心比之前拉近 (-120 vs -220)、年輪比之前密 (8mm/圈 vs 25mm/圈)，
// 才不會像神木年輪那樣稀疏。樹心拉近後 wz 在板邊超過 pithY 距離時
// r 增長變線性 → 板的左右邊自然變成順紋，中間才有拱形（real lumber 樣）。
// 1. 樹心位置在板下方，沿 grain 用 sin 慢彎模擬樹心相對切面起伏
float pithY = -120.0 + sin(gx * 0.005) * 40.0 + sin(gx * 0.0023 + 1.1) * 25.0;
// 2. 真實 Euclidean ring 半徑：pithY 在下方時 sqrt(d²+wz²) 對 wz 拋物線 → 拱
float r = sqrt((wy - pithY) * (wy - pithY) + wz * wz);
// 3. 中頻 fbm 擾動振幅 8mm：打散規律性，年輪不會等距斑馬條紋
r += (wd_fbm(vec2(gx * 0.008, wz * 0.02)) - 0.5) * 8.0;
// 4. 高頻細擾動振幅 1.5mm
r += (wd_fbm(vec2(gx * 0.05, wz * 0.08)) - 0.5) * 1.5;
// 5. 主年輪：每 ~12mm 一圈（家具材合理密度，比神木 25mm 密但不會 sub-pixel）
float ringPos = fract(r * 0.083);
// 6. 冬材深色帶，振幅 0.40；薄邊上 fade 掉
float darkBand = smoothstep(0.45, 0.85, ringPos) * (1.0 - smoothstep(0.85, 1.0, ringPos));
float dimming = 1.0 - darkBand * 0.40 * cathedralFade;
// 7. 副年輪細線（~5mm 一條）；同樣只在廣面
float subRing = fract(r * 0.20);
dimming -= smoothstep(0.85, 0.95, subRing) * (1.0 - smoothstep(0.95, 1.0, subRing)) * 0.10 * cathedralFade;
// 8. 沿 grain 拉長的導管孔列
float pore = wd_noise(vec2(gx * 0.06, wz * 0.55));
dimming -= smoothstep(0.74, 0.90, pore) * 0.12;
// 9. 大尺度心材/邊材色差
dimming -= (wd_fbm(vec2(gx * 0.003, wz * 0.012)) - 0.5) * 0.14;
// 10. 中尺度斑紋
dimming -= (wd_fbm(vec2(gx * 0.02, wz * 0.05)) - 0.5) * 0.07;
// 11. 順紋條紋（補強 grain 方向感，但比 narrow 弱因為已有 cathedral 拱）
float streak = wd_fbm(vec2(gx * 0.004, wz * 0.07)) * 0.50
             + wd_fbm(vec2(gx * 0.009, wz * 0.22)) * 0.30
             + wd_fbm(vec2(gx * 0.020, wz * 0.55)) * 0.20;
dimming -= smoothstep(0.40, 0.62, streak) * 0.10;
// 端面/薄邊（faceY 低）grain dimming 很弱→比廣面亮、會在交界露成白點
// （百葉葉片端嵌豎梃露白，user 回報「斜的白塊」）。補 baseline dim 貼齊廣面亮度。
dimming -= (1.0 - smoothstep(0.5, 0.85, abs(vWoodLocalNormal.y))) * 0.22;
dimming -= bGlue * 0.42;
dimming -= bTone;
dimming = max(dimming, 0.0);
diffuseColor.rgb *= dimming;`;
  }
  // narrow（quartersawn 直紋）：細條從樹幹切出主要看到平行順紋線，沒有 cathedral
  return `${header}
// 直紋（quartersawn）：細條板（腳、橫撐、牙條）沒有 cathedral 拱，
// 只有沿 grain 的平行木理線
float streak = wd_fbm(vec2(gx * 0.004, wz * 0.07)) * 0.50
             + wd_fbm(vec2(gx * 0.009, wz * 0.22)) * 0.30
             + wd_fbm(vec2(gx * 0.020, wz * 0.55)) * 0.20;
float dimming = 1.0;
dimming -= smoothstep(0.40, 0.62, streak) * 0.22;
// 沿 grain 拉長的導管孔列
float pore = wd_noise(vec2(gx * 0.06, wz * 0.55));
dimming -= smoothstep(0.74, 0.90, pore) * 0.10;
// 大尺度心材/邊材色差
dimming -= (wd_fbm(vec2(gx * 0.003, wz * 0.012)) - 0.5) * 0.14;
// 中尺度斑紋
dimming -= (wd_fbm(vec2(gx * 0.02, wz * 0.05)) - 0.5) * 0.07;
// 端面/薄邊 baseline dim（同 wide：避免端面比廣面亮成白點）
dimming -= (1.0 - smoothstep(0.5, 0.85, abs(vWoodLocalNormal.y))) * 0.22;
dimming -= bGlue * 0.42;
dimming -= bTone;
dimming = max(dimming, 0.0);
diffuseColor.rgb *= dimming;`;
}

/** onBeforeCompile 回呼，附唯一 cacheKey 供 material.customProgramCacheKey 用。 */
export type WoodCompile = ((shader: WebGLProgramParametersWithUniforms) => void) & {
  cacheKey: string;
};

function makeCompile(
  grainAxis: string,
  crossAxis: string,
  thinAxis: string,
  mode: GrainMode,
  board?: BoardSplit,
): WoodCompile {
  const fragmentInjection = makeGrainFragment(grainAxis, crossAxis, thinAxis, mode, board);
  const compile = ((shader: WebGLProgramParametersWithUniforms) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>\nvarying vec3 vWoodLocalPos;\nvarying vec3 vWoodLocalNormal;`,
      )
      .replace(
        "#include <fog_vertex>",
        // position 是 three-units（1 unit = 100mm，見 PerspectiveView SCALE）；
        // shader 所有常數按 mm 寫，這裡 ×100 轉成 mm。
        // vWoodLocalNormal = geometry-local normal，用來判斷現在這面是
        // 「廣面」（normal 沿 thin 軸 Y）還是「薄邊」（normal 沿 wz/gx），
        // 薄邊上要關掉 cathedral 拱避免出現橫向截斷條紋。
        `#include <fog_vertex>\nvWoodLocalPos = position * 100.0;\nvWoodLocalNormal = normal;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${HELPERS}`)
      .replace("#include <map_fragment>", fragmentInjection);
  }) as WoodCompile;
  // 四個 grain 變體都由這個 closure 產生 → onBeforeCompile.toString() 完全相同。
  // three.js 程式快取用 toString() 當鍵 → 4 變體被當成同一支 shader，grain
  // 方向會跟著「第一個編譯的零件」跑（豎梃拿到橫檔的 X-grain）。附唯一
  // cacheKey 給 material.customProgramCacheKey，three.js 才會分開編譯。
  compile.cacheKey = board
    ? `wood:${grainAxis}:${mode}:${board.axis}:${board.pieces}:${board.spanMm.toFixed(1)}`
    : `wood:${grainAxis}:${mode}`;
  return compile;
}

// 拼板變體的 compile 依參數快取：同一份設計裡片數/跨距相同的零件共用同一個
// closure（React memo 才不會每次 render 都以為 material 換了）。
const boardCompileCache = new Map<string, WoodCompile>();

/**
 * 取木紋 compile。board 給了就畫成 N 片拼板 / 疊層（每片紋路不同 + 膠合線），
 * 沒給就是整塊（跟以前一模一樣）。
 */
export function getWoodCompile(
  grainDirection: "length" | "width",
  mode: GrainMode,
  board?: BoardSplit,
): WoodCompile {
  const axes: [string, string, string] =
    grainDirection === "width" ? ["lp.z", "lp.x", "lp.y"] : ["lp.x", "lp.z", "lp.y"];
  if (!board || board.pieces < 2 || !(board.spanMm > 0)) {
    return grainDirection === "width"
      ? (mode === "wide" ? woodCompileZWide : woodCompileZNarrow)
      : (mode === "wide" ? woodCompileXWide : woodCompileXNarrow);
  }
  const key = `${grainDirection}:${mode}:${board.axis}:${board.pieces}:${board.spanMm.toFixed(1)}`;
  let c = boardCompileCache.get(key);
  if (!c) {
    c = makeCompile(axes[0], axes[1], axes[2], mode, board);
    boardCompileCache.set(key, c);
  }
  return c;
}

/** Cross-grain 尺寸（mm）≥ 此閾值用 wide（山形紋），否則用 narrow（直紋） */
export const WIDE_BOARD_THRESHOLD_MM = 80;

/** Grain 沿 local X、cross = local Z：grainDirection="length" 的細條 */
export const woodCompileXNarrow = makeCompile("lp.x", "lp.z", "lp.y", "narrow");
/** Grain 沿 local X、cross = local Z：grainDirection="length" 的寬板 */
export const woodCompileXWide = makeCompile("lp.x", "lp.z", "lp.y", "wide");
/** Grain 沿 local Z、cross = local X：grainDirection="width" 的細條 */
export const woodCompileZNarrow = makeCompile("lp.z", "lp.x", "lp.y", "narrow");
/** Grain 沿 local Z、cross = local X：grainDirection="width" 的寬板 */
export const woodCompileZWide = makeCompile("lp.z", "lp.x", "lp.y", "wide");
