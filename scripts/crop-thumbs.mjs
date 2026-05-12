// One-off: 從 docs/health-2026-05-12/NN-{slug}.png 裁右上 3D 區，
// 輸出 public/thumbs/{slug}.webp (320x235 ≈ 4:3 thumb)。
// 跑：node scripts/crop-thumbs.mjs

import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const SRC_DIR = "docs/health-2026-05-12";
const OUT_DIR = "public/thumbs";

// 截圖 1385x4289。3D 卡片大約在 right 46%、top 10% 的 box：
// 3D 模型實際出現的區域（避開 action 按鈕條 + 場景 toggle + 顯露 toggle）。
// 部分家具截圖時帶警告 banner（衣櫃/斗櫃/鞋櫃/吧檯椅），3D 卡片整體下移約 110px。
const DEFAULT_CROP = { left: 580, top: 240, width: 805, height: 380 };
const BANNER_OFFSET = 110;
const BANNERED = new Set(["wardrobe", "chest-of-drawers", "shoe-cabinet", "bar-stool"]);
const RESIZE = { width: 320, height: 240 };

function cropFor(slug) {
  const c = { ...DEFAULT_CROP };
  if (BANNERED.has(slug)) c.top += BANNER_OFFSET;
  return c;
}

const files = fs
  .readdirSync(SRC_DIR)
  .filter((f) => /^\d{2}-.+\.png$/.test(f));

for (const f of files) {
  const slug = f.replace(/^\d{2}-/, "").replace(/\.png$/, "");
  const inPath = path.join(SRC_DIR, f);
  const outPath = path.join(OUT_DIR, `${slug}.webp`);
  await sharp(inPath)
    .extract(cropFor(slug))
    .resize(RESIZE.width, RESIZE.height, { fit: "cover" })
    .webp({ quality: 80 })
    .toFile(outPath);
  const size = fs.statSync(outPath).size;
  console.log(`✓ ${slug}.webp  ${(size / 1024).toFixed(1)} KB`);
}
console.log(`\nDone: ${files.length} thumbs written to ${OUT_DIR}/`);
