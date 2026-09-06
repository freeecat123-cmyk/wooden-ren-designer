# Furniture Generator Memory

## 2026-09-07 Design Studio Renewal (Specification)

- User approved a full interface/workflow renewal: large central model,
  collapsible desktop side panels, mobile bottom sheets, design management,
  selection inspector and integrated drawings/materials/build/quote views.
- Preserve existing geometry, old designs, URLs, entitlements and explicit cloud
  saves. This is separate from the already released integrated upgrade below.
- Written scope: docs/superpowers/specs/2026-09-07-design-studio-renewal.md.
  Specification awaiting review; implementation and deployment not yet performed.

## 2026-09-07 Integrated Upgrade (Released)

- User approved completing geometry, machining exports, fixed sharing and
  desktop/mobile workbench controls continuously, preserving all old designs.
- Explicitly approved shared rear frame rebate and cabinet inside-post shoulder
  spans. New construction uses version 2; direct template defaults remain 1.
  Legacy snapshots/parameterized links must not silently upgrade. See A10.15.
- New designs must serialize actual parameters on first save; appending only
  designId to a blank URL incorrectly changes v2 back to v1. Form blur/timers
  must retain the latest saved revision, and undo rebasing must retain the
  original blank-page version semantics.
- Private design-shares Storage bucket provisioned; no SQL migration needed.
  Explicit publication stores an immutable signed-model projection; owner
  revocation is rechecked without caching. See lib/design-sharing/README.md.
- Live disposable design save/publish/update/revoke passed: saved model changed
  from 170mm to 180mm while publication stayed 170mm; anonymous API returned 404
  after revocation, and reload showed the revoked state. Existing designs untouched.
- 29 default templates / 514 full part records match pre-upgrade ff7d1d9d exactly;
  165 legacy leg fingerprints still match. Revised audit now 236/236 clean,
  with legacy baseline left intact. Unsupported unsafe excavation retains warnings.
- Shared explicit construction boxes feed preview, CNC and dimensional exports.
  Never apply shaped splay correction again to an explicit construction box.
  Aggregate stock checks include X/Z boundaries, not only interval midpoints;
  opposing cuts can sever a part even if each cutter independently leaves stock.
- Accurate exports require the unstripped raw model, including frozen raw snapshots.
  Printable simplifications remain separate; unsupported accurate geometry fails closed.
- Sharing preserves only allowlisted louver semantic labels, never free-form label
  suffixes. Reset dirty/pending state on a genuine design switch, not save-as sync.
  Analytics drops capability-link page events. Private Storage policies must not grant
  anonymous/authenticated object access; never publish or sign bucket URLs.
- Desktop workbench groups retain hidden option values just like mobile. Save URL
  canonicalization is not an undo step; a pending save must honor Reset key deletions
  and blank-v2 semantics. These races have real Chromium component regressions.
- Local full verify: 1506 tests passed, all audits passed; production build passed.
  Enabling export-browser coverage gives 1507/1507. CI now installs Chromium and
  enables that coverage rather than skipping it on the runner.
- Released application `4256c742`, CI follow-up `6b662f68`. Geometry Audit
  34050772406 and Verify 34050929344 passed; Vercel confirmed both deployments.
  Production desktop/mobile zh/en checks passed (one zh desktop navigation timeout
  passed isolated retry). Live production immutable sharing/revocation probe passed
  and removed its three synthetic objects. See the integrated-upgrade plan.

## 2026-09-06 Rectangular Cut Audit Follow-up

- Recognize only complete rectangular cutter coverage, including blind rebates
  and complementary half-laps. Renderer ZYX stock bounds must agree with audit
  bounds before cuts qualify; no rotation-convention or template changes.
- Tightened baseline by exactly 117 reviewed pairs: wine-rack 42, plywood laps
  62, deadman rails 12, box lid 1. Remaining 11 cases / 277 pairs supersede the
  earlier counts below. Workbench deadman-board versus under-shelf stays flagged.
- Missing/shallow/shifted/same-side/gapped cuts have negative controls. Actual
  wine-rack CSG mesh volumes and ray occupancy verified at renderer scale 0.01;
  do not claim the simplified STL exporter includes machining.
- Full local verify: 1236 tests / 77 files, typecheck and all audits passed.
  Production build passed. Deployment status must be checked separately.
- Photo-frame construction choice and Chinese-cabinet rail convention remain
  unresolved; generic continuation does not pick a conflicting specification.

## 2026-09-06 Saved Model Compatibility

- Signed schema-v1 model snapshots in params._modelSnapshot, owned loading,
  atomic history restore, invalid/stale rejection and explicit legacy fallback.
  See docs/phase-one-completion.md for key rotation and public-sharing limits.
- Actual Chrome save/reopen/edit/restore verified on the existing test design;
  four output routes retain 500 x 350 x 400mm / 17 parts. Admin output gates now
  match existing verified admin entitlement, without changing member plans.
- Project rebuilding now flattens nested options and respects assembly mode and
  signed models. Client estimates are not authoritative signature checks.
- Mobile report control no longer floats over editor controls. Real desktop/mobile
  editing fixtures and iPhone slider/advanced-sheet checks passed.
- Output review caught stale USD cookie overriding Chinese server quote currency
  while client terms used TWD; align with existing locale policy, regression tested.
- Geometry still 30 warning cases / 394 pairs, not 394 proven defects. Photo-frame
  confirmed missing rebate needs user's construction decision; not silently fixed.
  This is not a declaration that the full phase is complete.

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
