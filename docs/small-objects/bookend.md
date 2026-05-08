# 書擋 (Bookend) 設計研究

> wrd 家具設計器小物件擴充參考資料  
> 整理：木頭仁團隊 / 2026-05-08  
> 目標：把書擋這件「看似簡單、實則牽涉力學/美學/工法」的小物件，做成 wrd 可參數化生成的模板。

---

## 0. 第一性原理：書擋到底在做什麼？

書擋的本質就一句話：**讓直立的書本不要倒下**。  
拆成物理：書群會對書擋施加水平推力 F，書擋必須靠**自重 W × 摩擦係數 μ + 結構抗傾倒力矩**抵抗。

- 防滑公式（簡化）：F ≤ μ·(W_書擋 + W_壓在底板上的書)
- 防傾倒（轉動平衡）：書擋自重重心離支點的水平距離 × 自重 ≥ 書群推力 × 推力施加高度

**結論**：好書擋只有兩種解法

1. **重底款**：底板深、夠重、書本「壓在底板上」順便壓住自己（L 型底板書擋的精髓）
2. **加固款**：加三角支撐 / 帶肩榫，把推力傳到地面而不是讓背板自己折

wrd 模板必須兩種都做出來，並且讓使用者選。

---

## 1. 款式分類（15 種）

### 1.1 L 型基礎款（底板 + 背板）
- **結構**：兩片木板 90° 對接，背板站立、底板水平壓在書下方
- **尺寸建議**：底板 D150 × W120 × T18mm；背板 H180 × W120 × T18mm
- **適用**：所有書、最通用、wrd 預設

### 1.2 直角附三角加固款（gusset reinforced）
- **結構**：L 型 + 一片三角形補強板黏接在內側
- **三角板比例**：直角邊長 = 底板深的 0.5~0.8 倍（建議 0.65）
- **強度提升**：背板抗傾倒力矩約增加 2.5 倍
- **適用**：精裝書、字典、攝影集

### 1.3 弧形背款（arch top）
- **結構**：背板上緣切弧形，視覺輕盈
- **弧形數據**：弧高 = 背板高的 0.3、弧寬 = 背板寬的 0.9
- **參考**：Woodsmith Arch-Top Bookends（5 片 4.5″×3.75″×3/4″ 面接）
- **工法**：帶鋸切弧 → 砂磨機修圓 → 背板層壓貼皮（veneer）做出彎曲假象

### 1.4 動物剪影款（silhouette）
- **常見圖案**：貓、狗、兔子、鯨魚、恐龍、大象、長頸鹿、鳥
- **板厚建議**：18~25mm 實木（太薄會折）
- **切割**：線鋸/帶鋸/雷射，雷射最乾淨
- **SVG 路徑提示**：
  - 貓：S 形背線、尖耳兩個三角凸、尾巴向上勾
  - 鯨魚：橢圓身體 + 尾鰭分叉 + 噴氣孔
  - 恐龍（劍龍）：背脊鋸齒狀凸起 5~7 個
  - 兔子：兩耳豎立 = 1.5×頭部高
- **底板**：通常做隱藏式，銜接於剪影底邊內側

### 1.5 字母 / 單字剪影款（letter cut-out）
- **常見字**：READ、LOVE、LIBRARY、HOME、單字母（initial）
- **配置**：兩個書擋拼成一個字（READ + READ 鏡像）或左右各拼半字
- **字體選擇**：Sans-serif 比 Serif 強度高（沒有細腳易斷）
- **板厚**：≥ 20mm，否則細筆畫易折
- **參考**：MyGift "GOOD" / "READ" 黑鐵 + 白木 L 型款

### 1.6 樹形款（tree silhouette）
- **造型**：底部樹幹 + 上方樹冠（雲朵狀或鋸齒狀）
- **尺寸**：H200~250mm、底板 D150
- **變化**：聖誕樹（三角階梯）、橡樹（橢圓樹冠）、松樹（多層三角）

### 1.7 山形款（mountain silhouette）
- **造型**：多座連峰或單峰，最高峰 = 200mm
- **變化**：富士山（單峰雪頂、頂部白漆 1/4）、洛磯山脈（連峰高低錯落 3~5 峰）
- **市售參考**：Etsy Minerd Design Wooden Mountains Bookends（多色）

