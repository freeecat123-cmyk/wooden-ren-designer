import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { writeFile, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, '..', 'public');
const APP = join(__dirname, '..', 'app');

const BROWN = '#8B4513';
const CREAM = '#FAF6F0';

const iconSvg = (size) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">
  <rect width="512" height="512" rx="96" ry="96" fill="${BROWN}"/>
  <text x="256" y="350" font-family="'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif" font-size="320" font-weight="900" text-anchor="middle" fill="${CREAM}">木</text>
</svg>`;

const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FAF6F0"/>
      <stop offset="100%" stop-color="#E8D9C2"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="60" y="60" width="180" height="180" rx="36" fill="${BROWN}"/>
  <text x="150" y="200" font-family="'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif" font-size="120" font-weight="900" text-anchor="middle" fill="${CREAM}">木</text>
  <text x="280" y="160" font-family="'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif" font-size="56" font-weight="900" fill="#3A2412">木頭仁工程圖生成器</text>
  <text x="280" y="220" font-family="'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif" font-size="32" font-weight="500" fill="#6B4423">從尺寸到圖紙，三秒完成</text>
  <g transform="translate(60,320)">
    <text font-family="'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif" font-size="40" font-weight="700" fill="#3A2412" x="0" y="0">三視圖 ・ 透視圖 ・ 榫卯細節</text>
    <text font-family="'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif" font-size="40" font-weight="700" fill="#3A2412" x="0" y="64">材料單 ・ 切料圖 ・ 報價系統</text>
  </g>
  <rect x="60" y="540" width="1080" height="2" fill="${BROWN}" opacity="0.3"/>
  <text x="60" y="590" font-family="'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif" font-size="28" font-weight="600" fill="${BROWN}">木頭仁木匠學院出品</text>
  <text x="1140" y="590" font-family="sans-serif" font-size="24" font-weight="500" fill="#6B4423" text-anchor="end">wooden-ren-designer.vercel.app</text>
</svg>`;

async function makePng(svg, size, out) {
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`✓ ${out}`);
}

async function main() {
  // PWA + apple-touch
  const sizes = [
    { size: 192, name: 'icon-192.png' },
    { size: 512, name: 'icon-512.png' },
    { size: 180, name: 'apple-touch-icon.png' },
    { size: 32, name: 'favicon-32.png' },
    { size: 16, name: 'favicon-16.png' },
  ];
  for (const { size, name } of sizes) {
    await makePng(iconSvg(size), size, join(PUBLIC, name));
  }

  // OG image
  await sharp(Buffer.from(ogSvg))
    .resize(1200, 630)
    .png({ compressionLevel: 9 })
    .toFile(join(PUBLIC, 'og.png'));
  console.log(`✓ ${join(PUBLIC, 'og.png')}`);

  // favicon.ico (multi-size: 16, 32, 48)
  const ico16 = await sharp(Buffer.from(iconSvg(16))).resize(16, 16).png().toBuffer();
  const ico32 = await sharp(Buffer.from(iconSvg(32))).resize(32, 32).png().toBuffer();
  const ico48 = await sharp(Buffer.from(iconSvg(48))).resize(48, 48).png().toBuffer();
  const icoBuf = await pngToIco([ico16, ico32, ico48]);
  await writeFile(join(APP, 'favicon.ico'), icoBuf);
  console.log(`✓ ${join(APP, 'favicon.ico')} (16/32/48)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
