# Design Studio Renewal Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development for independent tasks and review each completed change.

**Goal:** Deliver the approved design workspace and searchable design library without changing saved geometry.
**Architecture:** Keep server model resolution authoritative; compose responsive client shells around existing rendered content and persistence controls.
**Tech Stack:** Next.js 16, React 19, TypeScript, Three.js, Vitest, Playwright.
**Spec:** docs/superpowers/specs/2026-09-07-design-studio-renewal.md

## Global Constraints

- No geometry or pricing formula changes; preserve saved reference, revision and entitlement checks.
- Chinese and English; 360/390/768/1280/1440px acceptance.
- One primary canvas and one parameter form across responsive breakpoints.
- Explicit cloud saves; no customer data mutations for testing.
- Work on codex/design-studio-renewal; do not push or release without verified results.

## Task 1: Workspace Shell And Inspector

Files: new components/design/DesignStudio.tsx, DesignStudio.module.css,
DesignStudio.test.ts; reuse SelectedPartContext and existing parameter form.
Interface: props locale:string, design:FurnitureDesign, title:string,
toolbar:ReactNode, parameters:ReactNode, model:ReactNode, drawings:ReactNode,
materials:ReactNode, build:ReactNode, quote:ReactNode, notices?:ReactNode.

- [x] Add failing component browser tests for five views, unchanged input after
  switching views, panel collapse and mobile focus restoration.
- [x] Implement semantic tabs and panels, persistent mounted parameter/model slots,
  responsive CSS and inspector using selectedPartId. Clear stale selection.
- [x] Verify canvas slot count remains one on resizing; tab controls never submit
  the parameter form. The inspector distinguishes cut and visible dimensions.
- [x] Review tests and visual states; integrate in Task 4.

## Task 2: Design Library

Files: components/MyDesignsClient.tsx and new scoped library helpers/tests/styles.
Interface: owned rows retain id, furniture_type, name, params, created_at, updated_at;
open href remains `/design/${slug}?designId=${id}&loadSaved=1`.

- [x] Failing tests: case-insensitive search, category normalization, stable sorting,
  complete retrieval, no rows retained across account changes.
- [x] Implement toolbar filters, grid/list, recent design continuation, pending
  mutations and inline retry/error states, preserving server mutation endpoints.
- [x] Use existing truthful category images with explicit sample labels when no
  verified saved thumbnail exists; do not generate pretend saved previews.
- [x] Test responsive layouts and filtering empty states, then review.

## Task 3: Embedded Quote

Files: new components/quote/StudioQuote.tsx and focused tests; existing quote helpers.
Interface: design:FurnitureDesign, locale:string, quoteHref:string, allowed:boolean.

- [x] Add failing tests that quote values use calculateQuote and sanitized inputs,
  and locked users receive no quote data.
- [x] Build embedded cost controls around existing calculateQuote/sanitizeLaborOpts
  and existing quote form pieces where feasible, with full quote route preserved.
- [x] Retain model identity when generating full quote/print links; no iframe or
  duplicate math. Do not lose local quote settings on workspace view changes.
- [x] Verify recalculation, invalid input, permissions and final link parameters.

## Task 4: Server Page Integration

Files: app/[locale]/design/[type]/page.tsx, integration tests, scoped studio CSS.

- [x] Add regression tests for single responsive shell and protected raw exports.
- [x] Replace duplicated desktop/mobile rendering with DesignStudio slots. Keep
  existing server resolver, save/share/history controls, warnings and permissions.
- [x] Put three views and part/joint drawings in Drawings, material list in
  Materials, existing steps/tools in Build and StudioQuote in Quote.
- [x] Preserve all form options and supported geometry modes. Keep model mounted
  without a second material-preview canvas. No geometry undo on view changes.
- [x] Run legacy form/history/save/browser suites and fix regressions.

## Task 5: Acceptance

- [x] Run npm run typecheck, npm test, npm run audit and npm run build; capture each exit status.
- [x] Start a dedicated local server on an unused port. Playwright screenshots in
  both languages at required widths, nonblank/moving canvas pixels, filters,
  inspector, form editing, undo/redo and download smoke checks.
- [x] Independent whole-diff review; fix important findings and rerun scoped tests.
- [x] Update memory and this checklist with actual evidence, not predicted results.

## Execution Ledger

- Specification approved by user: "繼續" after written scope review.
- Ruling: use a new feature branch in the existing clean checkout rather than a
  new unrequested worktree; preserve all unrelated untracked files. This keeps
  installed dependencies available, at the cost of sharing the local checkout.
- Design tokens: white #ffffff, zinc #27272a, muted #71717a, border #e4e4e7,
  emerald #047857. Existing site font, 12/14/16/20px UI type, no hero styling.
- Thumbnail ruling: this release uses explicitly labeled category samples for
  records without verified captured previews; no new Storage policy or schema.
  This avoids exposing private assets, but means previews are not personalized.

## Verification Evidence (2026-09-08)

- Latest complete Vitest run: 117 files, 1528 tests passed, with
  RUN_LIBRARY_BROWSER=1, RUN_STUDIO_QUOTE_BROWSER=1 and RUN_EXPORT_BROWSER=1,
  using --maxWorkers=1. CI now enables the same browser suites.
- Live English acceptance found a 13px horizontal overflow: the new form width
  rule expanded sr-only numeric fields to viewport width. Added a failing
  real-browser regression (1440px instead of 1px), excluded sr-only fields from
  that rule, then all 8 studio browser tests passed.
- Screenshot readiness now polls actual model pixels rather than assuming two
  frames finish asynchronous texture/HDR loading. View switching also waits for
  the selected tab and restored canvas. The live-site timeout is bounded at 60s;
  the independent CSG worker timeout is unchanged.
- An earlier parallel run exposed a missing initialFit viewer wake dependency
  and a CSG worker timeout under load. Added the dependency; the focused 28-test
  run and subsequent complete run passed without relaxing the CSG timeout.
- Typecheck exit 0; production build exit 0 with NEXT_DIST_DIR=.next/studio-build.
  Default tsconfig changes generated by the isolated build were removed.
- Existing machining/template/permission audits exit 0, including revised
  construction and unchanged legacy leg fingerprints. No geometry math changed.
- verify-design-editing.mjs passed desktop and mobile undo/draft cleanup,
  unchanged repeat-save, in-flight edits, Save As and history migration. Requests
  were fixture-backed; no customer cloud records were created or changed.
- Actual browser model click selected a rear lower stretcher and displayed its
  material, visible/cut dimensions and joints in the new inspector.
- Final production-preview browser run passed both languages at 1440, 1280,
  768, 390 and 360px: nonblank wood pixels, rotation, one persistent canvas/form,
  five tabs, parameter editing, modal focus restoration, no page overflow and no
  browser errors. Screenshots: /tmp/studio-live-{locale}-{width}.png.
- Visual review covered Chinese desktop/tablet/mobile and English desktop/mobile.
  Component browser suites additionally cover library filters and embedded quote;
  the existing export-browser suite covers download rendering.
- Read-only independent review found preset-navigation stale exports,
  cross-account mutation busy state and English quote semantics. Each fixed with
  regression coverage; scoped rereview reported no outstanding findings.
- Local preview uses port 3120 and a separate build directory. Existing port
  3107 development server and unrelated user files/processes were left untouched.
- Release is not pushed or deployed. Private captured thumbnails are not part of
  this delivery; the approved fallback uses explicitly labeled category samples.
