# 筆筒（Pencil Holder / Desk Caddy）設計參考

> 用途：wrd 家具設計器小物件模板的設計與參數化依據。
> 規範：所有尺寸以 mm 為單位，內部計算保高精度，UI 顯示 round 至 1 位小數（依專案慣例）。
> 慣例：origin = 底部中心；長 (L) = X 軸、深 (D) = Y 軸、高 (H) = Z 軸。
> 文件對齊：本檔與 `docs/drafting-math.md` 共用幾何/榫卯規則，衝突以 drafting-math 為準並回頭 flag。

---

## 0. 設計總覽 / 不變量（First Principles）

筆筒看似最簡單的小物件，實際上要同時兼顧：

1. **物件穩定性**：高徑比 (H/D) 過大會傾倒；單一筆插偏心一邊也會倒。
2. **筆的物理常數**：標準木鉛筆 ⌀7.5–8 mm、長 175 mm；原子筆 ⌀10–14 mm、長 140–155 mm；麥克筆 ⌀18–22 mm、長 130–160 mm；化妝刷 ⌀12–35 mm、長 150–200 mm；廚房料理工具 ⌀30–45 mm、長 280–340 mm。
3. **木材尺寸穩定性**：實木有徑向/弦向收縮，中空筒形若整塊挖空，徑向膨脹會頂裂；建議分片膠合或預留收縮縫。
4. **底面接地**：木底容易刮傷桌面，建議底圈內嵌 EVA 軟墊或羊毛氈，預留 ⌀ 略小於外徑、深 0.5 mm 的環形凹槽。
5. **內側塗裝**：筆芯石墨會掉粉、麥克筆有溶劑，內壁建議生漆/植物油 (亞麻仁/胡桃) 而非聚氨酯（化妝刷尤其要避免有機溶劑殘留）。

### 全系列共用的關鍵不變量

| 變數 | 區間 (mm) | 說明 |
|---|---|---|
| 外高 H | 80 – 150 | 筆露出 1/3 才好抓；標準鉛筆 175 mm，H = 100 露 75 mm 為視覺最優 |
| 外徑/邊長 D 或 L | 60 – 120 | 單筒 70–90、桌邊型 100–140 |
| 壁厚 t | 8 – 18 | 實木 12–15 為甜蜜點；薄於 8 易裂、厚於 18 笨重 |
| 底厚 b | 8 – 15 | 槽接 8–10 / 釘接 12–15 |
| 倒角 r | 1 – 6 | 內口 r = 1（避免吃手）；外緣 r = 2–4 |
| 筆孔 ⌀ | 9 – 14 | 鉛筆 9、原子筆 12、麥克筆 14（給 +1 mm 公差） |
| 高徑比 H/D | 0.8 – 1.6 | <0.8 偏餐具盤、>1.6 不穩 |

---

## 1. 款式分類（12 種，可作為 wrd template variant）

### 1.1 方筒（Square Tube）— 最基礎

- 尺寸：80 × 80 × 100 mm（外）；壁厚 12、底厚 10、淨深 90 mm。
- 工法選項：① 四片斜接 (45° miter) + 內部三角 spline；② 四片企口 (rabbet)；③ 指接 (box joint, 8 mm pitch)；④ 鳩尾接 (through dovetail, 1:7)。
- 工序：刨 / 切尺寸 / 打槽接底板 / 接合四面 / 上下端面平整 / 倒角 / 砂紙 #240 → #400 / 上油 / 底貼氈。
- 變體：長方形 60 × 100 × 90（橫式分槽）、雙人對放 200 × 80 × 90（中央隔板）。

### 1.2 圓筒（Round Tube）— 車床/旋成

