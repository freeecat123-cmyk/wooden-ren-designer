# Upgrade Acceptance Status

Updated: 2026-09-11. Integrated against production commit 2e21ae91;
release validation below. No customer designs modified.

## Completed and verified

- Legacy parameter-only designs compare against expanded defaults without false
  print-preflight mismatches; changed dimensions and revisions still warn.
- Print confirmation shows generated dimensions, saved state and scale guidance.
  Image/font readiness, failure and retry behavior have browser tests.
- Double-tenon dimensions count the longest tenon at each end once. Class C1
  shelf print labels are 320 mm; ordinary stock allowance yields 332 mm.
- Stock calculations respect physical joinery dimensions. A 400 x 300 x 70 mm
  tray with 15-degree splayed walls has 433.2 mm long-wall cut length and 445 mm
  stock length, verified on the authenticated local print page.
- Dining-table trestle upper-rail sockets use valid bottom-relative Y centers.
  Tests cover three leg sizes and retain the underside opening and cut depth.
  This corrects invalid metadata, not a demonstrated misplaced 3D socket.
- Removed obsolete joint-audit exemptions for six low-table leg variants and
  two shoe-cabinet base variants after two clean reproductions. Strict audit passes.
- Regenerated client translation namespace list. Production build and complete
  project audit pass. Audit success means baseline compliance, not zero defects.
- Integration run with all three browser-test opt-ins and `--maxWorkers=2`
  passed 160 files / 1868 tests. Typecheck, production build, full project
  audit, assertion scripts and PDF OpenAction verification passed.
- Preserved newer production Class C geometry, screw positioning, mobile
  controls and drawing improvements while resolving eight overlapping files.
- Fixed the tray range warning after reproducing it in the authenticated print
  page and tests: its former 200 mm threshold rejected its own 400 mm default.
  Catalog controls and warnings now share the existing 600 x 450 x 120 limits.
- Desktop (1440 px) and mobile (390 px) material pages retain visible 3D with
  no document-level horizontal overflow. Canvas sampling found 1057 colors
  and changing the camera produced a different image.
- Main upgrade f0c3aac deployed successfully; production footer confirmed that
  build. Both GitHub Verify and Geometry Audit checks passed.

## Remaining evidence gaps

| Item | Current evidence | Required verification |
| --- | --- | --- |
| Cloud save across devices | Dedicated test fixture changed through authenticated UI from 340 to 345 mm; same database ID updated with a new revision and model snapshot; reopening from My Designs restored 345 mm. Test fixture deleted afterward | Actual second physical device still not operated; fixture creation via service API does not verify the new-design prompt |
| Physical print dimensions | PDF structure checks and print guidance pass | Print at 100%, measure reference dimensions on paper; no physical printer was operated |
| Legacy overlap baseline | Legacy photo-frame rebate is classified as a confirmed defect; revised version is clean. Other legacy overlaps include workbench deadman versus shelf | Preserve old-version appearance constraints; explicitly choose migration versus legacy geometry changes before changing stored-design behavior |
| 18 joint-audit combinations | Trestle tables, dining-chair backs, dovetail box and wine-rack intersections remain allowlisted | Distinguish actual misalignment from axis-matching limitations and non-mortise joinery; do not alter geometry merely to silence diagnostics |
| Other out-of-bounds mortise diagnostics | Audit emits side-panel coordinate warnings despite machining bounds checks passing | Identify parameter sets and validate rendered cut location independently |

Existing customer designs have not been edited to manufacture acceptance
evidence. Tests do not establish structural safety or fidelity to every exam
drawing. Unresolved rows are not claimed complete.
