// One-off: 從 docs/health-2026-05-12/NN-{slug}.png 裁右上 3D 區，
// 輸出 public/thumbs/{slug}.webp (320x235 ≈ 4:3 thumb)。
// 跑：node scripts/crop-thumbs.mjs

import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const SRC_DIR = "docs/health-2026-05-12";
const OUT_DIR = "public/thumbs";

// 截圖 1385x4289。3D 卡片大約在 right 46%、top 10% 的 box：
// 3D 模型出現的區域（4:3 aspect 對齊最終 thumbnail 比例）。
// 中心 x=980（3D 卡片水平中心）、y=420（model 高度中心）。
// 部分家具截圖帶警告 banner（衣櫃/斗櫃/鞋櫃/吧檯椅），3D 卡片整體下移約 110px。
const DEFAULT_CROP = { left: 740, top: 240, width: 480, height: 360 };
const BANNER_OFFSET = 110;
const BANNERED = new Set(["wardrobe", "chest-of-drawers", "shoe-cabinet", "bar-stool"]);
// 縮圖最終尺寸：中央 model 區 256x192，四周 32/24 padding → 總 320x240
const MODEL_SIZE = { width: 256, height: 192 };
const PADDING = { top: 24, bottom: 24, left: 32, right: 32 };
const PAD_BG = { r: 241, g: 241, b: 240 }; // zinc-100 近色，配 home 卡片漸層

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
    .resize(MODEL_SIZE.width, MODEL_SIZE.height, { fit: "cover" })
    .extend({ ...PADDING, background: PAD_BG })
    .webp({ quality: 82 })
    .toFile(outPath);
  const size = fs.statSync(outPath).size;
  console.log(`✓ ${slug}.webp  ${(size / 1024).toFixed(1)} KB`);
}
console.log(`\nDone: ${files.length} thumbs written to ${OUT_DIR}/`);