- 外徑 80 mm，內徑 60 mm（壁厚 10），高 100 mm；底直接由原木挖出留 12 mm。
- 車床流程：⌀ 90 × 110 mm 木坯 → 兩端定中心 → 外徑成形 → 中空 (掏內徑用 hollowing tool，壁厚 10 ± 1 mm) → 底厚 12 mm → 砂磨 → 拋光 → 上油。
- 紋向：建議**端紋（end grain）朝上**，徑向收縮對外徑影響小（<1 %），不易裂；側紋朝上裂紋率高 3–5 倍。
- 中式古典版 (黃花梨/紫檀)：外徑 100–150、高 130–200、壁厚 12–18，常見三足底（小蹄足或如意足）。

### 1.3 多面體（Hexagon / Octagon）— 段拼或一體切

**段拼版（stave-built）**：

- 六角邊長 a = 40 → 外接圓 R = 40、內接圓 r = 34.6；八角邊長 a = 35 → R = 45.7、r = 42.2。
- 每段切 60° (六角) 或 67.5° (八角) 兩端複合斜角；建議用斜切夾治具。
- 高 100、壁厚 12、底以 6/8 邊形 plywood 槽接。
- 表面長紋外露好看，但段間膠縫多 → 用緩衝膠（PU 或 Titebond III）。

**一體版（solid block）**：

- 80 × 80 × 100 方料 → 桌鋸 4 次切 45° 斜邊變八角 → 鑽中心孔 (⌀ 60、深 90) → 倒角 → 上油。

### 1.4 階梯多層（Stepped / Tiered）

- 三層階梯式：H1 = 80, H2 = 100, H3 = 120；前低後高給筆排序視覺層次。
- 底面共用一片 180 × 80 × 12 底板，三筒以橫向 dado (深 5、寬 12) 嵌入或螺絲反鎖。
- 變體：每層孔 ⌀ 不同 (前 9 / 中 12 / 後 18) 對應 鉛筆 / 原子筆 / 麥克筆。
- 適合 wrd 做為 "stepCount + perStepHeight + perStepDiameter" 三軸參數。

### 1.5 磁吸組合（Magnetic Modular，OakyBlocks 流派）

- 每模組 60 × 60 × 80 mm；側面內嵌 ⌀ 8 × 3 mm 釹磁鐵 4 顆（兩面共 8 顆）。
- 磁鐵孔距底邊 20 mm、距側邊 15 mm，左右對稱保證任意組合都對齊。
- 模組類型：筆筒、便條盒、夾子盒、手機架、線材槽 — 共用 60 mm 模數可拼成長條。
- 工法重點：磁鐵孔用 forstner 鑽頭精度 ±0.2 mm；極性方向統一 (用油漆筆標 N/S)。

### 1.6 旋轉式（Lazy Susan / Rotating）

- 雙層：底盤 ⌀ 180、上轉盤 ⌀ 160（差 10 mm 防夾手）；中間放 ⌀ 100 lazy susan 軸承（鋼珠式高度 8 mm）。
- 上方 6 個分區（60° 一格），每區深 60 mm、寬 70 mm（弧長）、高 100 mm。
- 中央可加 ⌀ 30 立柱手把方便旋轉。
- 軸承固定：上下盤各鎖 4 顆 M3 × 12 螺絲；建議螺絲不穿透頂面，預埋孔深 8 mm（轉盤總厚 12 mm）。

### 1.7 帶抽屜款（With Drawer）

- 外殼 200 × 100 × 130 mm，上半 90 mm 為直立筆插（多格），下半 35 mm 為抽屜。
- 抽屜內淨：184 × 84 × 28（四邊各留 2 mm 滑動公差，符合 wrd 抽屜規則）。
- 滑軌：木對木企口滑（左右各刻 6 × 6 mm 凹槽）或拉手繩。
- 抽屜面：可比殼體略凸出 3 mm（蓋 3 分簡化）或齊平（入柱齊平）。
- 抽屜內格：放迴紋針 / 橡皮擦 / 美工刀片，分隔 20 × 20 mm 一格。

### 1.8 桌邊夾固款（Desk Edge Clamp）

