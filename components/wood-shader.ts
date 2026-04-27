import type { WebGLProgramParametersWithUniforms } from "three";

/**
 * 把木紋 grain 注入到 meshStandardMaterial 的 fragment shader，
 * 用「世界座標」算 sin noise 而不是 UV——徹底繞過 BoxGeometry UV
 * 沒正確 binding 的問題，順便讓所有零件紋密度一致 + 接合處紋連續。
 *
 * 用法：在 JSX 上 onBeforeCompile={woodOnBeforeCompile}
 *
 * 為什麼世界座標：UV-based texture 在這個專案實測整 face 只 sample 到單一
 * texel（commit 9ca5762 revert 過）。world-position 不依賴 UV，每個 fragment
 * 直接用自己的世界 XYZ 算 noise，必定有變化。
 *
 * Scale 慣例：PerspectiveView 用 SCALE = 0.01（1 unit = 100mm），所以
 * sin(x * 30) 約每 100/30 ≈ 3.3mm 一個週期——細紋；
 * sin(x * 8) 約每 12mm 一個週期——粗條年輪。
 */
export const woodOnBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
  shader.vertexShader = shader.vertexShader
    .replace(
      "#include <common>",
      `#include <common>
varying vec3 vWoodWorldPos;`,
    )
    .replace(
      "#include <fog_vertex>",
      `#include <fog_vertex>
vWoodWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;`,
    );

  shader.fragmentShader = shader.fragmentShader
    .replace(
      "#include <common>",
      `#include <common>
varying vec3 vWoodWorldPos;
// value noise + fbm helpers——必須放 <common>（即 main 之外）
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
}`,
    )
    .replace(
      "#include <map_fragment>",
      `#include <map_fragment>
// 真實木紋年輪：sawtooth 漸變（淺→深→突然 reset 回淺）+ 大尺度低頻
// 扭曲讓紋路偶爾大彎、平常平直（模擬實木鋸切後的年輪）。
vec3 wp = vWoodWorldPos;
// 1. 低頻扭曲：用大尺度 fbm 偏移 X 座標。週期約 200mm 才大彎
//    fbm 而非單層 noise → 變化更自然，不會看起來像鋸齒
float distort = (wd_fbm(wp.yz * 0.5) - 0.5) * 0.5
              + (wd_fbm(wp.yz * 1.4 + vec2(31.0, 17.0)) - 0.5) * 0.2;
float wavyX = wp.x + distort;
// 2. 主年輪：每 ~23mm 一圈，sawtooth 用 mod
//    多加 noise(yz * 6.0) * 0.02 讓 ring 邊界不要完全平行
float ring = mod(wavyX * 4.4 + wd_noise(wp.yz * 6.0) * 0.04, 1.0);
// 3. 深色帶 = ring 接近 1.0 那段；用 smoothstep 把深色集中在 80-100% 區間
//    （年輪「冬材」很窄、「夏材」較寬，不是均勻 50/50）
float darkBand = smoothstep(0.65, 0.95, ring) * (1.0 - smoothstep(0.95, 1.0, ring));
float dimming = 1.0 - darkBand * 0.45;
// 4. 大尺度明暗區塊：模擬不同部位木材深淺差
dimming -= wd_fbm(wp.xz * 0.8) * 0.06;
diffuseColor.rgb *= dimming;`,
    );
};