### 1.8 城堡剪影款（castle / wizard library）
- **造型**：方塔 + 三角尖頂 + 城牆鋸齒（merlons）
- **適用**：兒童房、奇幻文學藏書（哈利波特粉）
- **複雜度**：高，建議雷射切割

### 1.9 金屬 + 木混搭（metal-wood hybrid）
- **結構**：金屬 L 型片做底板（薄 2~3mm），木板做背板鎖在金屬上
- **優點**：底板薄不佔空間 + 木質溫度
- **市售**：BENT Design heavy-duty steel bookend、konektra bookends
- **wrd 實作**：可以參數化「底板材質：木 / 鐵」

### 1.10 壓書款（極矮背 + 重底）
- **結構**：背板低（H80~100mm），底板厚重（T35mm 或加金屬塊）
- **原理**：靠書本壓底板穩定，背板只負責給書一個倚靠點
- **適用**：書桌上少量書（5~8 本）、雜誌

### 1.11 磁吸對組款（magnetic pair）
- **結構**：兩個書擋背面內嵌釹磁鐵，可吸合存放或書架定位
- **磁鐵**：直徑 6~10mm 釹磁鐵，鑽 6~10mm 孔埋入後膠固
- **數量**：每側 2~3 顆對位
- **參考**：Shelfology Maggie Square、Peleg Design Arrow

### 1.12 抽屜底款（hidden drawer）
- **結構**：底板加厚成空盒（高 50~70mm），內藏小抽屜
- **抽屜尺寸**：W100 × D100 × H40mm
- **開啟**：磁吸推開 / 後方鉸鍊 / 手指槽
- **適用**：藏書籤、便條紙、私房錢
- **參考**：Palos Publishing 教學（外殼 6~8″ × 10~12″ × 5″）

### 1.13 燈泡 / 書角款（reading nook）
- **造型**：背板做成大寫 J 倒勾或燈泡輪廓
- **進階**：背板挖空裝 LED 燈條，書擋兼閱讀燈
- **電路**：USB 5V、LED 軟條 0.5m，藏在背板內側溝槽

### 1.14 推拉式 / 軌道滑動款（adjustable rail）
- **結構**：底座做長軌道（鳩尾溝 / T 形溝 / 鋁擠 T-track），書擋可沿軌道滑動調整寬度
- **軌道**：鳩尾溝寬 25mm、深 12mm；T-track 用鋁擠（25×10mm 標準）
- **可調寬度**：300~600mm
- **參考**：Instructables Shelfomatic、Sliding Dovetail Bookends
- **適用**：書架太寬只放幾本書、書數量會變動

### 1.15 風格特化款（Mid-Century / Shaker / 日式禪 / 兒童彩繪）
- **Mid-Century Modern**：胡桃木、傾斜腳、有機曲線、銅質配件
- **Shaker**：白橡木、純粹直角、無裝飾、外露木釘 8~10mm
- **日式禪 / 侘寂**：檜木 / 杉木、燒杉（shou sugi ban）燒黑表面、不對稱、留節疤
- **兒童彩繪**：松木 / 橡膠木（rubberwood）、所有外角倒 R5 圓邊、無毒水性漆、可加沙袋配重（內部空腔填沙 200~500g）

---

## 2. 標準尺寸規格（mm 級）

### 2.1 主流尺寸區間

| 部位 | 最小 | 推薦 | 最大 | 備註 |
|---|---|---|---|---|
| 底板深 D | 100 | 150 | 200 | < 100 易翻倒 |
| 底板寬 W | 100 | 120 | 180 | 配合書本厚度群 |
| 背板高 H | 150 | 180 | 250 | 約書本高 0.7~0.85 |
| 板厚 T | 12 | 18 | 25 | < 12 強度不足 |
| 三角支撐邊 | D×0.5 | D×0.65 | D×0.8 | 比例規則 |

### 2.2 依書本類型分

