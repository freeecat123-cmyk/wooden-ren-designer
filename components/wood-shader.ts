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
): string {
  const header = `#include <map_fragment>
vec3 lp = vWoodLocalPos;
float gx = ${grainAxis};
float wz = ${crossAxis};
float wy = ${thinAxis};
`;
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
// 1. 樹心位置：推回 -220mm（之前 -130 讓 pith 太近，arch 弧度太大每個拱
//    都像漩渦看起來就是石頭紋）。pith 遠 = 弧度淺、拱形平緩 = 像真木板。
//    sin 幅度也壓低避免 pith 沿 grain 劇烈擺動。
float pithY = -220.0 + sin(gx * 0.0055) * 30.0 + sin(gx * 0.0023 + 1.1) * 18.0;
// 2. 真實 Euclidean ring 半徑：pithY 在下方時 sqrt(d²+wz²) 對 wz 拋物線 → 拱
float r = sqrt((wy - pithY) * (wy - pithY) + wz * wz);
// 3. 中頻 fbm 擾動振幅 4mm（ring 間距 15mm 的 1/4）：rings 不完美平行但
//    保持乾淨弧線、不會被噪聲攪成石頭紋
r += (wd_fbm(vec2(gx * 0.008, wz * 0.02)) - 0.5) * 4.0;
// 4. 高頻細擾動振幅 0.8mm
r += (wd_fbm(vec2(gx * 0.05, wz * 0.08)) - 0.5) * 0.8;
// 5. 主年輪：每 ~15mm 一圈（家具材合理密度）
float ringPos = fract(r * 0.067);
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
dimming = max(dimming, 0.0);
diffuseColor.rgb *= dimming;`;
}

function makeCompile(
  grainAxis: string,
  crossAxis: string,
  thinAxis: string,
  mode: GrainMode,
) {
  const fragmentInjection = makeGrainFragment(grainAxis, crossAxis, thinAxis, mode);
  return (shader: WebGLProgramParametersWithUniforms) => {
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
  };
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