- 主體 150 × 80 × 120 mm；側面延伸出 C 型木夾，可吃 0.3–2.3 inch (8–58 mm) 桌板厚度。
- C 夾用 M8 蝶帽螺絲鎖緊，桌板接觸面墊 3 mm 軟木避免壓痕。
- 重心校正：主體重心要落在夾持中軸內側 30 mm，避免單側懸臂下垂。
- 適合不能在桌面打孔/不想佔桌面的工作者。

### 1.9 化妝刷筒（Makeup Brush Holder）

- ⌀ 90 × 130 mm（化妝刷比鉛筆長且毛束需通風）。
- 內部分隔：⌀ 60 不鏽鋼或玻璃內杯（拆出清洗），杯與木壁間填珍珠/咖啡豆吸濕（傳統作法）。
- 雙筒並排：100 × 200 × 130（左大刷 ⌀ 80、右小刷 ⌀ 50）。
- 旋轉 360 + lid：外加 ⌀ 100 木蓋阻塵，刷頭朝下/朝上皆可（避免毛束變形要朝上）。
- 木材選低氣味：楓 / 樺 / 山毛櫸；避免雪松（精油影響皮膚）。

### 1.10 廚房料理筒（Kitchen Utensil Holder）

- ⌀ 150–180 × 200–250 mm（鍋鏟/打蛋器需要大空間）。
- 壁厚 18–25（吸濕熱穩定性需求高）。
- 木材：相思木 (acacia) / 橡木 / 柚木（防潮/抗油）。
- 內襯：建議內壁刷天然蜂蠟或食用級胡桃油，三個月一補。
- 排水：底板鑽 4 個 ⌀ 6 mm 透氣/排水孔，四角佈置；底部 4 個墊腳離桌 8 mm。

### 1.11 木工房專用（Workshop Caddy）

針對木頭仁工坊使用情境特化：

- 外殼 220 × 120 × 140 mm。
- 分槽（從左到右）：
  - **直立筆插槽**：6 個 ⌀ 10 孔（木工鉛筆/麥克筆/白色粉筆）。
  - **長尺槽**：18 mm 寬 × 50 mm 深 × 150 mm 長（直角尺 / 30 cm 鋼尺立放）。
  - **劃線刀槽**：12 mm 寬 × 40 mm 深 × 140 mm 長。
  - **夾子/橡皮擦盤**：80 × 80 × 30 mm 開放盤。
  - **磁吸條**：背面貼 100 × 10 × 3 mm 釹磁條，吸鑿刀套蓋 / 鑽頭。
- 強化結構：四角實木方料柱 + 板片 dado 嵌入；可承受 5 kg 以上工具重壓。

### 1.12 文具站（剪刀/刀片直立槽）

- 主體 100 × 100 × 130 mm。
- 中心 ⌀ 60 圓孔放筆；四周圍四個窄縫：
  - 剪刀縫：3 × 50 mm（剪刀刃片厚度 ~2 mm）。
  - 美工刀縫：5 × 40 mm（含本體厚度）。
  - 切割墊小片縫：2 × 80 mm。
  - 釘書機放底層抽屜。
- 安全考量：刀片縫底部要堵死或加軟木墊，避免刺穿桌面。

### 1.13（額外）圓盤散放筆（Tray Style）

- 200 × 150 × 25 mm 淺盤，邊緣抬高 15 mm，筆水平放置。
- 適合書法毛筆橫放（毛朝上避免變形）；也適合鋼筆收藏陳列。
- 工法：底板 + 四邊框，框與底用 rabbet + 釘 / 槽接。

---

## 2. 內部分隔方案

| 方案 | 說明 | 適用款式 |
|---|---|---|
| 縱向單分（一刀切兩半） | 中央插一片 t = 6 mm 隔板 | 1.1 / 1.7 |
| 橫向 2×2 田字 | 十字隔板，4 格 | 1.7 / 1.11 |
| 田字 3×3 | 9 格小格，每格 25 mm | 化妝品收納 |
| 輻射放射狀 | 圓筒內 6 條 60° 輻射板 | 1.2 / 1.9 |
| 圓孔陣列 | 頂部一塊厚 15 mm 木板鑽多 ⌀ 10 孔 | 木工筆筒插 6–12 支鉛筆 |
| 可拆活動隔板 | 內壁刻 5 mm 槽，隔板可滑 | 1.7 抽屜內 |
| 磁吸隔板 | 隔板側嵌磁鐵與外殼磁吸 | 高階訂製 |

