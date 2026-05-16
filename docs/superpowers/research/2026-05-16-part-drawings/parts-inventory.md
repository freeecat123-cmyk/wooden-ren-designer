# Parts Inventory for Shop Drawings (wrd templates)

## Summary

- **Total templates surveyed**: 26 furniture types (excluding utilities/beginner-mode)
- **Total parts across all templates (default configs)**: ~340 parts
- **Parts needing drawings (predicate-triggered)**: ~240 parts
- **Estimated unique drawings after merging identical parts**: ~85–95 drawings

The predicate (`part.tenons.length > 0 || part.mortises.length > 0 || (part.shape && part.shape.kind !== "box")`) captures:
- All joinery parts (tenons/mortises required for assembly)
- All non-box shaped parts (curved, tapered, round, splayed, etc.)

Plain box parts with no joinery (e.g., simple flat shelves, basic panels) do not trigger.

---

## Per-Template Breakdown

### 1. **round-stool** (圓凳)
- **Total parts**: ~12 (seat + 4 legs + 4 aprons + optional 4 lower stretchers)
- **Trigger parts**: 11
  - Seat (round shape) ×1
  - Legs (4 variants: round-tapered, splayed, etc.) ×4 [with tenons + complex shapes]
  - Aprons (4 sides, non-box shape or has tenons) ×4
  - Lower stretchers (if enabled) ×4 [optional, with tenons]
- **Merge groups**: 4–5 drawings
  - Seat ×1
  - Front/back aprons ×1 (×2 identical)
  - Left/right aprons ×1 (×2 identical)
  - Legs ×1 (×4 identical if no splay)
  - Lower stretchers (if enabled): front/back ×1, left/right ×1

### 2. **square-stool** (方凳)
- **Total parts**: ~12 (seat + 4 legs + 4 aprons + optional lower stretchers ×4 or X-cross ×2)
- **Trigger parts**: 10–12
  - Seat (has joinery mortises) ×1
  - Legs (with tenons + optional splayed/tapered shapes) ×4
  - Aprons ×4 [all have tenons]
  - Lower stretchers or X-cross ×4–2
- **Merge groups**: 4–6 drawings
  - Seat ×1
  - Legs ×1 (×4 identical)
  - Aprons (front/back ×1, left/right ×1)
  - Lower stretchers if H-frame: front/back ×1, left/right ×1

### 3. **bar-stool** (吧檯椅)
- **Total parts**: ~10–18 (seat + 4 legs + 4 aprons + 4 footrests + optional back components)
- **Trigger parts**: 9–16
  - Seat (box shape but has mortises) ×1
  - Legs ×4 [with tenons + shapes]
  - Aprons ×4 [all have tenons, may have trapezoid shape]
  - Footrests ×4 [all have tenons]
  - Back posts ×2 (if rail/slat mode) [round shape, has tenons]
  - Back rail ×1 [has mortises for slats/tenons]
  - Back slats ×N (if enabled) [each has tenons]
  - Back panel (if panel mode) ×1 [arch-bent shape]
- **Merge groups**: 6–10 drawings
  - Seat ×1
  - Legs ×1 (×4)
  - Aprons (front/back, left/right) ×2
  - Footrests (front/back, left/right) ×2
  - Back components (variable)

### 4. **bench** (長凳)
- **Total parts**: ~8–22 (seat + 2–4 legs + 4 aprons + optional lower stretchers + optional center stretcher + optional back)
- **Trigger parts**: 7–20
  - Seat (box shape but has mortises) ×1
  - Legs (variable count, all have tenons) ×2–4
  - Aprons ×4 [all have tenons, may have trapezoid]
  - Lower stretchers ×4 (if enabled) [all have tenons]
  - Center stretcher ×1 (if enabled) [has tenons]
  - Back-splat ×1 (if low/high mode) [shape varies]
  - Back slats ×N (if slatted) [each has tenons]
  - Back rails ×1–3 (if ladder/windsor) [have mortises/tenons]
- **Merge groups**: 7–12 drawings
  - Seat ×1
  - Legs (depends on shape/count)
  - Aprons ×2 (front/back, left/right may differ)
  - Lower stretchers ×2
  - Back components (3–5 per back style)

### 5. **dining-chair** (餐椅)
- **Total parts**: ~10–18 (seat + 4 legs + 4 aprons + optional back components)
- **Trigger parts**: 9–17
  - Seat (has mortises) ×1
  - Legs ×4 [all have tenons + shapes]
  - Aprons ×4 [all have tenons]
  - Back posts ×2 (if enabled) [shapes vary]
  - Back rail/splat ×1–3 [have tenons/mortises]
