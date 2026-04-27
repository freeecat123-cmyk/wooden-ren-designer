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
varying vec3 vWoodWorldPos;`,
    )
    .replace(
      "#include <map_fragment>",
      `#include <map_fragment>
// Wood grain via world-position sin noise.
// 主紋路沿 X 軸（適合大部分桌面與橫撐），同時帶 Y/Z 微擾動讓接合處不會
// 看起來像同一條垂直線。家具用實木紋路通常一條一條清晰可見。
vec3 wp = vWoodWorldPos;
float wobble = sin(wp.y * 4.0 + wp.z * 3.0) * 0.08;
// 粗條紋（年輪粗線）：每 30mm 一條
float coarse = sin((wp.x + wobble) * 22.0 + sin(wp.z * 6.0) * 0.3);
// 細條紋（細紋）：每 8mm 一條
float fine = sin((wp.x + wobble * 0.6) * 80.0);
// 把 sin 範圍 -1..1 轉成「線」（峰值處才暗，其他保持原色）
// 拉寬 smoothstep 範圍 + 加重深度讓紋更明顯
float coarseLine = smoothstep(0.3, 0.95, coarse) * 0.45;
float fineLine = smoothstep(0.5, 0.95, fine) * 0.18;
float grainDarken = coarseLine + fineLine;
diffuseColor.rgb *= (1.0 - grainDarken);`,
    );
};
