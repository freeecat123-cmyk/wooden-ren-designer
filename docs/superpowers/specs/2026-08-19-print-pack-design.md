# 木作藍圖 1:1 實尺樣板列印

日期:2026-08-19(第三版,範圍已大幅收斂)
狀態:待審

> **範圍變更紀錄**
> 第一、二版把這件事設計成「列印包」——依料長選紙輸出**比例零件圖**,外加 1:1 樣板與拼接。
> 木頭仁 2026-08-19 指正:那個前提錯了。樣板是拿來**貼在木料上照著描**的,只需要攤平那一面的
> 輪廓,不需要三視圖,也不需要尺寸標註——尺寸鏈本身才是吃掉紙張的元凶。並明確指示
> 「我只要 1:1」「側視圖根本不用」「桌面椅面櫃板直接給三視圖列印」。
> 本版依此重寫:**只做 1:1 樣板,不做比例圖選紙,不做拼接。**

## 1. 目標

一鍵輸出一包 1:1 實尺樣板 PDF,列印後直接貼在木料上照著描線、點榫孔中心。
每個零件依實際大小自動選紙,塞不下就轉角度斜擺。真的塞不下最大的紙(大面板)就不勉強,
改出既有的比例零件圖。

## 2. 樣板長什麼樣

**有的**:

- **攤平那一面的 1:1 輪廓**(單一視圖)
- **榫眼、榫頭、螺絲孔的位置**(木頭仁 2026-08-19:「都要出,因為有榫孔跟榫頭」——
  大平板的樣板價值不在那個長方形外框,在榫孔位置)
- **部件名稱**,寫在輪廓**裡面**
- **100mm 證明尺**:一條標示 100mm 的實尺線。印表機縮放時量一下就知道印錯

**沒有的**:

- 尺寸標註、尺寸鏈(這是紙不夠用的真正原因)
- 三視圖、側視圖
- 標題欄、比例尺條、第三角法符號

## 3. 範圍

包含:1:1 樣板產生、選紙與旋轉擺放、超尺寸退回零件圖、PDF 產出、ZIP 打包、索引封面。

不包含:

- **不做比例零件圖的選紙**。既有 `/design/[type]/print` 與零件圖完全不動
- **不做拼接列印**。超過最大紙一律退回零件圖
- 不新增語系,沿用既有 `zh-TW` / `en`

## 4. 已實測驗證的技術事實

以下皆為 2026-08-19 本機 Chromium(Playwright)實測,非推測:

| 項目 | 結果 |
|---|---|
| jsPDF 4.2.1 + svg2pdf.js 2.7.0 產出自訂尺寸 | MediaBox **353.0 × 500.0 mm**,精準 |
| 中文字型子集化(`subset-font`) | 標楷體 **5,060KB → 70KB** |
| 字型嵌入 | CIDFontType2 / Type0,附 ToUnicode → PDF 內文字可選取搜尋 |
| SVG 特性支援 | `clipPath`、`marker`、`polygon`、`ellipse`、`tspan`、`stroke-dasharray`、巢狀 `transform` 全部正確 |
| 真實生產圖轉換 | 線上 stool P-01 零件圖整張餵入,**零 error**,與瀏覽器原生渲染逐項一致 |

**關鍵地雷**:`svg2pdf` 只認 `font-weight` 400 與 700。中間值(500、600)會**靜默**掉回
Helvetica,中文變亂碼且不報錯。真圖實測:`font-weight="600"` 的標題欄輸出成
`Qó•s` / `g~g(`,改 700 後正確顯示「凳腳 1」「松木」。

樣板本身文字極少(只有部件名稱與 100mm 標示),但**退回零件圖的那條路會經過既有版面**,
所以 `lib/render/` 的 8 處 `fontWeight={500/600}` 仍須修掉(`lib/floor/`、`lib/raised-floor/`
另有 2 處,不在本專案路徑上)。

## 5. 選紙與擺放試算

紙張階梯:A4 → A3 → B3 → A2 → A1 → A0。每邊留白 5mm(沿用 `parts-svg.ts` 的 `MARGIN_MM`)。
擺放時掃 0–90° 找**第一個塞得下的角度**,紙張直放橫放都試。

### 5.1 兩段式紙張上限

木頭仁 2026-08-19:「桌面椅面櫃板因為尺寸太大 不可能輸出 直接給三視圖列印」、
「椅面如果在 B3 以下 就給 1:1」。

用既有的 `categorizePart(id)`(`lib/render/categorize-part.ts`)區分:

- **面板類**(`case` 櫃板 / `divider` 層板 / `seat` 座板椅面 / `door` 門板)→ 上限 **A2**
- **其餘**(`leg` 腳 / `apron` 牙板橫撐 / `drawer` / `misc`)→ 上限 **A0**

