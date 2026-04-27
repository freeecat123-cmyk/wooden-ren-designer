import type { WebGLProgramParametersWithUniforms } from "three";

/**
 * 木紋 grain shader injection。每個零件依 grainDirection 選對應版本：
 *  - "length" → grain 沿 local X 軸（板材常見：紋理跑長邊）
 *  - "width"  → grain 沿 local Z 軸（特殊情況：紋理橫跨寬邊）
 *
 * 為什麼用 local position 而不是 world：grain 應該跟著零件本身走，不是
 * 跟著世界座標——例如垂直放的腳跟水平放的橫撐如果共用世界 X 當 grain 軸，
 * 腳的紋路會橫著跑（錯）。改用 local，每個零件的 grain 自然順著它的長邊。
 *
 * 演算法（plain-sawn cathedral grain）：
 *   1. pith line：在 grain 方向用低頻 sin 慢彎，模擬樹心相對切面的位置
 *   2. r = perp 方向到 pith 的距離（+ 小擾動破完美平行）
 *   3. 主年輪：fract(r * 0.28) ≈ 3.5mm 一圈（橡木實測 3-5mm）
 *   4. 深色帶集中在年輪末端（冬材窄深）
 *   5. 沿 grain 方向的細點 = 橡木 vessel pore（細小縱向短線）
 *   6. 大尺度色階：心材/邊材的整體色差
 *
 * 用法：const compile = grainDir === "width" ? woodCompileZ : woodCompileX;
 *      <meshStandardMaterial onBeforeCompile={compile} />
 */

const HELPERS = `
varying vec3 vWoodLocalPos;
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

/**
 * grainAxis = 沿木紋方向的 local 座標（如 lp.x）
 * crossAxis = 主要 cross-grain 方向（顯眼的那一邊，通常 width 軸）
 * thinAxis  = 次要 cross-grain 方向（厚度方向，貢獻小）
 */
function makeGrainFragment(
  grainAxis: string,
  crossAxis: string,
  thinAxis: string,
): string {
  return `#include <map_fragment>
vec3 lp = vWoodLocalPos;
float gx = ${grainAxis};
float wz = ${crossAxis};
float wy = ${thinAxis};
// 1. 樹心位置：在板「下方」(wy < 0)，距離 200mm 左右（拉近一點讓拋物線更彎）
//    沿 grain 方向有 sin 擾動，振幅 130mm——pith 上下擺，rings 跟著起伏 → cathedral 拱
float pithY = -220.0 + sin(gx * 0.0055) * 90.0 + sin(gx * 0.0023 + 1.1) * 60.0;
// 2. 真實 Euclidean ring 半徑：(wy - pithY)² + wz²
//    pithY 在下方時 sqrt(d²+wz²) 對 wz 拋物線——天然的 cathedral 拱
float r = sqrt((wy - pithY) * (wy - pithY) + wz * wz);
// 3. 中頻 fbm 擾動，振幅 12mm——破完美橢圓
r += (wd_fbm(vec2(gx * 0.008, wz * 0.02)) - 0.5) * 12.0;
// 4. 高頻細擾動，振幅 3mm
r += (wd_fbm(vec2(gx * 0.05, wz * 0.08)) - 0.5) * 3.0;
// 5. 主年輪：每 ~25mm 一圈——視覺尺度，遠看才解析得到細節
float ringPos = fract(r * 0.04);
// 6. 深色帶（冬材）佔週期 40%
float darkBand = smoothstep(0.45, 0.85, ringPos) * (1.0 - smoothstep(0.85, 1.0, ringPos));
float dimming = 1.0 - darkBand * 0.55;
// 7. 副年輪：倍頻次線（每 ~10mm 一條淡線）
float subRing = fract(r * 0.10);
dimming -= smoothstep(0.85, 0.95, subRing) * (1.0 - smoothstep(0.95, 1.0, subRing)) * 0.18;
// 8. 橡木 vessel pore：沿 grain 拉長的細小深點
float pore = wd_noise(vec2(gx * 0.35, wz * 0.5));
dimming -= smoothstep(0.84, 0.93, pore) * 0.18;
// 9. 大尺度心材/邊材色差（整塊明暗區塊）
dimming -= (wd_fbm(vec2(gx * 0.003, wz * 0.012)) - 0.5) * 0.18;
// 10. 中尺度斑紋
dimming -= (wd_fbm(vec2(gx * 0.02, wz * 0.05)) - 0.5) * 0.08;
diffuseColor.rgb *= dimming;`;
}

function makeCompile(
  grainAxis: string,
  crossAxis: string,
  thinAxis: string,
) {
  const fragmentInjection = makeGrainFragment(grainAxis, crossAxis, thinAxis);
  return (shader: WebGLProgramParametersWithUniforms) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vWoodLocalPos;`)
      .replace(
        "#include <fog_vertex>",
        `#include <fog_vertex>\nvWoodLocalPos = position;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${HELPERS}`)
      .replace("#include <map_fragment>", fragmentInjection);
  };
}

/** Grain 沿 local X 軸——對應 part.grainDirection = "length"。Cross = Z（width），thin = Y（thickness） */
export const woodCompileX = makeCompile("lp.x", "lp.z", "lp.y");
/** Grain 沿 local Z 軸——對應 part.grainDirection = "width"。Cross = X（length），thin = Y（thickness） */
export const woodCompileZ = makeCompile("lp.z", "lp.x", "lp.y");
