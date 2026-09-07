# Fixed-Version Design Sharing

## Deployment

No SQL migration or schema change is required. Provision a **private** Supabase
Storage bucket named `design-shares`, with `application/json` allowed and a
4 MiB file limit (the signed source snapshot itself is limited to 2 MiB).
The coordinator provisions the bucket; application code never creates it.
Do not grant `anon` or `authenticated` any Storage object policies for this
bucket. Inspect existing broad policies as well as bucket-specific policies.
Never make this bucket public or generate signed Storage URLs.

Required server environment: `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
Snapshot verification uses the existing `MODEL_SNAPSHOT_SIGNING_KEY` if set,
otherwise the service-role key. Keep any configured previous signing keys when
rotating keys. No database password, database URL or management token is needed.
Creation uses the existing `checkIpRateLimit` helper, keyed by verified owner ID
(`design-share-owner`), with 30 attempts/day and HTTP 429 above that limit.
Configure the existing Upstash Redis environment to enforce this across instances.
The shared helper intentionally fails open if Redis is missing or unavailable;
this feature preserves that repository policy. Revocation is never rate-limited.

## Caller Contract

`ShareDesignButton` accepts `savedDesignId`, `savedRevision` (exact
`designs.updated_at` string), and `hasUnsavedChanges`. The latter defaults to
true: publication is disabled unless the caller explicitly establishes that
the displayed signed model and all unsubmitted form inputs match the saved
revision. Unverified/legacy parameter-only designs must be saved again first.
Use the saved snapshot match, not simply the presence of `designId` in the URL.
Existing `category`/`defaults` props are accepted for compatibility but never
used to construct a share. The main design page is owned by the coordinator.
Pass these same three props through MobileShell for its mobile sharing entry.
The button captures `input/change` only within `form[data-design-form]` and
accepts `wooden-ren:design-saved` only when its `id/fingerprint/revision/search`
matches current geometry parameters and pending form values. Viewing-only URL
changes do not clear pending edits; an in-flight stale save cannot authorize a
different on-screen model. The latest successful save revision takes precedence
while the server props catch up. Desktop/mobile dialogs have distinct IDs.

## Persistence and Security

- `publications/<256-bit-random-token>.json`: immutable, privacy-filtered geometry
  plus private owner/design/revision metadata. Uploads never overwrite.
- `owners/<owner>/<design>/<token>.json`: private management index, written
  first so a partial publication cannot become an undiscoverable active link.
- `revocations/<token>.json`: immutable owner-checked revocation marker. Never
  delete these markers while the corresponding publication exists.
- All reads use the server credential, `no-store`, and unique query strings to
  avoid stale private Storage CDN responses. Revocation lookup errors fail closed.
- Publication verifies ownership and the signed saved revision, never accepts
  client geometry, and does not modify the saved design or its parameters.
- Management is paginated (10 index entries per request, at most 20 object reads).
  Revoked/incomplete entries may produce empty pages with a next offset.
- Public responses contain only allowlisted geometry, no signing envelopes,
  customer names, notes, private record IDs, or owner information.
- Version-2 `constructionCut` machining coordinates are validated by the shared
  `constructionCutBox` helper and projected to numeric coordinates/half-extents
  and the depth-axis enum; nested metadata is excluded and invalid cuts fail closed.
- Public HTML is only a shell. Geometry comes from the uncached token API,
  rechecked every 15 seconds; hidden/offline/restored pages discard it and
  reauthorize. Failed requests remove geometry; a 25-second lease bounds stalled
  requests. Revocation prevents subsequent authorized reads, but cannot erase
  geometry already downloaded or screenshots taken by recipients.
- No share token authorizes editing, saving, paid exports or private record access.
  The viewer uses the existing geometry renderer, not the editable design page.

## Verification

Run `npx vitest run lib/design-sharing` and `npx tsc --noEmit`.
Browser fixtures: `npx tsx lib/design-sharing/browser-smoke.ts <local-origin>`.
The script never creates live publications; it intercepts the share API and
checks desktop/mobile nonblank and rotated pixels, revocation/reload, explicit
creation, pending-form guards and clipboard fallback. Screenshots go to `/tmp`.
Before release, verify anonymous Storage download/list/write are denied and test
create/view/revoke using a disposable authenticated owned signed design.
Unknown/revoked token API responses must be 404 with `Cache-Control: no-store`;
Storage/configuration failures must return generic 503 responses.

Explicit live-provider probe:
`npx tsx lib/design-sharing/live-smoke.ts --live --origin=http://localhost:3115`.
It uses synthetic UUIDs/signed geometry, substitutes only `ownedDesign`, and
uses the real private Storage adapter plus local public API. No customer DB
rows are read/written. A finally block removes exactly its publication, owner
index and revocation marker and verifies the publication is gone. It also
checks anonymous list/download isolation. Without `--live` it refuses to write.
