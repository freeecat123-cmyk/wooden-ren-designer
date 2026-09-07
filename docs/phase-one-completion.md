# Phase One Completion

## Accepted Scope

Continue the existing upgrade without pausing after each release. Preserve user
data, dimensions and unrelated work. No blanket overlap exceptions.

## Acceptance Checklist

- [x] Saved model snapshots: signed server-generated raw and assembled geometry;
  owned-record loading; changed parameters use the current template; legacy
  records explicitly remain parameter-only. Restore retains the snapshot.
- [x] Owned output consistency: design, cutting, printing and quotes resolve the same
  saved geometry. Private references do not replace ownership checks.
- [x] Editing ergonomics: mobile controls remain reachable, history and save
  workflows have desktop/mobile browser regression coverage.
- [ ] Geometry review: classify the remaining 11 cases / 277 pairs individually,
  prove machining coverage or fix confirmed defects without shrinking blanks.
- [ ] Full tests, type checks, audits, build, browser checks and release checks.

## Constraints Found

- Rectangular cut coverage removed 117 verified false-positive pairs (wine-rack
  42, plywood workbench 62, deadman rails 12, box lid 1) without template changes.
  Remaining 277 pairs are unresolved warnings, not 277 confirmed defects. The
  workbench deadman rear cheek still intersects the under-shelf; keep that warning.

- Photo-frame notes specify a rear rebate but rail machining data omits it.
  Glass/back placement and stated rebate height disagree; do not invent a new
  joinery specification merely to silence the four back-panel intersections.
- Existing 2D/3D oversized corner-notch clamps and XYZ/ZYX rotation conventions
  disagree. Keep these explicitly unresolved until a convention is approved.
- Snapshots preserve model data, not historical renderer code or past pricing.
  Parameter-only historical records cannot retroactively recover lost geometry.
- Anonymous customer links cannot read a private snapshot. They still rebuild
  from query parameters; use the owner's exported PDF to share frozen drawings.
  A public immutable sharing format is not implemented in this phase.

## Verification Evidence (2026-09-06)

- Cut-audit follow-up: 1236 tests / 77 files, typecheck, all audits and production
  build passed. Injected duplicate-part collision correctly failed the audit.
  Desktop/iPhone wine-rack pages report zero overlaps; canvas pixel checks prove
  nonblank output and rotation changes (verify-cut-audit.mjs). Mobile controls
  remain reachable, including the negative fixed-overlay check. No cloud writes.

- Authenticated Chrome: existing test record saved with a model, reopened in a
  new tab at 500mm, edited/saved at 550mm, restored to the archived 500mm model.
  No customer design changed; test cleanup awaits approval.
- Four output routes opened successfully as the existing admin; design, quote,
  engineering print, cutting and quote print all showed 500 x 350 x 400mm / 17 parts.
- Desktop and iPhone real-component fixtures pass repeat-save, in-flight edits,
  undo/draft cleanup and Save As/history migration (mocked auth/API).
- iPhone real page: all three dimension sliders reachable after normal scrolling;
  ArrowRight changed 1800 to 1810mm; advanced sheet opened. Injecting the old
  fixed report-button style correctly failed the position assertion.
- Final local verification: 1217 tests / 74 files, type check, audits and production
  build passed. Currency browser checks cover stale opposite-currency cookies;
  Chinese quote and hydrated terms agree, English retains its USD DIY estimate.
  Deployment checks remain tracked separately.

## Snapshot Operations

`params._modelSnapshot` stores schema-v1 signed raw and assembled model data in
the existing JSONB column. Existing version-history triggers archive it atomically.
No SQL migration is required. Normal input remains limited to 32KB; models to 2MB.
The server rejects tampering and stale saved revisions rather than silently
substituting a different model. History lists omit large model payloads.

Signing uses `MODEL_SNAPSHOT_SIGNING_KEY` when configured, otherwise the existing
server-only `SUPABASE_SERVICE_ROLE_KEY`, with HMAC domain separation. Before key
rotation, retain old signing keys in `MODEL_SNAPSHOT_PREVIOUS_KEYS` as a JSON array
of strings (maximum ten). Keep those keys while archives signed by them exist.
Keys must never be exposed as NEXT_PUBLIC variables, logged or stored in Git.
Without a signing key, records remain parameter-only; signatures are not invented.
