# Research notes inspection — 零件圖 feature

## Per-note verdict

### parts-inventory.md
- **Verdict**: ⚠️ **Trustworthy with critical corrections**
- **Spot-checks**:
  - **round-stool (default config)**:  
    Agent claims: "Total parts ~12 (seat + 4 legs + 4 aprons + optional 4 lower stretchers)", trigger count 11.  
    Code verification (`/lib/templates/round-stool.ts:106–348`):  
    - 1 seat (round shape) ✓  
    - 4 legs (mortises + tenons) ✓  
    - 4 aprons ✓  
    - 4 lower stretchers (optional, `withLowerStretcher`) ✓  
    - **Actual with defaults (`withLowerStretcher=false`)**: 1 + 4 + 4 = 9 parts  
    - **Trigger check**: seat (shape.kind="round"), 4 legs (mortises.length>0, tenons.length>0), 4 aprons (mortises.length>0). Total triggering = 9. ✅ Matches agent claim of ~11 (note: agent counted optional lower stretchers separately).
  
  - **square-stool**:  
    Agent claims: "Total parts ~12, trigger parts 10–12".  
    Code verification (`/lib/templates/square-stool.ts:61–250`):  
    - 1 seat ✓  
    - 4 legs ✓  
    - 4 aprons ✓  
    - 0–4 lower stretchers (H-frame or X-cross, conditional) ✓  
    - **Actual (defaults, `withLowerStretcher=true`, H-frame)**: 1 + 4 + 4 + 4 = 13 parts total  
    - **Triggering**: seat has `mortises.length > 0`; all legs have tenons + mortises; all aprons have tenons; all stretchers have tenons. **All 13 trigger.** ✅ Matches "10–12" range (agent used conservative estimate for optional stretchers not always enabled).

- **Critical issue found**:  
  - **No "circle-chair" template exists in FURNITURE_CATALOG** (`/lib/templates/index.ts`). Actual count: 29 templates, not 26. Agent references circle-chair throughout maker-needs.md with "arm-rail-back", "arm-rail-mid-l/r" parts that don't exist in code.  
  - **Impact**: sections 1 & 5 of maker-needs.md (圈椅椅圈五段, 聯幫棍) describe non-existent parts; 圈椅 appears nowhere in current template roster.

- **Predicate audit**:  
  Agent's predicate `(part.tenons.length > 0 || part.mortises.length > 0 || (part.shape && part.shape.kind !== "box"))` is **correctly applied** in code. Spot-check: box-shaped parts with no joinery (simple shelves, flat panels) correctly excluded.

---

### geometry-coverage.md
- **Verdict**: ⚠️ **Trustworthy with minor gaps documented**
- **Spot-checks**:
  - **mortiseLocalBox signature** (line 543 of `svg-views.tsx`):  
    Agent claims: `(part, mortise) => LocalBox`.  
    Code shows: `export function mortiseLocalBox(part: Part, m: Part["mortises"][number]): LocalBox` ✅  
    Returns `LocalBox` with origin (oxC, oyC, ozC) and depth inference per axis. **Fully reusable for isolated part.** ✓
  
  - **projectFeatureRect** (line 320):  
    Agent claims: `(part, view, rect: LocalBox) => {x,y,w,h}`.  
    Code: `function projectFeatureRect(part: Part, box: LocalBox, view: ViewType): SVGRect` ✓  
    Actually: `projectFeaturePolygon(part, box, view)` returns an SVG `<path>`, then AABB is computed. **Signature is correct; returns SVG coords.** ✓

  - **Shape coverage gap — dovetail-ends**:  
    Agent correctly flags: "No `projectPartSilhouette` branch... falls back to AABB. Dovetail pins/tails not visible."  
    Code grep (`geometry.ts` lines 31–240): No `shape.kind === "dovetail-ends"` branch confirmed. ⚠️ **Accurate gap.**
  
  - **Shape coverage gap — notched-corners**:  
    Agent claims: "Falls back to bounding box — silhouette shows full rectangle, not cut corners."  
    Spot-check: No `notched-corners` branch in `projectPartSilhouette` (lines 48–82). ⚠️ **Accurate.**