| 書本類型 | 底板深 | 背板高 | 推薦每書擋承書數 |
|---|---|---|---|
| 平裝小說 | 100~120 | 150 | 8~12 本 |
| 一般精裝書 | 130~150 | 180 | 6~8 本 |
| 字典 / 攝影集 | 180~200 | 220 | 3~5 本 |
| 兒童繪本 | 150~180 | 180 | 5~8 本 |
| CD（120×140mm） | 120 | 150 | 15~20 片 |
| 12″ 黑膠（315mm） | 350 | 320 | 10~15 張 |
| A4 文件夾 | 250 | 320 | 3~5 個 |

### 2.3 推薦 wrd preset

```
preset_basic    : 150D × 120W × 180H × 18T
preset_thick    : 200D × 150W × 220H × 22T  (字典/攝影集)
preset_compact  : 100D × 100W × 150H × 18T  (平裝/桌上)
preset_vinyl    : 350D × 120W × 320H × 22T  (黑膠唱片)
preset_kids     : 150D × 150W × 180H × 18T + 圓角 R5
```

---

## 3. 結構工法

### 3.1 主接合（底板 ↔ 背板）

按強度由低到高：

| 工法 | 強度 | 製作難度 | wrd 適配度 |
|---|---|---|---|
| 純膠合對接 (butt + glue) | 低 | 最易 | 不建議 |
| 螺絲對接（背面沉孔填栓） | 中 | 易 | 入門款 |
| 木釘 + 膠合（dowel）8mm × 2~3 支 | 中高 | 中 | 推薦預設 |
| 帶肩榫（shouldered tenon） | 高 | 中高 | 進階款 |
| 鳩尾榫（dovetail） | 最高 | 高 | 展示工藝 |
| 半搭接（half-lap） | 高 | 中 | 適合視覺溝感 |

### 3.2 木釘規格建議

- 直徑：8mm（書擋夠用、不過度）
- 長度：板厚 × 2 = 36mm（兩端各埋入 18mm）
- 數量：底板寬 / 60mm，最少 2 支
- 鑽孔深度：每側 20mm（留 4mm 給膠和誤差）
- 釘距：距板邊 ≥ 20mm，避免劈裂

### 3.3 帶肩榫規格（shouldered mortise & tenon）

按 wrd `joinery-standards` §1 慣例：

- 榫頭厚度：板厚的 1/3 → 18mm 板做 6mm 榫頭
- 榫頭長度：底板厚的 2/3 → 12mm（盲榫，不穿出底面）
- 榫肩寬度：上下各留 6mm（總寬 = 板厚）
- 卯眼配合：榫頭尺寸 +0.1mm 鬆配，便於上膠

### 3.4 三角加固比例

- **直角邊**：等於底板深的 0.5~0.8 倍
  - 0.5：視覺輕盈、強度普通
  - 0.65：黃金比，視覺與強度平衡（**推薦**）
  - 0.8：強度最高，視覺笨重
- **板厚**：與主結構相同 18mm，或薄 3mm（15mm）做層次
- **接合**：兩邊各鎖 2 支木釘 + 全面膠合

---

## 4. 重量 / 穩定性

### 4.1 防滑物理計算

書擋承受的水平推力（單側書群）：
```
F_推 ≈ N_books × m_book × g × tan(θ_lean)
N_books = 8（一般書架書數）
m_book ≈ 0.4kg（平裝）/ 0.8kg（精裝）
θ_lean ≈ 5° → tan ≈ 0.087
F_推 ≈ 8 × 0.6 × 9.8 × 0.087 ≈ 4.1N（一般情況）
```

書擋抗滑：
```
F_抗 = μ × (W_書擋 + W_壓書) × g
μ_橡膠墊_木 ≈ 0.6
μ_氈墊_木 ≈ 0.35
μ_木對木 ≈ 0.25
```

**結論**：底板必須有橡膠或氈墊。空書擋（不讓書壓底板）需重 ≥ 0.7kg 才穩。

### 4.2 配重做法

