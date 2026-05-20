# STL 匯出優化 — 設計文件

- 日期：2026-05-20
- 模組：`lib/export/*`、`components/ThreeDExportButton.tsx`
- 前置：commit `7041b5e`（匯出共用 `lib/render/part-geometry.ts` 形狀建模）已落地

## 背景與目標

STL/OBJ 匯出在 `7041b5e` 修好「斜度/弧度件變方塊」後，形狀已正確。本案進一步優化
匯出的**列印可行性**與**工作流**。

現況盤點（`components/ThreeDExportButton.tsx`）：

- 比例選單已存在（1:1 ～ 1:100 共 8 段，預設 1:10）—— 不需新增。
- OBJ 按鈕被 `SHOW_OBJ = process.env.NODE_ENV !== "production"` 鎖在 dev；
  鎖的理由（舊註解「export 是退化盒體」）已隨 `7041b5e` 失效。
- 標題字「3D 列印檔（簡化盒體）」已過時。

## 範圍

實作 4 項功能 + 收尾，分 3 階段。明確**不做**：boolean union 成單一實體（#5）——
slicer 切片本就自動處理多實體、攤平模式零件不重疊，union 慢又易失敗，CP 值低。

**鐵律：原本「組裝姿態、不分件」的 STL 匯出（現有「🖨️ STL」按鈕）一律保留不動。**
攤平排版（階段 2）與 3MF（階段 3）都是**新增**匯出選項，與既有匯出並存，絕不取代。
使用者匯出組裝姿態整件 STL 的既有行為必須 100% 不變。

## 階段 1：列印安全 + 收尾

### ① 最薄件警告

新檔 `lib/export/export-checks.ts`，export：

```ts
analyzeMinThickness(design: FurnitureDesign, scale: number): {
  thinnestMm: number;      // 最薄零件縮放後的最小維度（mm）
  partName: string;        // 該零件中文名
}
```

- 對每個非 `visual` 零件取 `min(visible.length, visible.thickness, visible.width)`，
  全體取最小，乘 `scale`。
- 門檻常數 `MIN_PRINTABLE_MM = 0.8`（2 × 一般噴嘴 0.4mm）。

UI（`ThreeDExportButton`）：選定比例下若 `thinnestMm < MIN_PRINTABLE_MM`，顯示警告
chip，例：「⚠️ 最薄件 0.3mm（座板），建議改 1:5 以上」。切換比例即時重算。
非阻擋——仍可匯出。

### ② 匯出前 manifold / 法線自檢

`export-checks.ts` 加：

```ts
validateGeometry(geom: BufferGeometry): {
  ok: boolean;
  nanVertices: number;       // NaN 座標頂點數
  degenerateTris: number;    // 退化（零面積）三角面數
  nonManifoldEdges: number;  // 非流形邊數（被 !=2 個面共用的邊）
}
```

- 邊流形性：建 edge → faceCount map（無向邊 key = 排序後的兩頂點 index），
  統計 count !== 2 的邊。
- 匯出時對每個零件 geometry 跑一遍；有問題的零件 `console.warn` 印零件名 + 數字，
  UI 顯示一行提示。**非阻擋**。

### ③ 收尾

- `ThreeDExportButton`：移除 `SHOW_OBJ` dev gate，OBJ 按鈕一律顯示。
- 更新過時字眼：標題拿掉「簡化盒體」；OBJ 的 `title` 與 `three-d-export.ts` 內
  「退化盒體」相關註解改寫。

## 階段 2：攤平排版匯出

### ④ 攤平單一 STL

新檔 `lib/export/flat-layout.ts`，export `buildFlatLayoutGroup(design, scale): Group`。

**每個零件的攤平姿態：**
- 取零件幾何（`buildShapeGeometry` 或 fallback box）的 bounding box。
- 旋轉使「最小維度軸 → Z（朝上）」，最大的兩維落在 XY 平面（貼列印床）。
- 忽略零件在家具裡的裝配 rotation（攤平是製造姿態，非裝配姿態）。

**排版（shelf packing，不求最佳解、只求不重疊）：**
- 取每件攤平後的 XY footprint（width × depth）。
- 按 footprint 較長邊降序排序。
- 左→右擺放，列寬超過虛擬列印床寬度就換行；列高取該列最高件。
- 件與件間隔常數 `LAYOUT_GAP_MM = 8`（在縮放前的 mm 空間排版，再隨 group 縮放）。
- 全部零件底面坐在 Z = 0。

**輸出：** 單一 STL，所有零件攤平排開。**這是新增的匯出選項；組裝姿態的整件
STL 不受影響、照常保留。**

UI：`ThreeDExportButton` 加按鈕「🛏️ 攤平 STL」。組裝姿態的「🖨️ STL」保留。
攤平 STL 同樣吃比例選單與最薄件警告。

### 邊界情況
- 自由曲面件（seat-scoop / live-edge / arch-bent / face-rounded）：用 bbox 決定攤平
  軸，與一般件一致。
- 零件數多時 footprint 總面積可能超出單一虛擬列印床——不阻擋，繼續往下排（使用者
  自行在 slicer 分批），但列印床寬度用一個合理常數（如 250mm）只決定換行時機。

## 階段 3：3MF 格式

### ⑤ 3MF 匯出

新檔 `lib/export/three-mf.ts`，export `download3MF(design, scale, layout)`。

- 3MF = OPC（ZIP）容器，內含：
  - `[Content_Types].xml`
  - `_rels/.rels`
  - `3D/3dmodel.model`（XML 主體）
- ZIP 函式庫：優先用專案既有依賴（先查 `package.json`，若有 `fflate` / `jszip`
  直接用）；都沒有則新增 `fflate`（體積小）。
- `3dmodel.model`：`<model unit="millimeter">`，每個零件一個 `<object>`（`<mesh>`
  含 `<vertices>` + `<triangles>`），`<build>` 內每個 `<item>` 帶 transform。
  零件中文名寫入 object 的 `name` 屬性。
- 顏色：可選，帶木種顏色（`<basematerials>` / 或 object 層級色）——若實作成本高
  可第一版省略，只保留單位 + 名稱 + 幾何。

UI：`ThreeDExportButton` 加按鈕「📦 3MF」，吃比例與組裝/攤平模式。

## 檔案異動總覽

| 檔案 | 動作 |
|---|---|
| `lib/export/export-checks.ts` | 新增（階段 1）|
| `lib/export/flat-layout.ts` | 新增（階段 2）|
| `lib/export/three-mf.ts` | 新增（階段 3）|
| `lib/export/three-d-export.ts` | 微調（接自檢、字眼）|
| `components/ThreeDExportButton.tsx` | 收所有 UI（3 階段陸續）|
| `package.json` | 可能新增 `fflate`（階段 3）|

## 驗收

- 每階段獨立 commit + 部署。
- `npx tsc --noEmit`：新檔零 error。
- 階段 1：故意選 1:100 比例，UI 出現最薄件警告；匯出正常零件無自檢警告。
- 階段 2：攤平 STL 下載後，於 slicer 開啟確認所有零件平躺、互不重疊、無支撐需求。
- 階段 3：3MF 下載後於 PrusaSlicer / Bambu Studio 開啟，單位正確（mm）、零件可辨識。

## 不做（YAGNI）

- boolean union 成單一實體（#5）。
- 最佳化裝箱（bin-packing 只用簡單 shelf packing）。
- 3MF 多材質貼圖 / UV。
- 榫頭凸出 / 榫眼 CSG —— 維持簡化版（使用者 2026-05-20 確認）。
