# 家具預覽圖

12 個家具範本的工程三視圖（正視 / 側視 / 俯視），用預設尺寸與台灣檜木顏色渲染。

點下面任一個 `.svg` 連結，GitHub 會直接顯示圖。

| 家具 | 件數 | 預覽 |
|---|---|---|
| 方凳 | 9 | [stool.svg](./stool.svg) |
| 長凳 | 9 | [bench.svg](./bench.svg) |
| 茶几 | 14 | [tea-table.svg](./tea-table.svg) |
| 邊桌 / 床頭櫃 | 9 | [side-table.svg](./side-table.svg) |
| 矮桌 | 10 | [low-table.svg](./low-table.svg) |
| 開放書櫃 | 9 | [open-bookshelf.svg](./open-bookshelf.svg) |
| 斗櫃 | **28** ⭐ | [chest-of-drawers.svg](./chest-of-drawers.svg) |
| 鞋櫃 | **19** ⭐ | [shoe-cabinet.svg](./shoe-cabinet.svg) |
| 玻璃展示櫃 | **16** ⭐ | [display-cabinet.svg](./display-cabinet.svg) |
| 餐桌 | 10 | [dining-table.svg](./dining-table.svg) |
| 書桌 | 10 | [desk.svg](./desk.svg) |
| 餐椅 | 12 | [dining-chair.svg](./dining-chair.svg) |

⭐ 標記 = 第二輪 polish 完成（抽屜內箱 5 件 / 門框 4 件 + 鑲板）。

## 重新生成

```bash
cd wooden-ren-designer
pnpm tsx scripts/gen-previews.ts
```

## 限制

- 這些只是預覽圖，**完整的 3D 透視圖、榫卯細節圖、材料單、工序、PDF 列印**等功能要跑 `pnpm dev` 開瀏覽器才看得到
- SVG 用 axis-aligned box 表示零件，不顯示榫頭凸出與曲線