| 方式 | 重量 | 製作難度 | 適合款式 |
|---|---|---|---|
| 底板加厚成 35mm 實木 | +500g | 易 | 壓書款 |
| 底板下挖凹槽嵌鐵塊 | +1~2kg | 中 | 高背款 |
| 底板下嵌水泥磚（封板隱藏） | +1~3kg | 中 | DIY 親民 |
| 內部空腔填沙 | +200~500g | 易 | 兒童款 |
| 底板嵌鉛塊（密度 11.3） | +2kg/100mL | 高（需密封） | 重型字典款 |

### 4.3 防滑墊配置

- **橡膠墊**：4 角各一片 15×15×2mm，或全底面 100×80×2mm 滿貼
- **羊毛氈**：5mm 厚，黏底面 4 角，會隨時間壓扁需更換
- **軟木**：3mm 厚，自然防滑，與木紋協調
- **建議**：橡膠 > 軟木 > 氈，但氈最不傷地板/書架表面

### 4.4 維護週期

每 6 個月檢查底面：
- 橡膠：壓縮硬化 → 換
- 軟木：碎屑掉落 → 換
- 氈：壓平變薄 → 換

---

## 5. 裝飾工法

### 5.1 剪影切割路徑

雷射切割設定（3mm 椴木合板 / 18mm 實木）：
- 3mm 合板：60W 雷射、速度 10mm/s、單次切穿
- 18mm 實木：120W 雷射、速度 3mm/s、多次走刀（3~4 次）
- 線鋸：1.5mm 細齒鋸條，逆紋切割
- 帶鋸：3mm 寬鋸條，半徑 ≥ 5mm

SVG 路徑撰寫提示（給 wrd 內建剪影 library）：
- 動物剪影起點固定在底板左下角，path 終點接回底邊
- 使用 `path d="M 0,0 ... Z"` 閉合，wrd 自動填板厚 extrude
- 細節最小寬度 ≥ 板厚（避免切完崩斷）

### 5.2 浮雕 / 雷射雕刻

- **CNC 浮雕**：3D 浮雕深度 2~5mm，書名 / 圖案 / 家徽
- **雷射雕刻**：表面碳化 0.2~0.5mm，黑色線條
- **燒烙（pyrography）**：手工焦烙筆，溫度 400~600°C，可控線條粗細

### 5.3 燒杉（shou sugi ban）

日式碳化表面：
- 噴燈烤至表面碳化（黑色 1~2mm）
- 鋼刷刷掉鬆動碳層
- 上亞麻仁油保護
- 適合杉木、檜木，不適合硬木（橡 / 胡桃）

### 5.4 表面塗裝建議

| 塗料 | 顏色 | 質感 | 適用 |
|---|---|---|---|
| 亞麻仁油 | 增深木色 | 啞光自然 | 通用、食安級 |
| 蜂蠟 | 微亮 | 溫潤 | 兒童款 |
| 水性壓克力 | 任意 | 平光/亮光 | 彩繪/兒童 |
| 燻黑（liming） | 黑灰 | 深沉 | Mid-Century |
| 透明亮光漆 | 原色 | 高光 | 字母款、字典款 |

---

## 6. 使用情境細分

### 6.1 兒童書架（家庭、幼稚園）
- 圓角 R5 全外角倒圓
- 鮮豔水性漆 + 動物 / 字母圖案
- 底板填沙做配重（避免兒童碰倒砸到自己）
- **避免**：尖角、玻璃鑲嵌、可拆小零件

### 6.2 辦公書架
- 簡潔幾何、深色系
- A4 文件夾承重設計（底板 D250、背板 H320）
- 金屬 + 木混搭符合現代辦公美學

### 6.3 收藏品展示（公仔 / 茶具 / 香水瓶）
- 背板挖溝做小架、上沿開倒勾
- 燈泡款 LED 加燈
- 玻璃 / 壓克力前擋

### 6.4 CD / 黑膠專用
- CD：底板 D120、背板 H150（CD 殼厚 10mm × 15 片 = 150mm）
- 黑膠：底板 D350、背板 H320，背板加厚 22mm 防 LP 重壓

---

## 7. 成對顯示 / 配對美學

### 7.1 對稱 vs 鏡像
- **對稱**：兩個書擋造型相同（最常見）
- **鏡像**：左右相反（動物面對面、字母拼字）
- **拼字**：兩個合起來才是完整字 (RE + AD = READ)