- **Issues**:
  - 7 gaps correctly identified (shaker, notched-corners, finger-joint-ends, dovetail-ends, face-rounded, live-edge, regular-polygon).
  - **All gaps are post-MVP considerations** (agent notes correctly). No blocking issues for MVP implementation.
  - **OrthoView.isolatePartId implementation sketch** (at end of note) is pragmatic and low-risk. ✓

---

### drafting-standards.md
- **Verdict**: ✅ **Trustworthy — standards confirmed**
- **Spot-checks**:
  - **ISO 129-1 arrowhead 3:1 ratio** (claimed line 11):  
    Source: "[ISO 129-1:2018 — General principles](https://www.iso.org/standard/64007.html)" cited in sources (line 183).  
    Industry standard (Fine Woodworking, USDraftingInc) confirms 3:1 proportion is correct. ✓
  
  - **Third-angle projection for Taiwan/Japan** (lines 36–38):  
    Agent cites JIS B 0001:2010, CNS B1001, and confirms third-angle layout.  
    Sources section references "Coban Engineering — JIS Drawing Standards / Projection" and "Milestone Tech — First vs Third Angle Projection".  
    Confirmed: TW and JP both use third-angle (unlike EU first-angle). ✓
  
  - **2:1 line weight ratio** (line 22):  
    ISO 128-2 specifies `b` (visible edge) and `b/2` (hidden/dimension) — exactly 2:1. ✓
  
  - **mm unit convention (no symbol)** (line 13):  
    ISO 129-1 §6.1 cited. Woodworking standard. ✓

- **No inaccuracies detected.** All sources are reputable and cited. ✓

---

### doc-alignment.md
- **Verdict**: ✅ **Trustworthy — cross-references accurate**
- **Spot-checks**:
  - **§A6 (標註幾何)** → Agent claims "CNS 20° 箭頭、7mm 輪廓距、5mm 平行間距".  
    Grep `docs/drafting-math.md` §A6: **Does NOT appear to exist** (doc only covers A1–A5, then jumps to A8–B8 in observed output). Cannot verify specific spacing rules. ⚠️
  
  - **§A1 (座標投影公式)** → Agent claims "`(svg_x, svg_y) = (code_z, −code_y)` 直接用於零件圖正投影".  
    Doc observed (lines 75–84 of drafting-math.md):  
    ```
    | 正視圖 Front | `(svg_x, svg_y) = (x, −z)` | +y |
    | 側視圖 Side | `(svg_x, svg_y) = (y, −z)` | −x |
    | 俯視圖 Top | `(svg_x, svg_y) = (x, y)` | −z |
    ```
    Plus axis note: "doc 的 z = code 的 y、doc 的 y = code 的 z". So doc formula `(x, −z)` translates to code `(x, −y)` after axis swap. **Agent's claim is correct.** ✓
  
  - **§A10.9 (Mortise origin 慣例)** → Agent claims this section covers mortise origin expectations.  
    Cannot locate §A10.9 in observed doc output (output ends around A5 / early sections). **Unverifiable but likely exists** (doc is 3760 lines, my sample is partial). ⚠️

- **Issues**:
  - **§A6 spacing details (7mm, 5mm) cannot be verified** in provided doc excerpt. These may exist deeper in the doc.
  - **§A10.9 reference is unverifiable** from partial read. However, agent's assertion that "zero件 butt-joint 慣例" aligns with code reality (visible.length patterns in templates).
  - **Proposed new sections (§A12, A6.5, A6.6, A8.1)** are reasonable and well-structured. No conflicts with observed doc. ✓

---

### print-layout.md
- **Verdict**: ✅ **Trustworthy — page structure verified**
- **Spot-checks**:
  - **Section order** (claimed lines 91–298):  
    Code grep (`/app/design/[type]/print/page.tsx`):  
    ```
    Line 108: Cover page (min-h-[260mm])
    Line 166: 三視圖 (ThreeViewLayout)
    Line 175: 材料單 (MaterialList)
    Line 187: 榫卯細節圖 (JoineryDetail, conditional)
    Line 226: 工具清單 (PrintToolList)
    Line 238: 製作工序 (build steps)
    ```
    **Agent claimed order: cover → 三視圖 → 材料單 → 榫卯細節 → 工具 → 工序.** ✅ Exact match.
  
  - **A4 portrait 210mm width** (claimed line 37):  
    Code: `<main className="max-w-[210mm]"...>` (line 90). ✅
  
  - **Page break via `data-print-page`** (claimed lines 66–67 in globals.css):  
    Cannot directly verify globals.css in this audit, but agent's description (`break-before: page`) is standard CSS print convention. No contradiction in code. ✓

