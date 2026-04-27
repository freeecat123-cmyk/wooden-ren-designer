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
 * 演算法（參考 godot procedural wood）：
 *   1. fbm 大尺度低頻扭曲 grain 軸——紋路偶爾大彎、平常平直
 *   2. 主年輪：sawtooth 漸變（mod()），淺→深→突然 reset 回淺
 *   3. smoothstep 把深色帶集中在 80% 區間（年輪冬材窄、夏材寬）
 *   4. 大尺度 fbm 模擬不同部位木材深淺差
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
 * grainCoord = 沿木紋方向的 local 座標
 * perpCoord = 垂直於木紋的 2D 平面 local 座標（用來做扭曲 noise）
 */
function makeGrainFragment(grainCoord: string, perpCoord: string): string {
  return `#include <map_fragment>
vec3 lp = vWoodLocalPos;
float gc = ${grainCoord};
vec2 pc = ${perpCoord};
// 1. 低頻扭曲：fbm 偏移 grain 座標。週期約 200mm 才大彎
float distort = (wd_fbm(pc * 0.5) - 0.5) * 0.5
              + (wd_fbm(pc * 1.4 + vec2(31.0, 17.0)) - 0.5) * 0.2;
float wavyG = gc + distort;
// 2. 主年輪：每 ~23mm 一圈 sawtooth；加細 noise 讓 ring 邊界不平行
float ring = mod(wavyG * 4.4 + wd_noise(pc * 6.0) * 0.04, 1.0);
// 3. 深色帶集中在 65-95% 區間（夏材寬淺、冬材窄深）
float darkBand = smoothstep(0.65, 0.95, ring) * (1.0 - smoothstep(0.95, 1.0, ring));
float dimming = 1.0 - darkBand * 0.45;
// 4. 大尺度明暗區塊
dimming -= wd_fbm(pc * 0.8) * 0.06;
diffuseColor.rgb *= dimming;`;
}

function makeCompile(grainCoord: string, perpCoord: string) {
  const fragmentInjection = makeGrainFragment(grainCoord, perpCoord);
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

/** Grain 沿 local X 軸——對應 part.grainDirection = "length" */
export const woodCompileX = makeCompile("lp.x", "lp.yz");
/** Grain 沿 local Z 軸——對應 part.grainDirection = "width" */
export const woodCompileZ = makeCompile("lp.z", "lp.xy");