### 7.2 對偶圖案
- 一隻黑貓 + 一隻白貓
- 山與海（左山右浪）
- 樹與鳥（左樹枝右鳥棲息）
- 月與星（不同形狀單獨美 + 配對講故事）

### 7.3 wrd 實作建議
- 模板選「single」或「pair」
- 「pair」自動生成 mirror 版本，並提供「mirrored / identical / different」三選一
- 拼字款內建字串輸入框，自動切左右半

---

## 8. 市售品牌參考（價格 / 規格 對標）

| 品牌 | 系列 | 規格 | 價位帶（USD） | 備註 |
|---|---|---|---|---|
| MUJI | 自然木製書架 | 通用 | 30~60 | 沒有專屬書擋線 |
| IKEA | KLABB / RIBBA 配件 | 100×120×150mm | 5~15 | 簡約 L 型 |
| Anthropologie | Decorative bookend | 變化大 | 60~150 | 動物雕塑感 |
| Etsy 工坊 | 客製姓名 / 圖案 | 客製化 | 35~120 | 個人化禮品 |
| BENT Design | Heavy-duty steel | 鐵 | 80~200 | 重型書專用 |
| konektra | 概念設計 | 木 + 金屬 | 80~150 | 歐式設計 |
| Peleg Design | Arrow magnetic | 樹脂 | 25~40 | 趣味款 |
| Shelfology | Maggie magnetic | 鐵 + 磁 | 50~100 | 模組系統 |

### 木頭仁定價建議（蝦皮上架）

按工法 / 木材 / 工時：

| 款式 | 木材 | 售價 NT$ | 成本 NT$ | 毛利率 |
|---|---|---|---|---|
| L 型基礎款 | 松木 | 480 | 120 | 75% |
| L 型 + 三角加固 | 橡木 | 980 | 280 | 71% |
| 動物剪影（雷射） | 胡桃木 | 1,580 | 450 | 72% |
| 字母剪影 | 白橡 | 1,280 | 380 | 70% |
| 抽屜底款 | 胡桃 + 橡 | 2,480 | 780 | 69% |
| 推拉軌道款 | 橡木 + 鋁軌 | 2,180 | 720 | 67% |
| 燒杉禪風款 | 杉木 + 燒杉 | 1,680 | 420 | 75% |

---

## 9. wrd 模板實作檢查清單（給工程接手）

### 9.1 參數
- `baseDepth`: 100~250mm，預設 150
- `baseWidth`: 100~200mm，預設 120
- `backHeight`: 150~280mm，預設 180
- `boardThickness`: 12~25mm，預設 18
- `style`: enum [`L-basic`, `L-gusset`, `arch`, `silhouette-animal`, `silhouette-letter`, `silhouette-mountain`, `silhouette-tree`, `silhouette-castle`, `magnetic-pair`, `hidden-drawer`, `low-back-heavy`, `metal-hybrid`, `adjustable-rail`, `wabi-sabi`, `kids`]
- `joinery`: enum [`dowel`, `screw`, `mortise-tenon`, `dovetail`, `half-lap`]
- `gussetRatio`: 0.5~0.8，預設 0.65（僅 `L-gusset` 顯示）
- `silhouettePreset`: 動物 / 字母 / 山 / 樹 / 城堡 子分類選單
- `pairMode`: enum [`identical`, `mirrored`, `wordplay`]
- `weightOption`: enum [`none`, `sand-fill`, `metal-insert`, `concrete-insert`]
- `nonSlipPad`: enum [`none`, `rubber-corners`, `rubber-full`, `cork`, `felt`]
- `cornerRound`: 0~10mm，預設 0（兒童款建議 5）

### 9.2 跨 wrd 慣例
- 板厚遵循 wrd `joinery-standards` 1/3 厚度榫頭規則
- 三視圖：俯視必須顯示三角加固虛線（隱藏在書遮蔽範圍內）
- 透視圖：?explode=N 可拆解動畫（底板 / 背板 / 三角 / 抽屜分離）
- 報價 joineryMode overlay：木釘 / 榫卯 / 螺絲不同價格
- 材料單：按 18mm 板計算用料

