# 榫卯細節圖重繪規範（Phase 2 共通 spec）

所有 12 種 JoineryType 重繪共用的設計、layout、必畫元素、命名、commit 規範。

## 設計目標

學習黃俊傑老師（台南魯班學堂）教科書級榫卯製圖，**重新繪製**（非複製圖檔）wrd 既有 12 種 JoineryType。

- **配色**：保留 wrd 米黃棕（`COLOR.TENON` `#e6c89a` 公榫 / `COLOR.MORTISE` `#b08a4e` 母榫）
- **Layout**：每種採「三視圖 + 等角圖並列」(2x2 grid + 標題欄)
- **動態尺寸**：所有 mm 數字必須來自 props，禁止 hardcoded literal

## Import 規範

每個 detail function 開頭加（如已有則整併）：

```ts
import {
  COLOR, STROKE, FONT, DASH,
  DimLine, Hatching, fitScale,
  CenterLine, SectionMark, HiddenEdge, GrainArrow,
  ScaleBar, TitleBlock, DimChain,
  IsometricGroup, ThreeViewLayout, WarningCallout,
} from "./draw-primitives";
```

**所有 helper 已在 `lib/joinery/draw-primitives.tsx` export**，不要重複定義。

## 統一 Layout（必遵守）

每個 detail function 回傳一個 `<svg>` 容器（width=960, height 自定）：

```
+----------------+----------------+
|                |                |
|   正視圖 front  |   側視圖 side  |
|   (1st quad)   |   (2nd quad)  |
|                |                |
+----------------+----------------+
|                |                |
|   俯視圖 top    |   等角圖 iso   |
|   (3rd quad)   |   (4th quad)  |
|                |                |
+----------------+----------------+
|                                 |
|       標題欄 TitleBlock          |
|                                 |
+---------------------------------+
```

用既有 `ThreeViewLayout` helper：

```tsx
<svg width={960} height={680} viewBox="0 0 960 680">
  <ThreeViewLayout
    width={960} height={620}
    front={<g>{/* 正視圖 SVG */}</g>}
    side={<g>{/* 側視圖 SVG */}</g>}
    top={<g>{/* 俯視圖 SVG */}</g>}
    iso={
      <IsometricGroup originX={200} originY={200} scale={1}>
        {/* 等角圖 SVG（30° 軸測） */}
      </IsometricGroup>
    }
    titleBlock={
      <TitleBlock
        x={0} y={0} width={960}
        joineryType={p.type ?? "..."}
        joineryNameZh="通榫"
        scale="1:1"
      />
    }
  />
</svg>
```

## 必畫 Checklist（每種都要）

