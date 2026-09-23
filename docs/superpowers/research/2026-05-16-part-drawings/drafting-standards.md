# Shop drawing standards (digest for wrd 零件圖)

## Recommended convention summary

Follow **ISO 128-2 (lines) + ISO 129-1 (dimensions) + third-angle projection**, with simplification for hand-tool woodworking (no GD&T tolerance frames, no surface-finish symbols). This matches both **JIS B 0001 (JP)** and **CNS B1001 (TW)** — both national standards are ISO-derived and Japan/Taiwan both default to **third-angle projection** (unlike most of Asia/EU). Output line weights at the 2:1 ISO ratio so SVG strokes land at familiar visual densities for any TW/JP woodworker who has seen a 工作圖 before.

## Dimension lines

- **Extension line:** thin continuous (type 01.1). Starts ~1mm gap from the object outline; extends ~2mm past the dimension line. Perpendicular to the measured edge.
- **Dimension line:** thin continuous, parallel to the measured feature, terminated by arrowheads at each end.
- **Arrowhead:** **closed filled triangle, ratio length:width ≈ 3:1**, drawn at ~3mm long × 1mm wide for an A4 sheet (ISO 129-1 §5 references the 3:1 proportion in Figure 11). For wrd's SVG we'll use length ≈ 6× the thin line weight.
- **Text placement:** centered above the dimension line, reading direction = sheet bottom (aligned/unidirectional system per ISO 129-1; JIS Z 8317 uses the same unidirectional method by default). Text height = 2.5mm or 3.5mm on A4; we'll pick 3.5mm for legibility on phone screens.
- **Units:** mm only, omit the unit symbol (ISO 129-1 §6.1). Whole numbers, no decimal unless <1mm precision is meaningful — for woodworking, round to 1mm (matches user preference: max 1 decimal).
- **Dimension chain vs baseline:**
  - **Chain (running)**: when each segment matters independently (e.g. shelf spacing, drawer face gaps). Tolerances stack — fine for hand-cut joinery where you fit-as-you-go.
  - **Baseline (datum-referenced)**: when one face is the reference (e.g. mortise locations from the bottom of a leg). Use this for **all mortise/dowel hole positions** so the woodworker measures everything from one square edge → no compounding error.
  - **Rule of thumb**: chain for box dimensions, baseline for joinery holes/mortises.
- **Tolerances:** **skip them** for hand-tool work. Add a sheet-level note `公差 ±1mm 除非另註 / Tol. ±1mm unless noted` instead of per-dimension tolerance frames.

## Line weights

Pick a single base thickness `b` (0.5mm for printed A4, or 1.5px on screen at 96dpi). All other widths are derived ratios per ISO 128-2.

| Line type | Weight | Style | Use |
|-----------|--------|-------|-----|
| Visible edge (01.2) | `b` (0.5mm) | solid | Outlines of the part as seen in this view |
| Hidden edge (02.1) | `b/2` (0.25mm) | dash 3× line-weight, gap 1.5× line-weight (≈ dash 1.5mm / gap 0.75mm at b=0.5) | Mortise depths, blind holes, edges behind face |
| Centerline (04.1) | `b/2` (0.25mm) | long-dash-dot-dash (12-2-2-2 × b) | Hole centers, symmetry axes |
| Extension/dimension (01.1) | `b/2` (0.25mm) | solid thin | Dimension/leader/extension |
| Section/hatch (01.1) | `b/2` (0.25mm) | solid, 45° spaced 2-4mm | Mortise cross-sections, cut planes |
| Phantom (05.1) | `b/2` (0.25mm) | long-dash-double-dot | Alternate position, adjacent part outline |
| Cutting plane (04.2) | `b` (0.5mm) | long-dash-dot-dash, thick at ends | Where a section view is taken |

ISO 128-2 specifies dash/gap *as a function of line weight*, not absolute mm — so the pattern scales correctly when you zoom the SVG.

## Third-angle projection

**Confirmed for TW + JP woodworking** — JIS B 0001:2010 defaults to third-angle; Taiwan follows the same convention via CNS B1001 (mirroring JIS/ANSI rather than European first-angle).

Layout (front view is the anchor):

```
                  [TOP VIEW]                    <- looking down from above
                       |
[LEFT SIDE]  ---  [FRONT VIEW]  ---  [RIGHT SIDE]
                       |
                  [BOTTOM]                       <- usually omitted
                       |
                  [REAR]                         <- only if asymmetric
```

The third-angle symbol (truncated cone, narrow end facing left) should appear in the title block so non-TW/JP readers don't misread.

For wrd 零件圖, default to **front + top + right side** (three views) for most parts; show only one view if the part is fully described by it (e.g. a flat panel labeled "厚 18mm" needs only the face view).

## Mortise / tenon notation

Woodworking shop drawings don't use machinist callouts (Ø, ↧, THRU as text codes). Convention:

- **Through mortise**: draw the rectangle on the face with solid visible lines, label `通榫 12×30 通` or just `通` near the leader.
- **Blind mortise**: draw the rectangle outline solid on the face it opens to, plus the **back edge as a dashed hidden line** showing depth in the side/section view. Annotate `12×30, 深 25`  (width × length, depth) via a leader pointing to the mortise.
- **Tenon**: dimension thickness × width × shoulder-to-end length on the side view; show the cheek-shoulder transition in the front view. Standard tenon thickness ≈ stock/3 — but **dimension the actual mm**, don't write a fraction (Fine Woodworking convention).
- **Dowel hole**: centerline cross at hole center on the face view, plus depth-dimensioned hidden lines in section. Annotate `Ø8 深 20 ×2` (diameter, depth, quantity) — woodworkers read Ø and 深 fluently.
- **Through hole**: `Ø8 通` (omit depth, add `通` = through).

**TW-specific convention** (魯班學堂 / 木匠工作圖 tradition): annotation text is **Chinese with mm**, leader lines are thin solid with a small dot terminator (not arrowhead) when pointing at a feature on the same view. Reserve arrowheads for dimension-line ends.

## Scale notation

- Format: `比例 1:5` or `SCALE 1:5` — place in **title block**, not floating on the drawing.
- If a single view uses a different scale (detail blow-up), label that view: `詳圖 A — 1:2` directly below the view.
- Add a **scale bar** (0–100mm with 10mm ticks) when the drawing will be reproduced/photocopied at unknown ratios. For digital SVG with metadata this is optional but cheap to include.

## Title block fields

Locate bottom-right of the sheet (ISO 7200 / JIS Z 8311 layout). Required fields for a wrd 零件圖:

- **零件名稱 / Part name** — Chinese primary, English optional (e.g. `前腳 Front Leg`)
- **零件編號 / Part No.** — e.g. `P-01`, `P-02` matching the assembly drawing BOM
- **數量 ×N / Qty** — how many of this part in the assembly
- **材料 / Material** — e.g. `胡桃木 Walnut`, `橡木 Oak`, `木芯板 18mm`
- **成品尺寸 / Finished size** — `W×D×H` mm, the gross stock dimension before joinery
- **比例 / Scale** — e.g. `1:5`
- **單位 / Units** — `mm`
- **投影法 / Projection** — third-angle symbol
- **圖號 / Drawing No.** — e.g. `WRD-2026-0516-P01`
- **日期 / Date** — `2026-05-16`
- **製圖 / Drawn by** — `木頭仁家具設計生成器`
- **公差註記 / Tolerance note** — `±1mm 除非另註`

For wrd specifically: also include the **share short-code** (e.g. `b5884b0`) so the woodworker can pull the live 3D model on their phone.

## Sources

- [ISO 129-1:2018 — Presentation of dimensions and tolerances, General principles](https://www.iso.org/standard/64007.html) — definitive source for dimension line, extension line, arrowhead 3:1 ratio (Figure 11), unidirectional text placement, mm unit omission.
- [ISO 128-2:2022 — Basic conventions for lines](https://www.iso.org/standard/83355.html) and [ISO 128-2:2020 PDF sample](https://cdn.standards.iteh.ai/samples/69129/38e651842df746fd990d29679e3c2e98/ISO-128-2-2020.pdf) — line types, 2:1 thick:thin ratio, dash/gap as function of line weight, 9-step weight series (0.13–2.0mm).
- [Caddrafter — Line Weights and Annotation Standards (ISO 128)](https://caddrafter.us/line-weights-and-annotation-standards/) — practical summary of ISO 128 line weights and 2:1 ratio rule.
- [Coban Engineering — JIS Drawing Standards / Projection](https://www.cobanengineering.com/GeometricDimensioningAndTolerancing/JISPaperSizes.asp) — confirms JIS B 0001 defaults to third-angle projection (Japan/Taiwan exception in Asia).
- [Milestone Tech — First vs Third Angle Projection](https://www.milestonetech.net/first-angle-projection-vs-third-angle-projection-in-engineering-drawings/) — confirms Taiwan uses third-angle, layout diagram.
- [CNS B1001 工程製圖一般準則 (PDF)](http://twhsiao.byethost7.com/download/file/CNS3%20B1001%E5%B7%A5%E7%A8%8B%E8%A3%BD%E5%9C%96(%E4%B8%80%E8%88%AC%E6%BA%96%E5%89%87).pdf) — Taiwan national standard, derives from ISO 128/129, mandates third-angle.
- [Fine Woodworking — Tips on Dimensions](https://www.finewoodworking.com/2011/12/12/tips-on-dimensions) and [Fine Woodworking — Mortise & Tenon project guide](https://www.finewoodworking.com/project-guides/joinery/mortise-and-tenon) — woodworking-specific dimensioning, 1/3 thickness tenon rule, baseline-from-one-face convention.
- [Dimensions.com — Mortise & Tenon Blind](https://www.dimensions.com/element/wood-joint-mortise-tenon-blind) — blind mortise depth = 2/3 board width convention.
- [WisTech Open Blueprint Reading — Title Blocks](https://wtcs.pressbooks.pub/blueprintreading/chapter/7-title-blocks/) — standard title block field list.
- [US Drafting Inc — Millwork Shop Drawings](https://usdraftinginc.com/how-to-read-millwork-shop-drawings/) — millwork/woodworking title block conventions.
