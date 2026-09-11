# Design autosave

Existing named designs autosave through the existing revision-checked PATCH
endpoint after three idle seconds. New designs still require a manual naming
step; autosave never creates an unnamed design or silently saves a copy.

- One request at a time. Edits made during a request remain dirty and are saved
  after the previous request completes, using its returned revision.
- Form input and pending model navigation cancel the pending timer, so an old
  rendered model is not saved while newer parameters are still applying.
- Network, authentication, missing-revision and version-conflict failures pause
  autosave. Manual Save retries; conflicts require reopening the cloud version
  or using Save As. There is no force-overwrite fallback.
- Cloud status displays the server-confirmed timestamp. Device-draft status
  separately displays the successful localStorage write time, never claiming
  cloud synchronization. Storage failure is reported instead.
- Restoring a device draft retains its old revision for conflict detection.
  A completed cloud save advances the draft comparison baseline even when the
  user has already made newer edits; only matching content clears the draft.

No database schema change. Existing saved designs, version history, manual Save
and Save As continue using the same endpoints. Browser tests use mocked accounts
and responses, not customer records. Live cross-device account testing remains
a release acceptance check; no production customer design was modified here.

Tests: `components/SaveDesignButton.test.ts`,
`components/design/DesignDraftRecovery.test.ts`, and the existing API revision
and version-restore tests. Device backups remain local to that browser; they do
not provide cross-device recovery until cloud saving succeeds.
