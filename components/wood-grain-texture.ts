import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three";

/**
 * 程序生成的木紋 texture——用 Canvas 畫多條 sin 干擾的垂直紋理線，
 * 模擬實木板材鋸切後的年輪。每個顏色 cache 一張，避免每次 render 重畫。
 *
 * 為什麼用程序：不用外部圖檔（bundle 0 size、無 CORS、無 license 問題），
 * 工程工具的乾淨美感 + 簡單細節。深色木材紋粗、淺色木材紋細是手動微調的。
 *
 * 用法：getWoodGrainTexture(material.color) → 拿到 texture 套到 mesh 的 map。
 */

const cache = new Map<string, CanvasTexture>();

interface GrainOptions {
  /** 紋理對比度（0-1），越大紋越明顯。預設 0.18 */
  contrast?: number;
  /** 紋理線數量。預設 60（256px wide）。深木材建議調少，淺木材調多 */
  lineCount?: number;
}

export function getWoodGrainTexture(
  baseColor: string,
  opts: GrainOptions = {},
): CanvasTexture {
  const cacheKey = `${baseColor}|${opts.contrast ?? 0.18}|${opts.lineCount ?? 60}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  // SSR safety—no document. PerspectiveView 是 client component，但保險起見。
  if (typeof document === "undefined") {
    // 回空 texture，client hydrate 後會重新生成正確版本
    return new CanvasTexture();
  }

  const W = 256;
  const H = 256;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // 1. 基底色填滿
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, W, H);

  // 2. 算紋理線顏色：基底色變暗版（深木暗一點、淺木暗多一點才看得到）
  const rgb = hexToRgb(baseColor);
  const isLight = (rgb.r + rgb.g + rgb.b) / 3 > 160;
  const contrast = opts.contrast ?? (isLight ? 0.22 : 0.15);
  const darken = (amt: number) => {
    const r = Math.max(0, Math.round(rgb.r * (1 - amt)));
    const g = Math.max(0, Math.round(rgb.g * (1 - amt)));
    const b = Math.max(0, Math.round(rgb.b * (1 - amt)));
    return `rgb(${r}, ${g}, ${b})`;
  };

  // 3. 畫多條垂直波浪線當主紋理
  const lineCount = opts.lineCount ?? 60;
  ctx.lineWidth = 0.8;
  for (let i = 0; i < lineCount; i++) {
    // 每條線在 X 軸的基準位置 + 微擾動
    const baseX = (W * i) / lineCount + (Math.random() - 0.5) * 2.5;
    // 透明度：每條線略不同，整體偏淡
    const alpha = contrast * (0.6 + Math.random() * 0.4);
    ctx.strokeStyle = darken(0.4);
    ctx.globalAlpha = alpha;
    // 線寬隨機微變
    ctx.lineWidth = 0.6 + Math.random() * 1.0;
    ctx.beginPath();
    // 沿 Y 軸取點，每點根據 sin 組合算 X 偏移做波浪
    const phase = i * 0.7 + Math.random() * Math.PI;
    for (let y = 0; y <= H; y += 3) {
      const wobble =
        2.5 * Math.sin(y / 28 + phase) +
        1.2 * Math.sin(y / 11 + phase * 1.7) +
        0.6 * Math.sin(y / 5 + phase * 2.3);
      const x = baseX + wobble;
      if (y === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // 4. 偶爾加幾條深色「年輪粗紋」增加變化
  ctx.globalAlpha = contrast * 1.4;
  ctx.strokeStyle = darken(0.55);
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 6; i++) {
    const baseX = Math.random() * W;
    const phase = Math.random() * Math.PI * 2;
    ctx.beginPath();
    for (let y = 0; y <= H; y += 4) {
      const wobble = 4 * Math.sin(y / 35 + phase) + 2 * Math.sin(y / 14 + phase);
      const x = baseX + wobble;
      if (y === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  ctx.globalAlpha = 1;

  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  // repeat = 2 平衡：大桌面看得到多條紋，小腳料不會太密。
  // 真要每零件等密度需 per-mesh clone texture，目前簡化版維持單張共用。
  texture.repeat.set(2, 2);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  cache.set(cacheKey, texture);
  return texture;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = hex.replace("#", "").match(/.{2}/g);
  if (!m || m.length < 3) return { r: 200, g: 170, b: 130 };
  return {
    r: parseInt(m[0], 16),
    g: parseInt(m[1], 16),
    b: parseInt(m[2], 16),
  };
}
