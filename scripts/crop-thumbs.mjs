// One-off: 從 docs/health-2026-05-12/NN-{slug}.png 裁右上 3D 區，
// 輸出 public/thumbs/{slug}.webp (320x235 ≈ 4:3 thumb)。
// 跑：node scripts/crop-thumbs.mjs

import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const SRC_DIR = "docs/health-2026-05-12";
const OUT_DIR = "public/thumbs";

// 截圖 1385x4289。3D 卡片大約在 right 46%、top 10% 的 box：
// 3D 模型完整出現區域（4:3）。3D 卡片內容區 y=160(toggle 下緣)~620(card 底)，
// model 中心 ≈ y=400。為了讓「高家具（衣櫃）/ 矮家具（茶几）」上下都有 margin
// 不被切，crop 取 460 高 × 615 寬（4:3）對齊 model bbox 中心。
// 部分家具截圖帶警告 banner（衣櫃/斗櫃/鞋櫃/吧檯椅），3D 卡片整體下移約 110px。
const DEFAULT_CROP = { left: 695, top: 235, width: 615, height: 385 };
const BANNER_OFFSET = 110;
const BANNERED = new Set(["wardrobe", "chest-of-drawers", "shoe-cabinet", "bar-stool"]);
// 縮圖最終尺寸：中央 model 區 240x180 (4:3)，四周 40/30 padding → 總 320x240
const MODEL_SIZE = { width: 240, height: 180 };
const PADDING = { top: 30, bottom: 30, left: 40, right: 40 };
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