- [ ] **三視圖**：正視 + 俯視 + 側視 三象限完整
- [ ] **等角圖**：第四象限 30° 軸測 (`IsometricGroup`)
- [ ] **中心線**：母件、公件中軸線用 `CenterLine`（點劃線）
- [ ] **剖面標記 A-A**：正視圖標 `SectionMark`，旁邊空間或下方放剖面圖
- [ ] **剖面 hatching**：剖面圖內用 `Hatching` 填充紅色 45° 斜線（用 `<rect fill={`url(#${hatchId})`} />`）
- [ ] **隱藏線**：所有看不到的邊線用 `HiddenEdge`（虛線）
- [ ] **完整尺寸鏈**：榫長/榫斷面（寬+厚）/母件厚/肩寬/留底厚 都標 — 用 `DimLine` 或 `DimChain`
- [ ] **木紋方向**：每片大尺寸組件加 `GrainArrow` 標 `↕` 木紋
- [ ] **工法警示**：適時加 `WarningCallout` (如「順紋方向不可逆」「貫穿端應微凸 1mm 後修平」「肩面承力面」)
- [ ] **標題欄**：底部 `TitleBlock` 含 joineryNameZh / scale / drawnBy="wrd-auto"

## 動態尺寸硬性規則

**所有 `<text>` 跟 `DimLine label`、`DimChain segments[].label` 內的 mm 數字必須是 props 變數**：

```tsx
// ✓ 正確
<DimLine ... label={`${tl}`} />
<DimLine ... label={`${tw} × ${tt}`} />
<text>{Math.round(mt - tl)}</text>

// ✗ 錯誤
<DimLine ... label="30" />
<text>30mm</text>
```

**白名單** (允許 hardcoded)：角度 `45°`、比例 `1:6` `1:8`、剖面標 `A-A`、`A` `B` `C` 字母。

## 不准動

- ❌ 不准改 `JoineryDetailParams` props signature
- ❌ 不准改 `lib/joinery/draw-primitives.tsx`（Phase 1 已凍結，要加 export 必須回 Phase 1 升版）
- ❌ 不准動其他 group 負責的 detail function（依切刀位）
- ❌ 不准動 `JoineryDetail` switch、`JOINERY_LABEL`、`JOINERY_DESCRIPTION`
- ❌ 不准動 import block 結構（除了加 primitives import）
- ❌ 不准 push（我統一 review + merge）

## 保留舊版 escape hatch

每個 detail function 重繪前，**先把舊版改名**（在同檔案內保留）：

```tsx
// 舊版改名為 LegacyXxxDetail
function LegacyThroughTenonDetail(p: JoineryDetailParams) {
  // ... 原本程式碼整段保留 ...
}

// 新版用原名
function ThroughTenonDetail(p: JoineryDetailParams) {
  // 教科書級重繪
  return (
    <svg width={960} height={680} viewBox="0 0 960 680">
      <ThreeViewLayout ... />
    </svg>
  );
}
```

這樣 `JoineryDetail` switch 不用動就接到新版，Legacy 函式留作未來 escape hatch。

## 切刀位註記

每個 detail function 前後加註記：

```tsx
/* === BEGIN through-tenon-detail (owner: agent-B1, group: A) === */
function LegacyThroughTenonDetail(p: JoineryDetailParams) { ... }
function ThroughTenonDetail(p: JoineryDetailParams) { ... }
/* === END through-tenon-detail === */
```

## 各 JoineryType 規格速查

| Type | 中文 | 必標尺寸 | 特殊處理 |
|---|---|---|---|
| through-tenon | 通榫 | tl, tw, tt, mt, ct, cw | 圓腳 motherShape="round" 公榫變圓榫；貫穿警示 |
| blind-tenon | 半隱榫 | tl, tw, tt, mt, ct, cw, 留底 mt-tl | tl 必 < mt，渲染前 clamp + WarningCallout |
| shouldered-tenon | 帶肩榫 | tl, tw, tt, cw, 肩寬 (cw-tw)/2 | cw 必 > tw 才有肩，否則 fallback 純通榫 |
| dovetail | 燕尾榫 | tl, tw, tt, 角度 1:6/1:8 | 依 material 切角度；依 cw 算組數 |
| finger-joint | 指接 | tt, mt, cw, 指數 floor(cw/tt) | 剩餘均分到兩端肩 |
| half-lap | 半搭 | ct, cw, mt, 削厚 ct/2 | T/十/L 字依 cw vs mt 推 |
| tongue-and-groove | 舌槽 | tt, tl, mt, 舌肩留厚 (mt-tt)/2 | tt 預設 mt/3 |
| stub-joint | 短榫 | tl, tw, tt, mt | tl ≤ min(mt-3, ct/2) |
| dowel | 木釘 | Ø=tt, tl, mt, cw, 釘數 | 釘數 = floor(cw/(Ø*4)) 最少 2 |
| mitered-spline | 斜接帶餅 | tt, tl, mt, 45° | 標 45°00′ |
| pocket-hole | 口袋孔 | mt, ct, 螺絲 ct/2+mt-5 | 角度 15°；老師圖庫無 ref，wrd 自繪 |
| screw | 螺釘 | tt, tl, mt, ct, 預鑽 tt*0.7 | 軟木 / 硬木 兩標 |

## 老師參考圖位置

`/Users/wengevaq989/Desktop/CLAUDE/joinery-batch/榫卯圖庫/`

完整 manifest: `/Users/wengevaq989/Desktop/wooden-ren-designer/docs/joinery-refs/manifest.json`

讀 manifest 找出你負責的 JoineryType priority=1 的圖檔路徑作為**風格參考**（不能複製）：

```bash
node -e "const m = require('/Users/wengevaq989/Desktop/wooden-ren-designer/docs/joinery-refs/manifest.json'); console.log(m.items.filter(i => i.joineryType === 'through-tenon' && i.priority === 1).slice(0,3).map(i => i.relativePath).join('\n'))"
```

## 驗收（每 agent 完工跑）

```bash
cd $WORKTREE_ROOT  # agent 自己的 worktree

# 1. typecheck
npx tsc --noEmit 2>&1 | grep -v "node_modules.pnpm-old" | grep "lib/joinery/details.tsx" | wc -l
# 預期 0 (新增的錯誤)

# 2. audit
npm run audit
# 預期 exit 0

# 3. commit (不 push)
git add lib/joinery/details.tsx
git commit -m "feat(joinery): redraw {type1}/{type2}/{type3} with teacher-style three-view + iso"
```

## 工法警示文字庫（建議句）

- 通榫類：「貫穿端應微凸 1mm 後修平」「楔片方向不可顛倒」
- 盲榫類：「白膠須塗滿榫眼底面」「榫長需 ≤ 母厚 - 3mm」
- 帶肩類：「肩面為主要承力面」「禁順紋反向受力」
- 燕尾類：「順紋切尾、橫紋切銷」「軟木 1:6 / 硬木 1:8 斜度」
- 指接：「指齒尖角應磨 R0.5 防爆裂」
- 木釘：「孔位誤差 ≤ 0.3mm」「軟木用短釘避免劈裂」
- 螺絲：「先導孔 = 螺桿徑 × 70%」「埋頭孔深 ≥ 螺頭高」
- 斜接餅：「45°切面誤差 ≤ 0.5°」「餅片膠合後不需夾具」
- 口袋孔：「孔深 = 板厚 - 5mm」「孔距 50-75mm 從邊 25mm 起」
