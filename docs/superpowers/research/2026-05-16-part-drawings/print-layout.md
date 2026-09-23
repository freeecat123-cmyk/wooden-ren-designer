# Print page layout recon

## Current page structure (order)

The print page (`app/design/[type]/print/page.tsx`) follows a strict sequential flow with conditional sections:

1. **Watermark layer** (line 91–94) — fixed position, 5% opacity "木頭仁 · woodenren.com", renders on every physical page via `@media print`
2. **Top bar** (line 100–105) — `.no-print` hidden in PDF, shows "A4 直式" label + PrintAccessGate auth gate
3. **Cover page** (line 108–163) — `<section data-print-page min-h-[260mm]>` — logo, title, dimensions, material, difficulty, estimated hours, part count, volume, design ID, date
4. **三視圖 page** (line 166–172) — three orthographic views (正視/側視/俯視) rendered by `ThreeViewLayout`, single-column wide grid on print
5. **材料單 page** (line 175–183) — tabular material list from `MaterialList` component, includes total volume callout
6. **榫卯細節圖 pages** (line 186–223, conditional) — only if `usages.length > 0` — each joinery type gets a `.print-keep` card, maps `JoineryDetail` SVG renderers
7. **工具清單 page** (line 226–235) — `PrintToolList` grouped by priority (必備/建議/可選), 2-column grid with QR codes, ~80px QR + text per cell
8. **製作工序 page** (line 238–298) — ordered list of build steps, each in `.print-keep` card with phase badge, title, time, tools, warnings
9. **Footer** (line 301–303) — `.no-print` hidden in preview, renders in PDF only with copyright + design ID

## Page setup

### Format & dimensions
- **Page format**: A4 portrait, 210mm × 297mm (per cover page label line 102: "列印預覽（A4 直式）")
- **Print viewport width**: 210mm − 2×10mm padding (px-10 both sides) = 190mm ≈ **722px** @ 96 DPI (or 755px @ 100 DPI depending on browser)
- **Max container width**: `max-w-[210mm]` on `<main>` (line 90) = **hard pixel limit at 210mm CSS units** = **794px** when Chrome's print dialog renders @ standard DPI

### Padding & spacing per section
- Cover: `px-10 py-16` = 40mm horizontal padding, 64mm top+bottom padding, `min-h-[260mm]` forces minimum 260mm height (fills most of page 1)
- Content sections (三視圖, 材料單, etc.): `px-10 py-12` = 40mm horizontal, 48mm top+bottom padding

### Page break rules (`app/globals.css:45–113`)
- **Each `<section data-print-page>` triggers a new A4 page** via `break-before: page` + `page-break-before: always` (line 66–67)
- **Exception**: first section exempted with `:first-of-type` (line 69–71) so cover doesn't have blank page before it
- **Inside sections**: `.print-keep` elements (cards, joinery details, build step items) use `break-inside: avoid` (line 91–93) to prevent mid-card splits
- **No explicit @page { size: A4; }** rule — relies on browser default + max-w-[210mm] constraint

### Render width in three-view layout
- **ThreeViewLayout** (line 171) uses `grid grid-cols-1 md:grid-cols-2` → at print width (722px), renders as 1 column then wraps to 2 columns, each child gets ~361px (less gaps/borders)
- In print context (max-w-[210mm]), the 3 views stack:
  - Row 1: front + side (~361px width each, ~240px height each)
  - Row 2: top + overflow (wraps or can be overridden for print)
- **Typical print output**: 3 views fill 1 full page due to aspect ratio + spacing

### Font hierarchy in print
- Section heading (SectionHeading) at line 317: `text-2xl font-bold` (h2) + subtitle `.text-xs` (line 318)
- Build step title: `font-semibold text-sm` (line 256)
- Tool list group header: `text-base font-semibold` (line 41 of PrintToolList)
- Body text in steps/descriptions: `.text-xs` (line 263)
- Callouts (warnings): `text-[10px] text-amber-800` (line 288)
- Footer: `text-[10px]` (line 301)