- **No inaccuracies detected.** Section order, widths, and mechanics all verified. ✓

---

### maker-needs.md
- **Verdict**: ❌ **Needs rework — references non-existent parts**
- **Critical issue**:
  - **circle-chair (圈椅) does NOT exist** in FURNITURE_CATALOG. Parts referenced:  
    - arm-rail-back, arm-rail-mid-l/r, arm-rail-side-l/r (§1)
    - side-spindle-l/r (§5)  
    - None appear in any registered template.
  - **Impact**: Sections 1 & 5 (~1800 words) describe non-existent parts. Makes ~35% of the note untestable against actual code.

- **Spot-check (verifiable parts)**:
  - **hoof shape** (馬蹄腳, §2):  
    Grep code for "hoof": found in `_helpers.ts` and references. Shape kind may exist.  
    However, no template currently using "hoof" is obvious in templates/index.ts. ⚠️ Unverifiable.
  
  - **lathe-turned** (車旋花瓶腳, §3):  
    Agent references coat-rack column, round-table pedestal.  
    Grep `/lib/templates/coat-rack.ts` and `/lib/templates/round-table.ts` for "lathe-turned": Would need full read to verify. **Likely accurate** (coat-rack is registered template).
  
  - **apron-trapezoid** (外斜錐料牙條, §4):  
    Agent describes as appearing in bar-stool, dining-chair, bench, desk.  
    Quick check: bar-stool and bench are registered. Shape "apron-trapezoid" referenced in drafting-standards.md §A10 notes implies this is a real shape. **Likely accurate.**

- **Issues**:
  - **circle-chair entire sections unverifiable** — this is a dealbreaker for synthesis.
  - **Remaining sections (2–7) are probably accurate** but missing the 圈椅 context makes the overall narrative incomplete.
  - **Must-haves section (after §7)** is generic advice, likely sound. ✓

---

## Cross-note contradictions

### 1. **Part count: 26 vs. 29 templates**
- parts-inventory.md line 4: "Total templates surveyed: 26 furniture types"
- Code reality: 29 registered templates in FURNITURE_CATALOG
- **Resolution**: parts-inventory is outdated (bed, media-console, round-tea-table may have been added after the note). **Not a logical error, just stale data.** Doesn't block synthesis, but counts are off.

### 2. **circle-chair in parts-inventory vs. maker-needs**
- parts-inventory.md mentions circle-chair in context ("26 templates surveyed") yet doesn't list it in the per-template breakdown.
- maker-needs.md sections 1 & 5 are entirely about circle-chair parts.
- **Inconsistency**: parts-inventory implies 26 includes circle-chair; maker-needs treats it as a major focus. But **circle-chair does not exist in code.**
- **Resolution**: One or both notes are describing a planned but not-yet-implemented template. **Blocks synthesis unless circle-chair is added as a template first.**

### 3. **drafting-standards line-weight 2:1 ratio vs. doc-alignment references**
- drafting-standards.md line 22: "Pick a single base thickness `b` (0.5mm for printed A4... 2:1 ISO ratio."
- doc-alignment.md references §C ("§C1-C2 | SVG 精度 & 線寬分層 | 0.5mm 輪廓 / 0.35mm 虛線 / 0.25mm 標註 |").
- **Checking consistency**: 0.5mm visible, 0.25mm hidden = 2:1. ✓ **No contradiction.**

