# Spec verification report: 零件圖 (Part Shop Drawing)

## Summary
Spec is **80% accurate on code claims, 40% bloat**. The document is over-engineered for Phase 1 MVP and mixes 2-3 implementation phases upfront when they should be separate specs. Major concerns: template count is wrong, print page line numbers are off by 3, and the "2-3 day Phase 1" claim is unrealistic by 50%.

---

## Factual errors / inaccuracies

1. **Template count (§1.2)**: Spec claims "26 模板". Reality: **32 templates** in `/lib/templates/*.ts` (excluding index + beginner-mode). Off by 6x.
   - Impact: §1.2 scaling estimate (340 part, 240 trigger, 85–95 unique) is proportionally wrong.
   - Fix: Recount; use actual 32 × avg 13 = 416 part, expect ~110–120 unique part drawings.

2. **Print page insertion (§6.2)**: Spec says insert new section "第 223 與 226 行之間" (between lines 223–226).
   - Reality: Line 223 is already `)}` closing the Joinery section. Lines 225–226 are the Tool List section header.
   - Correct location: Insert **after line 223** (after joinery closes) **before line 225** (before tool list). The spec's line numbers are off by ~3 due to variable conditional rendering.
   - Fix: Change spec to "after JoineryDetail section closes (line ~223), before PrintToolList (line ~225)".

3. **Shape kind count (§5.1 silhouette gaps)**: Spec lists "7 個 shape" with AABB fallback. 
   - Reality: There are **27 unique `kind` values** in `/lib/types/index.ts` (shape union), not "22 shape kinds" implied elsewhere. The 7 needing gaps are: `shaker`, `notched-corners`, `finger-joint-ends`, `dovetail-ends`, `face-rounded`, `live-edge`, `regular-polygon`.
   - Code check (`geometry.ts` lines 48–84): Confirmed no branches for these 7 kinds. ✓ Gap claim is accurate, count is OK.

4. **OrthoView signature (§8)**: Spec proposes `OrthoView({..., isolatePartId?: string, showDimensions?: boolean})`.
   - Reality: OrthoView is a **type alias** (`type OrthoView = "front" | "side" | "top"`), not a component function.
   - What exists: `ThreeViewLayout` component that accepts `design` + `joineryMode`; `projectPart()` and `projectPartSilhouette()` are standalone functions.
   - Fix: Spec should propose extending `ThreeViewLayout` props OR creating a new `<PartDrawingOrtho>` component wrapper, not mutating OrthoView type itself.

---

## Internal contradictions

1. **§4 vs §5 scope creep**: §4 says "Phase 1 + Phase 2 結合後的最終狀態" (Phase 1+2 combined), then §9 contradicts: Phase 1 is "三視圖 + T1+T2 尺寸 only", Phase 2 adds wood grain / orientation / 3D install hint / title block bottom.
   - Which is it? Is the card mockup in §4.1 Phase 1 or Phase 1+2 state?
   - Impact: Users reading §4 won't know if the example is MVP or post-MVP.
   - Fix: Rewrite §4 as "Phase 1+2 final state" with subsections marking which elements land in which phase.

2. **§6.2 grid strategy (hard parts forcing 1×2)**: Spec says "預設 2×2, hard parts 強制 1×2" to avoid squishing, but provides NO condition for switching. When does 1×2 kick in?
   - §6.2 lists 4 hard shapes: `lathe-turned`, `arch-bent`, `splayed-round-tapered`, `hoof`.
   - But §5 lists 6–7 shapes needing Phase 3 rendering (includes `apron-trapezoid` + bevel, others).
   - Fix: Define switch rule explicitly: "If part.shape.kind IN {lathe-turned, arch-bent, splayed-round-tapered, hoof}, use 1×2 grid for that part's page. Else 2×2."

3. **Title block bottom (§4.1 vs §4.2)**: Card mockup (§4.1) shows "材料、毛料、公差". §4.2 item 11 says "title block 底列" with same fields. Are these the same element or different? Mockup shows it integrated, item 11 suggests standalone.
   - Fix: Clarify: one title block at bottom of card, contains all three (material / stock size / tolerance).

---

## Over-engineering candidates (drop these for MVP)

