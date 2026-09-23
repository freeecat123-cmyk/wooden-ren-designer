# Integrated Blueprint Upgrade

Approved in chat on 2026-09-07. Execute continuously through verification and
deployment; do not ask again for ordinary implementation choices.

## Scope and Compatibility

1. Review all 11 residual collision cases, separating real defects from conservative
   bounds. Correct defects without erasing evidence or blanket exemptions.
2. Share the renderer's machining primitives with export; keep simplified printable
   models distinct from dimensionally accurate machining output.
3. Add explicit fixed-version, read-only, revocable design sharing. Never expose
   owner identity, customer data, private record access, or signing credentials.
4. Organize workbench settings on desktop/mobile while retaining existing parameter
   names, history, dependencies, defaults, saving and entitlement behavior.

Legacy construction is version 1. Revised construction is version 2. Direct
template defaults stay version 1 for compatibility. Newly opened blank designs
may start version 2; saved records and parameterized legacy URLs remain version 1
unless explicitly upgraded. Signed snapshots remain authoritative. Selecting the
new construction is an edit and must participate in undo/save/restore.

Approved construction: photo-frame glass and backer share the rear rebate, with
matching machining and cut sizes; Chinese-cabinet rails use inside-post shoulder
spans with tenons separately counted. No silent writes to customer designs.

## Acceptance

- Red/green tests and deliberately broken geometry controls for fixes.
- Legacy model fingerprints unchanged and version 2 tested independently.
- All output paths use the selected model; unsupported machining is explicit.
- Share creation authenticated, owner-scoped, immutable, privacy-filtered, revocable;
  revoked/unknown tokens fail closed, even when stale caches exist.
- Real desktop/iPhone interactions and nonblank rotating model pixel checks.
- Full verify/build, specific-file commits, both CI checks and deployment verified.