**為什麼是 A2 不是 B3**:B3 是 500×353,長邊夠但**短邊只有 353mm**。椅面座板接近正方形
(方凳座板 350×350、餐椅椅面 420×400),寬度直接卡在短邊,扣留白只剩 343mm,連 350 的都
塞不下;斜擺也救不了——正方形旋轉只會讓外框更大。實測九件零件在 B3 上限下**面板類全數
落空**,等於「椅面一律不出樣板」,與指示的本意相反。A2 短邊 420mm 剛好切在正確位置。

### 5.2 試算結果

| 零件 | 攤平尺寸 mm | 類別 | 結果 |
|---|---|---|---|
| 方凳 牙條 | 280×60 | 橫撐 | A4 水平擺 |
| 方凳 下橫撐 | 280×40 | 橫撐 | A4 水平擺 |
| 圓凳 弧形撐 | 380×90 | 橫撐 | A3 水平擺 |
| 方凳 凳腳 | 425×35 | 腳 | **A3 斜 21°** |
| 餐椅 後腿(曲線) | 900×120 | 腳 | **A1 斜 32°** |
| 方凳 座板 | 350×350 | 面板 | A2 水平擺 |
| 餐椅 椅面 | 420×400 | 面板 | A2 水平擺 |
| 邊桌 桌面板 | 450×450 | 面板 | 超過 A2 → 退回零件圖 |
| 書桌 桌面板 | 1200×600 | 面板 | 超過 A2 → 退回零件圖 |
| 餐桌 桌面板 | 1500×800 | 面板 | 超過 A2 → 退回零件圖 |
| 衣櫃 背板 | 1920×1200 | 面板 | 超過 A2 → 退回零件圖 |

**斜擺不是小技巧,是演算法必要的一步**:凳腳 425mm 在 A3 上水平擺放不下(可用長邊只有
410mm),斜 21° 就進去了,省掉一個紙張級距。曲線後腿 900×120 同理,斜 32° 讓它留在 A1
而不用上 A0。

## 6. 架構

### 6.1 可直接複用的既有程式碼(不用重寫)

| 既有函式 | 位置 | 提供什麼 |
|---|---|---|
| `partFlatOutline(part)` | `lib/export/parts-svg.ts:50` | 攤平面輪廓,已在三主視圖中取投影面積最大者,已平移到原點、已翻 Y 成 SVG 慣例 |
| `outlinePathD(pts)` | `lib/export/parts-svg.ts:84` | 輪廓點 → SVG path |
| `partMachiningFaces(part, derived)` | `lib/export/mortise-faces.ts:547` | 該面的 `FaceHole[]` / `FaceTenon[]` |
| `deriveMortisesByPart(design)` | `lib/export/derived-mortises.ts` | 推導出的榫眼 |
| `groupPartsForDrawing(design)` | `lib/render/part-drawing/grouping.ts` | 同形合併與件號 |
| `zipStore(files)` | `lib/export/zip-store.ts:35` | 零依賴 ZIP 打包 |

這條管線原本是給 CNC 刀路產生器用的,幾何精度就是為了切削而做,拿來當列印樣板綽綽有餘。

### 6.2 `lib/export/template-pack/fit.ts`(新增)

紙張表與擺放演算法。

```ts
export interface PaperSpec { id: string; label: string; w: number; h: number }
export interface Placement { paper: PaperSpec; angleDeg: number; portrait: boolean }

/** 面板類上限 A2,其餘上限 A0。 */
export function ladderFor(category: PartCategory): PaperSpec[]

/** 掃 0–90°,回傳第一個塞得下的擺法;整條階梯都塞不下回 null(→ 退回零件圖)。 */
export function placeOnLadder(w: number, h: number, ladder: PaperSpec[]): Placement | null
```

判定式(矩形旋轉後的軸對齊外框):

```
bw = w·cosθ + h·sinθ
bh = w·sinθ + h·cosθ
塞得下 ⟺ (bw ≤ W 且 bh ≤ H) 或 (bw ≤ H 且 bh ≤ W)
```

其中 `W = paper.w - 10`、`H = paper.h - 10`(每邊 5mm 留白)。

### 6.3 `lib/export/template-pack/sheet.tsx`(新增)

一個零件 → 一張樣板 SVG。viewBox 單位 = mm = 紙面座標。

- 輪廓:`outlinePathD`,`stroke-width` 0.3mm(比 CNC 的 0.1mm hairline 粗,列印才看得見)
- 榫孔 / 孔位:實線輪廓 + 中心十字(方便點中心)
- 名稱:放在輪廓**內部**的重心位置;若輪廓太窄(細長條)改放在輪廓正上方 3mm 處並加引線
- 100mm 證明尺:紙面左下角
- 旋轉:整組內容包一層 `transform="rotate(θ) translate(...)"`,置中於紙面

### 6.4 `lib/export/template-pack/pdf.ts`(新增)

