# Phase one: reliable design editing

Accepted scope: saving/reopening, undo/redo, consistent outputs, and mobile editing.

## Save contract

- My Designs opens the latest owned database record, not a cached list snapshot.
- Save updates the current id; Save As creates an independent record.
- All modes and nested options survive saving on desktop and mobile.
- Updated records return their database timestamp. Editors submit that timestamp
  as a compare-and-swap precondition; conflicts never overwrite newer content.
- Pending edits remain visibly unsaved even if an earlier request succeeds.
- Local recovery is scoped to account, template, and design; it is not cloud backup.

## Verification

- Exercise saved parameter serialization including false values and old flat options.
- Verify conflict response, auth/ownership filters, and missing records.
- Exercise editing, undo/redo, and recovery on desktop and mobile.
- Run the existing geometry/output audits before claiming engineering consistency.

## Remaining larger milestones

Historical template snapshots and the full workbench layout require separate
implementation and are not implied by device recovery or parameter version history.

## Cloud parameter history

The pre-existing `20260428_design_versions.sql` snapshots OLD params/name on
updates. The live table exists and held 14 rows during a read-only check.
`/api/designs/[id]/versions` lists only owned snapshots (20 per page), and restores
an owned snapshot with an atomic `updated_at` precondition. The existing trigger
preserves the displaced saved state. Restoring uses today's template engine;
the UI explicitly states this distinction.

Verification: six version API tests cover ownership, pagination, auth, and
conflicts. `node scripts/verify-design-versions.mjs` exercises the real component
with fixture responses on desktop and iPhone 13 (requires dev CSS output).
No real customer design was restored. Production build and typecheck passed.

## Initial verification (2026-09-05)

- 61 test files / 1,104 tests passed, including atomic save conflicts and saved-query round trips.
- Existing geometry/output audit passed its baseline, with 38 overlap-warning cases still requiring review.
- Desktop and iPhone 13: dimension edit, undo, redo passed; mobile device draft recovery passed; no horizontal overflow.
- Production build passed. Cloud save tests use a mocked database; a real authenticated cloud save/reopen remains unverified.

## Follow-up verification (2026-09-06)

### Authenticated cloud verification completed

Using the production build on localhost:3108 with the existing signed-in Chrome
session, created only `Codex 驗證暫存 20260906` (design id
`da0e7fab-11b7-4d41-aa44-4d4490a87e3d`). Initial 500 x 350 x 400mm save succeeded;
updated the same record to 550mm, opened it from My Designs in a new browser tab,
and confirmed the 550mm cloud value. Selected the original history snapshot and
restored it, confirming 500mm and saved status. This supersedes earlier notes
that successful cloud save/reopen/restore was unverified. Existing customer
designs were not edited. Test record cleanup awaits explicit deletion approval.
These changes are still local, not deployed to the public site.

- Actual signed-in browser creation exposed inconsistent admin quotas: the UI
  grants existing administrators lifetime features, but create API still applied
  the stored free profile's one-design limit. Create API now exempts only users
  validated by the existing server admin allowlist, matching category checks.
  Regression tests retain the free-account quota and authentication requirement.
- The real test creation was rejected before insert. Browser control then lost
  connection; successful cloud create/update/reopen/restore remains unverified.
  No test row was created, and no existing customer design was changed.
- Corrected side-view world-Z conversion in audit bounds/slices. Three new tests
  include off-center positive/negative coordinates and translation invariance.
  Geometry warning baseline remains 32 cases; no baseline regeneration needed.

- `node scripts/verify-design-editing.mjs` runs the real save/history/recovery
  components with deterministic navigation, auth and API fixtures on desktop and
  iPhone 13. Covers abandoned-draft cleanup after undo, repeated save requests,
  edits during a pending save, Save As identity and revision-preserving undo.
- The harness initially failed on stale drafts and duplicate save requests.
  Recovery now removes the abandoned draft when returning to the initial state.
  Save skips repeated requests only after a matching successful response in the
  current editor; URL parameters alone are not trusted as cloud confirmation.
- Tea-table clearance fixes retain original blank dimensions and positions;
  24 intersections resolved, leaving 32 baseline warning cases.
- Wine-rack half-lap tests verify complementary rectangular cutter coverage for
  seven leg styles and three grid/thickness combinations, with negative controls.
  This is machining-data coverage, not end-to-end CSG or exported-mesh validation.
- `partExportGeometry` currently omits mortise subtraction intentionally. Existing
  STL/OBJ/3MF exports are simplified models, not machining-ready joint geometry.
- Real authenticated cloud save/reopen and production deployment remain outside
  these fixture-based results. No customer design record was written or restored.
