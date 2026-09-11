# Print Preflight

- The shop-drawing print page retains its existing server-side paid/admin gate.
  It reads a saved design only with both design ID and authenticated owner ID.
- Confirmation includes the owned design name (or template name), generated model
  overall dimensions, current design warnings, and existing template-page presence.
- Saved state is matching only after comparing owned cloud parameters and revision
  through the existing snapshot query comparator. Missing/failed reads are
  unverified, not saved. Matching parameters do not certify template geometry.
- Parameter-only legacy records fill missing fields with current template
  defaults before comparison, as reopening them does. The legacy construction
  version stays 1. Signed model snapshots retain strict comparison; they do not
  gain new defaults. No stored parameters are written by this check.
- Engineering drawings must be read by their dimension labels. Existing 1:1 pages
  require 100% printing, no fit-to-page, and physical dimensional verification.
  This change does not alter any diagram scale, model geometry or access rights.
- Shared print controls wait for HTML images (including lazy off-screen images)
  and document fonts, then recheck immediately before invoking print. Failed or
  timed-out resources block output with a retry action. Readiness is not a full
  visual proof of diagram correctness. Native browser print shortcuts cannot be
  prevented by this control.
- Existing quote callers without preflight data keep direct printing after asset
  readiness. PDF filenames use the design name/date; afterprint restores the title.
- Browser tests cover explicit confirmation, warnings, image failures/retry, font
  loading and legacy direct printing. `scripts/verify-print-preflight.mjs` checks
  the actual component with local app CSS at mobile and desktop sizes, using mock
  metadata and a stubbed browser print call, not an authenticated customer record.

## Authenticated verification (2026-09-11)

- Local preview on port 3122, existing authenticated session: the legacy stool
  opened from My Designs reports matching at 340 x 330 x 420 mm.
- Changing only the print URL length to 341 reports changed; restoring the
  original URL reports matching again. Cloud records were not edited.
- The default cert-c1 print page without a saved reference reports unsaved.
- This verifies confirmation and parameter comparison, not physical print scale,
  actual printer output, or correctness of every drawing.

## Full regression (2026-09-11)

- Ran `RUN_EXPORT_BROWSER=1 RUN_LIBRARY_BROWSER=1 RUN_STUDIO_QUOTE_BROWSER=1 npx vitest run`:
  139 files, 1652 tests passed, none skipped.
- The opt-in library test failed twice because a strict single-element wait
  selected multiple list items. It now polls for zero items, preserving the
  account-isolation assertion without changing application behavior.
- The opt-in browser checks use isolated fixtures, not production customer data.
  Real cross-device saving and physical printer output remain acceptance checks.
- No deployment was performed as part of this verification.

## Release checks (2026-09-11)

- Production build passed with `NEXT_DIST_DIR=.next/release-verification`
  and `NODE_OPTIONS=--use-system-ca`, including TypeScript and prerendering.
- Regenerated the stale client translation namespace list using the existing
  generator; removed the unused `stylePreset` namespace. Rebuilt successfully.
- `npm run audit` passed after regeneration. This is baseline compliance, not
  zero geometry defects: legacy overlap checks retain one known-defect case;
  joint checks allow 18 known-issue combinations (155/173 non-allowlisted pass).
  Revised overlap checks report 239/239 clean. Trestle rail mortise-coordinate
  warnings remain and were not silently suppressed or changed during this work.
- `node scripts/verify-pdf-openaction.cjs` passed: sample PDF byte offsets,
  metadata and file structure remain intact after removing the open action.
- No customer records, authentication settings, or deployment targets changed.
- The post-build high-concurrency test run hit a 10-second CSG subprocess
  timeout. The unchanged machining suite passed all 22 tests in isolation.
  Re-running all opt-in tests with `--maxWorkers=2` passed; no timeout or
  geometry assertions were weakened.