設計提示：隔板底部留 5 mm 通氣縫，避免發霉 + 方便清屑。

---

## 3. 接合工法（Joinery）

### 3.1 主結構接合

| 工法 | 強度 | 美觀 | 工序時間 | wrd 模板適合 |
|---|---|---|---|---|
| 平接 (butt + 釘/螺絲) | 低 | ★ | 10 min | 平實/初學者 |
| 斜接 (45° miter) | 低 | ★★★★ | 30 min | 北歐/日式極簡 |
| 斜接 + spline (3×30 mm 三角條) | 中 | ★★★★★ | 60 min | 1.1 / 1.3 |
| 企口接 (rabbet, 6 × 6 mm) | 中 | ★★ | 30 min | 1.7 / 1.11 |
| 指接 (box joint, 8 mm pitch) | 高 | ★★★★ | 90 min | 1.1 進階 |
| 鳩尾接 (through dovetail, 1:7) | 極高 | ★★★★★ | 180 min | 1.1 / 1.7 高階 |
| 段拼 (stave) + 端面圓木栓 | 中 | ★★★ | 120 min | 1.3 |

### 3.2 底板接合

- **槽接 (dado)**：底板嵌入四壁內側 dado 槽，深 5、寬 = 底板厚（10 或 12）。最隱蔽乾淨。
- **釘接 (nail / brad)**：底板從外側釘入，表面留釘孔（可用木栓塞補）。
- **木栓接 (dowel)**：⌀ 6 × 20 mm 暗榫從側壁打入底板，2 顆 / 邊。
- **螺絲反鎖**：底板從下方反鎖，便於拆卸，但底面會看到。

### 3.3 圓筒中空成形

- **車床掏內** (1.2 主流)：壁厚 10 ± 1 mm。
- **forstner 鑽**：⌀ 60 forstner 鑽頭一次到底（可達 90 mm 深）；超過要多段鑽 + 鑿刀清底。
- **CNC 銑挖**：3D 程式掃描，壁厚最均勻，但設備門檻高。
- **多片膠合**：上下兩個半圓殼膠合（中央有縫但結構穩定）。

---

## 4. 裝飾選項

| 選項 | 製作方式 | 適合定位 |
|---|---|---|
| 邊緣倒角 (chamfer 2 mm 45°) | 修邊機 / 銼刀 | 全系列基本款 |
| 邊緣圓角 (round-over r = 3) | 修邊機 + R3 圓邊刀 | 兒童 / 化妝刷 |
| 雙線溝飾（groove 2 mm × 2 道） | 修邊機 | 中式文房 |
| CNC 雕花 (V-bit 30°) | CNC + V-Carve | 訂製 / 文創 |
| 鑲嵌 (inlay, 0.6 mm 薄板) | 雷雕 / CNC + Paul Zank V-protocol | 高階 |
| 烙印 (logo branding) | 烙印模 / 雷雕 | 木頭仁 / 木匠學院品牌 |
| 噴砂紋理 | 砂帶機局部打磨 | 工業風 |
| 染色（黑 / 胡桃 / 柚） | 水性染劑（先染再上油） | 對比色設計 |
| 防水處理 | 桐油 + 蜂蠟（食器級） | 廚房筒 |

**鑲嵌 V-bit 公式（Paul Zank V-Inlay Protocol）**：

- 母槽深度 D_female；公榫切深 D_male = D_female + 0.5 mm（給膠水空間）。
- V-bit 角度 30° 或 60°；公榫倒立切刻、與母槽鏡像。
- 木頭仁工坊適用：30° V-bit + 0.6 mm 薄飾片。

---

## 5. 木材選擇對照

