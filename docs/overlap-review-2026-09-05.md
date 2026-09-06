# Overlap review

Latest follow-up: workbench cap fan triangulation incorrectly filled concave
corner cuts. Earcut now preserves these openings; the audit recognizes 16
cleared pairs, leaving 30 warning cases / 394 pairs. Four actual variants and
mesh rays, winding and cap area are tested; removing cuts restores warnings.
Template dimensions and outlines remain unchanged. Oversized notches remain unclassified
because existing 2D/3D clamps differ (45% vs 47.5%).

236 template/variant cases: 198 clean, 38 with recorded intersections (434 pairs).
Initial review did not change geometry. Follow-up now resolves tea-table's
24 pairs with clearance notches: 204 clean cases, 32 warnings, 410 pairs remain.
Saved design records were not modified.

| Category | Cases | Pairs | Finding |
| --- | ---: | ---: | --- |
| tea-table | 6 | 24 | Confirmed missing clearance cuts. Shelf slats are solid, with no notch shape or mortises. |
| wine-rack | 7 | 42 | Rectangular cutter coverage now tested in renderer world coordinates for seven leg styles and three grid/thickness combinations. Not a full CSG/export validation. |
| chinese-cabinet | 4 | 240 | Frame/panel and post intersections; individual machining coverage still requires review. |
| workbench | 15 | 91 | Mixed laminated joints, sliding support grooves and shelf cases; individual coverage still requires review. |
| desk | 1 | 12 | Round splayed leg/apron contact; requires geometric review. |
| dovetail-box | 1 | 7 | Dovetail wall and lid intersections; requires machining review. |
| coat-rack | 1 | 6 | Rotated feet and hooks against a round column; requires geometric review. |
| stool | 1 | 4 | Two-way curved-leg joint region; requires machining review. |
| round-table | 1 | 4 | Pedestal contact; requires geometric review. |
| photo-frame | 1 | 4 | Back panel/frame contact; requires machining review. |

## Confirmed tea-table defect

Default box legs: `leg-1/2` intersect `shelf-slat-1`, and `leg-3/4` intersect
`shelf-slat-4`. Each measured intersection is 36 x 18 x 14mm. The slat is
472 x 60 x 18mm; its builder emits neither a notch shape nor any mortises.
The old "notched corners" exception is stale. The same builder supplies all
six reported tea-table variants. Their measured intersection depths differ.

User continued with the recommended end notches, retaining blank sizes and
layout. Cuts follow each leg silhouette with 0.5mm internal clearance and are
included in machining data and the cutting steps. Both slat orientations are
regression tested, including a negative control that removes the cuts.

## Regression guard

The former category/variant-wide exception could hide additional collisions.
The audit now records exact part-pair ids and intersection bounds, rejecting
new pairs or increased depth even within an exempt template. The remaining 410
pairs are a regression baseline, not a declaration that those joints are sound.
Injected duplicate tabletop in the tea-table case correctly exits 1.

## Wine-rack follow-up (2026-09-06)

`lib/geometry/wine-rack-half-lap.test.ts` verifies each crossing's two cutters
cover its full X/Y section and complementary Z halves. Checks use actual
`mortiseLocalBox` data and PerspectiveView's explicit Three.js `ZYX` Euler order.
Missing, shifted and same-side cuts are rejected by negative controls. No
template geometry or warning baselines were changed for this review.

The older OBB paragraph in drafting-math names Three.js `XYZ`, while the current
renderer explicitly uses `ZYX`. This discrepancy is recorded, not resolved by
changing the established renderer or OBB convention in this task. The new test
checks the renderer's existing behavior; it does not establish cross-output
rotation consistency. Simplified 3D exports also omit mortise subtraction.
