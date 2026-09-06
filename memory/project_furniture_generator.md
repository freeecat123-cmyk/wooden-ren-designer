# Furniture Generator Memory

- Workbench corner-notch audit follow-up: actual mesh and four template variants
  verified with missing-cut controls. Fixed cap fans spanning concave cutouts
  using Earcut; blank sizes/outlines unchanged. 16 cleared pairs removed; 30
  warning cases/394 pairs remain. Recognize only common
  2D/3D unclamped range <=45%; oversized-notch discrepancy remains documented.

## 2026-09-06 Autonomous Phase-One Follow-up

- Successfully completed real authenticated cloud verification on localhost:3108:
  created test design da0e7fab-11b7-4d41-aa44-4d4490a87e3d, saved 500mm, updated to
  550mm, reopened from My Designs in a new tab (550mm persisted), restored original
  snapshot (500mm persisted). Existing design untouched. Supersedes prior blocked
  cloud-test notes. Test deletion approval requested; not deployed publicly.

- Actual local Chrome session was signed in. Test creation failed with free-plan
  one-design quota despite admin UI entitlement. Fixed create API quota to honor
  existing server-verified admin status; no subscription/profile mutation.
  Added admin/free/unauthenticated route tests. Browser connection failed before
  retry, so no test row created and actual successful save/reopen remains pending.
- Fixed worldAABB/partAabbAtY side-view sign conversion, with hand-calculated
  off-center bounds tests. Does not change template or rendering conventions;
  236-case overlap baseline results unchanged (32 warning cases).

- User requested continuing without waiting for another instruction after every item.
- Added real-component desktop/iPhone fixture harness `scripts/verify-design-editing.mjs`.
  Reproduced and fixed stale device drafts after undo and redundant repeated save
  requests after a confirmed save. Pending-save edits and Save As history migration
  verified. Auth/API are mocked; no production data changed.
- Wine-rack cutter tests: seven leg styles x three grid/thickness combinations,
  with missing/shifted/same-side negative controls. Existing 42 warning pairs remain
  in baseline; cutter coverage is not a full CSG/export proof.
- Recorded existing renderer ZYX vs historical OBB XYZ discrepancy without changing
  conventions. Existing 3D exports intentionally omit mortise subtraction.

## 2026-09-05 Phase One Upgrade

- Tea-table follow-up authorized by user continuing: added silhouette-derived through clearance notches with 0.5mm clearance; original blank sizes/positions unchanged. Six variants / 24 overlaps resolved (32 warning cases remain). Both shelf orientations covered with missing-cut negative controls. One saved tea-table record exists (read-only count); no database writes. Local only, not deployed.

- Geometry follow-up: tightened overlap exceptions to exact pair/depth baselines (`scripts/overlap-baseline.json`). Found a real tea-table defect: six variants / 24 leg-slat collisions, despite stale "notched corners" comments; default slats have no notch or mortises. Asked user to choose end notches (recommended, blank sizes/layout preserved) versus shortened slats. Geometry remains unchanged pending that choice. Review table: `docs/overlap-review-2026-09-05.md`.

- Follow-up: existing `design_versions` table and snapshot trigger were discovered (14 rows confirmed by read-only live query). Added owned-history GET and atomic restore POST at `/api/designs/[id]/versions`, plus desktop/mobile history dialog. No schema migration needed. Restore uses current template geometry; historical template pinning remains pending. API and UI tests use fixtures; no customer design was restored during verification.

- Implemented initial reliability changes locally; not deployed: latest-record reopening via `loadSaved=1`, `updated_at` compare-and-swap for saves, complete designer-mode persistence on desktop/mobile, dirty status, device draft recovery, save-response navigation guards.
- My Designs must fetch the owned cloud record on open. `revision` must survive form submissions and undo/redo, but must not itself create a history entry.
- Mobile 3D stays sticky only while advanced settings are open; ordinary scrolling must not cover save/undo controls.
- Tests exclude `.claude` worktree copies. Existing overlap audit has 38 baseline warning cases; a successful audit is not proof that every model is geometrically clean.
- Remaining first-phase work: cloud version history/template snapshots, full workbench interaction redesign, classify and resolve existing geometric warnings, authenticated cloud end-to-end verification.

## 2026-06-25

- Saved design UX decision: "Save design" updates the currently opened cloud design when the URL has `designId`; "Save as new" creates a separate design record. Repeatedly pressing save on the same design must not create duplicates.
- Opening a design from "My Designs" should preserve the full saved params, including nested template `options`, and include `designId` in the URL so later saves update the same row.
- Undo/redo phase 1 decision: add page-local parameter history only. "Undo" and "Redo" navigate URL parameter snapshots in the current tab/session; they do not create saved design records or database versions.