| 木材 | 特性 | 推薦用途 | 不推薦 |
|---|---|---|---|
| 楓木 (Maple) | 細紋密實 | 化妝刷 / 文具站 | 戶外 |
| 胡桃木 (Walnut) | 深色高級感 | 高階文房 / 桌邊夾 | 兒童（深色易隱藏髒污） |
| 橡木 (Oak) | 木紋粗獷耐用 | 廚房 / 工作筒 | 中式典雅 |
| 櫻桃木 (Cherry) | 中色溫潤 | 階梯款 / 旋轉款 | 戶外 |
| 桐木 (Paulownia) | 極輕、便宜 | 親子課程 / 教學樣品 | 重物承載 |
| 檜木 (Hinoki) | 香氣防蟲 | 文房 / 茶道用 | 食用器具（味道強） |
| 相思木 (Acacia) | 耐潮油性高 | 廚房 | 文具（紋粗顯亂） |
| 黃花梨 / 紫檀 | 中式珍品 | 收藏級文房 | 一般日用 |
| 椴木夾板 (Plywood) | 穩定不變形 | 模組磁吸款 / 抽屜 | 全裸面（要包邊） |

含水率：成品木材建議 8–12 %（室內用），高於 14 % 完工後易裂。

---

## 6. 使用情境特化建議

### 6.1 辦公桌（Office Desk）

- 高 100、徑 80 為甜蜜點；放桌面右上角不擋視線。
- 顏色配筆電（Mac → 楓 / 胡桃；木質鍵盤 → 櫻桃）。
- 建議含 1 個抽屜（迴紋針/橡皮擦）。

### 6.2 化妝台（Vanity）

- 雙筒並排（大筆 + 小筆）。
- 內杯可拆出清洗。
- 高 130（化妝刷較長）。

### 6.3 廚房（Kitchen）

- ⌀ 150 + H 240、壁厚 20。
- 底排水孔 4 個 + 墊腳離桌 8 mm。
- 食器級表面處理。

### 6.4 木工房（Workshop）

- 模板 1.11 全套。
- 角落含磁吸條吸鑽頭。
- 推薦木材：實木邊料（橡木 / 山毛櫸）。

### 6.5 兒童書桌（Kids' Desk）

- 全外緣 r = 5 圓角（防撞）。
- 桐木輕款，跌落不傷。
- 階梯款配色 (前低後高) 視覺易辨。
- 不用磁鐵（兒童誤食風險）。

---

## 7. 市售品牌參考點（Benchmark）

| 品牌 | 經典型號 / 風格 | 關鍵尺寸 (mm) | 學習點 |
|---|---|---|---|
| 無印良品 (MUJI) | MDF 筆立、橡木方筒 | 80 × 80 × 100 | 極簡、無 logo、純色 |
| IKEA | RISATORP 鐵網 / SKÅDIS 系統 | 90 × 90 × 110 | 模組化思維 |
| Oakywood (PL) | OakyBlocks Pen Tray | 60 × 60 × 80 模數 | 磁吸模組系統 |
| Y Studio | 黃銅 + 木材鋼筆筒 | ⌀ 70 × 90 | 高級文具陳列 |
| 品木家具 (TW) | 訂製文房 | 100 × 100 × 120 | 台灣木職人風格 |
| KANO Editions | 北歐 8 格 | 155 × 90 × 75 | 多格分類 |
| Minimum Design | Origami 折紙風 | ⌀ 60 × 100 | 幾何極簡 |
| Y2K Magic Pencil Case (Nedrelow) | 磁吸文具系統 | 7 種 sleeve | 磁吸延伸 |
| 中式古董 (黃花梨 / 紫檀) | 蘇州/北京文房 | ⌀ 100–150 × 130–200 | 端紋、三足、雙線溝飾 |

木頭仁差異化建議：

1. **台灣本土木種**（柳杉 / 樟木 / 台灣杉）— 故事性強。
2. **木匠學院 logo 烙印** — 品牌識別。
3. **客製化刻字** — Etsy/蝦皮加價方案 NT$ 200。
4. **教學版 DIY kit** — 預切板片 + 砂紙 + 油 + 教學影片，引流到課程。

