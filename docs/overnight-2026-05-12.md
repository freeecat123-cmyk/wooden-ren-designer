# 2026-05-12 凌晨 wrd 學生 beta 準備批次工作摘要

User 11pm 去睡前授權的批次自主模式產出。從 HEAD `cef9dbc` 開始跑到
HEAD `6c5538c`，共 9 個 commit / ~2 小時。

## 已完成（全部已 push）

### 學生 beta 必備 scaffolding（`bf90683`）
- `components/SiteFooter.tsx` — 版權 + build SHA + Vercel env tag
- `components/BugReportFab.tsx` — 全站右下角 🐛 浮動按鈕，mailto wengbinren@gmail.com
  自動帶 URL/SHA/UA，學生不必背任何指令
- `components/design/ResetDefaultsButton.tsx` — 尺寸區右上 ↺ 重設預設，confirm 後清
  所有 URL params，學生改爛了的逃生口
- `app/not-found.tsx` — 友善 404
- `app/error.tsx` — app-level error boundary（重試 + mailto 回報）
- `app/global-error.tsx` — root layout 都崩時兜底
- `app/design/[type]/error.tsx` — 設計頁專屬 error（重設預設選項）
- `app/design/[type]/loading.tsx` — Suspense fallback「正在生成 3D 模型⋯」

### 28 模板預設值體檢（`612986b`）
跑 Playwright 截每個模板的 default URL，列出 6 個 P1 礙眼 + 3 個 P2 優化問題：

**P1 礙眼**（學生看到會 WTF，1.5 hr 可全修）：
1. 床架床頭板飄在半空（同 cornice 飄空 pattern）
2. 衣櫃預設立刻跳「沒勾滑軌」警告
3. 斗櫃預設立刻跳「沒勾滑軌」警告
4. 鞋櫃預設立刻跳「層板過矮」警告
5. 吧檯椅預設立刻跳「腳粗過細」警告
6. 立式衣帽架完全沒有掛鉤 part（光禿禿木竿）

**P2 優化**（可開放後再修）：
7. 圓凳預設用方腳
8. 筆筒 / 相框 3D 視覺像實心方塊
9. 玻璃展示櫃預設上層開放下層玻璃

詳見 `docs/health-2026-05-12/README.md`（含 28 張截圖證據 + 修復順序 + 工時估算）。

### style-detail-packs 死 key 清理（`55eda49`）
- 寫 `scripts/audit-pack-keys.ts` 自動掃出 packs 內引用不存在 option 的 preset
- 結果：331 個死 key 出現次數 / 51 個 unique 死 key / 1 個整個 orphan category
  (square-stool 被重命名為 stool)
- 寫 `scripts/clean-pack-keys.ts` 自動重新序列化，幹掉 215 個死 key + 8 個 orphan
  category block
- packs.ts 3714 → 3367 lines（-347 lines / -9.4%）
- 加進 `npm run audit` chain

### drafting-math.md drift report（`23b3bde`）
- 掃 doc 內 72 個 inline-code identifier，比對 code
- 真 drift（重命名/移除）：7 個（backTiltDeg / footStyle / grainLocked /
  legThickness / mouldingProfile / sculpted / waistHeight）
- 整體 drift 率 ~10%
- 建議早上修這 7 個 doc 段落（沒緊急性，但 memory feedback_use_drafting_math_doc
  說改前要 grep doc，doc 不準會誤導）

### dead-checkbox audit（`17fd52c`）
- 寫 `scripts/audit-dead-checkboxes.ts` 自動掃 28 模板的 checkbox key 用法
- Heuristic：總出現次數 ≤ 3 = spec+const+notes 但沒 if-block = notes-only suspect
- 結果：**0 suspect** ✅（昨晚清完 14 個死選項後完全乾淨）
- 加進 `npm run audit` chain，未來新增 checkbox 沒做實作會自動抓