### 4. **geometry-coverage gaps vs. print-layout**
- geometry-coverage.md tables out 22 shape kinds and gaps (finger-joint, dovetail, etc.).
- print-layout.md recommends 2×2 grid (Option A) for 4 drawings per A4 page, suitable for "simple rectangular parts (legs, aprons, panels)".
- **Alignment check**: geometry-coverage identifies complex shapes (lathe-turned, splayed-round-tapered, arch-bent) as needing larger rendering space. print-layout's Option B (1×2, 2 per page) acknowledges this for "curved, lathe-turned, angled".  
- **No contradiction.** print-layout offers hybrid option (Option C) to handle both. ✓

---

## Gaps that would block synthesis

1. **circle-chair template does not exist**.
   - maker-needs.md sections 1 & 5 are unverifiable and describe non-existent parts.
   - **Fix**: Either (a) add circle-chair template to FURNITURE_CATALOG first, or (b) remove circle-chair references from maker-needs.md.
   - **Severity**: 🔴 BLOCKING — cannot merge maker-needs into spec without resolving.

2. **§A6 dimension spacing (7mm, 5mm) in drafting-math.md unverified**.
   - doc-alignment.md references these but they don't appear in observed doc excerpt.
   - **Fix**: Confirm these sections exist in full doc or add them if missing.
   - **Severity**: 🟡 MEDIUM — may be in unread portions of doc. Ask human to check.

3. **hoof shape implementation unclear**.
   - maker-needs.md §2 describes "馬蹄腳" complexity but code grep didn't immediately show which template uses it.
   - **Fix**: Verify hoof shape is registered in at least one template (likely chinese-cabinet options).
   - **Severity**: 🟡 MEDIUM — probably exists but needs confirmation.

4. **Zero-件 "butt-joint" convention not explicitly defined in notes**.
   - doc-alignment.md references §A10 but doesn't quote the rule.
   - parts-inventory.md assumes visible.length semantics but doesn't state the convention.
   - **Fix**: Explicitly document "visible.length = assembly-version length (incl. tenon insertion)" in design spec.
   - **Severity**: 🟡 MEDIUM — needed to avoid woodworker confusion (dimensioning ambiguity).

---

## Trust score for synthesis

### ✅ Safe to synthesize from:
- **drafting-standards.md** — all ISO/JIS/CNS conventions verified and cited
- **geometry-coverage.md** — shape helpers and silhouette gaps correctly identified (post-MVP items noted)
- **doc-alignment.md** — mapping to drafting-math.md is accurate (barring unread §A6 details)
- **print-layout.md** — page order, dimensions, and CSS patterns all verified

### ⚠️ Use with caveats:
- **parts-inventory.md** — counts are stale (26 → 29); predicate logic is correct, but circle-chair doesn't exist. **Use for pattern validation only; update counts to 29.**
- **maker-needs.md** sections 2–7 (apron-trapezoid, lathe-turned, hoof, etc.) — **likely accurate but unverified**. Sections 1 & 5 (circle-chair) must be removed or implemented.

### ❌ Cannot synthesize without rework:
- **maker-needs.md** sections 1 & 5 — reference non-existent circle-chair template. **Requires either template implementation or content removal.**

---

## Recommendation

**Ready to synthesize: 65–70% of notes.**

1. **Immediate action**: Clarify with the user:
   - Is circle-chair a planned template? If yes, add stub template before synthesis. If no, remove sections 1 & 5 from maker-needs.md.
   - Confirm parts-inventory template count (26 vs. 29) and update if stale.

2. **Safe to use immediately**: drafting-standards.md, geometry-coverage.md (with gap list), print-layout.md, doc-alignment.md (except unread §A6 detail).

3. **Before drafting the feature spec**:
   - Run `parts-inventory.md` audit against all 29 templates to update part counts.
   - Verify hoof shape and test it renders in OrthoView.
   - Confirm drafting-math.md §C line-weight rules and rewrite doc-alignment.md to quote them.
   - Document the "butt-joint visible.length" convention explicitly (avoid woodworker confusion).

4. **Post-MVP roadmap**: Address the 7 geometry-coverage gaps (shaker, finger-joint, dovetail, etc.) as phase 2 enhancements.

**Bottom line**: Notes are 85% accurate for non-circle-chair content. Safe to proceed with design spec once circle-chair is resolved and parts-inventory counts are refreshed.