---

## 8. wrd 模板實作建議（給家具設計器）

### 8.1 參數列（mm 為主，禁用 ratio，符合 feedback_use_mm_not_ratio）

```
PencilHolder {
  variant: "square" | "round" | "hex" | "oct" | "stepped" | "magnetic"
         | "rotating" | "drawer" | "makeup" | "kitchen" | "workshop" | "stationery"
  outerL: 80   // 外長 (X)，圓筒時忽略，用 outerD
  outerD: 80   // 外深 (Y)
  outerH: 100  // 外高 (Z)
  wallThickness: 12
  bottomThickness: 10
  innerChamfer: 1
  outerChamfer: 3   // 0 = 無倒角；> 0 = 倒角；負值 (round-over) 用另參數
  outerRound: 0     // 圓角半徑（與 chamfer 二擇一）
  pencilHoles: { count: 0, diameter: 9, gridX: 1, gridY: 1 } // 0 = 開口式
  divider: "none" | "cross" | "radial6" | "grid3x3" | "verticalSingle"
  joinery: "miter" | "miterSpline" | "rabbet" | "boxJoint" | "throughDovetail"
  bottomJoinery: "dado" | "nail" | "dowel" | "screw"
  hasDrawer: false
  drawerHeight: 35
  hasFelt: true       // 底氈
}
```

### 8.2 預設 preset（4 個風格符合既有 preset 系列）

| Preset | 用途 | 主要尺寸 (mm) |
|---|---|---|
| 斯堪地 (Scandi) | 1.1 方筒 + miter spline + 楓 | 80 × 80 × 100, t12 |
| 農舍 (Farmhouse) | 1.10 廚房筒 + 相思木 | ⌀150 × 230, t20 |
| 侘寂 (Wabi-Sabi) | 1.2 圓筒車床 + 檜木 | ⌀80 × 100, t10 |
| 包浩斯 (Bauhaus) | 1.5 磁吸模組 + 胡桃 | 60 × 60 × 80 模數 |

### 8.3 必須處理的視圖陷阱（依 feedback）

- **三視圖環環相扣**：圓筒車紋方向（端紋朝上）→ 正視圖看到放射紋，俯視圖看到年輪同心圓，側視圖看到平行直紋。改一個透視先想另兩個會不會跟著對。
- **凸出延伸實線**：sweep 端點 endT 的 1.05 extrapolation 對小物件影響更大（5 % 偏移 = 5 mm）；確認已 clamp。
- **拆解動畫 ?explode=N**：底板 → 四面板 → 隔板 → 筆 sample，順序由底而上。
- **榫卯細節圖**：方筒 miter spline / box joint / dovetail 的 SVG hint 需重用 details.tsx 既有 SVG 渲染器（trapezoid / finger / half-lap）。

### 8.4 工序對偶 step（assembly mode）

1. 鋸切板片至尺寸。
2. 標記榫卯位置。
3. 切榫 / 開槽（依 joinery 變體）。
4. 試組（dry fit）。
5. 砂磨內側面（組合後砂不到的面要先磨）。
6. 上膠組合，夾具固定 30 min。
7. 修整端面、外側砂磨。
8. 倒角 / 圓角。
9. 上油（亞麻仁 / 胡桃油），靜置 24 h。
10. 拋光 / 補油。
11. 底貼羊毛氈。
12. 完成檢驗。

---

## 9. 報價/工時估算（給工具商店上架用）

| 款式 | 材料費 (NT$) | 工時 (h) | 建議售價 (NT$) |
|---|---|---|---|
| 1.1 方筒 楓 | 80 | 1.5 | 480 – 680 |
| 1.2 圓筒 檜（車床） | 100 | 1.0 | 580 – 880 |
| 1.3 八角拼 胡桃 | 180 | 3.0 | 1280 – 1880 |
| 1.4 階梯三層 櫻桃 | 250 | 3.5 | 1680 – 2400 |
| 1.5 磁吸模組（單顆） | 80 | 1.0 | 380 – 580 |
| 1.7 抽屜款 胡桃 | 320 | 4.5 | 2280 – 3200 |
| 1.10 廚房筒 相思 | 220 | 2.5 | 1280 – 1680 |
| 1.11 木工專用 橡木 | 280 | 4.0 | 2480 – 3200 |
| DIY Kit（預切版） | 50 | 0.3 包裝 | 280 – 380 |

