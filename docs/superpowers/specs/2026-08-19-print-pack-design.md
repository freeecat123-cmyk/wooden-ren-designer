# 木作藍圖 列印包(Print Pack)設計

日期:2026-08-19
狀態:待審

## 1. 背景與目標

現況:`/design/[type]/print` 產出一整份 A4 綜合圖紙(封面 → 材料單 → 榫卯 → 零件索引 → 零件圖 2 欄網格 → 範本 → 工具)。其中零件圖走 `lib/render/part-drawing/paper-sheet.tsx`,紙面硬綁 **A4 橫式 297×210**,再由 `paper-fit.ts` 的 CNS 比例樹(1/2/5/10/20)挑「塞得下的最小比例」。

問題:長料被壓到 1:10、1:20,尺寸標註跟榫卯記號糊成一團,而且完全沒有 1:1 實尺樣板可用。

目標:**一鍵下載一包 PDF**,依料長自動選紙(短料 A4、長料 B3/A2),外加 1:1 實尺樣板,拿去輸出中心直接印。

## 2. 範圍

包含:

- 零件圖:一件一張,依料長選紙,比例盡量維持在看得清楚的範圍
- 1:1 實尺樣板:輪廓為主 + 邊緣標註
- 零件清單索引(封面):共幾件、各在哪張紙、什麼比例
- 材料單 / 切割排版圖
- 超大零件的拼接列印(第一版就做)

不包含:

- **不動既有 `/design/[type]/print`**。它是已驗收的 A4 綜合圖紙,列印包是獨立的第三條輸出,避免回歸風險
- 不新增語系,沿用 next-intl 既有的 `zh-TW` / `en`

## 3. 產出方式決策

| 方案 | 做法 | 取捨 |
|---|---|---|
| A 瀏覽器列印路由 | 新路由 + 命名 `@page`,使用者按 Ctrl+P 存 PDF | 零依賴、中文免處理;但每種紙要按一次列印,不是真一鍵 |
| **B 前端自產 PDF(採用)** | `jsPDF` + `svg2pdf.js`,直接下載 zip | 真一鍵、檔名與紙張完全可控;代價是要自己解決中文字型嵌入 |
| C 後端 headless Chromium | Vercel 上跑 `@sparticuz/chromium` | 真一鍵但 50MB bundle、冷啟 3–5 秒、記憶體要 1GB |

決策:**採方案 B**(使用者 2026-08-19 指定)。字型問題已於同日實測解決,見下節。

## 4. 已實測驗證的技術事實

以下皆為本機 Chromium(Playwright)實測結果,非推測:

| 項目 | 結果 |
|---|---|
| jsPDF 4.2.1 + svg2pdf.js 2.7.0 產出 B3 | MediaBox **353.0 × 500.0 mm**,精準 |
| 中文字型子集化(`subset-font`) | 標楷體 **5,060KB → 70KB**(約 150 字) |
| 字型嵌入方式 | CIDFontType2 / Type0 複合字型,附 ToUnicode → PDF 內文字**可選取、可搜尋** |
| 單張 B3 PDF 檔案大小 | 32KB |
| SVG 特性支援 | `clipPath`、`marker`(箭頭)、`polygon`、`ellipse`、`tspan`、`stroke-dasharray`、巢狀 `transform` **全部正確渲染** |
| 專案 SVG 特性盤點 | 只用到上述這些,無 `pattern` / `mask` / `filter` / `foreignObject` |

### 4.1 真實生產圖驗證(2026-08-19 第三輪)

上表用的是手寫測試 SVG。另外抓了**線上真圖**再驗一次:`designer.woodenren.com/design/stool`
的 P-01 凳腳零件圖(12KB、26 個文字元素、31 個群組、由 `OrthoView` + `annotation.tsx`
產生),整張餵進 `svg2pdf`:

- **零 page error**,`getBBox()` 回 296×209 正確
- 標題欄六欄中文、三視圖、尺寸鏈箭頭、中心點劃線、虛線輪廓、比例尺條、view 標籤全部正確重現
- 把同一份 SVG 用瀏覽器原生渲染成 PNG 對照,版面**逐項一致** → 轉換是忠實的,沒有失真

字元集取自該圖實際文字共 47 字,子集後 55KB。

### 4.2 現況比例量測(說明本專案要解決什麼)