## Reusable components for 零件圖 integration

### SectionHeading wrapper (line 308–320)
```tsx
<div className="mb-4 pb-2 border-b-2 border-zinc-900">
  <h2 className="text-2xl font-bold">{title}</h2>
  {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
</div>
```
- **Reuse**: Exact same pattern — title on h2, subtitle (count, notes) in xs gray text
- **Spacing**: mb-4 (16px) before content, pb-2 + border-b-2 for visual separation

### Print-safe card pattern (line 191–219)
```tsx
<div className="print-keep border border-zinc-300 rounded p-4">
  <div className="flex items-baseline justify-between flex-wrap gap-2 mb-2">
    <h3 className="font-semibold">Title</h3>
    <span className="text-xs text-zinc-500">Subtext</span>
  </div>
  <p className="text-xs text-zinc-600 mb-3">Description</p>
  {/* Content SVG or component */}
</div>
```
- **Critical**: `.print-keep` prevents page breaks mid-card
- **Aspect**: border-zinc-300 + rounded + p-4 padding is consistent across joinery/tool/step cards

### Section wrapper pattern (lines 166, 175, 226, 238)
```tsx
<section data-print-page className="px-10 py-12">
  <SectionHeading title="..." subtitle="..." />
  {/* Content grid or list */}
</section>
```
- **Each section starts a new A4 page automatically**
- Padding: `px-10` (40mm) + `py-12` (48mm) standard for all content pages (not cover)

## 零件圖 section — proposed integration

### Logical insertion point
**After JoineryDetail, before PrintToolList** (i.e., between line 223 and 226).

**Rationale**:
- 三視圖 (overview whole furniture) → 材料單 (BOM) → 榫卯細節圖 (joint method) → **零件圖 (detailed per-part drawings)** → 工具清單 (shopping list) → 工序 (assembly steps)
- 零件圖 bridges from "how to join" to "what tools/steps needed per part"
- Supports learner workflow: understand assembly → see each part in detail → shop tools → execute steps

### Layout density per A4 page
At print width of 722px (190mm usable), with `px-10 py-12` padding:

**Option A: 2×2 grid (4 drawings per page)**
- Grid: `grid grid-cols-2 gap-4` 
- Per drawing container: ~361px − gap/borders ≈ **350px width × 200px height** (A6-ish)
- Suitable for simple rectangular parts (legs, aprons, panels with orthogonal views)
- Each card shows: part name + 3-view ortho or isometric + dimensions label
- **Estimated drawings per standard furniture**: 8–12 parts → 2–3 pages

**Option B: 1×2 stack (2 drawings per page)**
- Grid: `grid grid-cols-1 gap-6`
- Per drawing: **700px width × 400px height** (closer to A5)
- Suitable for complex parts (curved, lathe-turned, angled) that need larger, clearer views
- Allows space for written notes, grain direction arrows, detail callouts
- **Estimated drawings**: 8–12 parts → 4–6 pages

**Option C: Hybrid / responsive (adaptive)**
- Data-driven: flag each part as "simple" (rect, box) or "complex" (curved, round, angled)
- Simple → 4-up; complex → 2-up or 1-up
- **Pros**: space-efficient, quality scales with need
- **Cons**: harder to implement, inconsistent page breaks, learner might expect uniform

### Recommended approach: **Option A (2×2 grid, 4 per page)** with `.print-keep` wrapping

**Reasoning**:
- Standard furniture has 6–12 parts; 4-up means 2–3 pages max for 零件圖 section, keeping document under ~20 pages total
- Most parts in chair/table/cabinet projects are rectangular (legs, stretchers, panels, shelves) → A6 size adequate with good font clarity (10–12pt dimensions)
- Precedent: tool list uses `grid grid-cols-2` (line 44 of PrintToolList) successfully
- `.print-keep` on each drawing card ensures no orphans/widows across pages