### 9.3 動態選單隱藏（依 `feedback_dynamic_option_visibility`）
- 選 `metal-hybrid` → 隱藏 `joinery`（鎖螺絲固定）
- 選 `magnetic-pair` → 顯示 `magnetCount`、`magnetDiameter`
- 選 `hidden-drawer` → 顯示 `drawerWidth`、`drawerOpenStyle`
- 選 `adjustable-rail` → 顯示 `railType`、`railLength`
- 選 `kids` → 強制 `cornerRound` ≥ 3，強制 `nonSlipPad ≠ none`

### 9.4 錯誤檢查
- `baseDepth < 80mm` → 警告「底板過淺易翻倒」
- `backHeight > 0.9 × bookHeight` → 警告「背板過高擋住書脊」
- `boardThickness < 12mm` 且 `style = silhouette-letter` → 阻擋（細筆畫易斷）
- `style = adjustable-rail` 且 `railLength < 250mm` → 警告「軌道過短可調範圍小」

---

## 10. 設計總結 / 給木頭仁的建議

1. **wrd 第一輪先做 6 款**：L-basic、L-gusset、arch、silhouette-animal、letter、hidden-drawer  
   → 涵蓋 80% 銷售場景
2. **第二輪 4 款**：magnetic-pair、low-back-heavy、adjustable-rail、wabi-sabi  
   → 拓展高客單價市場
3. **第三輪 5 款**：mountain、tree、castle、metal-hybrid、kids  
   → 風格化 / 客製禮品
4. **拍片題材**：
   - 「最簡單的書擋只要 3 片木頭」（L-basic + dowel）
   - 「會藏抽屜的書擋」（hidden-drawer）
   - 「磁吸對組書擋怎麼做」（magnetic-pair + 釹磁鐵教學）
   - 「燒杉禪風書擋」（wabi-sabi + shou sugi ban）
5. **與木匠學院連動**：書擋是「初級榫卯練習」最佳題材，可做為帶肩榫 / 木釘 / 鳩尾的入門教材

---

## 參考資料

- Woodsmith Plans - Arch-Top Bookends: https://www.woodsmithplans.com/plan/arch-top-bookends/
- Palos Publishing - Hidden Drawer Bookend: https://palospublishing.com/how-to-create-a-wooden-bookend-with-a-hidden-drawer/
- Instructables - Shelfomatic Adjustable Bookends: https://www.instructables.com/Shelfomatic-Bookshelf-With-Adjustable-In-rail-Book/
- Instructables - Sliding Dovetail Bookends: https://www.instructables.com/Sliding-Dovetail-Bookends/
- 3axis.co - Laser Cut Bookend Files: https://3axis.co/laser-cut/book-end/
- Build Basic - Simple DIY Bookends: https://build-basic.com/build-simple-diy-bookends/
- Wood Whisperer - Hidden Compartments: https://thewoodwhisperer.com/articles/secret-locks-and-compartments-woodworking-magic-tricks/
- Canadian Woodworking - Rabbets, Dados, Grooves: https://canadianwoodworking.com/techniques_and_tips/rabbets-dados-and-grooves/
- Kreg Tool - Dowel Joints Guide: https://learn.kregtool.com/learn/how-to-make-dowel-joints/
- BENT Design - Heavy-duty steel bookend: https://www.bent.design/products/metal-bookend
- Honda Kids - 自由研究本立て: https://www.honda.co.jp/kids/jiyuu-kenkyu/upper/11/
- airdiy.net - ブックスタンドの作り方: https://airdiy.net/work/work_002.html
- MyBambino - Personalized children bookends: https://mybambino.com/collections/natural-book-ends
- Pretty Handy Girl - Kids Bookend Kit: https://prettyhandygirl.com/kids-bookend-kit-build-your-own-bookend/
- OpenStax University Physics - Friction: https://openstax.org/books/university-physics-volume-1/pages/6-2-friction

---

*文件版本：v1 / 2026-05-08*  
*下次補強：實際產線照片、wrd 模板程式碼鏈接、學院教材連動規劃*
