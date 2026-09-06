# Integrated Blueprint Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Track each independently testable deliverable below.

**Goal:** Complete the four approved upgrade areas without changing legacy designs.

**Architecture:** Retain the parameterized catalog and signed model snapshots.
Add explicit construction versions, shared machining primitives and private-to-public
snapshot publication with revocation. Keep UI and geometry responsibilities separate.

**Tech Stack:** Next.js 16, React, TypeScript, Three.js/three-bvh-csg, Supabase, Vitest, Playwright.

**Spec:** docs/superpowers/specs/2026-09-07-integrated-upgrade-design.md

## Global Constraints

- No customer design overwrite or deletion; no blanket collision exemptions.
- Legacy template defaults and saved snapshots remain unchanged.
- Read drafting-math sections A10, AU16/AU23 before related geometry edits.
- Each worker owns disjoint files; only coordinator edits global docs/baselines and deploys.

## 1. Construction Version and Approved Frame/Cabinet Fixes

Files: lib/design/parse-search-params.ts, saved-query.ts, model-snapshot.ts;
lib/templates/photo-frame.ts, chinese-cabinet.ts; new version/geometry tests.
Interface: options.constructionVersion is "1" or "2"; absent direct-template input
means "1". Existing option serialization carries explicit versions across outputs.

- [x] Write tests for legacy saved queries and version round trips; confirm red.
- [x] Implement version selection and explicit upgrade UI using schema options.
- [x] Add numerical tests for frame rear rebate and cabinet shoulder spans.
- [x] Implement approved version-2 construction, retain version-1 fingerprints.
- [x] Check affected saved-record counts read-only; test all six downstream outputs.

## 2. Remaining Geometry Review

Files: remaining affected templates, lib/geometry, focused tests. No baseline edits by workers.
Interface: same constructionVersion option; default v1, fixes opt in v2.

- [x] Reproduce each remaining pair and identify shape/machining cause.
- [x] Add negative controls and either strict shape coverage or real v2 machining.
- [x] Retain warnings where evidence does not establish clearance.
- [x] Coordinator reviews pair-level evidence and updates current/legacy audits separately.

## 3. Machining Export

Files: lib/export/three-d-export.ts, flat-layout.ts; shared lib/render machining helper;
components/PerspectiveView.tsx; focused tests.
Interface: reusable unit-aware subtractMortisesFromGeometry and explicit export mode.

- [x] Tests show missing cuts in export, rotated cuts and invalid geometry handling.
- [x] Extract actual renderer primitive without changing visual behavior.
- [x] Wire dimensional machining export while preserving printable-model defaults.
- [x] Verify stock volume/cuts, positions, thin-stock behavior, all export formats.

## 4. Fixed Sharing

Files: components/design/ShareDesignButton.tsx; new owned share API, token resolver,
public read-only page, private Storage bucket and tests (no SQL migration required).
Interface: explicit create returns opaque URL; revoke invalidates token; share payload
is generated from owned signed geometry, not arbitrary client JSON.

- [x] Test ownership, unauthenticated denial, unknown/revoked token and privacy filtering.
- [x] Implement immutable publication and revocation using private Storage.
- [x] Add UI states, copy fallback and revocation; never silently publish on page load.
- [x] Verify public page renders snapshot with no editable/private navigation.

Live evidence: a disposable owned test design was saved through Chrome, published,
then updated from 170mm to 180mm overall width. The publication remained 170mm.
Owner revocation returned 404 to an unauthenticated API request; reloading the viewer
displayed the revoked state. No existing customer design was overwritten.
The test also exposed save-navigation/version races. After the fixes, updating
the same disposable design from 40mm to 45mm frame width returned its new saved
revision and loaded the matching frozen snapshot. Blank-history edge cases are
covered separately before final release.

Read-only database inventory on 2026-09-07: photo-frame 1 (this test record),
Chinese cabinet 0, workbench 0, coat rack 0, desk 4, stool 7, round table 0.
No existing customer row was changed; version-1 routing remains explicit.
Independent comparison against pre-upgrade commit ff7d1d9d in a detached
verification checkout: all 29 template defaults and 514 complete part records
have identical SHA-256 hashes. The disposable checkout was removed afterward.

## 5. Workbench Controls

Files: form/control components and new workbench-specific organization helper/tests.
Interface: existing option names, values, dependency logic and form submission retained.

- [x] Tests for every option appearing once and conditional controls staying reachable.
- [x] Group by dimensions/structure, top, base, vises, storage, machining.
- [x] Preserve hidden inputs, dirty state, undo/redo and mobile sheet behavior.
- [x] Real desktop/mobile interactions and occlusion checks.

Workbench browser evidence: Chinese/English on desktop and iPhone 13, 286
controls checked, all six groups reachable, preset/dependency/URL/history and
mobile sharing interactions passed. Canvas nonblank; no occluded controls or
page overflow. Final build must recheck areas changed after this run.

## 6. Integration and Release

- [x] Review each worker diff and run focused tests before integration.
- [x] Run npm run verify, npm run build and injected-error audits.
- [x] Run authenticated version/share workflows on disposable test data only.
- [x] Verify desktop/mobile and selected output routes against selected model.
- [x] Update drafting-math, completion checklist and project memory with evidence.
- [ ] Commit specific paths, push and verify both CI checks, Vercel and live build.

Release verification: 1506 unit/integration tests passed (110 files); the opt-in
desktop/mobile export browser test passed separately, including 3MF volume.
All legacy/revised audits passed, including 236/236 revised collision cases,
20701 revised machining SVGs and 3658 revised template faces / 8265 A4 pages.
640 oversized faces use the existing part-drawing fallback. Deliberately injected
collision, 20mm machining overflow and missing-template errors all fail correctly.
One CSG subprocess hit its 10-second guard while build and tests competed for CPU;
the full serialized verification passed without relaxing that guard.
Fresh production-build workbench rerun passed all four locale/device scenarios
and 286 controls, with nonblank canvas and no occlusion/overflow/runtime errors.
Fresh share-browser rerun passed desktop/mobile pixels, rotation, revocation,
reload and management dialog behavior. The live private-Storage probe passed
immutable create/read/revoke and anonymous isolation, then removed only its
three synthetic objects; no customer database rows were modified.