**CSS template**:
```tsx
<section data-print-page className="px-10 py-12">
  <SectionHeading title="零件圖" subtitle={`共 ${design.parts.length} 件`} />
  <div className="grid grid-cols-2 gap-4">
    {design.parts.map((part) => (
      <div key={part.id} className="print-keep border border-zinc-300 rounded p-4">
        <h3 className="font-semibold text-sm">{part.nameZh}</h3>
        <p className="text-xs text-zinc-500 mb-2">材質: {MATERIALS[part.material].nameZh}</p>
        {/* Render part orthographic views or isometric */}
        {/* Optionally: grain direction, cut dimensions, quantity label */}
      </div>
    ))}
  </div>
</section>
```

### Print-specific CSS considerations

1. **Page break safety**: Wrap each part drawing in `.print-keep` → `break-inside: avoid` (inherited from globals.css)
2. **Overflow management**: SVG card content should be bounded; add `overflow-hidden` or `max-height` to prevent bleed
3. **Repeating section header**: Standard sections don't repeat titles per page; 零件圖 follows same pattern (title only on first page). If section spans 2+ pages, consider subtitle note "（续）" on continuation
4. **Grid stability**: 2-column grid is stable on A4 portrait; avoid 3-column (too narrow, squished labels)
5. **Dynamic page count**: Design may have 4 parts (1 page) or 20 parts (5 pages); no enforced "parts per page" cap, let grid + page break rules handle flow

### Open design questions

1. **Sort order for parts**:
   - By structural role (case → divider → drawer as per PartCategory enum in svg-views.tsx line 2978–2981)?
   - By assembly sequence (from base to top)?
   - Alphabetical (part ID or Chinese name)?
   - **Recommended**: Structural role (case/legs first, drawers last) matches BOM convention; easier for learner to cross-reference material list

2. **Index/summary page**:
   - Add a page between JoineryDetail and 零件圖 listing all parts as a compact table with part ID, name, count, material?
   - **Pro**: fast reference when building, learner checks "part 04 is the left leg, pine, qty 2"
   - **Con**: adds 1 page, may feel redundant with 材料單 (but BOM is about *volume*, not *assembly*)
   - **Recommendation**: **Include lightweight index** if furniture has >10 parts; skip for simple designs

3. **Grain direction & detail callouts**:
   - Mark wood grain direction on each drawing (critical for stain/finish uniformity)?
   - Highlight edge protection points, joinery locations?
   - **Recommendation**: Post-MVP; current `ThreeViewLayout` + `JoineryDetail` handle this separately; 零件圖 v1 can be clean orthogonal views + dimensions

4. **Quantity and materials**:
   - Display "qty: 2", "qty: 4" on drawing if part appears multiple times?
   - Show wood species vs. hardware (glass, brass) visual distinctly?
   - **Recommendation**: Yes; simple `{part.quantity}× ` label or badge; matches 材料單 BOM

5. **3D / isometric vs. orthographic views**:
   - Use same ortho triple (正視/側視/俯視) as 三視圖 page, just per-part?
   - Or switch to isometric for clarity (better shows 3D shape)?
   - **Recommendation**: **Orthographic (same as 三視圖)** for consistency + learner already familiar; isometric adds complexity and may require new renderer

---

## Validation checklist for layout

- [ ] Confirm A4 portrait pixel width at target DPI (test print at 96dpi and 100dpi scales)
- [ ] Measure 2×2 grid actual rendered size in browser print preview (DevTools → Print preview)
- [ ] Test page break with 8, 12, 16 parts — count pages, check for orphaned cards
- [ ] Verify `.print-keep` prevents card splits (manually trigger page break in middle of grid, check CSS applies)
- [ ] Font size check: h3 (font-semibold text-sm) and dimension labels (text-xs) readable at 150% zoom on printed page
- [ ] QR codes in tool list don't bleed into 零件圖 section (verify page break boundary is clean)
- [ ] Watermark doesn't obscure part drawings (fixed positioning OK for light 5% opacity)