### floating-parts audit（`6c5538c`）
- 寫 `scripts/audit-floating-parts.ts` 捕捉 part AABB 超出家具 bbox 的情況
- tol = 50mm（允許 cornice/knob 正常 overhang，catch N cm 飄空）
- 結果：28 模板 × default options = 0 violations ✅
- 限制寫在 header：skips rotated parts（床頭板飄空 case 抓不到，要 playwright）
- 加進 `npm run audit:floating-parts`

## 額外做的（健檢 P1 trivial defaults）

`0a64d52` 修了 4 個 1-line P1 / P2：

- **衣櫃 + 斗櫃預設啟用三段式滑軌** — `useDrawerSlide` default false → true
  （影響 6 個用 zone-helpers 的櫃模板；warning 消失）
- **鞋櫃預設上層改不分層** — topCount 1 → 0（perShelf 從 116mm 過矮警告 → 250mm 通透）
- **吧檯椅腳粗預設 35 → 50** — height/legSize 比例從 1:21.4（過細警告）→ 1:15 ✅
- **圓凳預設改圓錐腳** — legShape "tapered" → "round-taper-down"

4 個都 playwright 自驗 ✅，截圖 `verify-*.png` commit 進 health-2026-05-12/。

`4675890` 加 no-print className 到 SiteFooter + BugReportFab，print 頁不會印
版權跟浮動鈕。

## 沒做（等你早上拍板）

### P1 還剩下 2 個非 trivial
- **P1-1 床架床頭板飄空** — 涉及 3D rotation math（headboard rotation X=-π/2, Y=-π/2
  雙轉），不是 1-line fix，需要先把 rotation math 釐清。預估 30-60 min。
- **P1-6 立式衣帽架掛鉤** — 要設計 hook part 樣式 + 數量分布規則，60 min feature work。

### Memory 列的家具 backlog
- 博古架/玻璃書櫃門片有縫
- 頂箱櫃選項重複
- 中式櫃只藏面板對門無效

### 床架 P1（8 種 headStyle 實裝）
- `project_wrd_bed_template.md` 記的待辦

### 抽屜右側板入溝槽多一條空槽
- `project_wrd_joinery_db.md` 記的待辦

---

## 升級的 audit chain

```
npm run audit
  ├─ audit-overlaps         (零容忍 part overlap)
  ├─ audit-joints           (榫頭/榫眼配對)
  ├─ audit-joinery-dynamic-dims  (尺寸標註動態化)
  ├─ audit-pack-keys        (NEW: preset 死 key drift)
  └─ audit-dead-checkboxes  (NEW: notes-only checkbox drift)

separate:
  └─ audit:floating-parts   (NEW: 部件超出 bbox)
```

如果你動模板，跑 `npm run audit` 會自動擋下新引入的死 key / 死 checkbox。

---

## Repository 健康度

| 指標 | 之前 | 之後 |
|---|---|---|
| packs.ts lines | 3,714 | 3,367 |
| dead preset keys | 331 occurrences | 0 |
| dead checkboxes | 已知 14 砍 + 未知 | 已知 0（heuristic 確認） |
| audit scripts | 3 | 5（+ 1 separate） |
| 學生 beta 必備頁 | 0 | 4（not-found/error/global-error/design-error） |
| 學生回報管道 | 無 | mailto FAB + error pages 內建 |
| build version 標示 | 無 | footer 顯示 SHA |

---

## 早上建議優先順序

1. **看 `docs/health-2026-05-12/README.md`** 決定 P1 哪幾個今天修
2. **看 `docs/drafting-math-drift-2026-05-12.md`** 看要不要順手修 doc
3. **跑一次 `npm run audit`** 確認所有新 audit 都綠
4. **vercel deploy 確認** student-facing scaffolding 在 prod 渲染 OK
5. **加 student notification 文案**（FB 社團/IG 公告開放測試）
6. **準備條款 + 隱私頁** (我做不了，需要你決定文字)
7. **設定 rate limit** (我做不了，需要你決定每日上限)

---

build at `6c5538c` · 2026-05-12 ~00:40 Taipei