1. `renderToStaticMarkup(<TemplateSheet .../>)` → SVG 字串
2. 注入隱藏容器:`position:absolute; left:-99999px`
   這是**防禦性寫法,不是硬性依賴**。2026-08-19 在釘住的 jspdf 4.2.1 / svg2pdf.js 2.7.0
   上實測:改成 `display:none` 產出的 PDF 去掉 `/CreationDate` 與 `/ID` 後 byte-identical
   ——這版 svg2pdf 的文字量測走自己掛在 `document.body` 下的節點,不看呼叫端容器可不可見,
   舊版那個「`getBBox()` 在未參與版面的元素上回 0」的地雷已被上游修掉。保留只因零成本、
   且可防未來升版又改回去;真要改先跑 `npm run verify:template` 比對輸出
3. `svg2pdf(el, doc, {...})`
4. 每種紙開一份 `jsPDF({ unit:'mm', format:[W,H] })`,同尺寸的多張用 `addPage()`

### 6.5 `/api/pdf-font`(新增)

- 字型:**Noto Sans TC**(SIL OFL,可散布)。系統的標楷體 / 微軟正黑體是授權字型,只能本機測試
- 全字庫留伺服器端,前端送出「本次實際要渲染的字元集合」,伺服器用 `subset-font` 回子集
- 以排序後字元集合的 hash 當 cache key
- 檔案靠 `outputFileTracingIncludes` 帶上部署 —— **既有前例照抄**:`next.config.ts` 已經用
  這招讓 `/api/cnc-tool` 帶上 1MB 的 HTML
- `export const runtime = "nodejs"`(專案慣例,且 `subset-font` 需要 Node)

### 6.6 打包與檔名

`zipStore` 依紙張分檔:

```
00_索引.pdf
01_樣板_A4.pdf
02_樣板_A3.pdf
03_樣板_A2.pdf
04_零件圖_A4.pdf     ← 太大無法 1:1 的零件
```

zip 檔名:`{家具名}_實尺樣板_{日期}.zip`

### 6.7 索引封面

一張 A4,列出每個零件:件號、件名、數量、攤平尺寸、**在哪張紙、擺放角度**、
或標明「太大 → 見零件圖」。拿到輸出中心可以核張數,也避免漏印。

### 6.8 UI 與權限

- 進入點:`/design/[type]` 頁面,既有 `ThreeDExportButton` 旁
- 面板:紙張階梯勾選(可關掉輸出中心沒有的尺寸)、預估張數、開始產生
- 權限:比照 `/print` 的 server-side gate(未登入導 `/login`、未付費導 `/pricing`)

## 7. 風險與對策

| 風險 | 對策 |
|---|---|
| `font-weight` 中間值靜默亂碼 | 加測試掃 `fontWeight={5xx/6xx}`;PDF 產出後斷言中文字串完整 |
| `getBBox()` 在隱藏容器回 0 | 已於 jspdf 4.2.1 / svg2pdf.js 2.7.0 實測不成立(見 §6.4);仍用 `left:-99999px` 當防禦性寫法 |
| 印表機自動縮放導致樣板不是實尺 | 100mm 證明尺 + 索引頁提醒「列印時務必選『實際大小 / 100%』,不要選『縮放至頁面大小』」 |
| 細長零件名稱塞不進輪廓 | 估算文字實際長度（CJK 約 6mm/字）與 `face.w` 比較——文字沿 x 軸畫，可用寬度是寬不是高；放不下就移到紙角加引線 |
| 大型家具零件多,前端產 PDF 卡 UI | 分批 `await` 讓出主執行緒,顯示進度 |

## 8. 分階段實作

- **Phase 1** `fit.ts` 選紙與旋轉演算法 + 單元測試(純函式,好測)
- **Phase 2** `sheet.tsx` 樣板 SVG:輪廓 + 孔位 + 名稱 + 證明尺
- **Phase 3** PDF 管線:字型 API + svg2pdf + 修掉 8 處 `fontWeight`
- **Phase 4** 打包、索引封面、超尺寸退回零件圖
- **Phase 5** UI 面板 + 權限 gate

## 9. 測試策略

單元測試:

- `placeOnLadder` —— 上表九個零件的預期紙張與角度,含邊界(剛好塞下 / 差 1mm 塞不下)
- 掃描 `fontWeight` 非 400/700

視覺回歸(此手法本次已實測可行):

Playwright 產 PDF → `pdf.js` 光柵化成 PNG 比對基準圖,並用 `getTextContent()` 抽文字
斷言中文完整。這正是本次抓到 `font-weight` 亂碼 bug 的方法。

**實尺驗證**:PDF 光柵化後量 100mm 證明尺的像素長度,換算回 mm,誤差需 < 0.5mm。

## 10. 未決事項

1. **面板類上限 A2 是否確認**。指示原文是 B3,但實測 B3 短邊 353mm 會讓所有椅面座板落空
   (見 §5.1)。已改用 A2;若要改回 B3,`ladderFor()` 一行常數
2. 非面板類上限。預設開到 A0(曲線後腿 900mm 落在 A1,還有餘裕)
3. 免費版是否給浮水印樣板當導購。預設不給,比照 `/print` 完全鎖付費