| Section | What it adds | Why drop | Suggestion |
|---------|-------------|----------|------------|
| **§5 hard-part special rendering** | 6 shape-specific rendering rules (lathe segment table, arch-bent chord+sagitta, apron-trapezoid bevels, hoof direction, etc.) | These are Phase 3 (3–4 days per spec). MVP needs basic silhouette + T1/T2 dims only. Silhouette fallback (AABB) is good enough for Phase 1. | Cut entire section to stub: "Phase 3 consideration: complex shapes like lathe-turned, arch-bent need custom rendering (segment table, chord+sagitta, etc.). See Phase 3 spec." |
| **§5.1 silhouette gap fixups** | Detailed table of 7 shape fallback workarounds (shaker, notched-corners, finger-joint, etc.) | Same: these are Phase 3 polish. AABB fallback is functional for MVP. | Cut to one line: "Phase 3 will add precise silhouettes for 7 complex shapes; Phase 1 uses AABB." |
| **§3.4 mortise/tenon symbol syntax** | Detailed callout syntax (通榫 W×L, 盲榫 W×L 深 D, round hole Ø8, etc.) | Only T2 upsized dimension + box outline needed Phase 1. Full callout syntax can wait Phase 2. | Move to Phase 2 spec: "Phase 2 will add detailed mortise/tenon callout syntax per ISO." For Phase 1: "Mortise boxes with bounding rect + depth label (e.g., '40×15, D30')." |
| **§10 drafting-math.md sync** | 4 new doc sections (§A12, §A6.5, §A6.6, §A8.1) totaling ~3000 words | This is meta-documentation work, not feature code. Belongs in a separate "documentation update" task, not the feature spec. | Move to separate doc task after Phase 1 code completes, not during design spec. |
| **§11 verification checklist + §12 risk table** | Detailed test cases (audit-overlaps non-regression, playwright screenshot audit, 7 shape validation, etc.) | Good practice, but specifying test details upfront locks implementation. Better to write tests as code lands. | Move to Phase 1 implementation PR template, not design spec. Spec should just say "Phase 1 done when 26 templates render zero-crash + ~85-95 unique part drawings merge correctly." |
| **§3.1–§3.3 ISO drafting standards** | Full line-weight table (§3.2), Tier 分級 4-level (T1–T4, §3.3), baseline datums, chain dimensions, symmetry abbreviation rules, reference value notation | All correct per ISO 128-2 / 129-1, BUT Phase 1 only does T1+T2 without fancy callout routing. Line-weight table is overkill for MVP — just "thick = visible, thin = hidden/dims". | Collapse to 1 paragraph: "Phase 1 uses basic ISO drafting: thick lines = edges, thin = hidden/dimensions. Phase 2 adds detailed line-weight, Tier callout rules per ISO 128-2." |

**Total bloat: ~35–40% of spec is Phase 2+ detail or meta-work.**

---

## Missing critical pieces

1. **Empty part drawing section behavior**: What if a template has zero qualifying parts (no mortises, no tenons, no non-box shapes)? Does the section render empty, or hide entirely, or show placeholder?
   - Spec never addresses this. Fix: "If zero parts trigger predicate, section title shows 'N/A — all parts are simple rectangular pieces.' No cards rendered."

2. **Merge semantics for large templates**: Spec says merge by geometry hash (visible + shape + tenon/mortise sigs). But what if a template has 20 identical legs? Do they all collapse to "腿 ×20"?
   - Spec says yes (§2.1) but provides no rendering limit. What's the max ×N shown? 50? 100?
   - Fix: "×N can be shown up to 99; if >99 identical parts, show '×99+' or split into multiple groups."

3. **Part ordering assumption**: §7 says sort by "結構角色" (structural role: panel, leg, apron, etc.), using `categorizePart()` enum.
   - But what if a template has 5 custom part IDs that don't fit standard enum? Where do they appear?
   - Fix: "Unknown roles append at end; order within role determined by part.id lexical sort."

4. **Print section ordering after insertion**: Spec says insert at "線 223 與 226 之間" which is vague. What's the final page order?
   - From code (lines 107–242), it's: Cover, Three-view, Material, Joinery, **[INSERT HERE]**, Tool List, Steps.
   - Spec §6.2 lists "順序：1. Cover, 2. 三視圖, 3. 材料單, 4. 榫卯, 5. 【零件圖】, 6. 工具, 7. 工序" — this matches, but the insertion point in code is unclear in spec text.
   - Fix: Clarify: "Insert <PrintPartDrawings/> section after `{usages.length > 0 && ...}` joinery section closes, before PrintToolList section begins."

5. **isolatePartId implementation detail**: Spec says add `isolatePartId?: string` to OrthoView. But how does caller pass it down through component tree?
   - Spec doesn't show: "Where does the part ID come from when user clicks a part in PartDrawingsPanel? How does it flow to the ortho renderer?"
   - Fix: "PartDrawingsPanel passes selectedPartId → PartDrawing component → OrthoView recenter logic. Omit isolatePartId if user is viewing print/PDF (full design view)."

---

## Phase 1 reality check

Spec claims: **2–3 days**

Breaking down each Phase 1 task:

| Task | Estimate | Notes |
|------|----------|-------|
| **Predicate + geometry hash grouping** | 4–6 hours | Straightforward; reuse existing part comparison logic. ×N merging is basic string format. |
| **OrthoView / PerspectiveView extend** | 3–4 hours | Adding `isolatePartId` prop + filtering parts + recenter. Low-risk if done as wrapper, not mutation. |
| **`<PartDrawing>` component (3-view + T1+T2 dims)** | 8–12 hours | **Biggest chunk**. SVG rendering (3 views + dimension placement + leader lines) is non-trivial. Dimension routing (avoiding overlap) can take 4–6 hours alone. |
| **T1 (overall L×W×T) + T2 (mortise/tenon boxes)** | 4–6 hours | T1 easy; T2 requires accurate mortise bounding + projected rect in each view. |
| **Annotation/dimension system** | 6–8 hours | Leader lines, horizontal/vertical dimension lines, arrow placement, text layout. High risk for layout bugs. |
| **Title block** | 2–3 hours | Simple card header + footer, part name, ×N badge, scale. |
| **PartDrawingsPanel (design page interactive list)** | 4–6 hours | List + click to expand modal + scroll. Mobile responsiveness adds 1–2 hours. |
| **Print section wrapper + 2×2 grid layout** | 3–4 hours | CSS grid, `print-keep` styling, page breaks. Straightforward. |
| **Audit: 26 templates render zero-crash** | 4–8 hours | Iterate fixes until all 26 render without error. Expect 2–3 edge cases (circular deps, shape rendering bugs). |
| **Testing / polish / bug fixes** | 3–6 hours | Dimension text overlap, grid spacing, edge cases (0 parts, 1 part, 100+ ×N, etc.). |

**Total: 44–65 hours = 5.5–8 days (1 dev full-time).**

Spec claims **2–3 days** = 16–24 hours.

**Verdict: ⚠️ Spec is optimistic by ~2.5–3×. Realistic Phase 1 is 5–6 days, not 2–3.**

Why the gap?
- Spec writer underestimated SVG dimension routing (6–12 hours for professional layout).
- Spec assumes OrthoView mutation is trivial; it's not (3–4 hours of safe refactoring).
- Spec doesn't account for edge case fixes during audit (4–8 hours per shape quirk).

---

## Recommendation

**Spec is correct in intent (zero件圖 feature is needed), but execution plan is bloated and timeline is wrong.**

### Option A (rewrite + replan) **Recommended**
- Cut §3.2–3.3 drafting standards to 1 paragraph → Phase 2 detail spec later.
- Cut §5 hard-part rendering entirely → create separate Phase 3 spec.
- Cut §10–12 (doc sync, verification, risk table) → move to implementation task checklist.
- Rewrite §9 Phase 1 estimate to **5–6 days** and be explicit about dimension routing being the long pole.
- Rewrite §4 to split "Phase 1 state" vs "Phase 1+2 final state" clearly.
- Fix template count (32, not 26) and print page line numbers (223–225, not 223–226).
- Result: Spec shrinks to 50–60%, becomes implementation-ready.

### Option B (keep as-is, treat as "vision doc")
- Keep full spec as long-term vision + forward-looking.
- Create separate "Phase 1 implementation spec" that cites this, carves out MVP scope.
- Phase 1 spec: predicate + merge + OrthoView extend + basic 3-view + T1+T2 dims + grid layout only. No §5, no §10–12.
- Phase 2 spec: wood grain arrows, orientation marks, 3D hints, title block bottom, callout syntax.
- Phase 3 spec: 7 shape silhouettes, hard-part rendering, 1×2 grid switch, local zoom figures.

**My call: Go with Option A.** This is a single-dev side project (not a 10-person enterprise team writing v1.0 spec for years of maintenance). Shorter, clearer specs iterate faster. Rewrite the spec to Phase 1 MVP only (~2000 words), save the rest for post-Phase-1 planning.

---

## Top 3 fixes if you only do 3 things

1. **Rewrite §9 Phase 1 estimate to 5–6 days, itemized by task**, and note that dimension routing + SVG layout is the long pole (6–12 hours). Current "2–3 day" claim is off by 2–3×.

2. **Split §4 into two substeps: "Phase 1 minimal state" (3-view + T1+T2 dims + basic title) vs "Phase 1+2 final state" (add wood grain, orientation, 3D install hint).** Current spec confuses readers about MVP scope.

3. **Cut §5 hard-part rendering + §5.1 silhouette gaps entirely.** Move to standalone Phase 3 spec. Phase 1 uses AABB fallback (shipped and correct). Trying to spec all 7 workarounds upfront locks implementation and adds 3+ days of work that doesn't ship Phase 1. Defer.

**Bonus (if time): Fix template count (32, not 26) and print page insertion point (223–225, not 223–226).**

---

## Inaccuracy summary

| Category | Count | Severity |
|----------|-------|----------|
| Factual errors (code vs spec) | 4 | 🟡 Medium (template count, line numbers, OrthoView type, shape count) |
| Internal contradictions | 3 | 🟡 Medium (Phase scope, grid switching rule, title block) |
| Missing critical details | 5 | 🟡 Medium (empty section, merge limits, part ordering, insertion point, isolatePartId flow) |
| Over-engineering (Phase 2+ bloat) | 6 sections | 🔴 High (35–40% of spec) |
| Timeline estimate error | 1 | 🔴 High (2–3 days claimed; 5–6 realistic) |

**Net verdict: Spec is 80% directionally correct, 40% bloat, Phase 1 timeline 2.5–3× optimistic. Viable after scope carve-out and timeline adjustment.**