線上實測目前 A4 硬綁之下,各家具最長零件拿到的比例:

| 家具 | 最長零件 | 尺寸 mm | 目前比例 |
|---|---|---|---|
| 方凳 | 凳腳 | 35×35×425 | 1:5 |
| 書桌 | 桌面板 | 1200×600×28 | 1:10 |
| 餐桌 | 桌面板 | 1500×800×30 | 1:10 |
| 衣櫃 | 背板 | 1200×3×1920 | 1:10 |

**實測抓到的關鍵 bug**:`svg2pdf` 只認 `font-weight` 400 與 700。**中間值(500、600)會靜默掉回 Helvetica,中文直接變亂碼**,不報錯。測試中 `font-weight="600"` 的標題欄輸出為 `g(˜-NÁ[¶QwŠ`,而同一份文件裡 `700` 的文字完全正常。

專案內 `lib/render/` 與 `components/print/` 目前有 **8 處** `fontWeight={500}` 或 `fontWeight={600}`,全部必須正規化為 400 或 700,否則上線即整排標題欄亂碼。

## 5. 架構

### 5.1 紙張表 `lib/render/part-drawing/paper-table.ts`(新增)

取代目前寫死的 `A4_PAPER` 常數。每張紙描述 `{ id, label, W, H, orientation }`(mm)。

紙張階梯(使用者確認輸出中心「都有」):A4 → A3 → B3 → A2 → A1 → A0。

版面分區改為**由紙張尺寸推導**,不再硬編碼:

```
margin      = 10mm(四邊)
titleBar    = 頂部 20mm
titleBlock  = 底部 20mm
drawArea    = 其餘區域
```

字級維持絕對 mm 值(`fontSize={5}` 等)。因為 viewBox 單位就是 mm,同一個字級在任何紙張上都是相同的物理大小——這是對的,不要跟著紙張縮放。

**未決**:B 系列採 ISO(B3 = 353×500)或 JIS(B3 = 364×515)。台灣輸出中心兩種都遇得到。先以 ISO 實作,這是紙張表裡的一行常數,確認後改一行即可。

### 5.2 選紙演算法 `pickPaperAndScale(part, mode, ladder)`

取代 `pickScaleForPaper()`。回傳 `{ paper, scale, tiles? }`。

- `mode: 'readable'` — 先在 A4 上找最大可用比例。若 A4 上的比例會掉到 **1:5 以下**(標註開始糊),就沿階梯升紙重試,目標把比例停在 1:1 ~ 1:2。這就是「短料 A4、長料 B3」。
- `mode: 'fullsize'` — 比例鎖 1:1,只升紙;升到階梯頂端仍塞不下 → 交給拼接(5.5)。

沿用既有的 L 型佈局計算(`L_LAYOUT_GAP`、`L_LAYOUT_CHAIN_PAD`)與 `getIsolatedExtents()`,只是把 `DRAW_AREA_W/H` 換成當前紙張推導值。

**必須保留 `needBrokenView`**。目前 `pickScaleForPaper()` 回傳這個旗標,`drawing.tsx:284` 拿它去呼叫 `computeBrokenViewSpec()` 畫斷面圖。新的回傳型別是:

```ts
interface PaperFitResult {
  paper: PaperSpec;
  scale: number;
  needBrokenView: boolean;
  tiles?: TileSpec[];
  views: Record<PartView, { w: number; h: number }>;
}
```

**升紙 / 斷面圖 / 拼接三者的互斥規則**(spec 第一版漏掉,補上):

- `mode: 'readable'` — 先升紙。升到階梯頂端仍塞不下 → `needBrokenView = true`,畫斷面圖(維持既有行為),**不拼接**。比例圖的目的是看得懂,斷面圖比拼四張紙實用
- `mode: 'fullsize'` — 比例鎖 1:1,升紙後仍塞不下 → **拼接**,`needBrokenView` 恆為 `false`。樣板要照著切,斷面圖會讓樣板失去意義

**既有呼叫點必須維持原行為**。`drawing.tsx` 與 `PartDrawingsPanel` 傳 `ladder: ['A4']`,結果與現況完全相同;只有列印包傳完整階梯。這讓 Phase 1 成為純重構,可用快照測試證明零行為變更。

### 5.3 `paper-sheet.tsx` 參數化

