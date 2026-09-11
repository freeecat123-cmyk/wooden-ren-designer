# Class C Q1 verification, 2026-09-09

Scope: the implemented `cert-c1` template, question 01200-100301. This is not
certification of all Class C questions, nor approval of the Class B study model.

## Evidence and changes

Reference: Workforce Development Agency public reference packet
https://owinform.wdasec.gov.tw/owInform/DLowFile/012003B15.pdf,
Q1 drawing on PDF page 12 (printed page 10), drawing revision 114/06/18.
Original drawings were inspected internally, not embedded in the application.

1. Back rail: the 30 dimension spans the hole centers; the lower hole is 10
   above the bottom of the 50-high rail. Independent calculation gives top
   offsets 10 and 40, not 30 and 40. Default world heights are 325 and 295.
   Regression tests independently check rail holes, side holes and dowel rods.
   The old code failed at 305 instead of 325 before the change.
2. Front lip: enlarged A-A section shows R3 at the corners of its 12 x 18
   section. Added the existing rounded longitudinal-edge profile, retaining
   stock dimensions and the existing end joints.
3. Shelf: the exposed tips require 3 x 45-degree bevels. Added optional shared
   tip rings for preview, orthographic projection and dimensional joinery
   export. No shoulder or stock-length change. Flush practice variants have
   no bevel inside the side panels. Added part-drawing notes and per-tip work
   estimates; the estimate is not an official examination time allocation.
4. Back-panel removal now warns that the open frame is not the full exam piece.
5. Catalog and SEO descriptions no longer call the irregular side a trapezoid
   or right-angled quadrilateral.

## Unresolved source differences (not guessed)

- Stock list: screw diameter 2.4; drawing: diameter 3. Both give length 15 and
  count 10. Both values are preserved with a source-discrepancy note.
- Supply gives 12 dowels; the interpreted drawing locates 8. No invented extra
  four positions.
- Lower rail direct elevation 80 versus the chained sum 81 remains documented
  in the template; this audit does not silently change it.

## Verification

- Red/green regressions for hole coordinates, missing R3 profile, absent-panel
  warning and missing tip bevel.
- Exact shoulder/tip geometry, finite dimensional export, mirrored ends,
  flush variant, orthographic output, grouping, localized work steps and
  quantity-scaled time estimates covered in tests.
- Desktop 1440 x 1000 and iPhone 13 browser checks: nonblank canvas, changed
  pixels after camera interaction, and visible 3D canvas on the Materials tab.
- Overlap audit: no new/increased pairs, 230/239 global cases clean. The nine
  existing non-Class-C residue cases are not represented as newly fixed.
- Joint audit: non-allowlisted cases pass (155/173).
- Machining audit: 20,165 drawings checked; no out-of-bounds machining lines.
- Template-pack audit: 3,670 faces / 8,282 A4 pages, zero issue categories.

Changes remain local until a separate commit/push/deployment action.