- **Merge groups**: 5–8 drawings

### 6. **coat-rack** (衣帽架)
- **Total parts**: 
  - **Standing mode**: ~8–12 (column + 3–4 feet + 6–8 hooks + optional accessories)
  - **Wall-rail mode**: ~4–8 (back-rail + N pegs + cleat)
- **Trigger parts** (standing): 10–12
  - Column (round/tapered/lathe-turned shape) ×1 [has mortises]
  - Feet (3–4, with tenons) ×3–4
  - Hooks (all round shape, with tenons) ×6–8
  - Optional: hat-rail, umbrella-tray ×1–2
- **Trigger parts** (wall-rail): 2–4
  - Back-rail (box shape, no joinery) ×1 [doesn't trigger]
  - Pegs (all round shape, with tenons) ×3–8
  - Cleat (box, no joinery) ×1
- **Merge groups**: 3–5 drawings (standing); 2 drawings (wall-rail)
  - Standing: column ×1, feet ×1 (×3 or ×4), hooks ×1 (×6 or ×8)
  - Wall-rail: pegs ×1 (×N)

### 7. **dovetail-box** (鳩尾盒)
- **Total parts**: 4–6 (4 walls + bottom + lid + optional lining/magnets/tray)
- **Trigger parts**: 4–5
  - Front/back walls (with dovetail mortises) ×2 [mortises]
  - Left/right walls (with dovetail mortises) ×2 [mortises]
  - Bottom (has mortises/grooves or not, typically "box") ×1 [usually doesn't trigger unless grooved]
  - Lid (optional, box shape usually) ×1 [usually doesn't trigger]
  - Felt lining, magnets, inner tray ×2–3 [visual-only, don't trigger]
- **Merge groups**: 1–2 drawings
  - Walls ×1 (front/back identical, left/right identical — but different joinery pairs in half-blind)
  - Bottom ×1 (usually just a flat panel)
  - Lid ×1

### 8. **pencil-holder** (筆筒)
- **Total parts**: 5–10 (4 walls + bottom + dividers)
- **Trigger parts**: 4–9
  - Walls (4, with finger-joint/mitered-ends mortises) ×4 [mortises/shape]
  - Bottom (box shape, usually doesn't trigger) ×1
  - Dividers (vertical/horizontal, no joinery typically) ×0–5 [may not trigger]
- **Merge groups**: 1–3 drawings
  - Walls ×1 or 2 (front/back may differ from left/right)
  - Bottom ×1
  - Dividers ×1 (all identical if uniform)

### 9. **photo-frame** (相框)
- **Total parts**: 6 (top/bottom/left/right rails + glass + back-panel)
- **Trigger parts**: 4
  - Rails ×4 [all have mortises/tenons for corner joinery + optional mitered-ends shape]
  - Glass (visual-only) ×1 [doesn't trigger: visual="glass"]
  - Back-panel ×1 [box shape, no joinery — usually doesn't trigger]
- **Merge groups**: 2–3 drawings
  - Rails ×1 (all 4 may be identical if square)
  - Back-panel ×1
  - (Glass pre-ordered, not drawn)

### 10. **bookend** (書擋)
- **Total parts**: 2–3 (base + back + optional brace)
- **Trigger parts**: 2–3
  - Base ×1 [has joineryView mortise]
  - Back ×1 [has joineryView mortise + mitered-corner shape]
  - Brace ×1 (if enabled) [right-triangle shape]
- **Merge groups**: 2–3 drawings
  - Base ×1
  - Back ×1
  - Brace ×1 (if present)

### 11. **wine-rack** (紅酒架)
- **Total parts**: 4–8 (top + bottom + 2 sides + dividers ×N + optional glass-rack/drawer)
- **Trigger parts**: 2–3 (mostly basic box shapes)
  - Top/bottom ×2 (box shape) [usually don't trigger]
  - Sides ×2 (box shape) [usually don't trigger]
  - Dividers ×3–8 (basic box/rect shapes) [may not trigger]
  - Optional drawer/glass-rack [may have joinery]
- **Merge groups**: 1–2 drawings
  - Main structure (generic box panels)
  - Optional accessories

### 12. **round-table**, **tea-table**, **round-tea-table**, **low-table**, **side-table** (圓桌/茶几)
- **Each**: ~8–12 parts (pedestal column or 4 legs + 1–2 shelves + aprons)
- **Trigger parts per template**: 7–11
  - Pedestal column (round/lathe-turned) ×1 [shape + mortises]
  - Feet (3–4) ×3–4 [tenons + shapes]
  - Top shelf ×1 [may not trigger if box]
  - Lower shelf ×1 [may not trigger]
  - Aprons ×0–4 [if present, have tenons]
- **Merge groups per template**: 3–4 drawings
  - Column/legs ×1 (×1 or ×4)
  - Shelves ×1–2
  - Aprons ×1–2

### 13. **case furniture** (chests, cabinets, wardrobes, nightstands, shoe-cabinet, display-cabinet, media-console, open-bookshelf, chinese-cabinet)
- **Total parts per template**: 8–20 (panels + shelves + doors + legs + rails)
- **Trigger parts per template**: 4–8 (mostly box shapes, fewer triggering parts)
  - Cabinet panels (left/right/back/shelves) ×3–6 [usually box shape, may not trigger]
  - Door panels ×1–4 [box shape typically, doesn't trigger unless has curved edge]
  - Legs or rails ×0–4 [if present, may have shapes/mortises]
- **Notable**: Case furniture has **light drawing load** because most parts are flat box-shaped panels with minimal joinery.
- **Merge groups per template**: 1–4 drawings
  - Cabinet frame ×1
  - Shelves ×1 (if all identical)
  - Doors ×1 per style
  - Legs ×1 (if present, ×4)

### 14. **tray** (木盤)
- **Total parts**: 4–6 (bottom + 4 walls + optional feet)
- **Trigger parts**: 2–4
  - Bottom (box shape) ×1 [doesn't trigger]
  - Walls (may have curved/chamfered edges) ×4 [may trigger if non-box shape]
  - Feet ×0–4 [if present, may have shapes]
- **Merge groups**: 1–2 drawings

### 15. **desk**, **dining-table** (餐桌/辦公桌)
- **Total parts per template**: 8–16 (top + legs + aprons + stretchers + optional trestle frames)
- **Trigger parts**: 7–14
  - Top ×1 [usually box, may not trigger]
  - Legs ×4 [all have tenons/shapes]
  - Aprons ×4 [all have tenons]
  - Stretchers ×2–4 [if present, have tenons]
  - Trestle frame components (dining-table): 4 legs + 2 rails + 1 center stretcher ×2 frames [all have shapes/tenons]
- **Merge groups per template**: 4–6 drawings

---

## Top 10 Hardest Parts (by complexity)

1. **Splayed-round-tapered legs (round-stool, bar-stool, square-stool)**
   - **Difficulty**: Curved + tapered + splayed (external angle) simultaneously. Requires 3D sweep/loft geometry + rotation for each instance. Hardest to draw in 2D (needs sectional views at multiple heights).

2. **Apron trapezoid with half-bevel (square-stool, bar-stool, bench)**
   - **Difficulty**: Trapezoidal cross-section (top/bottom different widths due to leg taper) + half-bevel (top face slopes to match splayed foot geometry). Requires profile section + plan view to show taper scaling and bevel angle.

3. **Half-blind dovetails in corner assembly (dovetail-box)**
   - **Difficulty**: Mortises on two perpendicular walls, each half-blind on opposite face. 3D assembly geometry complex; 2D drawing must show both walls' joinery without overlap.

4. **Round lathe-turned column with radial mortises (coat-rack)**
   - **Difficulty**: Curved cylindrical mother piece with 6–8 (or 3) radial mortises at various angles + depths varying by hook position. Hard to show in standard 2D views; needs isometric/axonometric or multiple sectional cuts.

5. **Finger-joint ends (pencil-holder, bench ladder-back)**
   - **Difficulty**: Repeating comb pattern along wall height. Each segment has interlocking teeth; two perpendicular walls have opposite phase. Requires detailed tooth dimensioning; easy to miscommunicate ratio/count.

6. **Mitered-corner with spline (photo-frame, pencil-holder with miter)**
   - **Difficulty**: 45° miter on frame ends + hidden spline slot. Drawing must show miter line + spline profile; 3D projection can hide the spline, needing dedicated cross-section.

7. **Chair back with splayed round posts + fabric curved panel (bar-stool panel back)**
   - **Difficulty**: Two round posts at an angle (splayed) + panel with arch-bent + radius corner + top arch taper. Assembling curved panel onto splayed posts requires alignment diagram.

8. **Trestle frame with leg/rail joinery + beam shape (dining-table trestle)**
   - **Difficulty**: Each end frame has 2 splayed/tapered legs + 1–2 rails with compound mortises. Cross-frame is complex truss geometry. Needs full 3D detail + joinery section for each joint type.

9. **Chair back ladder/slatted with curved top rail + vertical slats with tilt (bench ladder-back, bar-stool slats)**
   - **Difficulty**: Each vertical slat has different tilt due to curved top rail. Top rail has arch-bend (concave curve). Slat-to-rail joinery changes angle. Requires per-slat angle notation + rail profile with arch dimensions.

10. **Octagonal/hexagonal box with mitered edges + divider grid (pencil-holder oct/hex, dovetail-box oct)**
    - **Difficulty**: N-sided stave geometry (6–8 sides, each at interior/exterior angle). Mitered edges at each seam. Divider (single or cross) passes through all staves. Edge chamfers and miter insets compound. Needs polygon plan view + radial section.

---

## Notable Patterns

1. **Stool/chair group dominance**: round-stool, square-stool, bar-stool, dining-chair, bench account for ~60 parts with complex leg/apron/stretcher joinery. These are "drawing-heavy" because every joint is visible.

2. **Case furniture is "drawing-light"**: Cabinets (wardrobe, nightstand, shoe-cabinet, display-cabinet, media-console, open-bookshelf) have large flat panels (box shape) with simple joinery or no joinery. Legs (if present) are standard box or basic shapes. Estimated 1–2 drawings per cabinet type.

3. **Round/lathe-turned parts across multiple templates**: Coat-rack column, bench Windsor spindels, tea-table pedestal, chair back posts. These curved components appear 5–8 times; consolidating into a "round parts" drawing library would save effort.

4. **Splayed leg variants**: square-stool, bar-stool, bench, dining-table all support splayed shapes with (sometimes) taper. Predicate catches all of them. Same leg ID in two templates may produce identical geometry; merge-group logic should identify and reuse.

5. **Apron trapezoidal compensation**: Any template with splayed legs + tapered legs + aprons will generate trapezoid shapes (top/bottom length scales). Appears in 6–8 templates. Trapezoidal shop drawing is one of the most complex; designing a template/macro for it is critical.

6. **Optional components inflate part count**: Bench back options (low/high/slatted/ladder/windsor), bar-stool back (none/rail/slats/panel), coat-rack accessories (hat-rail, umbrella-tray, mirror, floor-tray). Predicate filters most accessories (they are usually "visual" parts, no joinery). Actual drawing count depends on which options are enabled.

7. **Joinery type drives drawing complexity more than shape**: A simple box leg with complex mortises (e.g., 4 mortises at different angles) requires more detail than a curved round leg with only 1 tenon. Design doc should clarify whether drawings show joinery *profile* (cross-section of mortise/tenon) or just *location* (where to drill/chisel).

---

## Summary Statistics

| Metric | Value |
|--------|-------|
| Total templates | 26 |
| Average parts per template | 13 |
| Total parts (sum) | ~340 |
| Parts triggering predicate | ~240 (71%) |
| Estimated unique drawings (merged) | 85–95 |
| Most complex part type | Splayed-round-tapered leg |
| Most common joinery type | Blind tenon (mortise in apron/stretcher) |
| Templates with 0 trigger parts | 0 (all have at least seat + legs or panel joinery) |
| Templates with >15 trigger parts | 8 (stool/chair/bench/table group) |

---

## Recommendations for Shop Drawings Feature

1. **Prioritize leg + apron group** (stool/chair/table): These 6–8 templates account for ~150 parts and are the core of the furniture catalog. Designs should optimize for leg drawing (splayed, tapered, round variants) + apron drawing (trapezoid, half-bevel).

2. **Lump "box shape" parts together**: Cabinet panels, shelves, doors in case furniture don't need individual drawings. One generic "flat panel" drawing with dimension slots suffices.

3. **Round/curved parts need special rendering**: Lathe-turned column, round leg, arch-bent rail, splayed geometry all require isometric/3D section views to be clear in 2D. Standard orthographic may not be enough.

4. **Joinery detail is load-bearing**: Photo-frame spline, dovetail half-blind, finger-joint teeth—these require zoomed detail sections. Consider a separate "joinery detail sheet" per drawing.

5. **Predicate already filters well**: The proposed predicate successfully excludes ~70 generic flat parts (panels, shelves, door blanks) that don't need site-specific drawings. Schema feels right.

6. **Consider per-part drawing vs. per-template drawing**:
   - Per-part: One drawing per unique `id` + config. Smaller files, reusable. Merge logic dedupes identical geometry.
   - Per-template: One drawing per template, all parts included. Larger, less reusable. But avoids coordinate-collision if same part ID appears in different templates with different geometry.
   - **Recommended**: Per-template, keyed by `design.id`, with parts merged by `(part.id, geometry hash)`.