工時不含設計與行銷；DIY Kit 利潤靠量取勝（毛利 80 % +）。

---

## 10. 與 wrd 其他小物件的關聯

- **筆筒 ↔ 鳩尾盒**：鳩尾接邏輯共用，可從 dovetailBox 模板抽 helper。
- **筆筒 ↔ 托盤**：1.13 圓盤散放筆 = tray 變體。
- **筆筒 ↔ 書擋**：木工專用筒 1.11 可加側面磁吸條吸書擋同系列。
- **筆筒 ↔ 抽屜盒**：1.7 抽屜款共用 drawer 4-side -2 mm 公差規則。

---

## 參考資料

### 西方資源

- [Fine Woodworking — Simple Desk Organizer](https://www.finewoodworking.com/project-guides/beginner-projects/weekend-project-a-simple-desk-organizer)
- [Woodsmith Plans — Pencil Box](https://www.woodsmithplans.com/plan/pencil-box/)
- [Woodsmith — Three-Tiered In-Box (miter splines)](https://www.woodsmithplans.com/plan/three-tiered-in-box/)
- [The Wood Whisperer — Pencil Holders](https://thewoodwhisperer.com/videos/pencil-holders/)
- [Bosch DIY — Log Pencil Holder](https://www.bosch-diy.com/gb/en/all-about-diy/penholder)
- [Craftsmanspace — Hedgehog pen plan (12× ⌀10 holes)](https://www.craftsmanspace.com/free-projects/hedgehog-pen-and-pencil-holder-plan.html)
- [Anika's DIY Life — Modern Pencil Holder](https://www.anikasdiylife.com/diy-modern-pencil-holder/)
- [Make Something — Easy Wooden Pencil Holder](https://makesomething.com/tutorials/making-wooden-pencil-holder-easy-project)
- [Instructables — Plywood Pencil Holder](https://www.instructables.com/How-to-Make-a-Plywood-Pencil-Holder/)
- [Instructables — Hexagonal Pen Stand](https://www.instructables.com/Hexagonal-Pen-Stand/)
- [Woodcraft — Splined Miters Guide](https://www.woodcraft.com/blogs/shop-knowledge-guides/splined-miters)
- [Craftsmanspace — Miter + Feather Spline Construction](https://www.craftsmanspace.com/woodworking-joints/construction-of-a-miter-joint-reinforced-with-a-feather-spline)
- [Turn A Wood Bowl — Wall Thickness Techniques](https://turnawoodbowl.com/wall-thickness-woes-bowl-turning-dilemma/)
- [Woodworkers Journal — Spindle-Turned Pencil Box](https://www.woodworkersjournal.com/project-spindle-turned-pencil-box/)
- [JB Woodcrafts — Turning Wooden End Grain Cups](https://jbwoodcrafts.co.uk/2022/05/turning-wooden-end-grain-cups/)
- [As Wood Turns — Stave Segmented Pencil Cup from Pen Blanks](https://www.aswoodturns.com/2018/05/pencil-cup/)

### 模組 / 磁吸系統

- [Oakywood — Pen Tray (OakyBlocks)](https://oakywood.shop/products/pen-tray-oakyblocks)
- [Oakywood — Wooden Pen Holder](https://oakywood.shop/products/pen-holder)
- [Nedrelow — Magic Pencil Case](https://www.nedrelow.com/products/magic-pencil-case)
- [Nordeco House — Modular Wooden Pen Holder](https://nordecohouse.com/products/wooden-pen-holder)

### 旋轉 / 抽屜款

- [If Only April — DIY Lazy Susan Pencil Holder](https://ifonlyapril.com/diy-lazy-susan-pencil-holder/)
- [BLU MONACO — Natural Wood Desktop Pen Organizer with Drawer](https://www.blumonaco.com/products/blu-monaco-natural-wood-desktop-pen-organizer-with-drawer-stylish-and-versatile-pen-holder-and-stationery-organizer-for-office-and-art-supplies-6-convenient-storage-compartments-and-drawer)

### 廚房 / 化妝刷

- [Forest Decor — Olive Wood Utensils Holder](https://forest-decor.com/product/wooden-utensils-holder/)
- [Oishya — Wooden Kitchen Utensils Holder (oak, wall t10)](https://oishya.com/wooden-kitchen-utensils-holder-oak/)
- [New Hampshire Bowl and Board — Large Wood Utensil Holder](https://www.newhampshirebowlandboard.com/products/large-wood-utensil-holder)

### 北歐 / 極簡

- [KANO Editions — 8-Slot Scandinavian Pencil Holder (155×90×75)](https://www.kanoeditions.com/products/minimalist-scandinavian-eco-friendly-pencil-holder-with-customizable-geometric-design)
- [Minimum Design — Origami Pen Holder (⌀60×100)](https://bridgeandhill.com/products/minimum-design-origami-pen-holder)
- [OCTÀGON DESIGN — Minimalist Wood Pencil Holder](https://octagon-design.com/en-us/products/minimalist-wood-pencil-holder)

### CNC / 鑲嵌

- [Vectric Forum — Marquetry / Inlay Techniques (V-bit protocol)](https://forum.vectric.com/viewtopic.php?t=31472)
- [Mark Zachmann — How to Create an Inlay with a CNC Router](https://mark-85079.medium.com/how-to-create-an-inlay-with-a-cnc-router-d4729240ef2c)

### 日本資源

- [キシル — ペン立て S](https://www.xyl.jp/c/stationery/pen_stand_s)
- [Kimpa Life — DIY 簡単ヒノキペン立て](https://www.kimpalife.com/entry/pen_stand)
- [Honda Kids — 自由研究ペン立て (60×60×15 mm 範例)](https://www.honda.co.jp/kids/jiyuu-kenkyu/lower/14/)
- [TOOLS to LIVEBY — Y Studio Pen Container](https://www.toolstoliveby.com.tw/en/stationery/pen-clips-pen-caps-pen-cases/y-studio-pen-container/)

### 中式 / 文房

- [新浪收藏 — 黃花梨筆筒（⌀100–150 × 130–200）](http://collection.sina.com.cn/jjhm/hmrw/2017-02-13/doc-ifyamkzq1268782.shtml)
- [中國紅木古典家具網 — 馬未都談明清筆筒](https://www.hm-3223.net/shangyue/show.php?itemid=26)
- [设计之家 — 文房用具：筆筒](https://www.sj33.cn/ys/yskt/sfjc/200803/14762.html)
- [新浪收藏 — 筆筒鑑定與養護](http://collection.sina.com.cn/jczs/20140805/1255159948.shtml?from=wap)

### 台灣資源

- [羽橋設計 — 主要的榫接結構](https://veneerer70ds.pixnet.net/blog/post/66478178)
- [888營建互聯網 — 常見木工榫接技法](https://www.888civil.com/news/2018-08-27-07-17-02)
- [Pinkoi — woodyourlife 筆筒手作體驗](https://en.pinkoi.com/product/QNWXKWCk)

---

## 對齊 drafting-math.md

- 端紋 vs 側紋紋向規則 → 對齊 §wood-grain-direction（待回填章節編號）。
- 倒角 / 圓角的 SVG hatch pattern → 對齊 §edge-treatment。
- box joint / dovetail SVG 渲染 → 對齊 §joinery-svg-hints。
- mm-only 參數慣例 → 對齊 feedback_use_mm_not_ratio。

如本檔規則與 drafting-math 衝突，以 drafting-math 為準並在此檔頂部開 issue。
