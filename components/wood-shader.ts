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
// 真實木紋：用 fbm noise 扭曲 X 軸再做 sin 條紋，紋路會像水波一樣彎曲，
// 不是格子布規則直線。輔以低頻變化讓粗條寬度不一致——更像實木。
vec3 wp = vWoodWorldPos;
// 用 Y/Z 平面的 noise 扭曲 X 座標——紋路就會沿垂直方向有波浪
float distort = (wd_fbm(wp.yz * 6.0) - 0.5) * 0.6;
float xc = wp.x + distort;
// 主年輪：取 abs(sin) 並乘冪讓尖峰處才深（線狀紋路），平均週期 ~25mm
float ring = abs(sin(xc * 25.0 + wd_fbm(wp.yz * 12.0) * 1.0));
ring = pow(ring, 6.0);
// 粗變化：低頻 noise 模擬「明暗區塊」，遠看有層次不會太均勻
float lowFreq = wd_fbm(wp.xz * 1.5) * 0.18;
// 細紋（高頻 sin），加一點點質感不要太搶
float fine = abs(sin(xc * 90.0)) * 0.05;
float grainDarken = ring * 0.4 + fine + lowFreq;
diffuseColor.rgb *= (1.0 - grainDarken);`,
    );
};