主要工作量。目前 A4 座標硬編碼散在各處,至少包含:

- `viewBox="0 0 297 210"`
- 外框 `rect` 的 296×209
- `innerX=10 / innerY=24 / innerW=267 / innerH=156`
- title bar 分隔線 y=20、文字 y=16.5、右側錨點 x=285
- title block y=182~202、寬 277、6 欄分割
- 比例尺條 `barX=200 / barY=178`
- 第三角法符號 `cx=171 / cy=190`

外加 `lib/render/svg-views.tsx` 裡 `OrthoView` 的 `paperMode="a4-landscape"`,其內部同樣寫死 `0 0 297 210`(約在 1332、1335 行)。需擴充成接受紙張物件。

### 5.4 1:1 實尺樣板 `template-sheet.tsx`(新增)

使用者選定「輪廓 + 邊緣標註」。

輪廓來源沿用既有的 `projectPartSilhouette`(`lib/render/geometry.ts`)——CNC 匯出那條管線已經在產 mm 精準輪廓,直接複用,不重寫。

紙上內容:

- 零件輪廓(1:1)+ 榫眼 / 孔位
- 紙邊標註:件號、件名、材料、數量
- **100mm 證明尺**:一條標示 100mm 的實尺線。列印比例被印表機縮放時,量一下就知道印錯了
- 「此圖為 1:1 實尺」字樣

### 5.5 拼接列印 `tiling.ts`(新增)

**期望值修正:拼接不是邊緣案例,是 1:1 樣板的主要路徑。**

原因是 L 型佈局的總寬 = `fW + sW + gap + padPaper × 4`,其中 `padPaper = 35 / scale`。
比例愈接近 1:1,尺寸鏈留白吃掉的紙就愈多。依此公式試算(非實測):

| 零件 | 目前 A4 | 升紙後可得 | 1:1 所需 |
|---|---|---|---|
| 凳腳 425mm | 1:5 | A3 → 1:2 | 約 614mm 寬 → A1 |
| 桌面板 1200mm | 1:10 | A2 → 1:5 | 遠超 A1 → 必須拼接 |

也就是說:**升紙帶來的是 1:10 → 1:5、1:5 → 1:2 這種一到兩階的改善**(對標註清晰度已經很有感),
但只要零件長邊超過約 400mm、又要真 1:1,幾乎都會落到拼接。Phase 4 因此不可省略。

超出最大紙的零件切成 N 頁:

- **重疊區 10mm**,避免裁切誤差造成缺口
- 四角**對位十字**
- 頁邊標記:「第 2 張 / 共 4 張 — 接第 1 張右側」
- 每份拼接附一張**拼接示意縮圖**,標出各張的相對位置

### 5.6 PDF 產出管線 `lib/export/print-pack/pdf.ts`(新增)

流程:

1. `renderToStaticMarkup(<Sheet .../>)` 產出 SVG 字串
2. 注入**隱藏容器**:`position:absolute; left:-99999px`
   **不可用 `display:none`** — `svg2pdf` 依賴 `getBBox()`,元素未參與版面時會回傳 0,整張圖會崩掉
3. `svg2pdf(el, doc, { x:0, y:0, width, height })`
4. 每種紙張開一份 `jsPDF({ unit:'mm', format:[W,H] })`,多張用 `addPage()`

### 5.7 字型服務 `/api/pdf-font`(新增)

- 字型檔:**Noto Sans TC**(SIL OFL,可再散布)。系統內建的標楷體 / 微軟正黑體是授權字型,**不可打包散布**,僅供本機測試
- 全字庫留在伺服器端。前端把「本次實際要渲染的字元集合」送上來,伺服器用 `subset-font` 回傳子集 TTF(實測約 70KB)
- 以排序後字元集合的 hash 當 cache key,長效快取
- 字元集合由我們自己組出來(SVG 內容完全由程式產生),因此**不會有缺字**。實測確認:不在子集內的字會直接消失,不是亂碼

**鐵則**:所有進 PDF 的文字,`font-weight` 只能是 400 或 700。新增元件一律遵守,既有 8 處一併修掉。

### 5.8 ZIP 打包

沿用既有的 `lib/export/zip-store.ts`(零依賴 STORED zip,原本給 3MF 用)。PDF 本身已壓縮,STORED 不吃虧。

檔名規則:

```
00_索引_A4.pdf
01_零件圖_A4.pdf
02_零件圖_B3.pdf
03_實尺樣板_A2.pdf
04_材料單_A4.pdf
05_切割排版_A3.pdf
```

zip 檔名:`{家具名}_列印包_{日期}.zip`

### 5.9 UI 進入點與權限

- 進入點:`/design/[type]` 頁面,放在既有 `ThreeDExportButton` 旁
- 面板內容:紙張階梯勾選(使用者可關掉輸出中心沒有的尺寸)、要不要含 1:1 樣板、預估張數
- 權限:比照 `/print` 的 server-side gate(未登入導 `/login`、未付費導 `/pricing`)。不能只靠前端遮罩

## 5.10 既有版面 bug(列印包會原封不動繼承)

第三輪實測時,在**現行線上的 A4 零件圖**上發現三個版面問題。已用瀏覽器原生渲染對照確認
是既有 bug,**不是 PDF 轉換造成**:

1. **第三角法符號壓在標題欄「數量」格上**。符號畫在 `cx=171, y=185~192`,而 title block
   從 `y=182` 起、第 4 欄範圍是 `x=148.5~194.7` —— 兩者重疊
2. **比例尺標籤「0」與「50mm」擠成 `050mm`**。1:5 時尺條只有 10mm 寬,兩個 `fontSize=2.8`
   的標籤在該寬度內必然相撞;比例愈小愈嚴重
3. **側視圖右側有一個孤兒「寬 35」標註**,離它的尺寸線很遠,落在繪圖區外緣

這三個都不在本專案範圍內,但列印包會照單全收,而且紙張變大後位置會重新分佈。
**待決:是否納入 Phase 1 順手修掉。** 修改會動到已驗收的零件圖版面,需要木頭仁點頭。

## 6. 風險與對策

| 風險 | 對策 |
|---|---|
| `font-weight` 中間值靜默亂碼 | 加 lint 規則或單元測試掃 `fontWeight={5xx/6xx}`;PDF 產出後驗證 ToUnicode 覆蓋率 |
| `getBBox()` 在隱藏容器回傳 0 | 明定用 `left:-99999px` 而非 `display:none`;加測試斷言 bbox 非 0 |
| 大型家具零件多,前端產 PDF 可能卡 UI | 分批 `await` 讓出主執行緒,顯示進度;超過門檻數量給提示 |
| Noto Sans TC 全字庫進 repo 體積大 | 只放伺服器端,不進 client bundle;或 build 時抓取 |
| 拼接對位誤差 | 10mm 重疊 + 對位十字 + 100mm 證明尺三重保險 |

## 7. 分階段實作

- **Phase 1** 地基:紙張表 + `pickPaperAndScale` + `paper-sheet` / `OrthoView` 參數化 + 修掉 8 處 `fontWeight`
- **Phase 2** PDF 管線:字型 API + svg2pdf 管線 + zip 打包,先只出零件圖
- **Phase 3** 樣板:`template-sheet` + 100mm 證明尺
- **Phase 4** 拼接:`tiling.ts` + 對位標記 + 示意縮圖
- **Phase 5** 收尾:索引封面、材料單 / 切割排版圖併入、UI 面板、權限 gate

## 8. 測試策略

單元測試:

- `pickPaperAndScale` — 各種料長 → 預期紙張與比例(含邊界:剛好塞下 / 剛好塞不下)
- `tiling` — 分頁數、重疊區、對位十字座標
- 掃描 `fontWeight` 非 400/700

視覺回歸(此手法本次已實測可行):

Playwright 產 PDF → `pdf.js` 光柵化成 PNG → 比對基準圖。同時用 `getTextContent()` 抽文字,斷言中文字串完整——這正是本次抓到 `font-weight` 亂碼 bug 的方法,自動化後可防回歸。

## 9. 未決事項

以下三項皆已設預設值,不阻擋實作;確認後調整即可。

1. B 系列採 ISO 還是 JIS。**預設 ISO**(B3 = 353×500),紙張表裡一行常數
2. 紙張階梯上限。**預設開到 A1**(841×594),A0 多數輸出中心要另外排程且單價跳一階;超過 A1 即觸發拼接
3. 免費版是否給浮水印版列印包當導購。**預設不給**,比照 `/print` 完全鎖付費
